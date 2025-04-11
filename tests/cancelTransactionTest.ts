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

    await dsl.assertBalance(ownerA.publicKey, 2_053_200); // this is the rent exemption amount

    const transactionAccountInfo = await dsl.programTestContext.banksClient.getAccount(transactionAddress, "confirmed");
    assert.strictEqual(transactionAccountInfo, null);
  });

  // TODO port remaining tests from multisigCancelTransactionTest.js
});
