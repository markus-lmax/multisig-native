use borsh::{BorshDeserialize, BorshSerialize};
use shank::ShankInstruction;
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

use crate::instructions::approve_transaction::approve_transaction;
use crate::instructions::cancel_transaction::cancel_transaction;
use crate::instructions::create_multisig::{create_multisig, CreateMultisigInstruction};
use crate::instructions::execute_transaction::execute_transaction;
use crate::instructions::propose_transaction::{
    propose_transaction, ProposeTransactionInstruction,
};
use crate::instructions::set_owners::{set_owners, SetOwnersInstruction};
use crate::instructions::change_threshold::{change_threshold, ChangeThresholdInstruction};
use crate::instructions::set_owners_and_change_threshold::{set_owners_and_change_threshold, SetOwnersAndChangeThresholdInstruction};

#[derive(BorshSerialize, BorshDeserialize, ShankInstruction)]
pub enum MultisigInstruction {
    #[account(0, writable, signer, name = "multisig", desc = "The multisig account to create")]
    #[account(1, name = "multisig_signer", desc = "The multisig PDA signer")]
    #[account(2, writable, signer, name = "payer", desc = "The payer for account creation")]
    #[account(3, name = "system_program", desc = "The system program")]
    CreateMultisig(CreateMultisigInstruction),

    #[account(0, writable, name = "multisig", desc = "The multisig account")]
    #[account(1, signer, name = "multisig_signer", desc = "The multisig PDA signer")]
    SetOwners(SetOwnersInstruction),

    #[account(0, writable, name = "multisig", desc = "The multisig account")]
    #[account(1, signer, name = "multisig_signer", desc = "The multisig PDA signer")]
    ChangeThreshold(ChangeThresholdInstruction),

    #[account(0, writable, name = "multisig", desc = "The multisig account")]
    #[account(1, signer, name = "multisig_signer", desc = "The multisig PDA signer")]
    SetOwnersAndChangeThreshold(SetOwnersAndChangeThresholdInstruction),

    #[account(0, name = "multisig", desc = "The multisig account")]
    #[account(1, writable, signer, name = "transaction", desc = "The transaction account to create")]
    #[account(2, signer, name = "proposer", desc = "The proposer (must be an owner)")]
    #[account(3, writable, signer, name = "payer", desc = "The payer for account creation")]
    #[account(4, name = "system_program", desc = "The system program")]
    ProposeTransaction(ProposeTransactionInstruction),

    #[account(0, name = "multisig", desc = "The multisig account")]
    #[account(1, writable, name = "transaction", desc = "The transaction account")]
    #[account(2, signer, name = "approver", desc = "The approver (must be an owner)")]
    ApproveTransaction(),

    #[account(0, name = "multisig", desc = "The multisig account")]
    #[account(1, name = "multisig_signer", desc = "The multisig PDA signer")]
    #[account(2, writable, name = "transaction", desc = "The transaction account")]
    #[account(3, writable, name = "refundee", desc = "The account to receive the rent refund")]
    #[account(4, signer, name = "executor", desc = "The executor (must be an owner)")]
    ExecuteTransaction(),

    #[account(0, name = "multisig", desc = "The multisig account")]
    #[account(1, writable, name = "transaction", desc = "The transaction account")]
    #[account(2, writable, name = "refundee", desc = "The account to receive the rent refund")]
    #[account(3, signer, name = "executor", desc = "The executor (must be an owner)")]
    CancelTransaction(),
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if let Ok(instruction) = MultisigInstruction::try_from_slice(data) {
        return match instruction {
            MultisigInstruction::CreateMultisig(create_data) => {
                create_multisig(program_id, accounts, create_data)
            }
            MultisigInstruction::SetOwners(set_owners_data) => {
                set_owners(program_id, accounts, set_owners_data)
            }
            MultisigInstruction::ChangeThreshold(change_threshold_data) => {
                change_threshold(program_id, accounts, change_threshold_data)
            }
            MultisigInstruction::SetOwnersAndChangeThreshold(set_owners_and_change_threshold_data) => {
                set_owners_and_change_threshold(program_id, accounts, set_owners_and_change_threshold_data)
            }
            MultisigInstruction::ProposeTransaction(propose_data) => {
                propose_transaction(program_id, accounts, propose_data)
            }
            MultisigInstruction::ApproveTransaction() => approve_transaction(accounts),
            MultisigInstruction::ExecuteTransaction() => execute_transaction(program_id, accounts),
            MultisigInstruction::CancelTransaction() => cancel_transaction(accounts),
        };
    }
    Err(ProgramError::InvalidInstructionData)
}
