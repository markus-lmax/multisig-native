#!/bin/bash

# This script verifies that the on-chain program matches the local source code.
set -e

# --- Configuration ---
PROGRAM_ID=$1
# The name of the program's .so file, derived from the Cargo.toml package name.
PROGRAM_SO_NAME="multisig_native.so"
# Directory where the local verifiable build is output.
LOCAL_BUILD_DIR="program/target/so"
# Temporary directory for the on-chain program dump.
ON_CHAIN_DUMP_DIR="on-chain-dump"
ON_CHAIN_PROGRAM_FILE="$ON_CHAIN_DUMP_DIR/$PROGRAM_SO_NAME"
LOCAL_PROGRAM_FILE="$LOCAL_BUILD_DIR/$PROGRAM_SO_NAME"

# --- Validation ---
if [ -z "$PROGRAM_ID" ]; then
    echo "Usage: $0 <PROGRAM_ID>"
    echo "  <PROGRAM_ID>: The public key of the program deployed on the cluster."
    exit 1
fi

# --- Main ---

# 1. Build the local source code verifiably.
echo "--- Building local source code... ---"
./build-verifiable.sh
echo "Local build complete."

# 2. Dump the on-chain program.
echo
echo "--- Dumping on-chain program: $PROGRAM_ID ---"
rm -rf "$ON_CHAIN_DUMP_DIR"
mkdir -p "$ON_CHAIN_DUMP_DIR"
solana program dump "$PROGRAM_ID" "$ON_CHAIN_PROGRAM_FILE"
echo "On-chain program dumped to $ON_CHAIN_PROGRAM_FILE"

# 3. Compare the builds.
echo
echo "--- Comparing builds... ---"

if [ ! -f "$LOCAL_PROGRAM_FILE" ]; then
    echo "❌ Error: Local build artifact not found at $LOCAL_PROGRAM_FILE"
    exit 1
fi

if [ ! -f "$ON_CHAIN_PROGRAM_FILE" ]; then
    echo "❌ Error: On-chain program dump not found at $ON_CHAIN_PROGRAM_FILE"
    exit 1
fi

LOCAL_HASH=$(sha256sum "$LOCAL_PROGRAM_FILE" | awk '{ print $1 }')
ON_CHAIN_HASH=$(sha256sum "$ON_CHAIN_PROGRAM_FILE" | awk '{ print $1 }')

echo "Local build hash:    $LOCAL_HASH"
echo "On-chain build hash: $ON_CHAIN_HASH"
echo

# 4. Report result.
if [ "$LOCAL_HASH" == "$ON_CHAIN_HASH" ]; then
    echo "✅ Verification successful: On-chain program matches local source code."
    # Clean up the downloaded program file on success.
    rm -rf "$ON_CHAIN_DUMP_DIR"
    exit 0
else
    echo "❌ Verification failed: On-chain program does not match local source code."
    echo "  The downloaded on-chain program is available at: $ON_CHAIN_PROGRAM_FILE"
    exit 1
fi
