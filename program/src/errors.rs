use solana_program::entrypoint::ProgramResult;
use solana_program::msg;
use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MultisigError {
    #[error("Threshold must be less than or equal to the number of owners and greater than zero.")]
    InvalidThreshold,
    #[error("Owners must be unique.")]
    UniqueOwners,
}

impl From<MultisigError> for ProgramError {
    fn from(e: MultisigError) -> Self {
       ProgramError::Custom(e as u32)
   }
}

pub fn assert_that(condition: bool, error: MultisigError) -> ProgramResult {
    if condition {
        Ok(())
    } else {
        msg!("custom program error: {:?} ({})", error, error);
        Err(error.into())
    }
}