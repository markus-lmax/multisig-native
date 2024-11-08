import {describe, test} from "node:test";
import {Keypair, PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {Multisig, MultisigDsl} from "../ts";

describe("set owners", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);
  async function getMultisig(multisigAddress: PublicKey): Promise<Multisig>
  {
    const multisigAccountInfo = await context.banksClient.getAccount(multisigAddress);
    assert.isNotNull(multisigAccountInfo);
    return Multisig.deserialize(multisigAccountInfo?.data);
  }

  test("change owners of multisig", async () => {
    // TODO copy/paste/adapt tests from multisigSetOwnerTest.ts after execute_transaction is implemented
  });
});
