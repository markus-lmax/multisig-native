#!/bin/bash

# This script builds the program in a Docker container to produce a verifiable build.

set -e

# The name of the Docker image to build
IMAGE_NAME="multisig-native-verifiable"

echo "Building Docker image: $IMAGE_NAME..."
docker build --network host -t "$IMAGE_NAME" .

echo "Running build in Docker container..."
docker run --network host --rm -v "$(pwd):/workspace" --workdir /workspace "$IMAGE_NAME" /bin/sh -c "pnpm install && pnpm build"

echo "Verifiable build complete. The artifacts are in program/target/so"
