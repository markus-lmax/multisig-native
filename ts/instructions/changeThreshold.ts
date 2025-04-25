import {Buffer} from "node:buffer";
import * as borsh from "borsh";
import {Assignable} from "../assignable";
import {PublicKey, TransactionInstruction} from "@solana/web3.js";
import {MultisigInstruction} from "./index";

export function createChangeThresholdInstruction(multisigAccount: PublicKey,
                                           threshold: number,
                                           programId: PublicKey): TransactionInstruction {
  const changeThreshold = new ChangeThreshold({
    instructionDiscriminator: MultisigInstruction.ChangeThreshold,
    threshold: threshold
  });
  return new TransactionInstruction({
    keys: [
      { pubkey: multisigAccount, isSigner: false, isWritable: true },
    ],
    programId: programId,
    data: changeThreshold.toBuffer(),
  });
}

export class ChangeThreshold extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(ChangeThresholdSchema, this));
  }
}

const ChangeThresholdSchema =
  {
    struct: {
      instructionDiscriminator: "u8",
      threshold: "u8"
    }
  };
