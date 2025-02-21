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
    const createMultisig = createCreateMultisigInstruction(
      this.programId, threshold, owners, useInvalidNonce ? nonce - 1 : nonce, multisig.publicKey, multisigSigner, payer.publicKey
    );
    const txMeta = await this.createAndProcessTx([createMultisig], payer, [multisig]);

    if (initialBalance > 0) {
      const systemTransfer = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        lamports: initialBalance,
        toPubkey: multisigSigner,
      })
      await this.createAndProcessTx([systemTransfer], payer);
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
    const transactionAccount = transactionAddress ? transactionAddress : Keypair.generate();
    const proposeTx = createProposeTransactionInstruction(multisig,
        transactionAccount.publicKey,
        proposer.publicKey,
        this.programTestContext.payer.publicKey,
        this.programId,
        instructions,
        proposerIsSigner,
        systemProgramId);
    const additionalSigners = proposerIsSigner ? [proposer, transactionAccount] : [transactionAccount];
    let txMeta = await this.createAndProcessTx([proposeTx], this.programTestContext.payer, additionalSigners);
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
    let approve = createApproveTransactionInstruction(multisig, transactionAddress, approver.publicKey, this.programId);
    return this.createAndProcessTx([approve], this.programTestContext.payer, [approver]);
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
    const execute = createExecuteTransactionInstruction(
        multisigAddress, multisigSigner, txAccount, refundee, executor.publicKey, dedupedAccounts, this.programId);
    return await this.createAndProcessTx([execute], this.programTestContext.payer, [executor]);
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

    const fundMintOwner = SystemProgram.transfer({
      fromPubkey: this.programTestContext.payer.publicKey,
      lamports: initialSolBalance,
      toPubkey: mintOwner.publicKey,
    });
    await this.createAndProcessTx([fundMintOwner], this.programTestContext.payer);

    const mintAccountKeypair = Keypair.generate();
    const rent = await this.programTestContext.banksClient.getRent();
    const createMintAccount = SystemProgram.createAccount({
      fromPubkey: mintOwner.publicKey,
      newAccountPubkey: mintAccountKeypair.publicKey,
      space: MINT_SIZE,
      lamports: Number(rent.minimumBalance(BigInt(MINT_SIZE))),
      programId: TOKEN_PROGRAM_ID,
    });
    const initMintAccount = createInitializeMint2Instruction(
        mintAccountKeypair.publicKey, decimals, mintOwner.publicKey, mintOwner.publicKey, TOKEN_PROGRAM_ID);
    await this.createAndProcessTx([createMintAccount, initMintAccount], mintOwner, [mintAccountKeypair]);

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

  async createAndProcessTx(instructions: TransactionInstruction[], payer: Keypair, additionalSigners: Keypair[] = []): Promise<BanksTransactionResultWithMeta> {
    const tx = new Transaction();
    const [latestBlockhash, _blockHeight] = await this.programTestContext.banksClient.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash;
    instructions.forEach(ix => tx.add(ix));
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

  async proposeSignAndExecuteTransaction(
      proposer: Keypair,
      signers: Array<Keypair>,
      instructions: Array<TransactionInstruction>,
      multisigSigner: PublicKey,
      multisigAddress: PublicKey,
      executor: Keypair,
      refundee: PublicKey
  ) {
    const txAccount = Keypair.generate();
    const propose = createProposeTransactionInstruction(multisigAddress, txAccount.publicKey, proposer.publicKey,
        this.programTestContext.payer.publicKey, this.programId, instructions, true, SystemProgram.programId);

    const approvals = await Promise.all(signers.map(async signer =>
        createApproveTransactionInstruction(multisigAddress, txAccount.publicKey, signer.publicKey, this.programId)
    ));

    const accounts = instructions.flatMap(ix =>
        ix.keys.map((meta) => meta.pubkey.equals(multisigSigner) ? {...meta, isSigner: false} : meta)
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
    const execute = createExecuteTransactionInstruction(multisigAddress, multisigSigner,
        txAccount.publicKey, refundee, executor.publicKey, dedupedAccounts, this.programId);

    return await this.createAndProcessTx([propose, ...approvals, execute], this.programTestContext.payer, [txAccount, proposer, ...signers]);
  }
}
