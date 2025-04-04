use crate::errors::{assert_that, MultisigError};
use crate::state::multisig::Multisig;
use crate::state::transaction::Transaction;
use borsh::BorshDeserialize;
use solana_program::account_info::next_account_info;
use solana_program::rent::Rent;
use solana_program::sysvar::Sysvar;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, system_program};

pub fn cancel_transaction(accounts: &[AccountInfo]) -> ProgramResult {
    msg!("invoke cancel_transaction");

    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let transaction_account = next_account_info(accounts_iter)?;
    let refundee = next_account_info(accounts_iter)?;
    let executor = next_account_info(accounts_iter)?;

    validate(multisig_account, transaction_account, executor)?;

    let account_span = 0usize;
    let lamports_required = Rent::get()?.minimum_balance(account_span);
    let lamports_to_refund = transaction_account.lamports() - lamports_required;
    **transaction_account.lamports.borrow_mut() -= lamports_to_refund;
    **refundee.lamports.borrow_mut() += lamports_to_refund;
    transaction_account.realloc(account_span, true)?;
    transaction_account.assign(&system_program::ID);

    Ok(())
}

fn validate(multisig_account: &AccountInfo, transaction_account: &AccountInfo, executor: &AccountInfo) -> ProgramResult {
    let multisig = Multisig::try_from_slice(&multisig_account.data.borrow())?;
    let transaction = Transaction::try_from_slice(&transaction_account.data.borrow())?;

    assert_that(executor.is_signer && multisig.owners.contains(executor.key), MultisigError::InvalidExecutor)?;
    assert_that(multisig.owner_set_seqno >= transaction.owner_set_seqno, MultisigError::InvalidOwnerSetSequenceNumber)?;
    assert_that(transaction.multisig == *multisig_account.key, MultisigError::InvalidTransactionAccount)?;

    Ok(())
}

