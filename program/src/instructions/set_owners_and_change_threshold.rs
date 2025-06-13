use crate::instructions::common::{execute_change_threshold, execute_set_owners, validate_owners, validate_signer, validate_threshold};
use crate::state::multisig::Multisig;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::pubkey::Pubkey;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg,
};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct SetOwnersAndChangeThresholdInstruction {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
}

pub fn set_owners_and_change_threshold(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction: SetOwnersAndChangeThresholdInstruction,
) -> ProgramResult {
    msg!("invoke set_owners_and_change_threshold - {:?}", instruction);

    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let multisig_signer = next_account_info(accounts_iter)?;
    let mut multisig_data = Multisig::try_from_slice(&multisig_account.data.borrow_mut())?;

    validate_signer(multisig_signer, multisig_account, &multisig_data, program_id)?;
    validate_owners(&multisig_data, &instruction.owners)?;
    validate_threshold(&multisig_data, instruction.threshold)?;
    
    execute_set_owners(&multisig_account, &mut multisig_data, instruction.owners)?;
    execute_change_threshold(&multisig_account, &mut multisig_data, instruction.threshold)
}
