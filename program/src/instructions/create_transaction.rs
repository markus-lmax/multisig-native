use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

pub fn create_transaction(_accounts: &[AccountInfo]) -> ProgramResult {
    msg!("create_transaction called");
    Ok(())
}