import {describe, test} from "node:test";
import {Keypair, PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {start} from "solana-bankrun";
import {MultisigDsl} from "../ts";

describe("set owners", async () => {
  const programId = PublicKey.unique();
  const context = await start([{ name: "multisig_native", programId: programId }], []);
  const dsl = new MultisigDsl(programId, context);

  test("change owners of multisig", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey];

    const setOwners = dsl.createSetOwnersInstruction(multisig.address, newOwners);
    const [transactionAddress, _txMeta] = await dsl.proposeTransaction(ownerA, [setOwners], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, setOwners, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.strictEqual(actualMultisig["nonce"], multisig.nonce);
    assert.strictEqual(actualMultisig["threshold"], multisig.threshold);
    assert.deepEqual(actualMultisig["owners"], newOwners.map(owner => Array.from(owner.toBytes())));
    assert.strictEqual(actualMultisig["owner_set_seqno"], 1);
  });

  // TODO is there some Anchor magic that makes this work?
  test.skip("allows re-expansion of owner list", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, ownerC] = multisig.owners;

    // Create and execute instruction to shrink multisig owners
    const shrinkOwnersInstruction = dsl.createSetOwnersInstruction(multisig.address, [ownerA.publicKey, ownerB.publicKey]);
    const [shrinkOwnersAddress, _txMeta1] = await dsl.proposeTransaction(ownerA, [shrinkOwnersInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, shrinkOwnersAddress);
    await dsl.executeTransaction(shrinkOwnersAddress, shrinkOwnersInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    // Create and execute instruction to re-expand multisig owners
    const expandOwnersInstruction = dsl.createSetOwnersInstruction(multisig.address, [ownerA.publicKey, ownerB.publicKey, ownerC.publicKey]);
    const [expandOwnersAddress, _txMeta2]= await dsl.proposeTransaction(ownerA, [expandOwnersInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, expandOwnersAddress);
    await dsl.executeTransaction(expandOwnersAddress, expandOwnersInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    const actualMultisig = await dsl.getMultisig(multisig.address);
    assert.deepStrictEqual(actualMultisig["owners"], [ownerA, ownerB, ownerC].map(o => Array.from(o.publicKey.toBytes())));
  });

  /*

  test("should propose, sign and execute changing owners of multisig within one transaction", async () => {
    const numberOfOwners = 9;
    const threshold = 4;
    const multisig = await dsl.createMultisig(threshold, numberOfOwners);
    const newOwner = Keypair.generate();

    // Create instruction to change multisig owners
    const transactionInstruction = await program.methods
        .setOwners([newOwner.publicKey, ...multisig.owners.slice(1).map(owner => owner.publicKey)])
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    await dsl.proposeSignAndExecuteTransaction(multisig.owners[1], multisig.owners.slice(2, threshold + 1), [transactionInstruction], multisig.signer, multisig.address, multisig.owners[1], multisig.owners[1].publicKey);
  })

  test("should not allow old owners to propose new transaction after ownership change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    // Create instruction to change multisig owners
    let transactionInstruction = await program.methods
        .setOwners([newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey])
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    const transactionAddress: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    let transactionInstruction2 = await program.methods
        .setOwners(multisig.owners.map(owner => owner.publicKey))
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    try {
      await dsl.proposeTransaction(ownerA, [transactionInstruction2], multisig.address);
      fail("Should have failed to propose transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: InvalidOwner. Error Number: 6000. Error Message: The given owner is not part of this multisig"));
    }
  });

  test("should not allow old owners to approve new transaction after ownership change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    // Create instruction to change multisig owners
    let transactionInstruction = await program.methods
        .setOwners([newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey])
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    const transactionAddress: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    let transactionInstruction2 = await program.methods
        .setOwners(multisig.owners.map(owner => owner.publicKey))
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    const transactionAddress2: PublicKey = await dsl.proposeTransaction(newOwnerA, [transactionInstruction2], multisig.address);

    try {
      await dsl.approveTransaction(ownerB, multisig.address, transactionAddress2);
      fail("Should have failed to approve transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: InvalidOwner. Error Number: 6000. Error Message: The given owner is not part of this multisig"));
    }
  });

  test("should not allow any more approvals on a transaction if owners change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    // Create instruction to change multisig owners
    let transactionInstruction = await program.methods
        .setOwners([newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey])
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    const transactionAddress: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    let transactionInstruction2 = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: new BN(1_000_000),
      toPubkey: provider.publicKey,
    });

    const transactionAddress2: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction2], multisig.address);

    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    let transactionAccount = await program.account.transaction.fetch(transactionAddress2);
    let actualMultisig = await program.account.multisig.fetch(multisig.address);

    assert.strictEqual(actualMultisig.ownerSetSeqno, 1, "Should have incremented owner set seq number");
    assert.strictEqual(transactionAccount.ownerSetSeqno, 0, "Owner set sequence number should not have updated");

    try {
      await dsl.approveTransaction(newOwnerB, multisig.address, transactionAddress2);
      fail("Should have failed to approve transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated."));
    }
  });

  test("should not allow transaction execution if owners change", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

    // Create instruction to change multisig owners
    let transactionInstruction = await program.methods
        .setOwners([newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey])
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    const transactionAddress: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);

    let transactionInstruction2 = SystemProgram.transfer({
      fromPubkey: multisig.signer,
      lamports: new BN(1_000_000),
      toPubkey: provider.publicKey,
    });

    const transactionAddress2: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction2], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress2);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    let transactionAccount = await program.account.transaction.fetch(transactionAddress2);
    let actualMultisig = await program.account.multisig.fetch(multisig.address);

    assert.strictEqual(actualMultisig.ownerSetSeqno, 1, "Should have incremented owner set seq number");
    assert.strictEqual(transactionAccount.ownerSetSeqno, 0, "Owner set sequence number should not have updated");

    try {
      await dsl.executeTransaction(transactionAddress2, transactionInstruction2, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
      fail("Should have failed to execute transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated."));
    }
  });

  test("should not allow owners to be changed by non multisig signer", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, _ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey];

    try {
      // Attempt to change the multisig owners
      await program.methods
          .setOwners(newOwners)
          .accounts({
            multisig: multisig.address,
            multisigSigner: multisig.signer,
          })
          .rpc();
      fail("Should have failed to execute transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp("Signature verification failed"));
    }

    try {
      // Attempt to change the multisig owners with provider key as signer
      await program.methods
          .setOwners(newOwners)
          .accounts({
            multisig: multisig.address,
            multisigSigner: provider.publicKey,
          })
          .rpc();
      fail("Should have failed to execute transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated"));
    }

    try {
      // Attempt to change the multisig owners with an owner key as signer
      await program.methods
          .setOwners(newOwners)
          .accounts({
            multisig: multisig.address,
            multisigSigner: ownerA.publicKey,
          })
          .signers([ownerA])
          .rpc();
      fail("Should have failed to execute transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated"));
    }
  });

  test("should not allow owners to be changed to empty list", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const newOwners = [];

    // Create instruction to change multisig owners
    let transactionInstruction = await program.methods
        .setOwners(newOwners)
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    const transactionAddress: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    try {
      await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
      fail("Should have not executed transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: NotEnoughOwners. Error Number: 6001. Error Message: Owners length must be non zero."));
    }
  });

  test("should update threshold to owners list length if new owners list is smaller than threshold", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const newOwnerA = Keypair.generate();
    const newOwners = [newOwnerA.publicKey];

    // Create instruction to change multisig owners
    let transactionInstruction = await program.methods
        .setOwners(newOwners)
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
        })
        .instruction();

    const transactionAddress: PublicKey = await dsl.proposeTransaction(ownerA, [transactionInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);
    await dsl.executeTransaction(transactionAddress, transactionInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);

    let actualMultisig = await program.account.multisig.fetch(multisig.address);
    assert.strictEqual(actualMultisig.nonce, multisig.nonce);
    assert.ok(new BN(1).eq(actualMultisig.threshold), "Should have updated threshold to owners length");
    assert.deepStrictEqual(actualMultisig.owners, newOwners, "Should have updated to new owners");
    assert.strictEqual(actualMultisig.ownerSetSeqno, 1, "Should have incremented owner set seq number");
  });

  test("should not allow increasing number of owners of multisig", async () => {
    const multisig = await dsl.createMultisig(2, 3);
    const [ownerA, ownerB, _ownerC] = multisig.owners;
    const [newOwnerA, newOwnerB, newOwnerC, newOwnerD] =
        [Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const newOwners = [newOwnerA.publicKey, newOwnerB.publicKey, newOwnerC.publicKey, newOwnerD.publicKey];

    // Create instruction to change multisig owners
    let setOwnersInstruction = await program.methods
        .setOwners(newOwners)
        .accounts({
          multisig: multisig.address,
          multisigSigner: multisig.signer,
          payer: provider.publicKey,
        })
        .instruction();

    const transactionAddress: PublicKey = await dsl.proposeTransaction(ownerA, [setOwnersInstruction], multisig.address);
    await dsl.approveTransaction(ownerB, multisig.address, transactionAddress);

    try {
      await dsl.executeTransaction(transactionAddress, setOwnersInstruction, multisig.signer, multisig.address, ownerB, ownerA.publicKey);
      fail("Should have not executed transaction");
    } catch (e) {
      assert.match(e.message,
          new RegExp(".*Error Code: TooManyOwners. Error Number: 6002. Error Message: The number of owners cannot be increased."));
    }
  });
 */
});
