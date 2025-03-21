import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";
import {createTransferCheckedInstruction} from "@solana/spl-token";

describe("execute transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("let proposer execute SOL transaction if multisig approval threshold reached", async () => {
    const multisig = await dsl.createMultisig(2, 3, 2_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const recipient = Keypair.generate().publicKey
    let solTransferInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 900_000,
      toPubkey: recipient,
    });

    await dsl.assertBalance(multisig.signer, 2_000_000);
    await dsl.assertBalance(recipient, 0);

    const [transactionAddress, _proposeTxMeta] = await dsl.proposeTransaction(ownerA, [solTransferInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    const txMeta = await dsl.executeTransaction(transactionAddress, solTransferInstruction, multisig.signer, multisig.address, ownerA, ownerA.publicKey);

    assert.strictEqual(txMeta.result, null);  // i.e. executeTransaction completed without error
    await dsl.assertBalance(multisig.signer, 1_100_000);
    await dsl.assertBalance(recipient, 900_000);
  });

  test("let proposer execute a SPL token transaction if multisig approval threshold reached using an ata", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let mint = await dsl.createTokenMint(3);
    let multisigOwnedAta = await dsl.createAta(mint, multisig.signer, 20);
    let destinationAta = await dsl.createAta(mint, Keypair.generate().publicKey);
    let tokenTransferInstruction = createTransferCheckedInstruction(
        multisigOwnedAta,  // from (should be a token account)
        mint.account,      // mint
        destinationAta,    // to (should be a token account)
        multisig.signer,   // from's owner
        15,                // amount
        3                  // decimals
    );

    await dsl.assertAtaBalance(multisigOwnedAta, 20);
    await dsl.assertAtaBalance(destinationAta, 0);

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [tokenTransferInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    await dsl.executeTransaction(transactionAddress, tokenTransferInstruction, multisig.signer, multisig.address, ownerA, ownerA.publicKey);

    await dsl.assertAtaBalance(multisigOwnedAta, 5);
    await dsl.assertAtaBalance(destinationAta, 15);
  });

  test("let proposer execute a transaction containing a SOL transfer and a SPL token transfer instruction", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let solTransferInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 50_000,
      toPubkey: context.payer.publicKey,
    });

    // Create instruction to send SPL tokens from multisig
    let mint = await dsl.createTokenMint(3);
    let multisigOwnedAta = await dsl.createAta(mint, multisig.signer, 20);
    let destinationAta = await dsl.createAta(mint, Keypair.generate().publicKey);
    let tokenTransferInstruction = createTransferCheckedInstruction(
        multisigOwnedAta,  // from (should be a token account)
        mint.account,      // mint
        destinationAta,    // to (should be a token account)
        multisig.signer,   // from's owner
        15,                // amount
        3                  // decimals
    );

    await dsl.assertBalance(multisig.signer, 1_000_000);
    await dsl.assertAtaBalance(multisigOwnedAta, 20);

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [solTransferInstruction, tokenTransferInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    await dsl.executeTransactionWithMultipleInstructions(
        transactionAddress,
        [solTransferInstruction, tokenTransferInstruction],
        multisig.signer,
        multisig.address,
        ownerA,
        ownerA.publicKey
    );

    await dsl.assertBalance(multisig.signer, 950_000);
    await dsl.assertAtaBalance(multisigOwnedAta, 5);
  });

  test("should not execute any instructions if one of the instructions fails", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let instruction1 = SystemProgram.transfer({ // should work
      fromPubkey: multisig.signer,
      lamports: 600_000,
      toPubkey: context.payer.publicKey,
    });
    let instruction2 = SystemProgram.transfer({ // should fail, not enough funds
      fromPubkey: multisig.signer,
      lamports: 500_000,
      toPubkey: context.payer.publicKey,
    });
    let instruction3 = SystemProgram.transfer({ // would work if instruction2 wasn't present, but won't be executed
      fromPubkey: multisig.signer,
      lamports: 100_000,
      toPubkey: context.payer.publicKey,
    });

    await dsl.assertBalance(multisig.signer, 1_000_000);

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [instruction1, instruction2, instruction3], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    const txResult = await dsl.executeTransactionWithMultipleInstructions(transactionAddress,
        [instruction1, instruction2, instruction3],
        multisig.signer,
        multisig.address,
        ownerA,
        ownerA.publicKey);

    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x1")
    assert.ok(txResult.meta.logMessages.includes("Transfer: insufficient lamports 400000, need 500000"));
    await dsl.assertBalance(multisig.signer, 1_000_000);
  });

  test("let owner who has approved execute transaction if multisig approval threshold reached", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });

    await dsl.assertBalance(multisig.signer, 1_000_000);

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    await dsl.assertBalance(multisig.signer, 0);
  });

  test("let owner who has not approved execute transaction if multisig approval threshold reached", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, ownerC] = multisig.owners;

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });

    await dsl.assertBalance(multisig.signer, 1_000_000);

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerC, ownerA.publicKey);

    await dsl.assertBalance(multisig.signer, 0);
  });

  test("close transaction account and refund rent exemption SOL on execute transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    await dsl.assertBalance(ownerA.publicKey, 0);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    await dsl.assertBalance(ownerA.publicKey, 2_053_200);  // this is the rent exemption amount

    let rawTxAccount = await context.banksClient.getAccount(transactionAddress, "confirmed");
    assert.strictEqual(rawTxAccount, null);
  });

  test("refund rent exemption SOL to any nominated account", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const otherAccount = Keypair.generate();

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.assertBalance(otherAccount.publicKey, 0);

    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, otherAccount.publicKey);
    await dsl.assertBalance(otherAccount.publicKey, 2_053_200);  // this is the rent exemption amount
  });

  test("should not clear up transaction account if execute fails", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 5_000_000,
      toPubkey: context.payer.publicKey,
    });
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    try {
      await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
      assert.fail("The executeTransaction function should have failed");
    } catch (e) {
      let rawTxAccount = await context.banksClient.getAccount(transactionAddress, "confirmed");
      assert.notStrictEqual(rawTxAccount, null);
    }
  });

  test("should not execute transaction twice", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 10_000,
      toPubkey: context.payer.publicKey,
    });

    await dsl.assertBalance(multisig.signer, 1_000_000);

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    await dsl.assertBalance(multisig.signer, 990_000);

    const txResult = await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerA, ownerA.publicKey);
    await dsl.assertBalance(multisig.signer, 990_000);

    assert.strictEqual(txResult.result, "Error processing Instruction 0: Failed to serialize or deserialize account data: Unknown");
  });

  test("should not let a non-owner execute transaction", async () => {
    const multisig = await dsl.createMultisig(2, 3, 1_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const ownerD = Keypair.generate();

    let transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });

    await dsl.assertBalance(multisig.signer, 1_000_000);

    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    const txResult = await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerD, ownerA.publicKey);

    assert.ok(txResult.meta.logMessages.includes("Program log: assertion failed - program error: InvalidExecutor (The executor must be a signer and an owner of this multisig.)"))
    assert.strictEqual(txResult.result, "Error processing Instruction 0: custom program error: 0x8");
    await dsl.assertBalance(multisig.signer, 1_000_000);
  });

  test("should handle multiple transactions in parallel", async () => {
    const multisig = await dsl.createMultisig(2, 3, 2_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    const transactionInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000_000,
      toPubkey: context.payer.publicKey,
    });

    await dsl.assertBalance(multisig.signer, 2_000_000);

    const [txAddress1, _txMeta1] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, txAddress1);
    await dsl.approveTransaction(ownerB, multisig.address, txAddress2);

    await dsl.executeTransaction(txAddress1, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
    await dsl.executeTransaction(txAddress2, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    await dsl.assertBalance(multisig.signer, 0);
  });

  test("should transfer funds from two different multisig accounts", async () => {
    const [ownerA, ownerB, ownerC, ownerD] = Array.from({length: 4}, (_, _n) => Keypair.generate());
    const multisig1 = await dsl.createMultisigWithOwners(2, [ownerA, ownerB, ownerC], 1_000_000);
    const multisig2 = await dsl.createMultisigWithOwners(2, [ownerB, ownerC, ownerD], 1_100_000);
    await dsl.assertBalance(multisig1.signer, 1_000_000);
    await dsl.assertBalance(multisig2.signer, 1_100_000);

    const transactionInstruction1 = SystemProgram.transfer({
      fromPubkey: multisig1.signer,
      lamports: 50_000,
      toPubkey: context.payer.publicKey,
    });
    const transactionInstruction2 = SystemProgram.transfer({
      fromPubkey: multisig2.signer,
      lamports: 100_000,
      toPubkey: context.payer.publicKey,
    });

    const [txAddress1, _txMeta1] = await dsl.proposeTransaction(ownerA, [transactionInstruction1], multisig1.address);
    const [txAddress2, _txMeta2] = await dsl.proposeTransaction(ownerB, [transactionInstruction2], multisig2.address);

    await dsl.approveTransaction(ownerB, multisig1.address, txAddress1);
    await dsl.approveTransaction(ownerC, multisig2.address, txAddress2);

    await dsl.executeTransaction(txAddress1, transactionInstruction1, multisig1.signer, multisig1.address, ownerB, ownerA.publicKey);
    await dsl.executeTransaction(txAddress2, transactionInstruction2, multisig2.signer, multisig2.address, ownerC, ownerA.publicKey);

    await dsl.assertBalance(multisig1.signer, 950_000);
    await dsl.assertBalance(multisig2.signer, 1_000_000);
  });
});
