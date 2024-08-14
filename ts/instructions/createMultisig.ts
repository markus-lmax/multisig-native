import {Buffer} from "node:buffer";
import {type PublicKey, TransactionInstruction} from "@solana/web3.js";
import * as borsh from 'borsh';
import {MultisigInstruction} from '.';

class Assignable {
  constructor(properties) {
    for (const [key, value] of Object.entries(properties)) {
      this[key] = value;
    }
  }
}

export class CreateMultisig extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(CreateMultisigSchema, this));
  }

  static fromBuffer(buffer: Buffer) {
    return borsh.deserialize(CreateMultisigSchema, buffer);
  }
}

const CreateMultisigSchema =
  {
    struct: {
      instructionDiscriminator: "u8",
      owners: {array: {type: {array: {type: 'u8', len: 32}}}},
      threshold: "u8",
      nonce: "u8"
    }
  };

export function createCreateMultisigInstruction(payer: PublicKey, programId: PublicKey, owners: PublicKey[], threshold: number, nonce: number): TransactionInstruction {
  const instructionObject = new CreateMultisig({
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
    data: instructionObject.toBuffer(),
  });
}
