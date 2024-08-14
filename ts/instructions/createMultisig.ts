import {Buffer} from "node:buffer";
import {type PublicKey, TransactionInstruction} from "@solana/web3.js";
import * as borsh from "borsh";
import {MultisigInstruction} from ".";
import {Assignable} from "./utils/assignable";

export class CreateMultisig extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(CreateMultisigSchema, this));
  }
}

const CreateMultisigSchema =
  {
    struct: {
      instructionDiscriminator: "u8",
      owners: {array: {type: {array: {type: "u8", len: 32}}}},
      threshold: "u8",
      nonce: "u8"
    }
  };

export function createCreateMultisigInstruction(payer: PublicKey, programId: PublicKey, owners: PublicKey[], threshold: number, nonce: number): TransactionInstruction {
  const createMultisig = new CreateMultisig({
    instructionDiscriminator: MultisigInstruction.CreateMultisig,
    owners: owners.map(owner => owner.toBuffer()),
    threshold: threshold,
    nonce: nonce
  });

  return new TransactionInstruction({
    keys: [
      {pubkey: payer, isSigner: true, isWritable: true},
    ],
    programId: programId,
    data: createMultisig.toBuffer(),
  });
}
