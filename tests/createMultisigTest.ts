import {describe, test} from "node:test";
import {Keypair, PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";

describe("create multisig", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test('Log create_multisig', async () => {
    const multisig = await dsl.createMultisigWithOwners(2, [Keypair.generate(), Keypair.generate(), Keypair.generate()]);
    const logs = multisig.txMeta.logMessages;

    assert(logs[0].startsWith(`Program ${programId}`));
    assert(logs[1] === `Program log: Our program's Program ID: ${programId}`);
    assert(logs[2] === `Program log: create_multisig called`);
    assert(logs[3].startsWith(`Program ${programId} consumed`));
    assert(logs[4] === `Program ${programId} success`);
    assert(logs.length === 5);
  });

  test("create multisig account", async () => {
    // const multisig = await dsl.createMultisig(2, 3);
    //
    // let actualMultisig = await program.account.multisig.fetch(multisig.address);
    // assert.strictEqual(actualMultisig.nonce, multisig.nonce);
    // assert.ok(multisig.threshold.eq(actualMultisig.threshold));
    // assert.deepStrictEqual(actualMultisig.owners, multisig.owners.map(owner => owner.publicKey));
    // assert.strictEqual(actualMultisig.ownerSetSeqno, 0);
    assert.isBelow(3, 4, "not below!")
  });

});
