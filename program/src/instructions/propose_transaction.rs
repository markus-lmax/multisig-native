use borsh_derive::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

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
pub struct ProposeTransactionInstruction {
    pub instructions: Vec<TransactionInstructionData>,
}

pub fn propose_transaction(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    instruction: ProposeTransactionInstruction,
) -> ProgramResult {
    msg!("invoke propose_transaction - {:?}", instruction);
    Ok(())
}
