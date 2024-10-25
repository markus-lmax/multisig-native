import {describe, test} from "node:test";
import {PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";
import {Transaction} from "../ts/state/transaction";

describe("propose transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);
  async function getTransactionAccount(address: PublicKey): Promise<Transaction>
  {
    const transactionAccountInfo = await context.banksClient.getAccount(address);
    assert.isNotNull(transactionAccountInfo);
    return Transaction.deserialize(transactionAccountInfo?.data);
  }

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

    let transactionAccount: Transaction = await getTransactionAccount(transactionAddress);

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
  })

  // the anchor version also validates that the payer is a signer (via the `Signer` trait), but it feels this is implicit
  // (at least I did not manage to write a test that would successfully get to the propose_transaction method without the payer having signed)
  test("validate proposer is signer", async () => {
    const multisig = await dsl.createMultisig(2, 3);

    const [_, txMeta] = await dsl.proposeTransactionWithProposerNotSigner(multisig.owners[0], [], multisig.address);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x4");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: ProposerNotSigner (The proposer must be a signer.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x4"));
  })

  test("validate at least one instruction", async () => {
    const multisig = await dsl.createMultisig(2, 3);

    const [_, txMeta] = await dsl.proposeTransaction(multisig.owners[0], [], multisig.address);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x5");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: MissingInstructions (The number of instructions must be greater than zero.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x5"));
  })
});
