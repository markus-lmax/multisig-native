# LMAX Solana Multisig Contract - Native

## Overview

A multisig contract to execute arbitrary Solana transactions.
This program is a re-implementation of [LMAX Multisig](https://github.com/LMAX-Exchange/multisig) which does not use the Anchor framework.
It can be used to allow a multisig to govern anything a regular Pubkey can govern. One can use the multisig as a BPF program upgrade authority, a mint authority, etc.

### Usage

To use, one must first create a `Multisig` account, specifying two important parameters:

1. Owners - the set of addresses that sign transactions for the multisig.
2. Threshold - the number of signers required to execute a transaction.

Once the `Multisig` account is created, one can create a `Transaction` account, specifying the parameters for a normal
Solana transaction.

To sign, owners should invoke the `approve` instruction, and finally, the `execute_transaction`, once enough
(i.e. `threshold`) of the owners have signed.

To alter the owners or signing threshold, a transaction to call the relevant function must be created using the
multisig, signed by the existing owners, and executed.

To cancel a transaction only a single signer is needed (as with execute); for attack implications see below.

### Attacks

If one of the owner keys is compromised then that key could be used to propose new transactions, execute signed
transactions, and cancel transactions.

- Proposing transactions would not really achieve anything and would cost the attacker money.
- Executing transactions would only be possible if they were signed by enough owners, in which case they are presumably
  safe to execute, so again this would have limited negative effect.
- Cancelling transactions could be quite disruptive, so this would be a viable denial of service attack.

The solution to a compromised key would be to call the change_owners function, but this involves proposing a
transaction, which could be canceled with the compromised key.  The cancel is only possible if the attacker can
arrange to get the cancel function executed between the propose and the execute functions being called.  This is
difficult but theoretically possible.  It can be blocked if the propose, approve, and execute functions are called in
the same transaction.

However, transactions have a maximum size (1232) so there is a limited number of approvals you can cram into a single
transaction.  The test case `should propose, sign and execute changing owners of multisig within one transaction` in
`multisigSetOwnerTest` demonstrates that a signing threshold of more than 4 owners prohibits the calling of propose,
approve, and execute in a single transaction.  However, a signature regime of 4 in 9 signers is possible and this seems
sufficient to cover most normal usages.

## Development

- install Rust, see https://doc.rust-lang.org/cargo/getting-started/installation.html
- install Solana, see https://solana.com/docs/intro/installation
- install pnpm, see https://pnpm.io/installation
- `pnpm install`: install dependencies (should only be required once unless you add to `package.json`)
- `pnpm build`: (re)build the multisig program
- `pnpm test`: run all tests
- `pnpm build-and-test`: (re)build the multisig program and run all tests 

## Verifiable Builds

`pnpm build-verifiable` builds the program inside a Docker container to produce a deterministic artifact.
This ensures that anyone with the same source code can reproduce the exact same `.so` binary, regardless of their local environment.

`pnpm verify <PROGRAM_ID>` runs a verifiable build, dumps the on-chain program for the given program ID,
and compares their SHA-256 hashes to confirm the deployed program matches the local source code.

Both scripts live in `scripts/` and require Docker to be installed.

For local testing, you can spin up a local validator with solana-test-validator, deploy to it, then verify:                                                                                                                                                                                                                      █
```
# Terminal 1:
solana-test-validator

# Terminal 2:
solana config set --url localhost
solana program deploy ./program/target/so/multisig_native.so
# note the printed program ID, then:
pnpm verify <PROGRAM_ID>
```

