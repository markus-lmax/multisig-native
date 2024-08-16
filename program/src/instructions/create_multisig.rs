use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::program::invoke;
use solana_program::pubkey::Pubkey;
use solana_program::rent::Rent;
use solana_program::sysvar::Sysvar;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, system_instruction,
};

use crate::state::multisig::Multisig;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CreateMultisigInstructionData {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub nonce: u8,
}

pub fn create_multisig(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: CreateMultisigInstructionData,
) -> ProgramResult {
    msg!("Instruction: CreateMultisig - {:?}", data);
    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let multisig_signer = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    validate(
        program_id,
        multisig_account,
        multisig_signer,
        payer,
        system_program,
        &data,
    )?;
    let multisig_data = Multisig {
        owners: data.owners,
        threshold: data.threshold,
        nonce: data.nonce,
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
        &[
            payer.clone(),
            multisig_account.clone(),
            system_program.clone(),
        ],
    )?;

    multisig_data.serialize(&mut &mut multisig_account.data.borrow_mut()[..])?;

    Ok(())
}

fn validate(
    _program_id: &Pubkey,
    _multisig: &AccountInfo,
    _multisig_signer: &AccountInfo,
    _payer: &AccountInfo,
    _system_program: &AccountInfo,
    _data: &CreateMultisigInstructionData,
) -> ProgramResult {
    // TODO implement checks
    Ok(())
}
