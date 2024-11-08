use crate::errors::{assert_that, assert_unique_owners, MultisigError};
use crate::state::multisig::Multisig;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::program::invoke;
use solana_program::pubkey::Pubkey;
use solana_program::rent::Rent;
use solana_program::sysvar::Sysvar;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, system_instruction,
};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CreateMultisigInstruction {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub nonce: u8,
}

pub fn create_multisig(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction: CreateMultisigInstruction,
) -> ProgramResult {
    msg!("invoke create_multisig - {:?}", instruction);
    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let multisig_signer = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    validate(program_id, multisig_account, multisig_signer, payer, system_program, &instruction)?;

    let multisig_data = Multisig {
        owners: instruction.owners,
        threshold: instruction.threshold,
        nonce: instruction.nonce,
        owner_set_seqno: 0,
    };
    invoke(
        &system_instruction::create_account(
            payer.key,
            multisig_account.key,
            Rent::get()?.minimum_balance(multisig_data.len()),
            multisig_data.len().try_into().unwrap(),
            program_id,
        ),
        &[payer.clone(), multisig_account.clone(), system_program.clone(), ],
    )?;
    multisig_data.serialize(&mut &mut multisig_account.data.borrow_mut()[..])?;
    Ok(())
}

fn validate(
    program_id: &Pubkey,
    multisig: &AccountInfo,
    multisig_signer: &AccountInfo,
    _payer: &AccountInfo,
    _system_program: &AccountInfo,
    instruction: &CreateMultisigInstruction,
) -> ProgramResult {
    // TODO test and implement anchor-internal checks
    assert_unique_owners(&instruction.owners)?;
    assert_that(
        instruction.threshold > 0 && instruction.threshold <= instruction.owners.len() as u8,
        MultisigError::InvalidThreshold,
    )?;
    let pda_address = Pubkey::create_program_address(
        &[multisig.key.as_ref(), &[instruction.nonce][..]],
        &program_id,
    );
    if pda_address.is_err() {
        // TODO ugly hack to re-use the custom log message inside `assert_that` -
        //  is there nicer way to do this via `map_err` or something similar?
        assert_that(false, MultisigError::ConstraintSeeds)?;
    }
    assert_that(
        multisig_signer.key.as_ref() == pda_address?.as_ref(),
        MultisigError::ConstraintSeeds,
    )?;
    Ok(())
}
