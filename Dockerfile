# Stage 1: Build the device-api application
FROM node:lts-alpine AS build

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

# Copy protobuf definitions and buf configuration
COPY buf.gen.yaml buf.yaml ./
COPY src/protobufs ./src/protobufs
RUN pnpm buf generate

# Copy everything else and build the application
COPY . .
RUN --mount=type=cache,id=build,target=/app/node_modules/.cache \
    pnpm run build

# Stage 2: Final runtime image
FROM node:lts-alpine AS final

# Enable Corepack to manage pnpm
RUN corepack enable

# Set up pnpm environment variables
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -S appuser && adduser -S -G appuser appuser 
RUN chown appuser:appuser /app

# Copy built application from build stage
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=build --chown=appuser:appuser /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

RUN pnpm install --production --frozen-lockfile --ignore-scripts

EXPOSE 9091
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9091/health || exit 1

CMD ["node", "dist/index.js"]