import {Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, VoteProgram} from "@solana/web3.js";
import {BanksTransactionResultWithMeta, ProgramTestContext} from "solana-bankrun";
import {
  createApproveTransactionInstruction,
  createCreateMultisigInstruction,
  createExecuteTransactionInstruction,
  createProposeTransactionInstruction,
  createSetOwnersInstruction
} from "./instructions";
import {assert} from "chai";
import {Transaction as TransactionAccount} from "./state/transaction";
import {
  ACCOUNT_SIZE,
  AccountLayout, createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {Multisig} from "./state";

export interface MultisigAccount {
  address: PublicKey;
  signer: PublicKey;
  nonce: number;
  owners: Keypair[];
  threshold: number;
  txMeta: BanksTransactionResultWithMeta;
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
      let fundingTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            lamports: initialBalance,
            toPubkey: multisigSigner,
          })
      );
      fundingTx.recentBlockhash = this.programTestContext.lastBlockhash;
      fundingTx.sign(payer);
      await this.programTestContext.banksClient.processTransaction(fundingTx);
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

  async createMultisig(threshold: number, numberOfOwners: number, initialBalance: number = 0): Promise<MultisigAccount> {
    const owners: Keypair[] = Array.from({length: numberOfOwners}, (_, _n) => Keypair.generate());
    return await this.createMultisigWithOwners(threshold, owners, initialBalance);
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

  createSetOwnersInstruction(multisig: PublicKey, newOwners: PublicKey[]): TransactionInstruction {
    return createSetOwnersInstruction(multisig, newOwners, this.programId);
  }

  async assertBalance(address: PublicKey, expectedBalance: number) {
    let actualBalance = await this.programTestContext.banksClient.getBalance(address, "confirmed");
    assert.strictEqual(actualBalance, BigInt(expectedBalance));
  }

  async assertAtaBalance(address: PublicKey, expectedBalance: number) {
    const accountInfo = await this.programTestContext.banksClient.getAccount(address);
    const tokenAccountInfo = AccountLayout.decode(accountInfo.data);
    assert.strictEqual(tokenAccountInfo.amount, BigInt(expectedBalance));
  }

  async executeTransactionWithMultipleInstructions(
      txAccount: PublicKey,
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

    const ix = createExecuteTransactionInstruction(
        multisigAddress, multisigSigner, txAccount, refundee, executor.publicKey, dedupedAccounts, this.programId
    );
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = this.programTestContext.lastBlockhash;
    tx.sign(this.programTestContext.payer, executor);

    return await this.programTestContext.banksClient.tryProcessTransaction(tx);
  }

  async executeTransaction(
      txAccount: PublicKey,
      ix: TransactionInstruction,
      multisigSigner: PublicKey,
      multisigAddress: PublicKey,
      executor: Keypair,
      refundee: PublicKey) {
    return await this.executeTransactionWithMultipleInstructions(txAccount, [ix], multisigSigner, multisigAddress, executor, refundee);
  }

  async createTokenMint(decimals: number = 3, initialSolBalance: number = 7_000_000): Promise<TokenMint> {
    const mintOwner = Keypair.generate();

    const fundingTx = new Transaction().add(  // mintOwner is also the fee payer, need to give it funds
        SystemProgram.transfer({
          fromPubkey: this.programTestContext.payer.publicKey,
          lamports: initialSolBalance,
          toPubkey: mintOwner.publicKey,
        })
    );
    fundingTx.recentBlockhash = this.programTestContext.lastBlockhash;
    fundingTx.sign(this.programTestContext.payer);
    await this.programTestContext.banksClient.processTransaction(fundingTx);

    const mintAccountKeypair = Keypair.generate();
    const rent = await this.programTestContext.banksClient.getRent();
    const mintTx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: mintOwner.publicKey,
          newAccountPubkey: mintAccountKeypair.publicKey,
          space: MINT_SIZE,
          lamports: Number(rent.minimumBalance(BigInt(MINT_SIZE))),
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(mintAccountKeypair.publicKey, decimals, mintOwner.publicKey, mintOwner.publicKey, TOKEN_PROGRAM_ID)
    );
    mintTx.recentBlockhash = this.programTestContext.lastBlockhash;
    mintTx.sign(mintOwner, mintAccountKeypair);
    await this.programTestContext.banksClient.processTransaction(mintTx);

    return { owner: mintOwner, account: mintAccountKeypair.publicKey, decimals: decimals };
  }

  async createAta(mint: TokenMint, owner: PublicKey, initialBalance: number = 0): Promise<PublicKey> {
    const tokenAccData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
        {
          mint: mint.account,
          owner,
          amount: BigInt(initialBalance),
          delegateOption: 0,
          delegate: PublicKey.default,
          delegatedAmount: BigInt(0),
          state: 1,
          isNativeOption: 0,
          isNative: BigInt(0),
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
        },
        tokenAccData,
    );
    const ata = getAssociatedTokenAddressSync(mint.account, owner, true);
    const ataAccountInfo = {
      lamports: 1_000_000_000,
      data: tokenAccData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    };
    this.programTestContext.setAccount(ata, ataAccountInfo);

    return ata;
  }

  // TODO use this for TX creation everywhere
  async createAndProcessTransaction(payer: Keypair, instruction: TransactionInstruction, additionalSigners: Keypair[] = []): Promise<BanksTransactionResultWithMeta> {
    const tx = new Transaction();
    const [latestBlockhash] = await this.programTestContext.banksClient.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash;
    tx.add(instruction);
    tx.feePayer = payer.publicKey;
    tx.sign(payer, ...additionalSigners);
    return await this.programTestContext.banksClient.tryProcessTransaction(tx);
  }


  async getMultisig(multisigAddress: PublicKey): Promise<Multisig>
  {
    const multisigAccountInfo = await this.programTestContext.banksClient.getAccount(multisigAddress);
    assert.isNotNull(multisigAccountInfo);
    return Multisig.deserialize(multisigAccountInfo?.data);
  }

  async getTransactionAccount(address: PublicKey): Promise<TransactionAccount>
  {
    const transactionAccountInfo = await this.programTestContext.banksClient.getAccount(address);
    assert.isNotNull(transactionAccountInfo);
    return TransactionAccount.deserialize(transactionAccountInfo?.data);
  }

}
