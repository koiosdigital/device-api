# Stage 1: Build the device-api application
FROM node:lts-alpine AS build

# Enable Corepack to manage pnpm
RUN corepack enable

# Set up pnpm environment variables
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Set working directory
WORKDIR /app
ENV DATABASE_URL="postgres://user:password@localhost:5432/dbname"

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts

# Generate Prisma client and protobuf files
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY buf.gen.yaml buf.yaml ./
COPY src/protobufs ./src/protobufs

RUN pnpm prisma generate && \
    pnpm run postinstall

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

# Install runtime dependencies
RUN apk add --no-cache git

# Copy node_modules from build stage (includes all Prisma dependencies)
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
ENV REDIS_URL="redis://redis:6379"

# Copy built application from build stage
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=build --chown=appuser:appuser /app/src/generated ./src/generated
COPY --from=build --chown=appuser:appuser /app/prisma ./prisma
COPY --from=build --chown=appuser:appuser /app/package.json ./package.json
COPY --from=build --chown=appuser:appuser /app/prisma.config.ts ./prisma.config.ts

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9091
USER appuser

ENTRYPOINT [ "/usr/local/bin/entrypoint.sh" ]
CMD ["node", "dist/index.js"]