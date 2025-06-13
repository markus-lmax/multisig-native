export * from "./createMultisig";
export * from "./setOwners";
export * from "./changeThreshold";
export * from "./setOwnersAndChangeThreshold";
export * from "./proposeTransaction";
export * from "./approveTransaction";
export * from "./executeTransaction";
export * from "./cancelTransaction";

export enum MultisigInstruction {
  CreateMultisig = 0,
  SetOwners = 1,
  ChangeThreshold = 2,
  SetOwnersAndChangeThreshold = 3,
  ProposeTransaction = 4,
  ApproveTransaction = 5,
  ExecuteTransaction = 6,
  CancelTransaction = 7,
}
