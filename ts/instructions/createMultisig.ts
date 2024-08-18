import {Buffer} from "node:buffer";
import * as borsh from "borsh";
import {Assignable} from "../assignable";
import {Keypair, PublicKey, SystemProgram, TransactionInstruction} from "@solana/web3.js";
import {MultisigInstruction} from "./index";

export function createCreateMultisigInstruction(programId: PublicKey,
                                                threshold: number,
                                                owners: Keypair[],
                                                nonce: number,
                                                multisigAccount: PublicKey,
                                                multisigSigner: PublicKey,
                                                payer: PublicKey): TransactionInstruction {
  const createMultisig = new CreateMultisig({
    instructionDiscriminator: MultisigInstruction.CreateMultisig,
    owners: owners.map(owner => owner.publicKey.toBuffer()),
    threshold: threshold,
    nonce: nonce
  });
  return new TransactionInstruction({
    keys: [
      {pubkey: multisigAccount, isSigner: true, isWritable: true},
      {pubkey: multisigSigner, isSigner: false, isWritable: false},
      {pubkey: payer, isSigner: true, isWritable: true},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    programId: programId,
    data: createMultisig.toBuffer(),
  });
}

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
