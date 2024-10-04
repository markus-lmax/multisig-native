import {Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, VoteProgram} from "@solana/web3.js";
import {BanksTransactionMeta, ProgramTestContext} from "solana-bankrun";
import {createCreateMultisigInstruction, createProposeTransactionInstruction} from "./instructions";

export interface MultisigAccount {
  address: PublicKey;
  signer: PublicKey;
  nonce: number;
  owners: Keypair[];
  threshold: number;
  txMeta: BanksTransactionMeta;
}

export class MultisigDsl {
  readonly programId: PublicKey;
  readonly programTestContext: ProgramTestContext;

  constructor(programId: PublicKey, programTestContext: ProgramTestContext) {
    this.programId = programId;
    this.programTestContext = programTestContext;
  }

  async createMultisig(threshold: number, numberOfOwners: number, initialBalance: number = 0): Promise<MultisigAccount> {
    const owners: Keypair[] = Array.from({length: numberOfOwners}, (_, _n) => Keypair.generate());
    return await this.createMultisigWithOwners(threshold, owners, initialBalance);
  }

  async createMultisigWithOwners(threshold: number,
                                 owners: Keypair[],
                                 initialBalance: number = 0,
                                 useInvalidNonce: boolean = false): Promise<MultisigAccount> {
    const multisig = Keypair.generate();
    const [multisigSigner, nonce] = PublicKey.findProgramAddressSync(
      [multisig.publicKey.toBuffer()],
      this.programId
    );
    const payer = this.programTestContext.payer;
    const ix = createCreateMultisigInstruction(
      this.programId, threshold, owners, useInvalidNonce ? nonce - 1 : nonce, multisig.publicKey, multisigSigner, payer.publicKey
    );
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = this.programTestContext.lastBlockhash;
    tx.sign(payer, multisig);

    const txMeta = await this.programTestContext.banksClient.processTransaction(tx);

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

  async createMultisigWithBadNonce(): Promise<MultisigAccount> {
    return this.createMultisigWithOwners(2, [Keypair.generate(), Keypair.generate()], 0, true);
  }

  async proposeTransaction(proposer: Keypair,
                           instructions: TransactionInstruction[],
                           multisig: PublicKey,
                           transactionAddress?: Keypair,
                           systemProgramId: PublicKey = SystemProgram.programId): Promise<[PublicKey, BanksTransactionMeta]> {
    let transactionAccount = transactionAddress ? transactionAddress : Keypair.generate();
    let ix = createProposeTransactionInstruction(multisig,
        transactionAccount.publicKey,
        proposer.publicKey,
        this.programTestContext.payer.publicKey,
        this.programId,
        instructions,
        systemProgramId);
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = this.programTestContext.lastBlockhash;
    tx.sign(this.programTestContext.payer, proposer, transactionAccount);

    let txMeta = await this.programTestContext.banksClient.processTransaction(tx);

    return [transactionAccount.publicKey, txMeta];
  }

  async proposeTransactionWithIncorrectSystemProgram(proposer: Keypair,
                                                     instructions: TransactionInstruction[],
                                                     multisig: PublicKey): Promise<[PublicKey, BanksTransactionMeta]> {
    return this.proposeTransaction(proposer, instructions, multisig, Keypair.generate(), VoteProgram.programId);
  }

}
