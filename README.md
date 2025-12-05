# Getting started

- install Rust, see https://doc.rust-lang.org/cargo/getting-started/installation.html
- install Solana, see https://solana.com/docs/intro/installation
- install pnpm, see https://pnpm.io/installation
- `pnpm install`
- `pnpm {build|test|build-and-test}`

# TODOs

- is the method to close transaction accounts correct?
- some methods currently only pass in the multisig, not the multisig_signer as well - need to add the latter in order to re-implement the following anchor constraint
  (extract relevant code from create_multisig into common.rs?): 
```
pub struct Auth<'info> {
  #[account(mut)]
  multisig: Box<Account<'info, Multisig>>,
  #[account(seeds = [multisig.key().as_ref()], bump = multisig.nonce)]
  multisig_signer: Signer<'info>,
  }
```
- equivalent of `anchor build --verifiable`?
- publish idl using Shank (see https://github.com/solana-developers/program-examples/tree/main/tools/shank-and-solita/native)
- why was threshold of type u64 in the anchor impl? (changed to u8 for now, avoids having to use BN on the TS/test side)
- (low prio): update borsh (ts) to latest (needs adapting of schema defs)
