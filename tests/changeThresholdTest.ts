import {describe, test} from "node:test";
import {PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {fail} from "node:assert";

describe("change threshold", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("should change threshold of multisig", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const changeThreshold = dsl.createChangeThresholdInstruction(multisig, 3);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, changeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], 3);
    assert.deepEqual(actualMultisig["owners"], multisig.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig["owner_set_seqno"], 0);
  });

  test("should require new threshold to be met", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, ownerC] = multisig.owners;

    const changeThresholdTo3 = dsl.createChangeThresholdInstruction(multisig, 3);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThresholdTo3], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, changeThresholdTo3, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const changeThresholdTo2 = dsl.createChangeThresholdInstruction(multisig, 2);
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [changeThresholdTo2], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress2);

    // Fail when trying to execute with the old threshold
    let txResult = await dsl.executeTransaction(txAddress2, changeThresholdTo2, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: NotEnoughSigners (The transaction must reach a minimum number of approvals.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xd");

    //Succeed when reaching the new threshold
    await dsl.approveTransaction(ownerC, multisig.address, txAddress2);
    await dsl.executeTransaction(txAddress2, changeThresholdTo2, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["threshold"], 2);
  });

  test("should update threshold for new transactions once executed", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const changeThreshold = dsl.createChangeThresholdInstruction(multisig, 1);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThreshold], multisig.address);

    // actual threshold not updated whilst tx in flight
    let inFlightThreshold = (await dsl.getMultisig(multisig.address))["threshold"];
    assert.strictEqual(inFlightThreshold, 2);

    // so we have 2 approvals
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, changeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    //The already existing transaction has now been executed and should update the threshold to 1
    let updatedThreshold = (await dsl.getMultisig(multisig.address))["threshold"];
    assert.strictEqual(updatedThreshold, 1);
  });

  test("should use new threshold on an already existing transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const changeThresholdTo1 = dsl.createChangeThresholdInstruction(multisig, 1);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThresholdTo1], multisig.address);

    const changeThresholdTo3 = dsl.createChangeThresholdInstruction(multisig, 3);
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [changeThresholdTo3], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, changeThresholdTo1, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    // threshold now updated to 1
    let updatedThreshold = (await dsl.getMultisig(multisig.address))["threshold"];
    assert.strictEqual(updatedThreshold, 1);

    // threshold should now be set to 1 meaning that transaction 2 has met the 1/3 approval required for execution, and does not need a second approval
    await dsl.executeTransaction(txAddress2, changeThresholdTo3, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    // the second threshold update transaction has now been executed and should update the threshold to 3
    let updatedThreshold2 = (await dsl.getMultisig(multisig.address))["threshold"];
    assert.strictEqual(updatedThreshold2, 3);
  });

  test("should not allow 0 threshold", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const changeThreshold = dsl.createChangeThresholdInstruction(multisig, 0);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    let txResult = await dsl.executeTransaction(txAddress, changeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: InvalidThreshold (Threshold must be less than or equal to the number of owners and greater than zero.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x0");

    let actualThreshold = (await dsl.getMultisig(multisig.address))["threshold"];
    assert.strictEqual(actualThreshold, 2);
  });

  test("should not allow threshold greater than number of owners", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const changeThreshold = dsl.createChangeThresholdInstruction(multisig, 4);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    let txResult = await dsl.executeTransaction(txAddress, changeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: InvalidThreshold (Threshold must be less than or equal to the number of owners and greater than zero.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x0");

    let actualThreshold = (await dsl.getMultisig(multisig.address))["threshold"];
    assert.strictEqual(actualThreshold, 2);
  });

  test("should not allow to change threshold without proposing a transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const changeThreshold = dsl.createChangeThresholdInstruction(multisig, 1);

    try {
      const txMeta = await dsl.createAndProcessTx([changeThreshold], dsl.programTestContext.payer);
      fail("Should have failed to execute transaction");
    } catch (e) {
      assert(e.message.startsWith("Signature verification failed."));
    }
  })

  test("should not allow threshold to be changed without passing in correct multisig signer", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, ownerC] = multisig.owners;

    const changeThresholdUsingPayer = dsl.createChangeThresholdInstructionManualSigner(dsl.programTestContext.payer.publicKey, multisig.address, 1);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [changeThresholdUsingPayer], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    let txResult = await dsl.executeTransaction(txAddress, changeThresholdUsingPayer, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    assert.strictEqual(txResult.result, "Error processing Instruction 0: Provided seeds do not result in a valid address");

    const changeThresholdUsingOwner = dsl.createChangeThresholdInstructionManualSigner(ownerC.publicKey, multisig.address, 1);
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [changeThresholdUsingOwner], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress2);
    let txResult2 = await dsl.executeTransaction(txAddress2, changeThresholdUsingOwner, multisig.signer, multisig.address, ownerC, ownerA.publicKey);
    assert.strictEqual(txResult2.result, "Error processing Instruction 0: Provided seeds do not result in a valid address");
  });

});
