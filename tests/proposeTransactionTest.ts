import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";
import {Transaction} from "../ts/state/transaction";

describe("propose transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("create transaction account and automatically approve transaction with proposer", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, _ownerB, _ownerC] = multisig.owners;
    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    assert.strictEqual(txMeta.result, null);

    const logs = txMeta.meta.logMessages;
    assert(logs[0].startsWith(`Program ${programId}`));
    assert(logs[1].startsWith(`Program log: invoke propose_transaction - ProposeTransactionInstruction { instructions: [TransactionInstructionData { program_id:`));
    assert.strictEqual(logs[logs.length-1], `Program ${programId} success`);

    let transactionAccount: Transaction = await dsl.getTransactionAccount(transactionAddress);

    //Approved by user in index 0 not by users in index 1 or 2
    assert.deepStrictEqual(transactionAccount["signers"], [true, false, false], "Only ownerA should have approved");
    assert.deepStrictEqual(transactionAccount["multisig"], Array.from(multisig.address.toBytes()),
      "Transaction account should be linked to multisig");
    assert.deepStrictEqual(transactionAccount["instructions"][0].program_id, Array.from(transactionInstruction.programId.toBytes()),
      "Transaction program should match instruction");
    assert.deepStrictEqual(transactionAccount["instructions"][0].data, Array.from(transactionInstruction.data),
      "Transaction data should match instruction");
    assert.deepStrictEqual(transactionAccount["instructions"][0].accounts, transactionInstruction.keys.map(key => {
        return { pubkey: Array.from(key.pubkey.toBytes()), is_signer: key.isSigner, is_writable: key.isWritable };
      }), "Transaction keys should match instruction");
  });

  test("validate system program id", async () => {
    const multisig = await dsl.createMultisig(2, 3);

    const [_, txMeta] = await dsl.proposeTransactionWithIncorrectSystemProgram(multisig.owners[0], [], multisig.address);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: incorrect program id for instruction");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: IncorrectProgramId (The account did not have the expected program id)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith("failed: incorrect program id for instruction"));
  });

  // the anchor version also validates that the payer is a signer (via the `Signer` trait), but it feels this is implicit
  // (at least I did not manage to write a test that would successfully get to the propose_transaction method without the payer having signed)
  test("should not be able to propose a transaction if user is not an owner", async () => {
    const multisig = await dsl.createMultisig(2, 3);

    const [_, txMeta] = await dsl.proposeTransactionWithProposerNotSigner(multisig.owners[0], [], multisig.address);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x3");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: ProposerNotSigner (The proposer must be a signer.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x3"));
  });

  test("should not be able to propose a transaction with empty instructions", async () => {
    const multisig = await dsl.createMultisig(2, 3);

    const [_, txMeta] = await dsl.proposeTransaction(multisig.owners[0], [], multisig.address);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x4");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: MissingInstructions (The number of instructions must be greater than zero.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x4"));
  });

  test("should not be able propose 2 transactions to the same transaction address", async () => {
    const multisig = await dsl.createMultisig(2, 3);

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });

    const txKeypair: Keypair = Keypair.generate();
    const [txAddress1, txMeta1] = await dsl.proposeTransaction(multisig.owners[0], [transactionInstruction], multisig.address, txKeypair);
    // avoid posting the same TX in the same block (TODO quick and dirty, would be better to wait until block height increases instead)
    await new Promise((resolve) => setTimeout(resolve, 500));
    const [txAddress2, txMeta2] = await dsl.proposeTransaction(multisig.owners[0], [transactionInstruction], multisig.address, txKeypair);

    assert.strictEqual(txAddress1.toBase58(), txKeypair.publicKey.toBase58());
    assert.strictEqual(txMeta1.result, null);

    assert.strictEqual(txAddress2.toBase58(), txKeypair.publicKey.toBase58());
    console.log(txMeta2.result);
    assert.strictEqual(txMeta2.result, "Error processing Instruction 0: custom program error: 0x0");

    assert(txMeta2.meta.logMessages[txMeta2.meta.logMessages.length-4].endsWith(" already in use"));
    assert(txMeta2.meta.logMessages[txMeta2.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x0"));
  });
});
