import {Buffer} from "node:buffer";
import * as borsh from "borsh";
import {Assignable} from "../assignable";

export class Transaction extends Assignable {
  static deserialize(data: Uint8Array): Transaction {
    return borsh.deserialize(TransactionSchema, Buffer.from(data));
  }
}

const TransactionSchema = { struct: {
  multisig: { array: { type: "u8", len: 32 }},
  instructions: { array: { type: { struct: {
    program_id: { array: { type: "u8", len: 32 }},
    accounts: { array: { type: { struct: {
      pubkey: { array: { type: "u8", len: 32 }},
      is_signer: "bool",
      is_writable: "bool"
    }}}},
    data: { array: { type: "u8" }}
  }}}},
  signers: { array: { type: "bool" }},
  owner_set_seqno: "u32"
}};
