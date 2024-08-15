use crate::instructions::create_multisig::{create_multisig, CreateMultisigInstructionData};
use crate::instructions::propose_transaction::{
    propose_transaction, ProposeTransactionInstructionData,
};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::msg;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize)]
pub enum MultisigInstruction {
    CreateMultisig(CreateMultisigInstructionData),
    ProposeTransaction(ProposeTransactionInstructionData),
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    msg!("Our program's Program ID: {}", &program_id);
    if let Ok(instruction) = MultisigInstruction::try_from_slice(data) {
        match instruction {
            MultisigInstruction::CreateMultisig(create_data) => {
                return create_multisig(program_id, accounts, create_data)
            }
            MultisigInstruction::ProposeTransaction(propose_data) => {
                return propose_transaction(program_id, accounts, propose_data)
            }
        }
    }
    Err(ProgramError::InvalidInstructionData)
}
