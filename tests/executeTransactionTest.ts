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
});
