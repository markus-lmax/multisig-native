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

    const logs = txMeta.logMessages;
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
});
