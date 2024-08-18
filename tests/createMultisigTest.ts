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
    const logs = multisig.txMeta.logMessages;

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
    assert.deepEqual(actualMultisig1["owners"], multisig1.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig1["owner_set_seqno"], 0);

    assert.strictEqual(actualMultisig2["nonce"], multisig2.nonce);
    assert.strictEqual(actualMultisig2["threshold"], multisig2.threshold);
    assert.deepEqual(actualMultisig2["owners"], multisig2.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig2["owner_set_seqno"], 0);
  })

  test("do not create multisig if provided threshold is greater than number of owners", async () => {
    try {
      await dsl.createMultisig(4, 3);
      assert.fail("Multisig should not have been created");
    } catch (e: any) {
      // TODO proper error code/message for InvalidThreshold only appear in manually added solana logs ATM (see assert_that in errors.rs)
      //      -> is there a way to retain the anchor behaviour (custom error message appearing in the exception)
      assert(e.message.endsWith("Error processing Instruction 0: custom program error: 0x0"));
    }
  });

  test("do not create multisig with 0 threshold", async () => {
    try {
      await dsl.createMultisig(0, 3);
      assert.fail("Multisig should not have been created");
    } catch (e: any) {
      assert(e.message.endsWith("Error processing Instruction 0: custom program error: 0x0"));
    }
  });

  test("do not create multisig with 0 threshold and no owners", async () => {
    try {
      await dsl.createMultisigWithOwners(0, []);
      assert.fail("Multisig should not have been created");
    } catch (e: any) {
      assert(e.message.endsWith("Error processing Instruction 0: custom program error: 0x0"));
    }
  });

  test("do not create multisig with duplicate owners", async () => {
    const [ownerA, ownerB] = Array.from({length: 2}, (_, _n) => Keypair.generate());
    try {
      await dsl.createMultisigWithOwners(2, [ownerA, ownerA, ownerB]);
      assert.fail("Multisig should not have been created");
    } catch (e: any) {
      assert(e.message.endsWith("Error processing Instruction 0: custom program error: 0x1"));
    }
  });

  test("do not create multisig account with bad nonce", async () => {
    try {
      await dsl.createMultisigWithBadNonce();
      assert.fail("Multisig should not have been created");
    } catch (e: any) {
      assert(e.message.endsWith(("Error processing Instruction 0: custom program error: 0x2")));
    }
  });
});
