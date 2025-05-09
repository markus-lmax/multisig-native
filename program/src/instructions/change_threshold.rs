use crate::errors::{assert_that, MultisigError};
use crate::state::multisig::Multisig;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg,
};
use solana_program::pubkey::Pubkey;
use crate::instructions::common::validate_signer;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ChangeThresholdInstruction {
    pub threshold: u8,
}

pub fn change_threshold(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction: ChangeThresholdInstruction,
) -> ProgramResult {
    msg!("invoke change_threshold - {:?}", instruction);

    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let multisig_signer = next_account_info(accounts_iter)?;
    let mut multisig_data = Multisig::try_from_slice(&multisig_account.data.borrow_mut())?;

    validate_signer(multisig_signer, multisig_account, &multisig_data, program_id)?;
    validate(&multisig_data,instruction.threshold)?;

    multisig_data.threshold = instruction.threshold;
    multisig_data.serialize(&mut &mut multisig_account.data.borrow_mut()[..])?;
    Ok(())
}

fn validate(multisig: &Multisig, threshold: u8) -> ProgramResult {
    assert_that(threshold > 0 && threshold <= multisig.owners.len() as u8, MultisigError::InvalidThreshold)?;
    Ok(())
}
