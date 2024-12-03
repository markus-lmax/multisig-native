import {describe, test} from "node:test";
import {Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";
import {assert} from "chai";
import {Transaction} from "../ts/state/transaction";

describe("execute transaction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("let proposer execute SOL transaction if multisig approval threshold reached", async () => {
    const multisig = await dsl.createMultisig(2, 3, 2_000_000);
    const [ownerA, ownerB, _ownerC] = multisig.owners;

    // Create instruction to send SOL from multisig
    const recipient = Keypair.generate().publicKey
    let solTransferInstruction = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: 900_000,
      toPubkey: recipient,
    });

    await dsl.assertBalance(multisig.signer, 2_000_000);
    await dsl.assertBalance(recipient, 0);

    const [transactionAddress, txMeta] = await dsl.proposeTransaction(ownerA, [solTransferInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    await dsl.executeTransaction(transactionAddress, solTransferInstruction, multisig.signer, multisig.address, ownerA, ownerA.publicKey);

    await dsl.assertBalance(multisig.signer, 1_100_000);
    await dsl.assertBalance(recipient, 900_000);
  });

});
