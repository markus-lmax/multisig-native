- install pnpm, see https://pnpm.io/installation
- `pnpm install`
- `pnpm {build|test|build-and-test}`

- TODO equivalent of `anchor build --verifiable`?
- TODO remove duplication of Assignable
- TODO why was threshold of type u64 in the anchor impl? (changed to u8 for now, avoids having to use BN on the TS/test side)
- TODO (low prio): update borsh (ts) to latest (needs adapting of schema defs) 