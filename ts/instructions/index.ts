export * from "./createMultisig";
export * from "./setOwners";
export * from "./proposeTransaction";
export * from "./approveTransaction";
export * from "./executeTransaction";

export enum MultisigInstruction {
  CreateMultisig = 0,
  SetOwners = 1,
  ProposeTransaction = 2,
  ApproveTransaction = 3,
  ExecuteTransaction = 4,
}
