# ============================================
# Stage 1: Build + fetch s6-overlay
# ============================================
FROM node:lts-alpine AS build

# Install s6-overlay (multi-arch) — extracted to / so it can be copied to the
# runtime stage below.
ARG TARGETARCH
ARG S6_OVERLAY_VERSION=3.2.1.0

RUN case ${TARGETARCH} in \
      amd64) S6_ARCH=x86_64 ;; \
      arm64) S6_ARCH=aarch64 ;; \
      armhf) S6_ARCH=armhf ;; \
      *) S6_ARCH=${TARGETARCH} ;; \
    esac && \
    wget -O /tmp/s6-overlay-noarch.tar.xz \
      https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz && \
    wget -O /tmp/s6-overlay-arch.tar.xz \
      https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz && \
    rm /tmp/s6-overlay-*.tar.xz

# Enable Corepack to manage pnpm
RUN corepack enable

# Set up pnpm environment variables
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts

# Generate Prisma client
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm prisma generate

COPY src/protobufs ./src/protobufs
RUN pnpm postinstall

# Copy everything else and build the application
COPY . .
RUN --mount=type=cache,id=build,target=/app/node_modules/.cache \
    pnpm run build

# Prune dev dependencies for the runtime image.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# Fetch the Prisma schema-engine binary so `migrate deploy` has it at runtime.
# The @prisma/engines postinstall that downloads it is allow-listed in
# pnpm-workspace.yaml but skipped above by --ignore-scripts, so run it directly.
# (We can't drop --ignore-scripts wholesale: the root postinstall runs
# `buf generate`, which needs dev-only deps absent from a --prod install.)
RUN pnpm rebuild @prisma/engines

# ============================================
# Stage 2: Final runtime image (s6-supervised)
# ============================================
FROM node:lts-alpine AS final

# Set working directory
WORKDIR /app

# Prisma's migration engine needs openssl at runtime
RUN apk add --no-cache openssl && rm -rf /var/cache/apk/*

# Copy s6-overlay from the build stage
COPY --from=build /init /init
COPY --from=build /command /command
COPY --from=build /etc/s6-overlay /etc/s6-overlay
COPY --from=build /package /package

# Copy the built app and the pruned production node_modules from the build
# stage. node_modules is owned by `node` (the user each s6 service drops to) so
# the bundled Prisma schema engine is usable without a runtime download.
# `prisma` is a production dependency, so `prisma migrate deploy` is available
# to the migrations service at startup.
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts

# Copy s6 service definitions and the migration script
COPY --chown=node:node docker/s6-rc.d /etc/s6-overlay/s6-rc.d/
COPY --chown=node:node --chmod=755 docker/run-migrations.sh /app/docker/run-migrations.sh

# s6 runs as root (PID 1) and drops to the `node` user for each service
ENV NODE_ENV=production
ENV S6_CMD_WAIT_FOR_SERVICES_MAXTIME=30000
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2
ENV S6_KILL_FINISH_MAXTIME=5000
ENV S6_KILL_GRACETIME=3000

EXPOSE 9091 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9091/health || exit 1

# Signal handling
STOPSIGNAL SIGTERM

# Use s6-overlay as entrypoint: runs the `migrations` oneshot, then `app`
ENTRYPOINT ["/init"]
