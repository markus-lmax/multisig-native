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
    #[error("A seeds constraint was violated.")] // TODO copy/pasted from Anchor, but we only use this for nonce check ATM - better / more specific error message?
    ConstraintSeeds,
    #[error("The given owner is not part of this multisig.")]
    InvalidOwner,
    #[error("The proposer must be a signer.")]
    ProposerNotSigner,
    #[error("The number of instructions must be greater than zero.")]
    MissingInstructions,
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