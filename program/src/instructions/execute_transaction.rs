use crate::errors::{assert_success, assert_that, MultisigError};
use crate::instructions::common::{close_account, validate_signer};
use crate::state::multisig::Multisig;
use crate::state::transaction::Transaction;
use borsh::BorshDeserialize;
use solana_program::account_info::next_account_info;
use solana_program::instruction::Instruction;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};

pub fn execute_transaction(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("invoke execute_transaction");

    let validated = validate(accounts)?;

    let signer_seeds = &[(*validated.multisig_account.key).as_ref(), &[validated.multisig.nonce]];
    validated
        .transaction
        .instructions
        .iter()
        .map(|ix| {
            let mut ix: Instruction = ix.into();
            ix.accounts = ix
                .accounts
                .iter()
                .map(|acc| {
                    let mut acc = acc.clone();
                    if acc.pubkey == *validated.multisig_signer.key {
                        acc.is_signer = true;
                    }
                    acc
                })
                .collect();
            solana_program::program::invoke_signed(&ix, accounts, &[&signer_seeds[..]])
        })
        .collect::<Result<Vec<_>, _>>()?;

    close_account(validated.transaction_account, validated.refundee)
}

struct ValidatedAccounts<'a, 'b> {
    multisig_account: &'a AccountInfo<'b>,
    multisig_signer: &'a AccountInfo<'b>,
    transaction_account: &'a AccountInfo<'b>,
    refundee: &'a AccountInfo<'b>,
    multisig: Multisig,
    transaction: Transaction,
}

fn validate<'a, 'b>(accounts: &'a [AccountInfo<'b>]) -> Result<ValidatedAccounts<'a, 'b>, ProgramError>
where
    'b: 'a,
{
    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let multisig_signer = next_account_info(accounts_iter)?;
    let transaction_account = next_account_info(accounts_iter)?;
    let refundee = next_account_info(accounts_iter)?;
    let executor = next_account_info(accounts_iter)?;

    let multisig = Multisig::try_from_slice(&multisig_account.data.borrow())?;
    let transaction = assert_success(
        Transaction::try_from_slice(&transaction_account.data.borrow()),
        MultisigError::MalformedTransactionAccount,
    )?;
    assert_that(executor.is_signer && multisig.owners.contains(executor.key), MultisigError::InvalidExecutor)?;
    assert_that(multisig.owner_set_seqno == transaction.owner_set_seqno, MultisigError::InvalidOwnerSetSequenceNumber)?;

    validate_signer(multisig_signer, multisig_account, &multisig, multisig_account.owner)?;

    assert_that(transaction_account.is_writable, MultisigError::ImmutableTransactionAccount)?;
    assert_that(transaction.multisig == *multisig_account.key, MultisigError::InvalidTransactionAccount)?;
    assert_that(refundee.key != transaction_account.key, MultisigError::InvalidRefundeeAccount)?;
    assert_that(refundee.is_writable, MultisigError::ImmutableRefundeeAccount)?;

    let approval_count = transaction.signers.iter().filter(|&did_sign| *did_sign).count() as u8;
    assert_that(approval_count >= multisig.threshold, MultisigError::NotEnoughSigners)?;

    Ok(ValidatedAccounts { multisig_account, multisig_signer, transaction_account, refundee, multisig, transaction })
}
