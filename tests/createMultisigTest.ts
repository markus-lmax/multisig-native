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
    assert(logs[1].startsWith(`Program log: Instruction: CreateMultisig - CreateMultisigInstructionData { owners: [`));
    assert(logs[logs.length-1] === `Program ${programId} success`);

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
});
