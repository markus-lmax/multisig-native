import {Buffer} from 'node:buffer';
import {type PublicKey, TransactionInstruction} from '@solana/web3.js';
import * as borsh from 'borsh';
import {MultisigInstruction} from '.';

export class CreateTransaction {
  instruction: MultisigInstruction;

  constructor(props: { instruction: MultisigInstruction }) {
    this.instruction = props.instruction;
  }

  toBuffer() {
    return Buffer.from(borsh.serialize(CreateTransactionSchema, this));
  }

  static fromBuffer(buffer: Buffer) {
    return borsh.deserialize(CreateTransactionSchema, CreateTransaction, buffer);
  }
}

export const CreateTransactionSchema = new Map([
  [
    CreateTransaction,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
      ],
    },
  ],
]);

export function createCreateTransactionInstruction(payer: PublicKey, programId: PublicKey): TransactionInstruction {
  const instructionObject = new CreateTransaction({
    instruction: MultisigInstruction.CreateTransaction,
  });

  return new TransactionInstruction({
    keys: [
      {pubkey: payer, isSigner: true, isWritable: true},
    ],
    programId: programId,
    data: instructionObject.toBuffer(),
  });
}
