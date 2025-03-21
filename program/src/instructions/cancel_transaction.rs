use solana_program::pubkey::Pubkey;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg};
use solana_program::account_info::next_account_info;

pub fn cancel_transaction(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("invoke cancel_transaction");

    let accounts_iter = &mut accounts.iter();
    let multisig_account = next_account_info(accounts_iter)?; // TODO #[account(constraint = multisig.owner_set_seqno>= transaction.owner_set_seqno)]
    let transaction_account = next_account_info(accounts_iter)?; // TODO #[account(mut, has_one = multisig, close = refundee)]
    let refundee = next_account_info(accounts_iter)?;
    let executor = next_account_info(accounts_iter)?; // Signer

    // TODO if !(ctx.accounts.multisig.owners.contains(ctx.accounts.executor.key)) { ErrorCode::InvalidExecutor.name()

    // TODO close TX account and send funds to given refundee, see https://solana.com/developers/courses/program-security/closing-accounts

    Ok(())
}
