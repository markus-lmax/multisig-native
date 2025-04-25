import {describe, test} from "node:test";
import {PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";

describe("change threshold", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("should change threshold of multisig", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const changeThreshold = dsl.createChangeThresholdInstruction(multisig.address, 3);
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, changeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], 3);
    assert.deepEqual(actualMultisig["owners"], multisig.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig["owner_set_seqno"], 0);
  });
});
