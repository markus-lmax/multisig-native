import {Buffer} from 'node:buffer';
import {type PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
import * as borsh from 'borsh';
import {MultisigInstruction} from '.';

export class CreateMultisig {
  instruction: MultisigInstruction;

  constructor(props: { instruction: MultisigInstruction }) {
    this.instruction = props.instruction;
  }

  toBuffer() {
    return Buffer.from(borsh.serialize(CreateMultisigSchema, this));
  }

  static fromBuffer(buffer: Buffer) {
    return borsh.deserialize(CreateMultisigSchema, CreateMultisig, buffer);
  }
}

export const CreateMultisigSchema = new Map([
  [
    CreateMultisig,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
      ],
    },
  ],
]);

export function createCreateMultisigInstruction(payer: PublicKey, programId: PublicKey): TransactionInstruction {
  const instructionObject = new CreateMultisig({
    instruction: MultisigInstruction.CreateMultisig,
  });

  return new TransactionInstruction({
    keys: [
      {pubkey: payer, isSigner: true, isWritable: true},
    ],
    programId: programId,
    data: instructionObject.toBuffer(),
  });
}
