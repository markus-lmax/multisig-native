use crate::errors::{assert_that, MultisigError};
use crate::instructions::common::close_account;
use crate::state::multisig::Multisig;
use crate::state::transaction::Transaction;
use solana_program::account_info::next_account_info;
use solana_program::pubkey::Pubkey;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

pub fn cancel_transaction(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("invoke cancel_transaction");

    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let transaction_account = next_account_info(accounts_iter)?;
    let refundee = next_account_info(accounts_iter)?;
    let executor = next_account_info(accounts_iter)?;

    validate(program_id, multisig_account, transaction_account, refundee, executor)?;

    close_account(transaction_account, refundee)
}

fn validate(
    program_id: &Pubkey,
    multisig_account: &AccountInfo,
    transaction_account: &AccountInfo,
    refundee: &AccountInfo,
    executor: &AccountInfo,
) -> ProgramResult {
    assert_that(*program_id == *multisig_account.owner, MultisigError::AccountOwnedByWrongProgram)?;

    let multisig = Multisig::checked_deserialize(&multisig_account.data.borrow())?;
    let transaction = Transaction::checked_deserialize(&transaction_account.data.borrow())?;

    assert_that(executor.is_signer && multisig.owners.contains(executor.key), MultisigError::InvalidExecutor)?;
    assert_that(multisig.owner_set_seqno >= transaction.owner_set_seqno, MultisigError::InvalidOwnerSetSequenceNumber)?;
    assert_that(transaction.multisig == *multisig_account.key, MultisigError::InvalidTransactionAccount)?;
    assert_that(transaction_account.is_writable, MultisigError::ImmutableTransactionAccount)?;
    assert_that(refundee.key != transaction_account.key, MultisigError::InvalidRefundeeAccount)?;
    assert_that(refundee.is_writable, MultisigError::ImmutableRefundeeAccount)?;

    Ok(())
}
