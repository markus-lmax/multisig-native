import {Buffer} from "node:buffer";
import {type PublicKey, SystemProgram, TransactionInstruction} from "@solana/web3.js";
import * as borsh from "borsh";
import {MultisigInstruction} from ".";
import {Assignable} from "../assignable";

export function createProposeTransactionInstruction(multisigAccount: PublicKey,
                                                    transactionAccount: PublicKey,
                                                    proposer: PublicKey,
                                                    payer: PublicKey,
                                                    programId: PublicKey,
                                                    instructions: TransactionInstruction[],
                                                    proposerIsSigner,
                                                    systemProgramId,
                                                    ): TransactionInstruction {
  const proposeTransactionInstruction = new ProposeTransactionInstruction({
    instructionDiscriminator: MultisigInstruction.ProposeTransaction,
    instructions: instructions.map(ix => {
      return {
        program_id: ix.programId.toBuffer(),
        accounts: ix.keys.map(key => { return { pubkey: key.pubkey.toBuffer(), is_signer: key.isSigner, is_writable: key.isWritable }}),
        data: ix.data
      };
    })
  });
  return new TransactionInstruction({
    keys: [
      {pubkey: multisigAccount, isSigner: false, isWritable: false},
      {pubkey: transactionAccount, isSigner: true, isWritable: true},
      {pubkey: proposer, isSigner: proposerIsSigner, isWritable: false},
      {pubkey: payer, isSigner: true, isWritable: false},
      {pubkey: systemProgramId, isSigner: false, isWritable: false},
    ],
    programId: programId,
    data: proposeTransactionInstruction.toBuffer(),
  });
}

class ProposeTransactionInstruction extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(ProposeTransactionSchema, this));
  }
}

const ProposeTransactionSchema = { struct: {
  instructionDiscriminator: "u8",
  instructions: { array: { type: { struct: {
    program_id: {array: {type: "u8", len: 32}},
    accounts: { array: { type: { struct: {
      pubkey: {array: {type: "u8", len: 32}},
      is_signer: "bool",
      is_writable: "bool"
    }}}},
    data: {array: {type: "u8"}}
  }}}},
}};
