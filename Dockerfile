# browser-mcp — Docker container for Browser MCP native Rust server

FROM rust:1-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /usr/src/browser-mcp
COPY Cargo.toml Cargo.lock ./
COPY crates/browser-mcp-server ./crates/browser-mcp-server
COPY extension ./extension
WORKDIR /usr/src/browser-mcp/crates/browser-mcp-server
RUN cargo build --release

FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /usr/src/browser-mcp/crates/browser-mcp-server/target/release/browser-mcp /usr/local/bin/browser-mcp

ENTRYPOINT ["browser-mcp"]
