use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::pubkey::Pubkey;
use solana_program::{msg, system_program};
use solana_program::program_error::ProgramError;
use crate::errors::{assert_that, MultisigError};
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