use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

pub fn create_multisig(_accounts: &[AccountInfo]) -> ProgramResult {
    msg!("create_multisig called");
    Ok(())
}