use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::{Pubkey, PUBKEY_BYTES};

#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct Multisig {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub nonce: u8,
    pub owner_set_seqno: u32,
    pub padding: Vec<u8>
}

impl Multisig {
    pub fn len(&self) -> usize {
        4 + PUBKEY_BYTES * self.owners.len() +  // owners
            1 +                                 // threshold
            1 +                                 // nonce
            4 +                                 // owner_set_seqno
            4 + self.padding.len()  // padding (used to allow re-expansion of owners list)
    }
}
