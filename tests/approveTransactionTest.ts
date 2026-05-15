import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl, MultisigSchema} from "../ts";
import {assert} from "chai";
import {Transaction, TransactionSchema} from "../ts/state/transaction";
import {Buffer} from "node:buffer";
import * as borsh from "borsh";

describe("approve transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  await test("update signers list when an owner approves", async () => {
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
    assert(logs.some(log => log === "Program log: invoke approve_transaction"));
    assert(logs.some(log => log === `Program ${programId} success`));

    let transactionAccount: Transaction = await dsl.getTransactionAccount(transactionAddress);
    assert.deepStrictEqual(transactionAccount["signers"], [true, true, false], "Both ownerA and ownerB should have approved");
  });

  await test("should not perform instructions if not reached multisig approval threshold", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    await dsl.assertBalance(multisig.signer, 1_000_000);

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const txResult = await dsl.executeTransaction(txAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: NotEnoughSigners (The transaction must reach a minimum number of approvals.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xd");
    await dsl.assertBalance(multisig.signer, 1_000_000);
  });

  await test("should approve idempotently", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    await dsl.assertBalance(multisig.signer, 1_000_000);

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    // Approve twice with the same owner
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress);

    await dsl.executeTransaction(txAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    await dsl.assertBalance(multisig.signer, 0);
  });

  await test("should not execute transaction if same user has approved multiple times to reach the threshold", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    await dsl.assertBalance(multisig.signer, 1_000_000);

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    //Approve again with the same owner meaning still only 1/3 approval
    await dsl.approveTransaction(ownerA, multisig.address, txAddress);

    const txResult = await dsl.executeTransaction(txAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: NotEnoughSigners (The transaction must reach a minimum number of approvals.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xd");
    await dsl.assertBalance(multisig.signer, 1_000_000);
  });

  await test("should not allow non-signer to approve", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const txResult = await dsl.approveTransaction(ownerB, multisig.address, txAddress, false);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: ApproverNotSigner (The approver must be a signer.)"));
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x10");
  });

  await test("should not allow approval with read-only transaction account", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const txResult = await dsl.approveTransaction(ownerB, multisig.address, txAddress, true, false);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: ImmutableTransactionAccount (The transaction account must be writable.)"));
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x9");
  });

  await test("should not allow approval with mismatched multisig account", async () => {
    const multisigA = await dsl.createMultisig(2, 3);
    const multisigB = await dsl.createMultisig(2, 3);
    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisigA.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress, _txMeta] = await dsl.proposeTransaction(multisigA.owners[0], [transactionInstruction], multisigA.address);

    // Approve using multisigB's address but a transaction that belongs to multisigA
    const txResult = await dsl.approveTransaction(multisigB.owners[0], multisigB.address, txAddress);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: InvalidTransactionAccount (The multisig of transaction account must match the provided multisig account.)"));
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xa");
  });

  await test("should not allow non owner to approve", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, _ownerB, _ownerC] = multisig.owners;
    await dsl.assertBalance(multisig.signer, 1_000_000);

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [txAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const notAnOwner = Keypair.generate();

    const txResult = await dsl.approveTransaction(notAnOwner, multisig.address, txAddress);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: InvalidOwner (The given owner is not part of this multisig.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x2");
    await dsl.assertBalance(multisig.signer, 1_000_000);
  });

  await test("should reject a Multisig account not owned by the program", async () => {
    // Forge a Multisig account that is *not* owned by the multisig program but contains Borsh-valid Multisig data.
    const attacker = Keypair.generate();
    const fakeMultisigAddress = Keypair.generate().publicKey;
    const fakeMultisigData = Buffer.from(
        borsh.serialize(MultisigSchema, {
          owners: [attacker.publicKey.toBytes()],
          threshold: 1,
          nonce: 0,
          owner_set_seqno: 0,
          padding: [],
        }),
    );
    context.setAccount(fakeMultisigAddress, {
      lamports: 1_000_000_000,
      data: fakeMultisigData,
      owner: SystemProgram.programId,  // wrong owner: should be `programId`
      executable: false,
    });

    // Forge a matching Transaction account. We have to mark it as owned by `programId` so the program is permitted
    // to write back to it; this is the very thing an attacker can't do in practice, but bankrun's `setAccount` lets us
    // bypass account creation to isolate the check we care about.
    const fakeTxAddress = Keypair.generate().publicKey;
    const fakeTxData = Buffer.from(
        borsh.serialize(TransactionSchema, {
          multisig: fakeMultisigAddress.toBytes(),
          instructions: [],
          signers: [false],
          owner_set_seqno: 0,
        }),
    );
    context.setAccount(fakeTxAddress, {
      lamports: 1_000_000_000,
      data: fakeTxData,
      owner: programId,
      executable: false,
    });

    const txMeta = await dsl.approveTransaction(attacker, fakeMultisigAddress, fakeTxAddress);

    assert.ok(
        txMeta.meta.logMessages.some(log => log.includes("AccountOwnedByWrongProgram")),
        "expected approve_transaction to log AccountOwnedByWrongProgram",
    );
    assert.strictEqual(
        txMeta.result,
        "Error processing Instruction 0: custom program error: 0x13",
        "expected approve_transaction to reject with AccountOwnedByWrongProgram (0x13)",
    );
  })

  await test("should reject a Transaction account not owned by the program", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [_, ownerB, _ownerC] = multisig.owners;

    const fakeTxAddress = Keypair.generate().publicKey;
    const fakeTxData = Buffer.from(
        borsh.serialize(TransactionSchema, {
          multisig: multisig.address.toBytes(),
          instructions: [],
          signers: [true, false, false],
          owner_set_seqno: 0,
        }),
    );
    context.setAccount(fakeTxAddress, {
      lamports: 1_000_000_000,
      data: fakeTxData,
      owner: SystemProgram.programId, // wrong owner: should be `programId`
      executable: false,
    });

    const txMeta = await dsl.approveTransaction(ownerB, multisig.address, fakeTxAddress);

    assert.ok(
        txMeta.meta.logMessages.some(log => log.includes("AccountOwnedByWrongProgram")),
        "expected approve_transaction to log AccountOwnedByWrongProgram for transaction account",
    );
    assert.strictEqual(
        txMeta.result,
        "Error processing Instruction 0: custom program error: 0x13",
        "expected approve_transaction to reject with AccountOwnedByWrongProgram (0x13)",
    );
  })
});
