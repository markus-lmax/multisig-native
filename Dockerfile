FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install essential dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    ca-certificates \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm 10.27.0
RUN npm install -g pnpm@10.27.0

# Install Rust 1.92.0
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.92.0
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Solana v1.18.26
RUN sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.26/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Verify the installed versions
RUN rustc --version
RUN solana --version
RUN pnpm --version

WORKDIR /workspace
