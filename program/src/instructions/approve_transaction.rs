use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

use crate::errors::MultisigError;
use crate::state::multisig::Multisig;
use crate::state::transaction::Transaction;

pub fn approve_transaction(
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("invoke approve_transaction");
    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let transaction_account = next_account_info(accounts_iter)?;
    let approver = next_account_info(accounts_iter)?;

    let multisig = Multisig::try_from_slice(&multisig_account.data.borrow())?;
    let mut transaction = Transaction::try_from_slice(&transaction_account.data.borrow())?;

    // TODO add validations:
    // - transaction_account.owner_set_seqno == multisig.owner_set_seqno
    // - validate approver is signer
    // - transaction is writable
    // - transaction.multisig == multisig_account.key

    let owner_index = multisig.owners.iter()
        .position(|a| a == approver.key)
        .ok_or(MultisigError::InvalidOwner)?;
    transaction.signers[owner_index] = true;

    transaction.serialize(&mut &mut transaction_account.data.borrow_mut()[..])?;
    Ok(())
}
