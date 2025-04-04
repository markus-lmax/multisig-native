import {describe, test} from "node:test";
import {PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";

describe("cancel transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("should let owner cancel transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    await dsl.assertBalance(ownerA.publicKey, 0);

    await dsl.cancelTransaction(transactionAddress, multisig.address, ownerB, ownerA.publicKey);

    await dsl.assertBalance(ownerA.publicKey, 1_162_320); // this is the rent exemption amount
    // TODO rent exemption amount is 2_108_880 for anchor version, probably because I use "safe delete" which leaves around the following for the TX account:
    // {"executable":false,"owner":"11111111111111111111111111111111","lamports":890880,"data":{},"rentEpoch":18446744073709552000}
    // -> try closing with the "unsafe" variant that is already used in execute_transaction.rs

    const transactionAccountInfo = await dsl.programTestContext.banksClient.getAccount(transactionAddress, "confirmed");
    assert.strictEqual(transactionAccountInfo.data.length, 0);
  });

  // TODO port remaining tests from multisigCancelTransactionTest.js
});
