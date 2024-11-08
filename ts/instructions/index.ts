export * from "./createMultisig";
export * from "./proposeTransaction";
export * from "./approveTransaction";

export enum MultisigInstruction {
  CreateMultisig = 0,
  SetOwners = 1,
  ProposeTransaction = 2,
  ApproveTransaction = 3,
}
