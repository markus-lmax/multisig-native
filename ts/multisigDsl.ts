import {Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction} from "@solana/web3.js";
import {BanksTransactionMeta, ProgramTestContext} from "solana-bankrun";
import {CreateMultisig, createProposeTransactionInstruction, MultisigInstruction} from "./instructions";

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
    const createMultisig = new CreateMultisig({
      instructionDiscriminator: MultisigInstruction.CreateMultisig,
      owners: owners.map(owner => owner.publicKey.toBuffer()),
      threshold: threshold,
      nonce: useInvalidNonce ? nonce - 1 : nonce
    });
    const ix = new TransactionInstruction({
      keys: [
        {pubkey: multisig.publicKey, isSigner: true, isWritable: true},
        {pubkey: multisigSigner, isSigner: false, isWritable: false},
        {pubkey: payer.publicKey, isSigner: true, isWritable: true},
        {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      ],
      programId: this.programId,
      data: createMultisig.toBuffer(),
    });
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
                           transactionAddress?: Keypair): Promise<[PublicKey, BanksTransactionMeta]> {
    let transactionAccount = transactionAddress ? transactionAddress : Keypair.generate();
    let ix = createProposeTransactionInstruction(multisig,
      transactionAccount.publicKey,
      proposer.publicKey,
      this.programTestContext.payer.publicKey,
      this.programId,
      instructions);
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = this.programTestContext.lastBlockhash;
    tx.sign(this.programTestContext.payer, proposer, transactionAccount);

    let txMeta = await this.programTestContext.banksClient.processTransaction(tx);

    return [transactionAccount.publicKey, txMeta];
  }
}
