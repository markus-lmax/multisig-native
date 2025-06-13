use borsh::BorshSerialize;
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::pubkey::{Pubkey, PUBKEY_BYTES};
use solana_program::{msg, system_program};
use solana_program::program_error::ProgramError;
use crate::errors::{assert_that, assert_unique_owners, MultisigError};
use crate::state::multisig::Multisig;

pub fn close_account(account: &AccountInfo, refundee: &AccountInfo) -> ProgramResult {
    **refundee.lamports.borrow_mut() = refundee.lamports()
        .checked_add(account.lamports())
        .ok_or(MultisigError::AccountCloseFailure)?;
    **account.lamports.borrow_mut() = 0;
    account.assign(&system_program::ID);
    account.realloc(0, false)?;

    Ok(())
}

pub fn execute_change_threshold(multisig_account: &&AccountInfo, multisig_data: &mut Multisig, threshold: u8) -> ProgramResult {
    multisig_data.threshold = threshold;
    multisig_data.serialize(&mut &mut multisig_account.data.borrow_mut()[..])?;
    Ok(())
}

pub fn execute_set_owners(multisig_account: &&AccountInfo, multisig_data: &mut Multisig, owners: Vec<Pubkey>) -> ProgramResult {
    // the padding ensures the multisig account size stays constant when decreasing the number of owners
    // (so that it can be re-expanded to the original number of owners later)
    let padding_len = multisig_data.padding.len() +
        PUBKEY_BYTES * (multisig_data.owners.len() - owners.len());
    multisig_data.padding = vec![0; padding_len];
    multisig_data.owners = owners;
    multisig_data.owner_set_seqno += 1;
    if (multisig_data.owners.len() as u8) < multisig_data.threshold {
        multisig_data.threshold = multisig_data.owners.len() as u8;
    }
    multisig_data.serialize(&mut &mut multisig_account.data.borrow_mut()[..])?;
    Ok(())
}

pub fn validate_signer(multisig_signer: &AccountInfo, multisig_account: &AccountInfo, multisig: &Multisig, program_id: &Pubkey) -> ProgramResult {
    let pda_address = Pubkey::create_program_address(
        &[multisig_account.key.as_ref(), &[multisig.nonce][..]],
        &program_id,
    ).map_err(|err| {
        msg!("could not derive pda address from multisig {} and nonce {}: {}", multisig_account.key, multisig.nonce, err);
        ProgramError::InvalidSeeds
    })?;
    assert_that(multisig_signer.key.as_ref() == pda_address.as_ref(), ProgramError::InvalidSeeds)?;

    Ok(())
}

pub fn validate_owners(multisig: &Multisig, owners: &[Pubkey]) -> ProgramResult {
    assert_unique_owners(owners)?;
    assert_that(!owners.is_empty(), MultisigError::NotEnoughOwners)?;
    // Increasing the number of owners requires reallocation of space in the data account.
    // This requires a signer to pay the fees for more space, but the instruction will be executed by the multisig.
    assert_that(owners.len() * PUBKEY_BYTES <= multisig.owners.len() * PUBKEY_BYTES + multisig.padding.len(), MultisigError::TooManyOwners)?;
    Ok(())
}

pub fn validate_threshold(multisig: &Multisig, threshold: u8) -> ProgramResult {
    assert_that(threshold > 0 && threshold <= multisig.owners.len() as u8, MultisigError::InvalidThreshold)?;
    Ok(())
}
