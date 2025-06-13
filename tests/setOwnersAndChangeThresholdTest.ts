import {describe, test} from "node:test";
import {Keypair, PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";

describe("set owners", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("should change owners of multisig and threshold", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey];

    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, newOwners, 1);
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, setOwnersAndChangeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);


    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], 1);
    assert.deepEqual(actualMultisig["owners"], newOwners.map(owner => Array.from(owner.toBytes())));
    assert.strictEqual(actualMultisig["owner_set_seqno"], 1);
  });

  // TODO backfill remaining tests from original multisig

  // TODO adapt these tests
  // test("should not allow to set owners without proposing a transaction", async () => {
  //   const multisig = await dsl.createMultisig(2, 3);
  //   const newOwners = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
  //   const setOwners = dsl.createSetOwnersInstruction(multisig, newOwners);
  //
  //   try {
  //     const txMeta = await dsl.createAndProcessTx([setOwners], dsl.programTestContext.payer);
  //     fail("Should have failed to execute transaction");
  //   } catch (e) {
  //     assert(e.message.startsWith("Signature verification failed."));
  //   }
  // });
  //
  // test("should not allow owners to be changed without passing in correct multisig signer", async () => {
  //   const multisig = await dsl.createMultisig(2, 3);
  //   const [ownerA, ownerB, ownerC] = multisig.owners;
  //   const newOwners = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
  //
  //   const setOwnersUsingPayer = dsl.createSetOwnersInstructionManualSigner(dsl.programTestContext.payer.publicKey, multisig.address, newOwners);
  //   const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersUsingPayer], multisig.address);
  //   await dsl.approveTransaction(ownerB, multisig.address, txAddress);
  //   let txResult = await dsl.executeTransaction(txAddress, setOwnersUsingPayer, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
  //   assert.strictEqual(txResult.result, "Error processing Instruction 0: Provided seeds do not result in a valid address");
  //
  //   const setOwnersUsingOwner = dsl.createSetOwnersInstructionManualSigner(ownerC.publicKey, multisig.address, newOwners);
  //   const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [setOwnersUsingOwner], multisig.address);
  //   await dsl.approveTransaction(ownerB, multisig.address, txAddress2);
  //   let txResult2 = await dsl.executeTransaction(txAddress2, setOwnersUsingOwner, multisig.signer, multisig.address, ownerC, ownerA.publicKey);
  //   assert.strictEqual(txResult2.result, "Error processing Instruction 0: Provided seeds do not result in a valid address");
  // });
});
