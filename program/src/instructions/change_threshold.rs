use crate::instructions::common::{execute_change_threshold, validate_signer, validate_threshold};
use crate::state::multisig::Multisig;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::pubkey::Pubkey;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg,
};
use crate::errors::{assert_that, MultisigError};

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
    let mut multisig_data = Multisig::checked_deserialize(&multisig_account.data.borrow_mut())?;

    // Defense in depth: validate_signer below also implicitly requires this (only the multisig program can produce
    // the PDA signer), but we assert it up front for symmetry with propose/approve/execute/cancel.
    assert_that(*program_id == *multisig_account.owner, MultisigError::AccountOwnedByWrongProgram)?;
    validate_signer(multisig_signer, multisig_account, &multisig_data, program_id)?;
    validate_threshold(instruction.threshold, &multisig_data.owners)?;

    execute_change_threshold(&multisig_account, &mut multisig_data, instruction.threshold)
}