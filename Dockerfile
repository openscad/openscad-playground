# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
# The application output is platform-independent (static JS + WASM), so it is
# built once on the build platform (`$BUILDPLATFORM`). Only the tiny nginx
# runtime stage is built per target architecture. This keeps multi-arch
# builds fast without cross-compiling the toolchain.
FROM --platform=$BUILDPLATFORM node:22-bookworm AS builder

# Tooling required by the webpack libs plugin:
#   git   -> clone the bundled OpenSCAD library repositories
#   zip   -> package libraries and fonts
#   unzip -> extract the prebuilt OpenSCAD WASM archive
#   curl  -> download the prebuilt OpenSCAD WASM archive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git unzip zip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so this layer is cached across source changes.
# NOTE: NODE_ENV is intentionally *not* set to production here, otherwise npm
# would skip the devDependencies (webpack, typescript, ...) needed to build.
COPY package.json package-lock.json* ./
RUN npm install

# Build the application: downloads the WASM binary, builds all bundled
# OpenSCAD libraries, then compiles the webpack bundle into ./dist.
COPY . .
ENV CI=true \
    NODE_ENV=production
RUN npm run build:all

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Static, cache-busted-at-deploy configuration for serving the SPA.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Revision metadata (also set dynamically by the release workflow).
LABEL org.opencontainers.image.title="OpenSCAD Playground" \
      org.opencontainers.image.description="Browser-based OpenSCAD editor and renderer (WebAssembly)" \
      org.opencontainers.image.source="https://github.com/openscad/openscad-playground" \
      org.opencontainers.image.url="https://ochafik.com/openscad2" \
      org.opencontainers.image.licenses="NOASSERTION"

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
