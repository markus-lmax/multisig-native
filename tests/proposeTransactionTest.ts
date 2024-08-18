import {describe, test} from "node:test";
import {PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";

describe("propose transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("automatically approve transaction with proposer", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, _ownerB, _ownerC] = multisig.owners;
    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const logs = txMeta.logMessages;
    assert(logs[0].startsWith(`Program ${programId}`));
    assert(logs[1].startsWith(`Program log: invoke propose_transaction - ProposeTransactionInstruction { instructions: [TransactionInstructionData { program_id:`));
    assert.strictEqual(logs[logs.length-1], `Program ${programId} success`);

    // TODO more assertions

    // let transactionAccount = await program.account.transaction.fetch(transactionAddress);
    //
    // //Approved by user in index 0 not by users in index 1 or 2
    // assert.ok(transactionAccount.signers[0], "OwnerA should have approved");
    // assert.ok(!transactionAccount.signers[1], "OwnerB should not have approved");
    // assert.ok(!transactionAccount.signers[2], "OwnerC should not have approved");
    // assert.deepStrictEqual(
    //   transactionAccount.multisig,
    //   multisig.address,
    //   "Transaction account should be linked to multisig"
    // );
    // assert.ok(
    //   !transactionAccount.didExecute,
    //   "Transaction should not have been executed"
    // );
    // assert.deepStrictEqual(
    //   transactionAccount.instructions[0].programId,
    //   transactionInstruction.programId,
    //   "Transaction program should match instruction"
    // );
    // assert.deepStrictEqual(
    //   transactionAccount.instructions[0].data,
    //   transactionInstruction.data,
    //   "Transaction data should match instruction"
    // );
    // assert.deepStrictEqual(
    //   transactionAccount.instructions[0].accounts,
    //   transactionInstruction.keys,
    //   "Transaction keys should match instruction"
    // );
  });
});
