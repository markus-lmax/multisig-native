import {Buffer} from "node:buffer";
import {AccountMeta, type PublicKey, TransactionInstruction} from "@solana/web3.js";
import * as borsh from "borsh";
import {MultisigInstruction} from ".";
import {Assignable} from "../assignable";

export function createExecuteTransactionInstruction(multisigAccount: PublicKey,
                                                    multisigSigner: PublicKey,
                                                    transactionAccount: PublicKey,
                                                    refundee: PublicKey,
                                                    executor: PublicKey,
                                                    remainingAccounts: AccountMeta[],
                                                    programId: PublicKey,
                                                    ): TransactionInstruction {
  const executeTransactionInstruction = new ExecuteTransactionInstruction({
    instructionDiscriminator: MultisigInstruction.ExecuteTransaction,
  });
  const accounts = [
    {pubkey: multisigAccount, isSigner: false, isWritable: false},
    {pubkey: multisigSigner, isSigner: false, isWritable: false},
    {pubkey: transactionAccount, isSigner: false, isWritable: true},
    {pubkey: refundee, isSigner: false, isWritable: true},
    {pubkey: executor, isSigner: true, isWritable: false},
  ];
  return new TransactionInstruction({
    keys: accounts.concat(remainingAccounts),
    programId: programId,
    data: executeTransactionInstruction.toBuffer(),
  });
}

class ExecuteTransactionInstruction extends Assignable {
  toBuffer() {
    return Buffer.from(borsh.serialize(ExecuteTransactionSchema, this));
  }
}

const ExecuteTransactionSchema = { struct: {
  instructionDiscriminator: "u8",
}};
