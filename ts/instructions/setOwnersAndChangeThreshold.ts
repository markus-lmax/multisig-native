import {Buffer} from "node:buffer";
import * as borsh from "borsh";
import {Assignable} from "../assignable";
import {PublicKey, TransactionInstruction} from "@solana/web3.js";
import {MultisigInstruction} from "./index";

export function createSetOwnersAndChangeThresholdInstruction(
    multisigSigner: PublicKey,
    multisigAccount: PublicKey,
    owners: PublicKey[],
    threshold: number,
    programId: PublicKey): TransactionInstruction {
  const setOwnersAndChangeThreshold = new SetOwnersAndChangeThreshold({
    instructionDiscriminator: MultisigInstruction.SetOwnersAndChangeThreshold,
    owners: owners.map(owner => owner.toBuffer()),
    threshold: threshold
  });
  return new TransactionInstruction({
    keys: [
      { pubkey: multisigAccount, isSigner: false, isWritable: true },
      { pubkey: multisigSigner, isSigner: true, isWritable: false },
    ],
    programId: programId,
    data: setOwnersAndChangeThreshold.toBuffer(),
  });
}

export class SetOwnersAndChangeThreshold extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(SetOwnersAndChangeThresholdSchema, this));
  }
}

const SetOwnersAndChangeThresholdSchema =
  {
    struct: {
      instructionDiscriminator: "u8",
      owners: {array: {type: {array: {type: "u8", len: 32}}}},
      threshold: "u8"
    }
  };
