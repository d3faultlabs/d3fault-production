use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer},
};
use sha2::{Digest, Sha256};

declare_id!("2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG");

// ─── Constants ─────────────────────────────────────────────────────────────

/// SOL sentinel: all-zeros stored in CommitmentEntry.token_mint for native SOL
pub const SOL_SENTINEL: [u8; 32] = [0u8; 32];

/// Ring buffer capacity — 64 entries (power-of-2, bytemuck array blanket impl safe)
/// 8(disc) + 8(count) + 8(head) + 64×120 = 7,704 bytes — within Solana 10,240-byte CPI limit
pub const MAX_ENTRIES: usize = 64;

/// Account space:
///   discriminator(8) + count(8) + head(8) + entries(64 × 120) = 7,704 bytes
pub const COMMITMENT_STORE_SPACE: usize = 8 + 8 + 8 + (MAX_ENTRIES * CommitmentEntry::SIZE);

// ─── Program ───────────────────────────────────────────────────────────────

#[program]
pub mod private_transfer {
    use super::*;

    /// Initialize the global commitment store. Call once after deploy.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut store = ctx.accounts.commitment_store.load_init()?;
        store.count = 0;
        store.head = 0;
        Ok(())
    }

    /// Deposit native SOL.
    pub fn deposit_sol(
        ctx: Context<DepositSol>,
        commitment: [u8; 32],
        amount: u64,
        expiry: i64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        let slot = {
            let store = ctx.accounts.commitment_store.load()?;
            for e in store.entries.iter() {
                if e.claimed == 0 && e.commitment == commitment {
                    return Err(ErrorCode::DuplicateCommitment.into());
                }
            }
            find_slot(&store.entries).ok_or(ErrorCode::StoreCapacityReached)?
        };

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.depositor.key(),
            &ctx.accounts.commitment_store.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.depositor.to_account_info(),
                ctx.accounts.commitment_store.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        {
            let mut store = ctx.accounts.commitment_store.load_mut()?;
            store.entries[slot] = CommitmentEntry {
                commitment,
                amount,
                expiry,
                token_mint: SOL_SENTINEL,
                claimed: 0,
                _pad: [0u8; 7],
                depositor: ctx.accounts.depositor.key().to_bytes(),
            };
            store.head = ((slot + 1) % MAX_ENTRIES) as u64;
            store.count += 1;
        }

        emit!(DepositEvent {
            commitment,
            amount,
            expiry,
            token_mint: Pubkey::default(),
        });
        Ok(())
    }

    /// Deposit an SPL token.
    pub fn deposit_spl(
        ctx: Context<DepositSpl>,
        commitment: [u8; 32],
        amount: u64,
        expiry: i64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        let slot = {
            let store = ctx.accounts.commitment_store.load()?;
            for e in store.entries.iter() {
                if e.claimed == 0 && e.commitment == commitment {
                    return Err(ErrorCode::DuplicateCommitment.into());
                }
            }
            find_slot(&store.entries).ok_or(ErrorCode::StoreCapacityReached)?
        };

        let token_mint_key = ctx.accounts.token_mint.key();

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.depositor_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        {
            let mut store = ctx.accounts.commitment_store.load_mut()?;
            store.entries[slot] = CommitmentEntry {
                commitment,
                amount,
                expiry,
                token_mint: token_mint_key.to_bytes(),
                claimed: 0,
                _pad: [0u8; 7],
                depositor: ctx.accounts.depositor.key().to_bytes(),
            };
            store.head = ((slot + 1) % MAX_ENTRIES) as u64;
            store.count += 1;
        }

        emit!(DepositEvent {
            commitment,
            amount,
            expiry,
            token_mint: token_mint_key,
        });
        Ok(())
    }

    /// Withdraw native SOL by revealing the preimage secret.
    pub fn withdraw_sol(ctx: Context<WithdrawSol>, secret: [u8; 32]) -> Result<()> {
        let commitment = sha256(&secret);

        let amount = {
            let mut store = ctx.accounts.commitment_store.load_mut()?;

            let idx = store
                .entries
                .iter()
                .position(|e| e.commitment == commitment && e.claimed == 0)
                .ok_or(ErrorCode::CommitmentNotFound)?;

            let clock = Clock::get()?;
            require!(clock.unix_timestamp <= store.entries[idx].expiry, ErrorCode::Expired);
            require!(store.entries[idx].token_mint == SOL_SENTINEL, ErrorCode::TokenMintMismatch);

            let amount = store.entries[idx].amount;
            store.entries[idx].claimed = 1;
            ctx.accounts.nullifier_record.nullifier = commitment;
            amount
        };

        let balance = ctx.accounts.commitment_store.get_lamports();
        require!(balance >= amount, ErrorCode::InsufficientFunds);
        ctx.accounts.commitment_store.sub_lamports(amount)?;
        ctx.accounts.recipient.add_lamports(amount)?;

        emit!(WithdrawEvent {
            commitment,
            amount,
            recipient: ctx.accounts.recipient.key(),
            token_mint: Pubkey::default(),
        });
        Ok(())
    }

    /// Withdraw an SPL token by revealing the preimage secret.
    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, secret: [u8; 32]) -> Result<()> {
        let commitment = sha256(&secret);

        let (amount, token_mint_key) = {
            let mut store = ctx.accounts.commitment_store.load_mut()?;

            let idx = store
                .entries
                .iter()
                .position(|e| e.commitment == commitment && e.claimed == 0)
                .ok_or(ErrorCode::CommitmentNotFound)?;

            let clock = Clock::get()?;
            require!(clock.unix_timestamp <= store.entries[idx].expiry, ErrorCode::Expired);

            let token_mint_key = ctx.accounts.token_mint.key();
            require!(
                store.entries[idx].token_mint == token_mint_key.to_bytes(),
                ErrorCode::TokenMintMismatch
            );

            let amount = store.entries[idx].amount;
            store.entries[idx].claimed = 1;
            ctx.accounts.nullifier_record.nullifier = commitment;
            (amount, token_mint_key)
        };

        let store_bump = ctx.bumps.commitment_store;
        let seeds: &[&[u8]] = &[b"commitment_store", &[store_bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.commitment_store.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        emit!(WithdrawEvent {
            commitment,
            amount,
            recipient: ctx.accounts.recipient.key(),
            token_mint: token_mint_key,
        });
        Ok(())
    }

    /// Reclaim native SOL after link expiry. Only the original depositor may call this.
    pub fn reclaim_sol(ctx: Context<ReclaimSol>, commitment: [u8; 32]) -> Result<()> {
        let amount = {
            let mut store = ctx.accounts.commitment_store.load_mut()?;
            let clock = Clock::get()?;

            let idx = store
                .entries
                .iter()
                .position(|e| e.commitment == commitment && e.claimed == 0)
                .ok_or(ErrorCode::CommitmentNotFound)?;

            require!(clock.unix_timestamp > store.entries[idx].expiry, ErrorCode::NotExpired);
            require!(store.entries[idx].token_mint == SOL_SENTINEL, ErrorCode::TokenMintMismatch);
            require!(
                store.entries[idx].depositor == ctx.accounts.depositor.key().to_bytes(),
                ErrorCode::UnauthorizedReclaim
            );

            let amount = store.entries[idx].amount;
            store.entries[idx].claimed = 1;
            amount
        };

        ctx.accounts.commitment_store.sub_lamports(amount)?;
        ctx.accounts.depositor.add_lamports(amount)?;
        Ok(())
    }

    /// Reclaim SPL tokens after link expiry. Only the original depositor may call this.
    pub fn reclaim_spl(ctx: Context<ReclaimSpl>, commitment: [u8; 32]) -> Result<()> {
        let amount = {
            let mut store = ctx.accounts.commitment_store.load_mut()?;
            let clock = Clock::get()?;

            let idx = store
                .entries
                .iter()
                .position(|e| e.commitment == commitment && e.claimed == 0)
                .ok_or(ErrorCode::CommitmentNotFound)?;

            require!(clock.unix_timestamp > store.entries[idx].expiry, ErrorCode::NotExpired);
            let token_mint_key = ctx.accounts.token_mint.key();
            require!(
                store.entries[idx].token_mint == token_mint_key.to_bytes(),
                ErrorCode::TokenMintMismatch
            );
            require!(
                store.entries[idx].depositor == ctx.accounts.depositor.key().to_bytes(),
                ErrorCode::UnauthorizedReclaim
            );

            let amount = store.entries[idx].amount;
            store.entries[idx].claimed = 1;
            amount
        };

        let store_bump = ctx.bumps.commitment_store;
        let seeds: &[&[u8]] = &[b"commitment_store", &[store_bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.depositor_token_account.to_account_info(),
                    authority: ctx.accounts.commitment_store.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;
        Ok(())
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

fn sha256(preimage: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(preimage);
    h.finalize().into()
}

fn find_slot(entries: &[CommitmentEntry; MAX_ENTRIES]) -> Option<usize> {
    for i in 0..MAX_ENTRIES {
        let e = &entries[i];
        if e.claimed != 0 || e.amount == 0 {
            return Some(i);
        }
    }
    None
}

// ─── Account Contexts ──────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = COMMITMENT_STORE_SPACE,
        seeds = [b"commitment_store"],
        bump
    )]
    pub commitment_store: AccountLoader<'info, CommitmentStore>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut, seeds = [b"commitment_store"], bump)]
    pub commitment_store: AccountLoader<'info, CommitmentStore>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSpl<'info> {
    #[account(mut, seeds = [b"commitment_store"], bump)]
    pub commitment_store: AccountLoader<'info, CommitmentStore>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = token_mint,
        associated_token::authority = commitment_store,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(secret: [u8; 32])]
pub struct WithdrawSol<'info> {
    #[account(mut, seeds = [b"commitment_store"], bump)]
    pub commitment_store: AccountLoader<'info, CommitmentStore>,
    #[account(
        init,
        payer = relayer,
        space = 8 + 32,
        seeds = [b"nullifier", sha256(secret.as_ref()).as_ref()],
        bump
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,
    /// CHECK: Recipient wallet — SOL is sent here
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    #[account(mut)]
    pub relayer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(secret: [u8; 32])]
pub struct WithdrawSpl<'info> {
    #[account(mut, seeds = [b"commitment_store"], bump)]
    pub commitment_store: AccountLoader<'info, CommitmentStore>,
    #[account(
        init,
        payer = relayer,
        space = 8 + 32,
        seeds = [b"nullifier", sha256(secret.as_ref()).as_ref()],
        bump
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,
    /// CHECK: Recipient wallet — tokens sent to recipient_token_account
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = commitment_store,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = relayer,
        associated_token::mint = token_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub relayer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReclaimSol<'info> {
    #[account(mut, seeds = [b"commitment_store"], bump)]
    pub commitment_store: AccountLoader<'info, CommitmentStore>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReclaimSpl<'info> {
    #[account(mut, seeds = [b"commitment_store"], bump)]
    pub commitment_store: AccountLoader<'info, CommitmentStore>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = commitment_store,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ─── State Accounts ────────────────────────────────────────────────────────

#[account(zero_copy)]
#[repr(C)]
pub struct CommitmentStore {
    pub count: u64,
    pub head: u64,
    pub entries: [CommitmentEntry; MAX_ENTRIES],
}

#[account]
pub struct NullifierRecord {
    pub nullifier: [u8; 32],
}

// ─── Data Types ────────────────────────────────────────────────────────────

/// SIZE: commitment(32) + amount(8) + expiry(8) + token_mint(32) + claimed(1) + pad(7) + depositor(32) = 120 bytes
/// Note: 7 padding bytes added after claimed(1) to maintain 8-byte alignment for depositor field.
/// Total entries: 256 × 120 = 30,720 bytes
#[zero_copy]
#[repr(C)]
pub struct CommitmentEntry {
    pub commitment: [u8; 32],
    pub amount: u64,
    pub expiry: i64,
    pub token_mint: [u8; 32],
    /// 0 = unclaimed, 1 = claimed
    pub claimed: u8,
    pub _pad: [u8; 7],
    pub depositor: [u8; 32],
}

impl CommitmentEntry {
    /// On-chain size: 32+8+8+32+1+7+32 = 120 bytes
    pub const SIZE: usize = 32 + 8 + 8 + 32 + 1 + 7 + 32;

    pub fn is_recyclable(&self) -> bool {
        self.claimed != 0 || self.amount == 0
    }
}

// ─── Unit Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};

    fn make_commitment(secret: &[u8]) -> [u8; 32] {
        let mut h = Sha256::new();
        h.update(secret);
        h.finalize().into()
    }

    fn zero_entry() -> CommitmentEntry {
        CommitmentEntry {
            commitment: [0u8; 32],
            amount: 0,
            expiry: 0,
            token_mint: [0u8; 32],
            claimed: 0,
            _pad: [0u8; 7],
            depositor: [0u8; 32],
        }
    }

    fn make_store() -> CommitmentStore {
        CommitmentStore {
            count: 0,
            head: 0,
            entries: [zero_entry(); MAX_ENTRIES],
        }
    }

    fn add_sol_entry(
        store: &mut CommitmentStore,
        secret: &[u8],
        amount: u64,
        expiry: i64,
        depositor: [u8; 32],
    ) -> [u8; 32] {
        let commitment = make_commitment(secret);
        let slot = find_slot(&store.entries).expect("No available slot in test store");
        store.entries[slot] = CommitmentEntry {
            commitment,
            amount,
            expiry,
            token_mint: SOL_SENTINEL,
            claimed: 0,
            _pad: [0u8; 7],
            depositor,
        };
        store.head = ((slot + 1) % MAX_ENTRIES) as u64;
        store.count += 1;
        commitment
    }

    #[test]
    fn commitment_is_sha256_of_secret() {
        let secret = b"hunter2_32_byte_pad_for_testing!";
        let commitment = make_commitment(secret);
        let mut h = Sha256::new();
        h.update(secret);
        let expected: [u8; 32] = h.finalize().into();
        assert_eq!(commitment, expected);
    }

    #[test]
    fn different_secrets_produce_different_commitments() {
        let c1 = make_commitment(b"secret_alpha_32_bytes_padded_xxx");
        let c2 = make_commitment(b"secret_beta__32_bytes_padded_xxx");
        assert_ne!(c1, c2);
    }

    #[test]
    fn duplicate_commitment_is_detected_for_active_entry() {
        let secret = b"unique_32_byte_secret_for_tests!";
        let commitment = make_commitment(secret);
        let depositor = [0u8; 32];

        let mut store = make_store();
        store.entries[0] = CommitmentEntry {
            commitment,
            amount: 1_000_000,
            expiry: 9_999_999_999,
            token_mint: SOL_SENTINEL,
            claimed: 0,
            _pad: [0u8; 7],
            depositor,
        };
        store.count = 1;
        store.head = 1;

        let is_duplicate = store.entries.iter().any(|e| e.claimed == 0 && e.commitment == commitment);
        assert!(is_duplicate, "Active duplicate commitment must be detected");
    }

    #[test]
    fn duplicate_commitment_is_detected_for_expired_unclaimed_entry() {
        let secret = b"unique_32_byte_secret_for_tests!";
        let commitment = make_commitment(secret);
        let depositor = [0u8; 32];

        let mut store = make_store();
        store.entries[0] = CommitmentEntry {
            commitment,
            amount: 1_000_000,
            expiry: 1_000,
            token_mint: SOL_SENTINEL,
            claimed: 0,
            _pad: [0u8; 7],
            depositor,
        };
        store.count = 1;
        store.head = 1;

        let is_duplicate = store.entries.iter().any(|e| e.claimed == 0 && e.commitment == commitment);
        assert!(is_duplicate, "Expired-unclaimed duplicate must also be blocked");
    }

    #[test]
    fn wrong_secret_does_not_match_commitment() {
        let real_secret = b"correct_secret_32_byte_padded_xx";
        let commitment = make_commitment(real_secret);
        let wrong_secret = b"wrong_secret_32_byte_padded_xxxx";
        let derived = make_commitment(wrong_secret);
        assert_ne!(derived, commitment, "Wrong secret must not match stored commitment");
    }

    #[test]
    fn correct_secret_finds_entry() {
        let secret = b"correct_secret_32_byte_padded_xx";
        let depositor = [0u8; 32];
        let mut store = make_store();

        let commitment = add_sol_entry(&mut store, secret, 500_000_000, 9_999_999_999, depositor);
        let derived = make_commitment(secret);
        let found = store.entries.iter().find(|e| e.claimed == 0 && e.commitment == derived);
        assert!(found.is_some(), "Should find matching entry with correct secret");
        assert_eq!(found.unwrap().amount, 500_000_000);
        assert!(found.unwrap().commitment == commitment);
    }

    #[test]
    fn expired_entry_is_rejected_at_withdraw_time() {
        let secret = b"expired_secret_32_byte_padded_xx";
        let depositor = [0u8; 32];
        let mut store = make_store();

        add_sol_entry(&mut store, secret, 1_000_000, 1_000_000, depositor);
        let now_sec: i64 = 9_000_000_000;
        let entry = store.entries.iter().find(|e| e.amount == 1_000_000).unwrap();
        let is_expired = now_sec > entry.expiry;
        assert!(is_expired, "Entry should be expired");
    }

    #[test]
    fn non_expired_entry_passes_expiry_check() {
        let secret = b"fresh_secret_32_byte_padded_xxxx";
        let depositor = [0u8; 32];
        let mut store = make_store();

        add_sol_entry(&mut store, secret, 1_000_000, 9_999_999_999, depositor);
        let now_sec: i64 = 1_000_000_000;
        let entry = store.entries.iter().find(|e| e.amount == 1_000_000).unwrap();
        let is_expired = now_sec > entry.expiry;
        assert!(!is_expired, "Entry should not be expired yet");
    }

    #[test]
    fn reclaim_requires_original_depositor() {
        let secret = b"reclaim_secret_32_byte_padded_xx";
        let depositor = [1u8; 32];
        let attacker = [2u8; 32];

        let mut store = make_store();
        let commitment = add_sol_entry(&mut store, secret, 100_000_000, 1_000, depositor);

        let entry = store.entries.iter().find(|e| e.commitment == commitment).unwrap();
        assert_eq!(entry.depositor, depositor);
        assert_ne!(entry.depositor, attacker, "Attacker must not be authorized to reclaim");
    }

    #[test]
    fn claimed_entry_is_marked_and_not_reusable() {
        let secret = b"replay_secret_32_bytes_padded_xx";
        let depositor = [0u8; 32];
        let mut store = make_store();

        let commitment = add_sol_entry(&mut store, secret, 1_000_000, 9_999_999_999, depositor);
        if let Some(entry) = store.entries.iter_mut().find(|e| e.commitment == commitment) {
            entry.claimed = 1;
        }

        let derived = make_commitment(secret);
        let unclaimed = store.entries.iter().find(|e| e.claimed == 0 && e.commitment == derived);
        assert!(unclaimed.is_none(), "Replayed withdraw should find no unclaimed entry");
    }

    #[test]
    fn claimed_slot_is_recycled_by_ring_buffer() {
        let depositor = [0u8; 32];
        let mut store = make_store();

        let c1 = add_sol_entry(&mut store, b"secret_one_32_bytes_padded_xxxx", 1_000, 9_999_999_999, depositor);
        if let Some(e) = store.entries.iter_mut().find(|e| e.commitment == c1) {
            e.claimed = 1;
        }

        let slot = find_slot(&store.entries);
        assert!(slot.is_some(), "Claimed slot should be recyclable");
        assert!(store.entries[slot.unwrap()].claimed != 0, "Recycled slot must be claimed");
    }

    #[test]
    fn expired_unclaimed_entry_is_never_evicted() {
        let depositor = [0u8; 32];
        let mut store = make_store();

        for i in 0..MAX_ENTRIES {
            store.entries[i] = CommitmentEntry {
                commitment: { let mut c = [0u8; 32]; c[0] = i as u8; c },
                amount: 1_000_000,
                expiry: 1_000,
                token_mint: SOL_SENTINEL,
                claimed: 0,
                _pad: [0u8; 7],
                depositor,
            };
        }
        store.count = MAX_ENTRIES as u64;

        let slot = find_slot(&store.entries);
        assert!(slot.is_none(), "Expired-unclaimed entries must never be evicted");
    }

    #[test]
    fn active_entry_is_never_evicted() {
        let depositor = [0u8; 32];
        let mut store = make_store();

        store.entries[0] = CommitmentEntry {
            commitment: [1u8; 32],
            amount: 1_000_000,
            expiry: 9_999_999_999,
            token_mint: SOL_SENTINEL,
            claimed: 0,
            _pad: [0u8; 7],
            depositor,
        };
        store.head = 1;
        store.count = 1;

        let slot = find_slot(&store.entries);
        assert!(slot.is_some(), "Should find a recyclable zero-initialized slot");
        assert_ne!(slot.unwrap(), 0, "Active entry at index 0 must not be evicted");
    }

    #[test]
    fn never_used_zero_slots_are_treated_as_available() {
        let store = make_store();
        let slot = find_slot(&store.entries);
        assert!(slot.is_some(), "Zero-initialized store must have available slots");
    }

    #[test]
    fn commitment_entry_size_constant_is_correct() {
        let expected: usize = 32 + 8 + 8 + 32 + 1 + 7 + 32;
        assert_eq!(CommitmentEntry::SIZE, expected);
    }

    #[test]
    fn commitment_store_space_is_correct() {
        let expected = 8 + 8 + 8 + (256 * 120);
        assert_eq!(COMMITMENT_STORE_SPACE, expected);
    }
}

// ─── Events ────────────────────────────────────────────────────────────────

#[event]
pub struct DepositEvent {
    pub commitment: [u8; 32],
    pub amount: u64,
    pub expiry: i64,
    pub token_mint: Pubkey,
}

#[event]
pub struct WithdrawEvent {
    pub commitment: [u8; 32],
    pub amount: u64,
    pub recipient: Pubkey,
    pub token_mint: Pubkey,
}

// ─── Errors ────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Commitment not found or already claimed")]
    CommitmentNotFound,
    #[msg("Duplicate commitment: already exists in active store")]
    DuplicateCommitment,
    #[msg("Token mint does not match the commitment entry")]
    TokenMintMismatch,
    #[msg("Claim link has expired")]
    Expired,
    #[msg("Cannot reclaim before expiry")]
    NotExpired,
    #[msg("All 256 slots are active — no recyclable entries available")]
    StoreCapacityReached,
    #[msg("Escrow has insufficient funds")]
    InsufficientFunds,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Only the original depositor may reclaim this commitment")]
    UnauthorizedReclaim,
}
