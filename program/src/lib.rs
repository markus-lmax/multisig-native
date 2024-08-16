pub mod instructions;
pub mod processor;
pub mod state;

use processor::process_instruction;
use solana_program::{declare_id, entrypoint};
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

declare_id!("LMAXm1DhfBg1YMvi79gXdPfsJpYuJb9urGkGNa12hvJ");

entrypoint!(process_instruction);
