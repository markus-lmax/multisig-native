use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

use crate::instructions::create_multisig::{create_multisig, CreateMultisigInstruction};
use crate::instructions::propose_transaction::{
    propose_transaction, ProposeTransactionInstruction,
};
use crate::instructions::approve_transaction::{approve_transaction};

#[derive(BorshSerialize, BorshDeserialize)]
pub enum MultisigInstruction {
    CreateMultisig(CreateMultisigInstruction),
    ProposeTransaction(ProposeTransactionInstruction),
    ApproveTransaction(),
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
            MultisigInstruction::ProposeTransaction(propose_data) => {
                propose_transaction(program_id, accounts, propose_data)
            }
            MultisigInstruction::ApproveTransaction() => {
                approve_transaction(accounts)
            }
        };
    }
    Err(ProgramError::InvalidInstructionData)
}
