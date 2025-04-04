use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

use crate::instructions::approve_transaction::approve_transaction;
use crate::instructions::cancel_transaction::cancel_transaction;
use crate::instructions::create_multisig::{create_multisig, CreateMultisigInstruction};
use crate::instructions::execute_transaction::execute_transaction;
use crate::instructions::propose_transaction::{
    propose_transaction, ProposeTransactionInstruction,
};
use crate::instructions::set_owners::{set_owners, SetOwnersInstruction};

#[derive(BorshSerialize, BorshDeserialize)]
pub enum MultisigInstruction {
    CreateMultisig(CreateMultisigInstruction),
    SetOwners(SetOwnersInstruction),
    ProposeTransaction(ProposeTransactionInstruction),
    ApproveTransaction(),
    ExecuteTransaction(),
    CancelTransaction(),
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if let Ok(instruction) = MultisigInstruction::try_from_slice(data) {
        return match instruction {
            MultisigInstruction::CreateMultisig(create_data) => {
                create_multisig(program_id, accounts, create_data)
            }
            MultisigInstruction::SetOwners(set_owners_data) => {
                set_owners(accounts, set_owners_data)
            }
            MultisigInstruction::ProposeTransaction(propose_data) => {
                propose_transaction(program_id, accounts, propose_data)
            }
            MultisigInstruction::ApproveTransaction() => approve_transaction(accounts),
            MultisigInstruction::ExecuteTransaction() => execute_transaction(program_id, accounts),
            MultisigInstruction::CancelTransaction() => cancel_transaction(accounts),
        };
    }
    Err(ProgramError::InvalidInstructionData)
}
