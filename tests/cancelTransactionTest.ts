import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
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

  test("should let owner cancel transaction, even if the owner set has changed", async () => {
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
    const changeOwnersInstruction = dsl.createSetOwnersInstruction(multisig.address, newOwners);
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

  test("should not let a non-owner cancel transaction", async () => {
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

  test("should not execute transaction after cancel", async () => {
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

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: MalformedTransactionAccount (The given transaction account is missing or not in the expected format.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xf");
  });

  test("should not approve transaction after cancel", async () => {
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

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: MalformedTransactionAccount (The given transaction account is missing or not in the expected format.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0xf");
  });

  test("should approve transaction after previous canceled", async () => {
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
});