import {Buffer} from "node:buffer";
import {type PublicKey, TransactionInstruction} from "@solana/web3.js";
import * as borsh from "borsh";
import {MultisigInstruction} from ".";
import {Assignable} from "../assignable";

export function createCancelTransactionInstruction(multisigAccount: PublicKey,
                                                   transactionAccount: PublicKey,
                                                   refundee: PublicKey,
                                                   executor: PublicKey,
                                                   programId: PublicKey): TransactionInstruction {
  const cancelTransactionInstruction = new CancelTransactionInstruction({
    instructionDiscriminator: MultisigInstruction.CancelTransaction,
  });
  const accounts = [
    {pubkey: multisigAccount, isSigner: false, isWritable: false},
    {pubkey: transactionAccount, isSigner: false, isWritable: true},
    {pubkey: refundee, isSigner: false, isWritable: true},
    {pubkey: executor, isSigner: true, isWritable: false},
  ];
  return new TransactionInstruction({
    keys: accounts,
    programId: programId,
    data: cancelTransactionInstruction.toBuffer(),
  });
}

class CancelTransactionInstruction extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(CancelTransactionSchema, this));
  }
}

const CancelTransactionSchema = { struct: {
  instructionDiscriminator: "u8",
}};
