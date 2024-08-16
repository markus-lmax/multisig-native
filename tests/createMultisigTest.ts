import {describe, test} from "node:test";
import {Keypair, PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {Multisig, MultisigDsl} from "../ts";

describe("create multisig", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("Log create_multisig", async () => {
    const multisig = await dsl.createMultisigWithOwners(2, [Keypair.generate(), Keypair.generate(), Keypair.generate()]);
    const logs = multisig.txMeta.logMessages;

    assert(logs[0].startsWith(`Program ${programId}`));
    assert(logs[1] === `Program log: Our program's Program ID: ${programId}`);
    assert(logs[2].startsWith(`Program log: Instruction: CreateMultisig - CreateMultisigInstructionData { owners: [`));
    assert(logs[logs.length-1] === `Program ${programId} success`);
  });

  test("create multisig account", async () => {
    const multisig = await dsl.createMultisig(2, 3);

    const actualMultisigAccountInfo = await context.banksClient.getAccount(multisig.address);
    assert.isNotNull(actualMultisigAccountInfo);

    const actualMultisig = Multisig.deserialize(actualMultisigAccountInfo?.data);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], multisig.threshold);
    assert.deepEqual(actualMultisig["owners"], multisig.owners.map(owner => Array.from(owner.publicKey.toBytes())));
    assert.strictEqual(actualMultisig["owner_set_seqno"], 0);
  });
});
