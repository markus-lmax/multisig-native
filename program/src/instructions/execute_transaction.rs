use crate::errors::{assert_success, assert_that, MultisigError};
use crate::instructions::common::close_account;
use crate::state::multisig::Multisig;
use crate::state::transaction::Transaction;
use borsh::BorshDeserialize;
use solana_program::account_info::next_account_info;
use solana_program::instruction::Instruction;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

pub fn execute_transaction(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("invoke execute_transaction");

    // TODO extract 3 methods from the below sections

    // validate accounts
    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let multisig_signer = next_account_info(accounts_iter)?;
    let transaction_account = next_account_info(accounts_iter)?;
    let refundee = next_account_info(accounts_iter)?;
    let executor = next_account_info(accounts_iter)?;

    let multisig = Multisig::try_from_slice(&multisig_account.data.borrow())?;
    let transaction = assert_success(
        Transaction::try_from_slice(&transaction_account.data.borrow()),
        MultisigError::MalformedTransactionAccount
    )?;

    assert_that(executor.is_signer && multisig.owners.contains(executor.key), MultisigError::InvalidExecutor)?;
    assert_that(multisig.owner_set_seqno == transaction.owner_set_seqno, MultisigError::InvalidOwnerSetSequenceNumber)?;

    let pda_address = Pubkey::create_program_address(
        &[multisig_account.key.as_ref(), &[multisig.nonce][..]],
        &program_id,
    ).map_err(|err| {
        msg!("could not derive pda address from multisig {} and nonce {}: {}", multisig_account.key, multisig.nonce, err);
        ProgramError::InvalidSeeds
    })?;
    assert_that(multisig_signer.key.as_ref() == pda_address.as_ref(), ProgramError::InvalidSeeds)?;

    assert_that(transaction_account.is_writable, MultisigError::ImmutableTransactionAccount)?;
    assert_that(transaction.multisig == *multisig_account.key, MultisigError::InvalidTransactionAccount)?;
    assert_that(refundee.key != transaction_account.key, MultisigError::InvalidRefundeeAccount)?;
    assert_that(refundee.is_writable, MultisigError::ImmutableRefundeeAccount)?;

    let approval_count = transaction.signers.iter()
        .filter(|&did_sign| *did_sign)
        .count() as u8;
    assert_that(approval_count >= multisig.threshold, MultisigError::NotEnoughSigners)?;

    let multisig_key = *multisig_account.key;
    let multisig_signer_key = *multisig_signer.key;

    // execute transaction
    let signer_seeds = &[multisig_key.as_ref(), &[multisig.nonce]];
    transaction
        .instructions
        .iter()
        .map(|ix| {
            let mut ix: Instruction = ix.into();
            ix.accounts = ix
                .accounts
                .iter()
                .map(|acc| {
                    let mut acc = acc.clone();
                    if acc.pubkey == multisig_signer_key {
                        acc.is_signer = true;
                    }
                    acc
                })
                .collect();
            solana_program::program::invoke_signed(&ix, accounts, &[&signer_seeds[..]])
        })
        .collect::<Result<Vec<_>, _>>()?;

    close_account(transaction_account, refundee)
}
