import {describe, test} from "node:test";
import {PublicKey, Transaction, TransactionInstruction} from "@solana/web3.js";
import {start} from "solana-bankrun";
import {CreateMultisig} from "../ts";
import {assert} from "chai";

describe("invalid instruction", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);

  await test("reject invalid instruction data with appropriate ProgramError code", async () => {
    const invalidCreateMultisig = new CreateMultisig({
      instructionDiscriminator: 255,
      owners: [],
      threshold: 100,
      nonce: 250
    });
    const invalidInstruction = new TransactionInstruction({
      keys: [
        {pubkey: context.payer.publicKey, isSigner: true, isWritable: true},
      ],
      programId: programId,
      data: invalidCreateMultisig.toBuffer(),
    });
    const tx = new Transaction().add(invalidInstruction);
    const [latestBlockhash] = await context.banksClient.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash;
    tx.sign(context.payer);

    const txResult = await context.banksClient.tryProcessTransaction(tx);

    assert(txResult.meta.logMessages[2] === `Program ${programId} failed: invalid instruction data`);
  });
});
