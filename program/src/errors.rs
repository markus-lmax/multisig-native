use solana_program::entrypoint::ProgramResult;
use solana_program::msg;
use solana_program::program_error::ProgramError;
use std::fmt::{Debug, Display};
use solana_program::pubkey::Pubkey;
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
    #[error("The owner set sequence attributes of the multisig account and transaction account must match.")]
    InvalidOwnerSetSequenceNumber,
    #[error("The number of owners must be greater than zero.")]
    NotEnoughOwners,
    #[error("The number of owners must not be increased.")]
    TooManyOwners,

}

impl From<MultisigError> for ProgramError {
    fn from(e: MultisigError) -> Self {
       ProgramError::Custom(e as u32)
   }
}

pub fn assert_that(condition: bool, error: impl Into<ProgramError> + Debug + Display) -> ProgramResult {
    if condition {
        Ok(())
    } else {
        msg!("assertion failed - program error: {:?} ({})", error, error);
        Err(error.into())
    }
}

pub fn assert_unique_owners(owners: &[Pubkey]) -> ProgramResult {
    for (i, owner) in owners.iter().enumerate() {
        assert_that(
            !owners.iter().skip(i + 1).any(|item| item == owner),
            MultisigError::UniqueOwners,
        )?
    }
    Ok(())
}
