import {Buffer} from "node:buffer";
import * as borsh from "borsh";
import {Assignable} from "../assignable";

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

