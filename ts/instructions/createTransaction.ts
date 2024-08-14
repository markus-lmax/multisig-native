import {Buffer} from "node:buffer";
import {type PublicKey, TransactionInstruction} from "@solana/web3.js";
import * as borsh from "borsh";
import {MultisigInstruction} from ".";

class Assignable {
  constructor(properties) {
    for (const [key, value] of Object.entries(properties)) {
      this[key] = value;
    }
  }
}

export class CreateTransaction extends Assignable{
  toBuffer() {
    return Buffer.from(borsh.serialize(CreateTransactionSchema, this));
  }

  static fromBuffer(buffer: Buffer) {
    return borsh.deserialize(CreateTransactionSchema, buffer);
  }}

const CreateTransactionSchema =
  {
    struct: {
      instructionDiscriminator: "u8",
      instructions: {array: {type: {struct: {
        program_id: { array: {type: "u8", len: 32}}
      }}}},
    },
  };

export function createCreateTransactionInstruction(payer: PublicKey, programId: PublicKey, instructions: PublicKey[]): TransactionInstruction {
  const instructionObject = new CreateTransaction({
    instructionDiscriminator: MultisigInstruction.CreateTransaction,
    instructions: instructions.map(programId => ({ program_id: programId.toBuffer() }))
  });

  return new TransactionInstruction({
    keys: [
      {pubkey: payer, isSigner: true, isWritable: true},
    ],
    programId: programId,
    data: instructionObject.toBuffer(),
  });
}
