use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};


#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CreateMultisigInstructionData {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub nonce: u8,
}

pub fn create_multisig(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    data: CreateMultisigInstructionData,
) -> ProgramResult {
    msg!("Instruction: CreateMultisig - {:?}", data);
    Ok(())
}
