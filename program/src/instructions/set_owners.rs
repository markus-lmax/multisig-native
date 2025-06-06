use crate::errors::{assert_that, assert_unique_owners, MultisigError};
use crate::state::multisig::Multisig;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::pubkey::{Pubkey, PUBKEY_BYTES};
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg,
};
use crate::instructions::common::validate_signer;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct SetOwnersInstruction {
    pub owners: Vec<Pubkey>,
}

pub fn set_owners(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction: SetOwnersInstruction,
) -> ProgramResult {
    msg!("invoke set_owners - {:?}", instruction);

    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let multisig_signer = next_account_info(accounts_iter)?;
    let mut multisig_data = Multisig::try_from_slice(&multisig_account.data.borrow_mut())?;

    validate_signer(multisig_signer, multisig_account, &multisig_data, program_id)?;
    validate(&multisig_data, &instruction.owners)?;

    // the padding ensures the multisig account size stays constant when decreasing the number of owners
    // (so that it can be re-expanded to the original number of owners later)
    let padding_len = multisig_data.padding.len() +
        PUBKEY_BYTES * (multisig_data.owners.len() - instruction.owners.len());
    multisig_data.padding = vec![0; padding_len];
    multisig_data.owners = instruction.owners;
    multisig_data.owner_set_seqno += 1;
    if (multisig_data.owners.len() as u8) < multisig_data.threshold {
        multisig_data.threshold = multisig_data.owners.len() as u8;
    }
    multisig_data.serialize(&mut &mut multisig_account.data.borrow_mut()[..])?;
    Ok(())
}

fn validate(multisig: &Multisig, owners: &[Pubkey]) -> ProgramResult {
    assert_unique_owners(owners)?;
    assert_that(!owners.is_empty(), MultisigError::NotEnoughOwners)?;
    // Increasing the number of owners requires reallocation of space in the data account.
    // This requires a signer to pay the fees for more space, but the instruction will be executed by the multisig.
    assert_that(owners.len() * PUBKEY_BYTES <= multisig.owners.len() * PUBKEY_BYTES + multisig.padding.len(), MultisigError::TooManyOwners)?;
    Ok(())
}
