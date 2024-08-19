use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use crate::instructions::propose_transaction::TransactionInstructionData;

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct Transaction {
    // The multisig account this transaction belongs to.
    pub multisig: Pubkey,
    // The instructions to be executed by this transaction
    pub instructions: Vec<TransactionInstructionData>,
    // signers[index] is true iff multisig.owners[index] signed the transaction.
    pub signers: Vec<bool>,
    // Owner set sequence number.
    pub owner_set_seqno: u32,
}

impl Transaction {
    pub fn len(&self) -> usize {
        32 +                                                           // multisig
        4 + self.instructions.iter().map(|instr| instr.len()).sum::<usize>() +  // instructions
        4 + self.signers.len() +                                       // signers
        4                                                              // owner_set_seqno
    }
}

