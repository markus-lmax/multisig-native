use crate::errors::{assert_that, assert_unique_owners, MultisigError};
use crate::state::multisig::Multisig;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::pubkey::Pubkey;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg,
};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct SetOwnersInstruction {
    pub owners: Vec<Pubkey>,
}

pub fn set_owners(
    accounts: &[AccountInfo],
    instruction: SetOwnersInstruction,
) -> ProgramResult {
    msg!("invoke set_owners - {:?}", instruction);

    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let mut multisig_data = Multisig::try_from_slice(&multisig_account.data.borrow_mut())?;

    validate(&multisig_data, &instruction.owners)?;

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
    assert_that(owners.len() <= multisig.owners.len(), MultisigError::TooManyOwners)?;
    Ok(())
}


