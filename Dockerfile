# syntax=docker/dockerfile:1

# ---- build ----
FROM golang:1.26-alpine AS build
RUN apk add --no-cache ca-certificates
WORKDIR /src
COPY . .
# go mod tidy writes go.sum if it is missing; the caches make rebuilds fast on the Pi.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/crumbs .

# ---- run: just the binary and CA certificates ----
FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /out/crumbs /crumbs
ENV DATA_DIR=/data \
    ADDR=:9099
EXPOSE 9099
VOLUME /data
ENTRYPOINT ["/crumbs"]
