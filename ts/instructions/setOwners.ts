import {Buffer} from "node:buffer";
import * as borsh from "borsh";
import {Assignable} from "../assignable";
import {PublicKey, TransactionInstruction} from "@solana/web3.js";
import {MultisigInstruction} from "./index";

export function createSetOwnersInstruction(
    multisigSigner: PublicKey,
    multisigAccount: PublicKey,
    owners: PublicKey[],
    programId: PublicKey): TransactionInstruction {
  const setOwners = new SetOwners({
    instructionDiscriminator: MultisigInstruction.SetOwners,
    owners: owners.map(owner => owner.toBuffer())
  });
  return new TransactionInstruction({
    keys: [
      { pubkey: multisigAccount, isSigner: false, isWritable: true },
      { pubkey: multisigSigner, isSigner: true, isWritable: false },
    ],
    programId: programId,
    data: setOwners.toBuffer(),
  });
}

export class SetOwners extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(SetOwnersSchema, this));
  }
}

const SetOwnersSchema =
  {
    struct: {
      instructionDiscriminator: "u8",
      owners: {array: {type: {array: {type: "u8", len: 32}}}}
    }
  };
