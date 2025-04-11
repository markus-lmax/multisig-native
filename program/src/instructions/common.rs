use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::system_program;
use crate::errors::MultisigError;

pub fn close_account(account: &AccountInfo, refundee: &AccountInfo) -> ProgramResult {
    **refundee.lamports.borrow_mut() = refundee.lamports()
        .checked_add(account.lamports())
        .ok_or(MultisigError::AccountCloseFailure)?;
    **account.lamports.borrow_mut() = 0;
    account.assign(&system_program::ID);
    account.realloc(0, false)?;

    Ok(())
}