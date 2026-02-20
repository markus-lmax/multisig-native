use crate::errors::{assert_present, assert_success, assert_that, MultisigError};
use crate::state::multisig::Multisig;
use crate::state::transaction::Transaction;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

pub fn approve_transaction(
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("invoke approve_transaction");
    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let transaction_account = next_account_info(accounts_iter)?;
    let approver = next_account_info(accounts_iter)?;

    let multisig = Multisig::try_from_slice(&multisig_account.data.borrow())?;
    let mut transaction = assert_success(
        Transaction::try_from_slice(&transaction_account.data.borrow()),
        MultisigError::MalformedTransactionAccount
    )?;


    validate(&multisig, &transaction, approver, transaction_account, multisig_account)?;

    let owner_index = assert_present(
        multisig.owners.iter().position(|a| a == approver.key),
        MultisigError::InvalidOwner
    )?;
    transaction.signers[owner_index] = true;

    transaction.serialize(&mut &mut transaction_account.data.borrow_mut()[..])?;
    Ok(())
}

fn validate(
    multisig: &Multisig,
    transaction: &Transaction,
    approver: &AccountInfo,
    transaction_account: &AccountInfo,
    multisig_account: &AccountInfo,
) -> ProgramResult {
    assert_that(
        multisig.owner_set_seqno == transaction.owner_set_seqno,
        MultisigError::InvalidOwnerSetSequenceNumber,
    )?;
    assert_that(approver.is_signer, MultisigError::ApproverNotSigner)?;
    assert_that(transaction_account.is_writable, MultisigError::ImmutableTransactionAccount)?;
    assert_that(transaction.multisig == *multisig_account.key, MultisigError::InvalidTransactionAccount)?;
    Ok(())
}
