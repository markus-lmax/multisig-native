import {describe, test} from "node:test";
import {PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";
import {Transaction} from "../ts/state/transaction";

describe("approve transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);
  async function getTransactionAccount(address: PublicKey): Promise<Transaction>
  {
    const transactionAccountInfo = await context.banksClient.getAccount(address);
    assert.isNotNull(transactionAccountInfo);
    return Transaction.deserialize(transactionAccountInfo?.data);
  }

  test("approve transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const txMeta = await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    const logs = txMeta.meta.logMessages;
    assert(logs[0].startsWith(`Program ${programId}`));
    assert.strictEqual(logs[logs.length-3], "Program log: invoke approve_transaction");
    assert.strictEqual(logs[logs.length-1], `Program ${programId} success`);

    let transactionAccount: Transaction = await getTransactionAccount(transactionAddress);
    assert.deepStrictEqual(transactionAccount["signers"], [true, true, false], "Both ownerA and ownerB should have approved");
  });
});
