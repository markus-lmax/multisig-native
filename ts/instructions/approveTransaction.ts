import {Buffer} from "node:buffer";
import {type PublicKey, TransactionInstruction} from "@solana/web3.js";
import * as borsh from "borsh";
import {MultisigInstruction} from ".";
import {Assignable} from "../assignable";

export function createApproveTransactionInstruction(multisigAccount: PublicKey,
                                                    transactionAccount: PublicKey,
                                                    approver: PublicKey,
                                                    programId: PublicKey,
                                                    ): TransactionInstruction {
  const approveTransactionInstruction = new ApproveTransactionInstruction({
    instructionDiscriminator: MultisigInstruction.ApproveTransaction,
  });
  return new TransactionInstruction({
    keys: [
      {pubkey: multisigAccount, isSigner: false, isWritable: false},
      {pubkey: transactionAccount, isSigner: false, isWritable: true},
      {pubkey: approver, isSigner: true, isWritable: false},
    ],
    programId: programId,
    data: approveTransactionInstruction.toBuffer(),
  });
}

class ApproveTransactionInstruction extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(ApproveTransactionSchema, this));
  }
}

const ApproveTransactionSchema = { struct: {
  instructionDiscriminator: "u8",
}};
