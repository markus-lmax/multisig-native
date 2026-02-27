import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {fail} from "node:assert";

describe("set owners", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  await test("should change owners of multisig and threshold", async () => {
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

  await test("should not allow old owners to propose new transaction after ownership and threshold change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey], 1);
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, setOwnersAndChangeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);


    const setOwners = dsl.createSetOwnersInstruction(multisig, multisig.owners.map(owner => owner.publicKey));
    const [_, txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x2");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: InvalidOwner (The given owner is not part of this multisig.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x2"));
  });

  await test("should not allow old owners to approve new transaction after ownership change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];


    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey], 1);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, setOwnersAndChangeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const setOwners2 = dsl.createSetOwnersInstruction(multisig, multisig.owners.map(owner => owner.publicKey));
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(newOwnerA, [setOwners2], multisig.address);

    const txMeta = await dsl.approveTransaction(ownerB, multisig.address, txAddress2);
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x2");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: InvalidOwner (The given owner is not part of this multisig.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x2"));
  });

  await test("should not allow any more approvals on a transaction if owners and threshold change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey], 1);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThreshold], multisig.address);

    const transfer = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [transfer], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, setOwnersAndChangeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const transactionAccount = await dsl.getTransactionAccount(txAddress2);
    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(transactionAccount["owner_set_seqno"], 0, "Owner set sequence number should not have updated");
    assert.strictEqual(actualMultisig["owner_set_seqno"], 1, "Should have incremented owner set seq number");

    const txMeta = await dsl.approveTransaction(newOwnerB, multisig.address, txAddress2);
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x5");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(
        " assertion failed - program error: InvalidOwnerSetSequenceNumber (The owner set sequence attributes of the multisig account and transaction account must match.)"
    ));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x5"));
  })

  await test("should not allow transaction execution if owners and threshold change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey], 1);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThreshold], multisig.address);

    const transfer = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [transfer], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress2);
    await dsl.executeTransaction(txAddress, setOwnersAndChangeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    let txAccount = await dsl.getTransactionAccount(txAddress2);
    let actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(txAccount["owner_set_seqno"], 0, "Owner set sequence number should not have updated");
    assert.strictEqual(actualMultisig["owner_set_seqno"], 1, "Should have incremented owner set seq number");

    const txMeta = await dsl.executeTransaction(txAddress2, transfer, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x8");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(
        " assertion failed - program error: InvalidExecutor (The executor must be a signer and an owner of this multisig.)"
    ));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x8"));
  })

  await test("should not allow owners amd threshold to be changed by non multisig signer", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, _ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey];

    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, newOwners, 1);

    const [_a, txMeta1] = await dsl.proposeTransactionWithProposerNotSigner(ownerA, [setOwnersAndChangeThreshold], multisig.address);
    assert.strictEqual(txMeta1.result, "Error processing Instruction 0: custom program error: 0x3");

    const [_b, txMeta2] = await dsl.proposeTransaction(newOwnerA, [setOwnersAndChangeThreshold], multisig.address);
    assert.strictEqual(txMeta2.result, "Error processing Instruction 0: custom program error: 0x2");
  });

  await test("should not allow owners to be changed to empty list", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const newOwners = [];

    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, newOwners, 1);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);

    const txMeta = await dsl.executeTransaction(txAddress, setOwnersAndChangeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x6");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length - 5].endsWith(
        " assertion failed - program error: NotEnoughOwners (The number of owners must be greater than zero.)"
    ));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length - 1].endsWith(" failed: custom program error: 0x6"));
  })

  await test("should not allow threshold larger than owners list length", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB] = [Keypair.generate(), Keypair.generate()];

    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, [newOwnerA.publicKey, newOwnerB.publicKey], 3);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThreshold], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);

    const txMeta = await dsl.executeTransaction(txAddress, setOwnersAndChangeThreshold, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x0");
    assert.ok(txMeta.meta.logMessages.includes("Program log: assertion failed - program error: InvalidThreshold (Threshold must be less than or equal to the number of owners and greater than zero.)"))
  });

  await test("should not allow to set owners and change threshold without proposing a transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const newOwners = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
    const setOwnersAndChangeThreshold = dsl.createSetOwnersAndChangeThresholdInstruction(multisig, newOwners, 1);

    try {
      await dsl.createAndProcessTx([setOwnersAndChangeThreshold], dsl.programTestContext.payer);
      fail("Should have failed to execute transaction");
    } catch (e) {
      assert(e.message.startsWith("Signature verification failed."));
    }
  });

  await test("should not allow owners and threshold to be changed without passing in correct multisig signer", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, ownerC] = multisig.owners;
    const newOwners = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];

    const setOwnersAndChangeThresholdUsingPayer = dsl.createSetOwnersAndChangeThresholdInstructionManualSigner(
        dsl.programTestContext.payer.publicKey, multisig.address, newOwners, 1
    );
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThresholdUsingPayer], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    let txResult = await dsl.executeTransaction(txAddress, setOwnersAndChangeThresholdUsingPayer, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    assert.strictEqual(txResult.result, "Error processing Instruction 0: Provided seeds do not result in a valid address");

    const setOwnersAndChangeThresholdUsingOwner = dsl.createSetOwnersAndChangeThresholdInstructionManualSigner(
        ownerC.publicKey, multisig.address, newOwners, 1
    );
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [setOwnersAndChangeThresholdUsingOwner], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress2);
    let txResult2 = await dsl.executeTransaction(txAddress2, setOwnersAndChangeThresholdUsingOwner, multisig.signer, multisig.address, ownerC, ownerA.publicKey);
    assert.strictEqual(txResult2.result, "Error processing Instruction 0: Provided seeds do not result in a valid address");
  });
});
