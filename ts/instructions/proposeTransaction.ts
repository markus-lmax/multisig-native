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

export class ProposeTransaction extends Assignable{
  toBuffer() {
    return Buffer.from(borsh.serialize(ProposeTransactionSchema, this));
  }
}

const ProposeTransactionSchema =
  {
    struct: {
      instructionDiscriminator: "u8",
      instructions: {array: {type: {struct: {
        program_id: { array: {type: "u8", len: 32}}
      }}}},
    },
  };

export function createProposeTransactionInstruction(payer: PublicKey, programId: PublicKey, instructions: PublicKey[]): TransactionInstruction {
  const proposeTransaction = new ProposeTransaction({
    instructionDiscriminator: MultisigInstruction.ProposeTransaction,
    instructions: instructions.map(programId => ({ program_id: programId.toBuffer() }))
  });

  return new TransactionInstruction({
    keys: [
      {pubkey: payer, isSigner: true, isWritable: true},
    ],
    programId: programId,
    data: proposeTransaction.toBuffer(),
  });
}
