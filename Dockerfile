# ==============================================================================
# Build Stage
#
# This stage installs all dependencies (including dev), builds the TypeScript
# source code into JavaScript, and prepares the production assets.
#
# Pinned to $BUILDPLATFORM rather than the target platform: `bun run build` emits
# JavaScript, and only `dist/` crosses into the production stage.
# Built for the target instead, the non-native leg of a
# `--platform linux/amd64,linux/arm64` build runs under QEMU, where bun >= 1.4
# aborts with a JavaScriptCore allocator assertion and fails the multi-arch push.
#
# The constraint this assumes: the build stage produces platform-independent
# output. A stage that compiles a native addon needs the target-arch toolchain
# and cannot cross-compile this way — drop the flag there.
# ==============================================================================
FROM --platform=$BUILDPLATFORM oven/bun:1.4.2 AS build

WORKDIR /usr/src/app

# Copy dependency manifests for optimized layer caching
COPY package.json bun.lock ./

# Install all dependencies (including dev dependencies for building).
# The BuildKit cache mount persists Bun's global package cache across builds.
# --ignore-scripts: the build only runs tsc, which needs type declarations,
# not compiled native bindings.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

# Copy the rest of the source code
COPY . .

# Build the application
RUN bun run build


# ==============================================================================
# Production Dependencies Stage
#
# Run the scanner and OTel installer natively, cross-installing production
# dependencies for the target architecture. Only node_modules leaves this stage.
# ==============================================================================
FROM --platform=$BUILDPLATFORM oven/bun:1.4.2 AS deps

WORKDIR /usr/src/app

# Keep the release-age gate and security scanner on every production install.
COPY package.json bun.lock bunfig.toml ./
COPY --from=build /usr/src/app/node_modules/@socketsecurity/bun-security-scanner ./node_modules/@socketsecurity/bun-security-scanner

# Docker uses amd64; Bun uses x64. Both support arm64 unchanged.
ARG TARGETOS
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      amd64) echo x64 ;; \
      arm64) echo arm64 ;; \
      *) echo "Unsupported TARGETARCH '$TARGETARCH': expected amd64 or arm64" >&2; exit 1 ;; \
    esac > .bun-cpu

# Install only production dependencies, ignoring any lifecycle scripts (like 'prepare')
# that are not needed in the final production image.
# `--omit=peer` drops the framework's optional peer tiers (test runner, service
# SDKs, parsers) that Bun would otherwise auto-install. Anything this server
# actually imports belongs in its own `dependencies`, so nothing needed at
# runtime is lost.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --production --omit=peer --frozen-lockfile --ignore-scripts \
      --os="$TARGETOS" --cpu="$(cat .bun-cpu)"

# Conditionally install OpenTelemetry optional peer dependencies (Tier 3).
# Installed by default. Omit them for a leaner image at build time
# with: docker build --build-arg OTEL_ENABLED=false
COPY scripts/install-otel.ts ./scripts/
ARG OTEL_ENABLED=true
RUN --mount=type=cache,target=/root/.bun/install/cache \
    if [ "$OTEL_ENABLED" = "true" ]; then \
      bun scripts/install-otel.ts --os="$TARGETOS" --cpu="$(cat .bun-cpu)"; \
    fi

# The scanner is only needed during installation.
RUN rm -rf node_modules/@socketsecurity/bun-security-scanner


# ==============================================================================
# Production Stage
#
# Runtime-only stage: Bun runs on the target architecture at container start.
# ==============================================================================
FROM oven/bun:1.4.2-slim AS production

WORKDIR /usr/src/app
ENV NODE_ENV=production

# OCI image metadata (https://github.com/opencontainers/image-spec/blob/main/annotations.md)
ARG APP_VERSION=unknown
LABEL org.opencontainers.image.title="college-scorecard-mcp-server"
LABEL org.opencontainers.image.description="Search, compare, and analyze U.S. college data — costs, earnings, programs, and outcomes — via MCP."
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/cyanheads/college-scorecard-mcp-server"
LABEL org.opencontainers.image.version="${APP_VERSION}"

# Keep the original manifest; the OTel installer rewrites the deps-stage copy.
COPY package.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy the compiled application code from the build stage
COPY --from=build /usr/src/app/dist ./dist

# The 'oven/bun' image already provides a non-root user named 'bun'.
# We will use this existing user for enhanced security.

# Create and set permissions for the log directory, assigning ownership to the 'bun' user.
RUN mkdir -p /var/log/college-scorecard-mcp-server && chown -R bun:bun /var/log/college-scorecard-mcp-server

# Switch to the non-root user
USER bun

# Define an argument for the port, allowing it to be overridden at build time.
# The `PORT` variable is often injected by cloud environments at runtime.
ARG PORT

# Set runtime environment variables
# Note: PORT is an automatic variable in many cloud environments (e.g., Cloud Run)
ENV MCP_HTTP_PORT=${PORT:-3010}
ENV MCP_HTTP_HOST="0.0.0.0"
ENV MCP_TRANSPORT_TYPE="http"
ENV MCP_SESSION_MODE="stateless"
ENV MCP_LOG_LEVEL="info"
ENV LOGS_DIR="/var/log/college-scorecard-mcp-server"

# Expose the port the server listens on
EXPOSE ${MCP_HTTP_PORT}

# Health check — probes /healthz every 30 seconds
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.MCP_HTTP_PORT || '3010') + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# The command to start the server
CMD ["bun", "run", "dist/index.js"]
