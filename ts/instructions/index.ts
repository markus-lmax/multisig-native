export * from "./createMultisig";
export * from "./setOwners";
export * from "./changeThreshold";
export * from "./proposeTransaction";
export * from "./approveTransaction";
export * from "./executeTransaction";
export * from "./cancelTransaction";

export enum MultisigInstruction {
  CreateMultisig = 0,
  SetOwners = 1,
  ChangeThreshold = 2,
  ProposeTransaction = 3,
  ApproveTransaction = 4,
  ExecuteTransaction = 5,
  CancelTransaction = 6,
}
