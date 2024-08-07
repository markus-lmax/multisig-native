use solana_program::{account_info::AccountInfo, declare_id, entrypoint, entrypoint::ProgramResult, msg, pubkey::Pubkey};

const ANCHOR_ACCT_DESCRIM_SIZE: usize = 8; // TODO replace, not relevant anymore
const VEC_SIZE: usize = 4;
const PUBKEY_SIZE: usize = 32;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "LMAX Multisig (Native)",
    project_url: "https://www.lmax.com",
    contacts: "email:infosec@lmax.com",
    policy: "https://lmax.com/.well-known/security.txt",

    preferred_languages: "en",
    auditors: "none (yet)"
}

#[macro_export]
macro_rules! vec_len {
    ( $elem_size:expr, $elem_count:expr ) => {
        {
            ($elem_size * $elem_count + VEC_SIZE)
        }
    };
}

#[macro_export]
macro_rules! instructions_len {
    ( $instructions: expr) => {
        {
            ($instructions.iter().map(|ix| {
                PUBKEY_SIZE + vec_len!(PUBKEY_SIZE + 1 + 1, ix.accounts.len()) + vec_len!(1, ix.data.len())
            })
            .sum::<usize>() + VEC_SIZE)
        }
    };
}

#[macro_export]
macro_rules! multisig_data_len {
    ( $owner_count:expr ) => {
        {
            (ANCHOR_ACCT_DESCRIM_SIZE + vec_len!(PUBKEY_SIZE, $owner_count) + 8 + 1 + 4)
        }
    };
}

#[macro_export]
macro_rules! transaction_data_len {
    ( $instructions:expr, $owner_count:expr ) => {
        {
            (ANCHOR_ACCT_DESCRIM_SIZE + PUBKEY_SIZE + instructions_len!($instructions) + vec_len!(1, $owner_count) + 4)
        }
    };
}

declare_id!("LMAXm1DhfBg1YMvi79gXdPfsJpYuJb9urGkGNa12hvJ");

entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    msg!("Hello, Multisig Native!");

    msg!("Our program's Program ID: {}", &program_id);

    Ok(())
}
