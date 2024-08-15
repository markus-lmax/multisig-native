import {Keypair, PublicKey, SystemProgram, Transaction} from "@solana/web3.js";
import {BanksTransactionMeta, ProgramTestContext} from "solana-bankrun";
import {createCreateMultisigInstruction} from "./instructions";

export interface MultisigAccount {
  address: PublicKey;
  signer: PublicKey;
  nonce: number;
  owners: Array<Keypair>;
  threshold: number;
  txMeta: BanksTransactionMeta;
}

export interface TokenMint {
  owner: Keypair;
  account: PublicKey;
  decimals: number;
}

export class MultisigDsl {
  readonly programId: PublicKey;
  readonly programTestContext: ProgramTestContext;

  constructor(programId: PublicKey, programTestContext: ProgramTestContext) {
    this.programId = programId;
    this.programTestContext = programTestContext;
  }

  async createMultisig(threshold: number, numberOfOwners: number, initialBalance: number = 0): Promise<MultisigAccount> {
    const owners: Array<Keypair> = Array.from({length: numberOfOwners}, (_, _n) => Keypair.generate());
    return await this.createMultisigWithOwners(threshold, owners, initialBalance);
  }

  async createMultisigWithOwners(threshold: number, owners: Array<Keypair>, initialBalance: number = 0): Promise<MultisigAccount> {
    const multisig = Keypair.generate();
    const [multisigSigner, nonce] = PublicKey.findProgramAddressSync(
      [multisig.publicKey.toBuffer()],
      this.programId
    );

    const payer = this.programTestContext.payer;
    const ownerKeys = owners.map(owner => owner.publicKey);
    const tx = new Transaction().add(createCreateMultisigInstruction(payer.publicKey, this.programId, ownerKeys, threshold, nonce));
    tx.recentBlockhash = this.programTestContext.lastBlockhash;
    tx.sign(payer);

    const txMeta = await this.programTestContext.banksClient.processTransaction(tx);

    // TODO await this.program.methods
    //   .createMultisig(owners.map(owner => owner.publicKey), threshold, nonce)
    //   .accounts({
    //     multisig: multisig.publicKey,
    //   })
    //   .signers([multisig])
    //   .rpc();
    if (initialBalance > 0) {
      await this.programTestContext.banksClient.processTransaction(
        new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            lamports: initialBalance,
            toPubkey: multisigSigner,
          })
        )
      );
    }

    return {
      address: multisig.publicKey,
      signer: multisigSigner,
      nonce: nonce,
      owners: owners,
      threshold: threshold,
      txMeta: txMeta
    };
  }
}
