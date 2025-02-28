import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";

describe("set owners", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("change owners of multisig", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, newOwners);
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], multisig.threshold);
    assert.deepEqual(actualMultisig["owners"], newOwners.map(owner => Array.from(owner.toBytes())));
    assert.strictEqual(actualMultisig["owner_set_seqno"], 1);
  });

  // TODO is there some Anchor magic that makes this work?
  test.skip("allows re-expansion of owner list", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, ownerC] = multisig.owners;

    // Create and execute instruction to shrink multisig owners
    const shrinkOwnersInstruction = dsl.createSetOwnersInstruction(multisig.address, [ownerA.publicKey, ownerB.publicKey]);
    const [shrinkOwnersAddress, _txMeta1] = await dsl.proposeTransaction(ownerA, [shrinkOwnersInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, shrinkOwnersAddress);
    await dsl.executeTransaction(shrinkOwnersAddress, shrinkOwnersInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    // Create and execute instruction to re-expand multisig owners
    const expandOwnersInstruction = dsl.createSetOwnersInstruction(multisig.address, [ownerA.publicKey, ownerB.publicKey, ownerC.publicKey]);
    const [expandOwnersAddress, _txMeta2]= await dsl.proposeTransaction(ownerA, [expandOwnersInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, expandOwnersAddress);
    await dsl.executeTransaction(expandOwnersAddress, expandOwnersInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.deepStrictEqual(actualMultisig["owners"], [ownerA, ownerB, ownerC].map(o => Array.from(o.publicKey.toBytes())));
  });

  test("can propose, sign and execute changing owners of 4/9 multisig within one transaction", async () => {
    const threshold = 4;
    const multisig = await dsl.createMultisig(threshold, 9);
    const newOwner = Keypair.generate();

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, [newOwner.publicKey, ...multisig.owners.slice(1).map(owner => owner.publicKey)]);

    await dsl.proposeSignAndExecuteTransaction(multisig.owners[1], multisig.owners.slice(2, threshold + 1), [setOwners], multisig.signer, multisig.address, multisig.owners[1], multisig.owners[1].publicKey);
  })

  test("should not allow old owners to propose new transaction after ownership change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey]);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const setOwners2 = dsl.createSetOwnersInstruction(multisig.address, multisig.owners.map(owner => owner.publicKey));


    const [_, txMeta] = await dsl.proposeTransaction(ownerA, [setOwners2], multisig.address);
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x2");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: InvalidOwner (The given owner is not part of this multisig.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x2"));
  });

  test("should not allow old owners to approve new transaction after ownership change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];


    const setOwners = dsl.createSetOwnersInstruction(multisig.address, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey]);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const setOwners2 = dsl.createSetOwnersInstruction(multisig.address, multisig.owners.map(owner => owner.publicKey));
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(newOwnerA, [setOwners2], multisig.address);

    const txMeta = await dsl.approveTransaction(ownerB, multisig.address, txAddress2);
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x2");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" assertion failed - program error: InvalidOwner (The given owner is not part of this multisig.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x2"));
  });

  test("should not allow any more approvals on a transaction if owners change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey]);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);

    const transfer = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [transfer], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

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
  });

  test("should not allow transaction execution if owners change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey]);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);

    const transfer = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [transfer], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress2);
    await dsl.executeTransaction(txAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

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
  });

  test("should not allow owners to be changed by non multisig signer", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, _ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, newOwners);

    const [_a, txMeta1] = await dsl.proposeTransactionWithProposerNotSigner(ownerA, [setOwners], multisig.address);
    assert.strictEqual(txMeta1.result, "Error processing Instruction 0: custom program error: 0x3");

    const [_b, txMeta2] = await dsl.proposeTransaction(newOwnerA, [setOwners], multisig.address);
    assert.strictEqual(txMeta2.result, "Error processing Instruction 0: custom program error: 0x2");
  });

  test("should not allow owners to be changed to empty list", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const newOwners = [];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, newOwners);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);

    const txMeta = await dsl.executeTransaction(txAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x6");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length - 5].endsWith(
        " assertion failed - program error: NotEnoughOwners (The number of owners must be greater than zero.)"
    ));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length - 1].endsWith(" failed: custom program error: 0x6"));
  });

  test("should update threshold to owners list length if new owners list is smaller than threshold", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const newOwnerA = Keypair.generate();
    const newOwners = [newOwnerA.publicKey];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, newOwners);
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.executeTransaction(txAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], 1, "Should have updated threshold to owners length");
    assert.deepEqual(actualMultisig["owners"], newOwners.map(owner => Array.from(owner.toBytes())), "Should have updated to new owners");
    assert.strictEqual(actualMultisig["owner_set_seqno"], 1, "Should have incremented owner set seq number");
  });

  /* TODO
  test("should not allow increasing number of owners of multisig", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC, newOwnerD] =
        [Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey, newOwnerD.publicKey];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, newOwners);

    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);

    const txMeta = await dsl.executeTransaction(txAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    assert.strictEqual(txMeta.result, "TODO number of owners cannot be increased");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith("TODO"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith("TODO"));
  });

   */
});
