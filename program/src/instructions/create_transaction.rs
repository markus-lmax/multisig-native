use borsh_derive::{BorshDeserialize, BorshSerialize};
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};
use solana_program::pubkey::Pubkey;


// #[derive(BorshSerialize, BorshDeserialize, Debug)]
// pub struct TransactionAccount {
//     pub pubkey: Pubkey,
//     pub is_signer: bool,
//     pub is_writable: bool,
// }

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct TransactionInstructionData {
    pub program_id: Pubkey,
    // pub accounts: Vec<TransactionAccount>,
    // pub data: Vec<u8>,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CreateTransactionInstructionData {
    pub instructions: Vec<TransactionInstructionData>,
}

pub fn create_transaction(_program_id: &Pubkey,
                          _accounts: &[AccountInfo],
                          data: CreateTransactionInstructionData) -> ProgramResult {
    msg!("Instruction: CreateTransaction - {:?}", data);
    Ok(())
}