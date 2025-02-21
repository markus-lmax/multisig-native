use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::next_account_info;
use solana_program::program::invoke;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;
use solana_program::rent::Rent;
use solana_program::system_program;
use solana_program::sysvar::Sysvar;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, system_instruction};
use solana_program::instruction::{AccountMeta, Instruction};
use crate::errors::{assert_present, assert_that, MultisigError};
use crate::state::multisig::Multisig;
use crate::state::transaction::Transaction;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct TransactionInstructionAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}
impl From<&TransactionInstructionAccount> for AccountMeta {
    fn from(account: &TransactionInstructionAccount) -> AccountMeta {
        match account.is_writable {
            false => AccountMeta::new_readonly(account.pubkey, account.is_signer),
            true => AccountMeta::new(account.pubkey, account.is_signer),
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct TransactionInstructionData {
    pub program_id: Pubkey,
    pub accounts: Vec<TransactionInstructionAccount>,
    pub data: Vec<u8>,
}
impl TransactionInstructionData {
    pub fn len(&self) -> usize {
        32 +                                          // program_id
            4 + (32 + 1 + 1) * self.accounts.len() +  // accounts
            4 + self.data.len()                       // data
    }

}
impl From<&TransactionInstructionData> for Instruction {
    fn from(ix: &TransactionInstructionData) -> Instruction {
        Instruction {
            program_id: ix.program_id,
            accounts: ix.accounts.iter().map(Into::into).collect(),
            data: ix.data.clone(),
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProposeTransactionInstruction {
    pub instructions: Vec<TransactionInstructionData>,
}

pub fn propose_transaction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction: ProposeTransactionInstruction,
) -> ProgramResult {
    msg!("invoke propose_transaction - {:?}", instruction);
    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?;
    let transaction_account = next_account_info(accounts_iter)?;
    let proposer = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    validate(proposer, system_program, &instruction)?;

    let multisig = Multisig::try_from_slice(&multisig_account.data.borrow())?;
    let owner_index = assert_present(
        multisig.owners.iter().position(|a| a == proposer.key),
        MultisigError::InvalidOwner
    )?;
    let mut signers = Vec::new();
    signers.resize(multisig.owners.len(), false);
    signers[owner_index] = true;

    let transaction_data: Transaction = Transaction {
        multisig: *multisig_account.key,
        instructions: instruction.instructions,
        signers,
        owner_set_seqno: 0,
    };
    invoke(
        &system_instruction::create_account(
            payer.key,
            transaction_account.key,
            Rent::get()?.minimum_balance(transaction_data.len()),
            transaction_data.len().try_into().unwrap(),
            program_id,
        ),
        &[payer.clone(), transaction_account.clone(), system_program.clone()],
    )?;
    transaction_data.serialize(&mut &mut transaction_account.data.borrow_mut()[..])?;

    Ok(())
}

fn validate(
    proposer: &AccountInfo,
    system_program: &AccountInfo,
    instruction: &ProposeTransactionInstruction,
) -> ProgramResult {
    assert_that(system_program.key == &system_program::id(), ProgramError::IncorrectProgramId)?;
    assert_that(proposer.is_signer, MultisigError::ProposerNotSigner)?;
    assert_that(!instruction.instructions.is_empty(), MultisigError::MissingInstructions)?;
    Ok(())
}

