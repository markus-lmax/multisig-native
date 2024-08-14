export * from "./createMultisig";
export * from "./proposeTransaction";

export enum MultisigInstruction {
  CreateMultisig = 0,
  ProposeTransaction = 1,
}
