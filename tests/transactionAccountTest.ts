import {describe, test} from 'node:test';
import {PublicKey, Transaction} from '@solana/web3.js';
import {assert} from 'chai';
import {start} from 'solana-bankrun';
import {createCreateMultisigInstruction, createProposeTransactionInstruction} from '../ts';

describe('transaction account', async () => {
  const PROGRAM_ID = PublicKey.unique();
  const context = await start([{ name: 'multisig_native', programId: PROGRAM_ID }], []);
  const client = context.banksClient;
  const payer = context.payer;

  test('Log propose_transaction', async () => {
    const tx = new Transaction().add(createProposeTransactionInstruction(payer.publicKey, PROGRAM_ID, [PublicKey.unique(), PublicKey.unique()]));
    tx.recentBlockhash = context.lastBlockhash;
    tx.sign(payer);

    const transaction = await client.processTransaction(tx);

    assert(transaction.logMessages[0].startsWith(`Program ${PROGRAM_ID}`));
    assert(transaction.logMessages[1] === `Program log: Our program's Program ID: ${PROGRAM_ID}`);
    assert(transaction.logMessages[2].startsWith(`Program log: Instruction: ProposeTransaction - ProposeTransactionInstructionData { instructions: [TransactionInstructionData { program_id:`));
    assert(transaction.logMessages[3].startsWith(`Program ${PROGRAM_ID} consumed`));
    assert(transaction.logMessages[4] === `Program ${PROGRAM_ID} success`);
    assert(transaction.logMessages.length === 5);
  })
});
