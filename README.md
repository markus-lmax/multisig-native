# Getting started

- install Rust, see https://doc.rust-lang.org/cargo/getting-started/installation.html
- install Solana, see https://solana.com/docs/intro/installation
- install pnpm, see https://pnpm.io/installation
- `pnpm install`
- `pnpm {build|test|build-and-test}`

# TODOs

- equivalent of `anchor build --verifiable`?
- publish idl using Shank (see https://github.com/solana-developers/program-examples/tree/main/tools/shank-and-solita/native)
- why was threshold of type u64 in the anchor impl? (changed to u8 for now, avoids having to use BN on the TS/test side)
- figure out how to run ts tests from intellij
- (low prio): update borsh (ts) to latest (needs adapting of schema defs) 