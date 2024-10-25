export * from "./createMultisig";
export * from "./proposeTransaction";
export * from "./approveTransaction";

export enum MultisigInstruction {
  CreateMultisig = 0,
  ProposeTransaction = 1,
  ApproveTransaction = 2,
}
