/**
 * D3FAULT program IDL — zero_copy CommitmentStore layout (Anchor 0.31 format).
 *
 * CommitmentEntry layout (120 bytes, #[zero_copy] #[repr(C)]):
 *   commitment  [u8;32]  +32
 *   amount      u64      +8
 *   expiry      i64      +8
 *   token_mint  [u8;32]  +32
 *   claimed     u8       +1
 *   _pad        [u8;7]   +7   (alignment padding)
 *   depositor   [u8;32]  +32
 *   ─────────────────────────
 *   total                120 bytes
 *
 * CommitmentStore layout (30,744 bytes):
 *   discriminator  8 bytes
 *   count          8 bytes
 *   head           8 bytes
 *   entries        256 × 120 = 30,720 bytes
 */
export const IDL = {
  address: "2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG",
  metadata: {
    name: "private_transfer",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "initialize",
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "authority", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "depositSol",
      discriminator: [108, 81, 78, 117, 125, 155, 56, 200],
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "depositor", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "commitment", type: { array: ["u8", 32] } },
        { name: "amount", type: "u64" },
        { name: "expiry", type: "i64" },
      ],
    },
    {
      name: "depositSpl",
      discriminator: [224, 0, 198, 175, 198, 47, 105, 204],
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "depositor", writable: true, signer: true },
        { name: "tokenMint", writable: false },
        { name: "depositorTokenAccount", writable: true },
        { name: "escrowTokenAccount", writable: true },
        { name: "tokenProgram", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "associatedTokenProgram", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "commitment", type: { array: ["u8", 32] } },
        { name: "amount", type: "u64" },
        { name: "expiry", type: "i64" },
      ],
    },
    {
      name: "withdrawSol",
      discriminator: [145, 131, 74, 136, 65, 137, 42, 38],
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "nullifierRecord", writable: true },
        { name: "recipient", writable: true },
        { name: "relayer", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "secret", type: { array: ["u8", 32] } }],
    },
    {
      name: "withdrawSpl",
      discriminator: [181, 154, 94, 86, 62, 115, 6, 186],
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "nullifierRecord", writable: true },
        { name: "recipient", writable: true },
        { name: "tokenMint", writable: false },
        { name: "escrowTokenAccount", writable: true },
        { name: "recipientTokenAccount", writable: true },
        { name: "relayer", writable: true, signer: true },
        { name: "tokenProgram", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "associatedTokenProgram", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "secret", type: { array: ["u8", 32] } }],
    },
    {
      name: "reclaimSol",
      discriminator: [210, 39, 108, 241, 176, 122, 84, 232],
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "depositor", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "commitment", type: { array: ["u8", 32] } }],
    },
    {
      name: "reclaimSpl",
      discriminator: [241, 43, 49, 37, 57, 79, 135, 180],
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "depositor", writable: true, signer: true },
        { name: "tokenMint", writable: false },
        { name: "escrowTokenAccount", writable: true },
        { name: "depositorTokenAccount", writable: true },
        { name: "tokenProgram", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "associatedTokenProgram", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "commitment", type: { array: ["u8", 32] } }],
    },
  ],
  accounts: [
    {
      name: "CommitmentStore",
      discriminator: [91, 127, 124, 107, 211, 144, 195, 254],
    },
    {
      name: "NullifierRecord",
      discriminator: [56, 18, 57, 175, 69, 202, 189, 70],
    },
  ],
  types: [
    {
      name: "CommitmentStore",
      type: {
        kind: "struct",
        fields: [
          { name: "count", type: "u64" },
          { name: "head", type: "u64" },
          {
            name: "entries",
            type: { array: [{ defined: { name: "CommitmentEntry" } }, 256] },
          },
        ],
      },
    },
    {
      name: "NullifierRecord",
      type: {
        kind: "struct",
        fields: [{ name: "nullifier", type: { array: ["u8", 32] } }],
      },
    },
    {
      name: "CommitmentEntry",
      type: {
        kind: "struct",
        fields: [
          { name: "commitment", type: { array: ["u8", 32] } },
          { name: "amount", type: "u64" },
          { name: "expiry", type: "i64" },
          { name: "tokenMint", type: { array: ["u8", 32] } },
          { name: "claimed", type: "u8" },
          { name: "pad", type: { array: ["u8", 7] } },
          { name: "depositor", type: { array: ["u8", 32] } },
        ],
      },
    },
  ],
  events: [
    {
      name: "DepositEvent",
      discriminator: [214, 34, 174, 181, 201, 250, 165, 227],
    },
    {
      name: "WithdrawEvent",
      discriminator: [255, 59, 141, 0, 227, 38, 76, 144],
    },
  ],
  errors: [
    { code: 6000, name: "CommitmentNotFound", msg: "Commitment not found or already claimed" },
    { code: 6001, name: "DuplicateCommitment", msg: "Duplicate commitment: already exists in store" },
    { code: 6002, name: "TokenMintMismatch", msg: "Token mint does not match the commitment entry" },
    { code: 6003, name: "Expired", msg: "Claim link has expired" },
    { code: 6004, name: "NotExpired", msg: "Cannot reclaim before expiry" },
    { code: 6005, name: "StoreCapacityReached", msg: "All 64 slots are active — no recyclable entries available" },
    { code: 6006, name: "InsufficientFunds", msg: "Escrow has insufficient funds" },
    { code: 6007, name: "ZeroAmount", msg: "Amount must be greater than zero" },
    { code: 6008, name: "UnauthorizedReclaim", msg: "Only the original depositor may reclaim this commitment" },
  ],
} as const;

export type D3faultIdl = typeof IDL;
