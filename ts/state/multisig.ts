import {Buffer} from "node:buffer";
import * as borsh from "borsh";
import {Assignable} from "../assignable";

export class Multisig extends Assignable {
  static deserialize(data: Uint8Array): Multisig {
    return borsh.deserialize(MultisigSchema, Buffer.from(data));
  }
}

const MultisigSchema =
  {
    struct: {
      owners: {array: {type: {array: {type: "u8", len: 32}}}},
      threshold: "u8",
      nonce: "u8",
      owner_set_seqno: "u32"
    }
  };

