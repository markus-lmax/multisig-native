import {Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, VoteProgram} from "@solana/web3.js";
import {BanksTransactionResultWithMeta, ProgramTestContext} from "solana-bankrun";
import {
  createApproveTransactionInstruction,
  createCreateMultisigInstruction,
  createProposeTransactionInstruction
} from "./instructions";
import {assert} from "chai";
import {Transaction as TransactionAccount} from "./state/transaction";

export interface MultisigAccount {
  address: PublicKey;
  signer: PublicKey;
  nonce: number;
  owners: Keypair[];
  threshold: number;
  txMeta: BanksTransactionResultWithMeta;
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

  async getTransactionAccount(address: PublicKey): Promise<TransactionAccount>
  {
    const transactionAccountInfo = await this.programTestContext.banksClient.getAccount(address);
    assert.isNotNull(transactionAccountInfo);
    return TransactionAccount.deserialize(transactionAccountInfo?.data);
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

    const txMeta = await this.programTestContext.banksClient.tryProcessTransaction(tx);

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
                           proposerIsSigner = true,
                           systemProgramId: PublicKey = SystemProgram.programId): Promise<[PublicKey, BanksTransactionResultWithMeta]> {
    let transactionAccount = transactionAddress ? transactionAddress : Keypair.generate();
    let ix = createProposeTransactionInstruction(multisig,
        transactionAccount.publicKey,
        proposer.publicKey,
        this.programTestContext.payer.publicKey,
        this.programId,
        instructions,
        proposerIsSigner,
        systemProgramId);
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = this.programTestContext.lastBlockhash;
    if (proposerIsSigner) {
      tx.sign(this.programTestContext.payer, proposer, transactionAccount);
    } else {
      tx.sign(this.programTestContext.payer, transactionAccount);
    }
    let txMeta = await this.programTestContext.banksClient.tryProcessTransaction(tx);

    return [transactionAccount.publicKey, txMeta];
  }

  async proposeTransactionWithIncorrectSystemProgram(proposer: Keypair,
                                                     instructions: TransactionInstruction[],
                                                     multisig: PublicKey): Promise<[PublicKey, BanksTransactionResultWithMeta]> {
    return this.proposeTransaction(proposer, instructions, multisig, Keypair.generate(), true, VoteProgram.programId);
  }

  async proposeTransactionWithProposerNotSigner(proposer: Keypair,
                                                instructions: TransactionInstruction[],
                                                multisig: PublicKey): Promise<[PublicKey, BanksTransactionResultWithMeta]> {
    return this.proposeTransaction(proposer, instructions, multisig, Keypair.generate(), false, SystemProgram.programId);
  }

  async approveTransaction(approver: Keypair,
                           multisig: PublicKey,
                           transactionAddress: PublicKey): Promise<BanksTransactionResultWithMeta> {
    let ix = createApproveTransactionInstruction(multisig,
        transactionAddress,
        approver.publicKey,
        this.programId);
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = this.programTestContext.lastBlockhash;
    tx.sign(this.programTestContext.payer, approver);

    return this.programTestContext.banksClient.tryProcessTransaction(tx);
  }

  async assertBalance(address: PublicKey, expectedBalance: number) {
    let actualBalance = await this.programTestContext.banksClient.getBalance(address, "confirmed");
    assert.strictEqual(actualBalance, BigInt(expectedBalance));
  }

  async executeTransactionWithMultipleInstructions(
      tx: PublicKey,
      ixs: Array<TransactionInstruction>,
      multisigSigner: PublicKey,
      multisigAddress: PublicKey,
      executor: Keypair,
      refundee: PublicKey) {
    const accounts = ixs.flatMap(ix =>
        ix.keys
            .map((meta) => meta.pubkey.equals(multisigSigner)? {...meta, isSigner: false} : meta)
            .concat({
              pubkey: ix.programId,
              isWritable: false,
              isSigner: false,
            })
    );
    const dedupedAccounts = accounts.filter((value, index) => {
      const _value = JSON.stringify(value);
      return index === accounts.findIndex(obj => {
        return JSON.stringify(obj) === _value;
      });
    });
    return this.programTestContext.banksClient.tryProcessTransaction(tx);

    await this.program.methods
        .executeTransaction()
        .accounts({
          multisig: multisigAddress,
          multisigSigner,
          transaction: tx,
          executor: executor.publicKey,
          refundee: refundee
        })
        .remainingAccounts(dedupedAccounts)
        .signers([executor])
        .rpc();
  }

  async executeTransaction(
      tx: PublicKey,
      ix: TransactionInstruction,
      multisigSigner: PublicKey,
      multisigAddress: PublicKey,
      executor: Keypair,
      refundee: PublicKey) {
    await this.executeTransactionWithMultipleInstructions(tx, [ix], multisigSigner, multisigAddress, executor, refundee);
  }

}
