use borsh::{BorshSerialize, BorshDeserialize};
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::msg;
use solana_program::pubkey::Pubkey;
use crate::instructions::create_multisig::create_multisig;
use crate::instructions::create_transaction::create_transaction;

#[derive(BorshSerialize, BorshDeserialize)]
pub enum MultisigInstruction {
    CreateMultisig,
    CreateTransaction,
}
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MultisigInstruction::try_from_slice(instruction_data)?;
    msg!("Our program's Program ID: {}", &program_id);
    match instruction {
        MultisigInstruction::CreateMultisig => create_multisig(accounts),
        MultisigInstruction::CreateTransaction => create_transaction(accounts),
    }
}
