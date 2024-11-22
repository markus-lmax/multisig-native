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
    #[error("The executor must be a signer and an owner of this multisig.")]
    InvalidExecutor,
    #[error("The transaction account must be writable.")]
    ImmutableTransactionAccount,
    #[error("The multisig of transaction account must match the provided multisig account.")]
    InvalidTransactionAccount,
    #[error("The refundee account must not be the same as the transaction account.")]
    InvalidRefundeeAccount,
    #[error("The refundee account must be writable.")]
    ImmutableRefundeeAccount,
    #[error("The transaction must reach a minimum number of approvals.")]
    NotEnoughSigners,
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
