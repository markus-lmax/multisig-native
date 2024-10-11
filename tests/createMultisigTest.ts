import {describe, test} from "node:test";
import {Keypair, PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {Multisig, MultisigDsl} from "../ts";

describe("create multisig", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);
  async function getMultisig(multisigAddress: PublicKey): Promise<Multisig>
  {
    const multisigAccountInfo = await context.banksClient.getAccount(multisigAddress);
    assert.isNotNull(multisigAccountInfo);
    return Multisig.deserialize(multisigAccountInfo?.data);
  }

  test("create multisig account", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    assert.strictEqual(multisig.txMeta.result, null);

    const logs = multisig.txMeta.meta.logMessages;
    assert(logs[0].startsWith(`Program ${programId}`));
    assert(logs[1].startsWith(`Program log: invoke create_multisig - CreateMultisigInstruction { owners: [`));
    assert.strictEqual(logs[logs.length-1], `Program ${programId} success`);

    const actualMultisig = await getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], multisig.threshold);
    assert.deepEqual(actualMultisig["owners"], multisig.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig["owner_set_seqno"], 0);
  });

  test("create multiple multisig accounts", async () => {
    const [ownerA, ownerB, ownerC, ownerD, ownerE] = Array.from({length: 5}, (_, _n) => Keypair.generate());
    const multisig1 = await dsl.createMultisigWithOwners(2, [ownerA, ownerB, ownerC]);
    const multisig2 = await dsl.createMultisigWithOwners(3, [ownerC, ownerD, ownerE]);

    const actualMultisig1 = await getMultisig(multisig1.address);
    const actualMultisig2 = await getMultisig(multisig2.address);

    assert.strictEqual(actualMultisig1["nonce"], multisig1.nonce);
    assert.strictEqual(actualMultisig1["threshold"], multisig1.threshold);
    assert.deepStrictEqual(actualMultisig1["owners"], multisig1.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig1["owner_set_seqno"], 0);

    assert.strictEqual(actualMultisig2["nonce"], multisig2.nonce);
    assert.strictEqual(actualMultisig2["threshold"], multisig2.threshold);
    assert.deepStrictEqual(actualMultisig2["owners"], multisig2.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig2["owner_set_seqno"], 0);
  })

  test("do not create multisig if provided threshold is greater than number of owners", async () => {
    let txMeta = (await dsl.createMultisig(4, 3)).txMeta;
    // TODO proper error code/message for InvalidThreshold only appear in manually added solana logs ATM (see assert_that in errors.rs)
    //      -> is there a way to retain the anchor behaviour (custom error message appearing in the exception)
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x0");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" custom program error: InvalidThreshold (Threshold must be less than or equal to the number of owners and greater than zero.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x0"));
  });

  test("do not create multisig with 0 threshold", async () => {
    let txMeta = (await dsl.createMultisig(0, 3)).txMeta;
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x0");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" custom program error: InvalidThreshold (Threshold must be less than or equal to the number of owners and greater than zero.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x0"));
  });

  test("do not create multisig with 0 threshold and no owners", async () => {
    let txMeta = (await dsl.createMultisigWithOwners(0, [])).txMeta;
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x0");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" custom program error: InvalidThreshold (Threshold must be less than or equal to the number of owners and greater than zero.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x0"));
  });

  test("do not create multisig with duplicate owners", async () => {
    const [ownerA, ownerB] = Array.from({length: 2}, (_, _n) => Keypair.generate());
    let txMeta = (await dsl.createMultisigWithOwners(2, [ownerA, ownerA, ownerB])).txMeta;
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x1");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" custom program error: UniqueOwners (Owners must be unique.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x1"));
  });

  test("do not create multisig account with bad nonce", async () => {
    let txMeta = (await dsl.createMultisigWithBadNonce()).txMeta;
    assert.strictEqual(txMeta.result, "Error processing Instruction 0: custom program error: 0x2");
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-3].endsWith(" custom program error: ConstraintSeeds (A seeds constraint was violated.)"));
    assert(txMeta.meta.logMessages[txMeta.meta.logMessages.length-1].endsWith(" failed: custom program error: 0x2"));
  });
});
