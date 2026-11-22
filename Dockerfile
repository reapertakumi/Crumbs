# syntax=docker/dockerfile:1

# ---- build ----
# Runs on the build machine's own CPU and cross-compiles for the target
# (Crumbs is pure Go, no CGO), so building the arm64 image for the Pi on
# GitHub's x86 runners is fast and needs no emulation.
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
ARG TARGETOS TARGETARCH
RUN apk add --no-cache ca-certificates
WORKDIR /src
COPY . .
# go mod tidy writes go.sum if it is missing; the caches make rebuilds fast.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/crumbs .

# ---- run: just the binary and CA certificates ----
FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /out/crumbs /crumbs
ENV DATA_DIR=/data \
    ADDR=:9099 \
    HTTPS_ADDR=:9443
EXPOSE 9099 9443
VOLUME /data
ENTRYPOINT ["/crumbs"]
