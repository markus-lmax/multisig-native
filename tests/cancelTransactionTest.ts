import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl, MultisigSchema} from "../ts";
import {assert} from "chai";
import {TransactionSchema} from "../ts/state/transaction";
import {Buffer} from "node:buffer";
import * as borsh from "borsh";

describe("cancel transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  await test("should let owner cancel transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const transactionInstruction = SystemProgram.transfer({
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

  await test("should let owner cancel transaction, even if the owner set has changed", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    // Change owner set of the multisig while the TX account at transactionAddress is still pending
    const newOwners = [ownerA.publicKey, ownerB.publicKey, Keypair.generate().publicKey];
    const changeOwnersInstruction = dsl.createSetOwnersInstruction(multisig, newOwners);
    const [changedOwnersAddress, _txMeta2]= await dsl.proposeTransaction(ownerA, [changeOwnersInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, changedOwnersAddress);
    await dsl.executeTransaction(changedOwnersAddress, changeOwnersInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    // Now cancel the original transaction instruction (the corresponding TX account owner set will be outdated at this point)
    await dsl.assertBalance(ownerB.publicKey, 0);
    await dsl.cancelTransaction(transactionAddress, multisig.address, ownerB, ownerB.publicKey);
    await dsl.assertBalance(ownerB.publicKey, 2_053_200); // this is the rent exemption amount

    const transactionAccountInfo = await dsl.programTestContext.banksClient.getAccount(transactionAddress, "confirmed");
    assert.strictEqual(transactionAccountInfo, null);
  });

  await test("should not let a non-owner cancel transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, _ownerB, _ownerC] = multisig.owners;
    const ownerD = Keypair.generate();

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    const txResult = await dsl.cancelTransaction(transactionAddress, multisig.address, ownerD, ownerA.publicKey);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: InvalidExecutor (The executor must be a signer and an owner of this multisig.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x8");

    const transactionAccountInfo = await dsl.programTestContext.banksClient.getAccount(transactionAddress, "confirmed");
    assert.notEqual(transactionAccountInfo, null);
  })

  await test("should not execute transaction after cancel", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    await dsl.cancelTransaction(transactionAddress, multisig.address, ownerB, ownerA.publicKey);

    const txResult = await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerA, ownerA.publicKey);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: MalformedTransactionAccount (The given transaction account is missing or not in the expected format.)"));
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xf");
  });

  await test("should not approve transaction after cancel", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    await dsl.cancelTransaction(transactionAddress, multisig.address, ownerB, ownerA.publicKey);

    let txResult = await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: MalformedTransactionAccount (The given transaction account is missing or not in the expected format.)"));
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xf");
  });

  await test("should approve transaction after previous canceled", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const recipient = Keypair.generate();

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: recipient.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    await dsl.cancelTransaction(transactionAddress, multisig.address, ownerB, ownerA.publicKey);

    const [transactionAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress2);
    await dsl.executeTransaction(transactionAddress2, transactionInstruction, multisig.signer, multisig.address, ownerA, ownerA.publicKey);

    await dsl.assertBalance(recipient.publicKey, 1_000_000);
  })

  await test("prevent burning funds by ensuring refundee is different from account being closed", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const txResult = await dsl.cancelTransaction(
        transactionAddress,
        multisig.address,
        ownerB,
        transactionAddress // refundee is the account being closed
    );

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: InvalidRefundeeAccount (The refundee account must not be the same as the transaction account.)"));
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xb");

    const transactionAccountInfo = await dsl.programTestContext.banksClient.getAccount(transactionAddress, "confirmed");
    assert.notEqual(transactionAccountInfo, null, "Transaction account should not have been closed on error.");
  });

  await test("should reject a Multisig account not owned by the program", async () => {
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
      owner: SystemProgram.programId, // wrong owner
      executable: false,
    });

    // Forge a transaction account that references the fake multisig
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

    const txMeta = await dsl.cancelTransaction(fakeTxAddress, fakeMultisigAddress, attacker, attacker.publicKey);

    assert.ok(
        txMeta.meta.logMessages.some(log => log.includes("AccountOwnedByWrongProgram")),
        "expected cancel_transaction to log AccountOwnedByWrongProgram",
    );
    assert.strictEqual(
        txMeta.result,
        "Error processing Instruction 0: custom program error: 0x13",
        "expected cancel_transaction to reject with AccountOwnedByWrongProgram (0x13)",
    );
  });
});