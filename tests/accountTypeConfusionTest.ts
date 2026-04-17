import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";

describe("account type confusion", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  await test("should reject a Multisig account passed in place of a Transaction account", async () => {
    // Create two real multisig accounts, both owned by the multisig program
    const multisig1 = await dsl.createMultisig(1, 2);
    const multisig2 = await dsl.createMultisig(1, 2);
    const [ownerA] = multisig1.owners;

    // Type confusion: pass multisig2's account where a Transaction account is expected.
    // The Borsh deserialization will fail because the data layouts are structurally incompatible.
    const txMeta = await dsl.approveTransaction(ownerA, multisig1.address, multisig2.address);

    assert.isNotNull(txMeta.result);
    assert.ok(txMeta.meta.logMessages.some(log => log.includes("MalformedTransactionAccount")));
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0xf");
  });

  await test("should reject a Transaction account passed in place of a Multisig account", async () => {
    // Create a real multisig and propose a real transaction
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB] = multisig.owners;
    const transferIx = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 1_000,
      toPubkey: Keypair.generate().publicKey,
    });
    const [transactionAddress, _] = await dsl.proposeTransaction(ownerA, [transferIx], multisig.address);

    // Type confusion: pass the transaction account where the multisig account is expected.
    const txMeta = await dsl.approveTransaction(ownerB, transactionAddress, transactionAddress);

    assert.isNotNull(txMeta.result);
    assert.ok(txMeta.meta.logMessages.some(log => log.includes("MalformedMultisigAccount")));
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x12");
  });
});
