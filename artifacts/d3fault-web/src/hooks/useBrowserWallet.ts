import { useState, useEffect, useCallback } from "react";
import { Keypair } from "@solana/web3.js";
import * as bip39 from "bip39";
import bs58 from "bs58";
import { derivePath } from "ed25519-hd-key";

const STORAGE_KEY = "d3fault_browser_wallet_v1";
const CHANGE_EVENT = "d3fault_wallet_changed";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EncryptedWallet {
  version: "aes256gcm-pbkdf2-v1";
  publicKey: string;   // stored plaintext — public key is not sensitive
  salt: string;        // base64 — random 32 bytes
  iv: string;          // base64 — random 12 bytes
  ciphertext: string;  // base64 — AES-256-GCM encrypted secretKey (64 bytes)
}

export interface BrowserWallet {
  keypair: Keypair;
  publicKey: string;
}

// ─── Module-level session cache ───────────────────────────────────────────────
// Decrypted keypair survives re-renders; cleared on page unload.
let _sessionKeypair: Keypair | null = null;

function getSessionKeypair(): Keypair | null { return _sessionKeypair; }
function setSessionKeypair(kp: Keypair | null) { _sessionKeypair = kp; }

// ─── Crypto helpers ───────────────────────────────────────────────────────────
function b64(arr: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(arr)));
}
function fromb64(s: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function deriveKey(password: string, salt: ArrayBuffer, usage: KeyUsage[]): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
}

async function encryptSecretKey(secretKey: Uint8Array, password: string): Promise<EncryptedWallet> {
  const salt: ArrayBuffer = new ArrayBuffer(32);
  const iv: ArrayBuffer   = new ArrayBuffer(12);
  crypto.getRandomValues(new Uint8Array(salt));
  crypto.getRandomValues(new Uint8Array(iv));
  const key        = await deriveKey(password, salt, ["encrypt"]);
  const skBuf: ArrayBuffer = new Uint8Array(secretKey).buffer;
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, skBuf);
  const kp = Keypair.fromSecretKey(secretKey);
  return { version: "aes256gcm-pbkdf2-v1", publicKey: kp.publicKey.toBase58(), salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext) };
}

async function decryptSecretKey(stored: EncryptedWallet, password: string): Promise<Uint8Array> {
  const salt       = fromb64(stored.salt);
  const iv         = fromb64(stored.iv);
  const ciphertext = fromb64(stored.ciphertext);
  const key        = await deriveKey(password, salt, ["decrypt"]);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new Uint8Array(plain);
  } catch {
    throw new Error("Incorrect password.");
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
function readStored(): EncryptedWallet | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EncryptedWallet;
    if (parsed.version !== "aes256gcm-pbkdf2-v1") { localStorage.removeItem(STORAGE_KEY); return null; }
    return parsed;
  } catch { return null; }
}

function notifyChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export interface UseBrowserWalletReturn {
  wallet: BrowserWallet | null;  // null if no wallet or locked
  loaded: boolean;
  hasWallet: boolean;            // a wallet exists in storage
  locked: boolean;               // wallet exists but needs password
  publicKeyStored: string | null;// public key readable even when locked

  createWallet: (mnemonic: string, password: string) => Promise<void>;
  importFromMnemonic: (mnemonic: string, password: string) => Promise<void>;
  importFromPrivateKey: (input: string, password: string) => Promise<void>;
  unlockWallet: (password: string) => Promise<void>;
  lockWallet: () => void;
  removeWallet: () => void;
  exportPrivateKey: () => string | null;
}

export function useBrowserWallet(): UseBrowserWalletReturn {
  const [wallet, setWallet]   = useState<BrowserWallet | null>(getSessionKeypair() ? { keypair: getSessionKeypair()!, publicKey: getSessionKeypair()!.publicKey.toBase58() } : null);
  const [stored, setStored]   = useState<EncryptedWallet | null>(readStored);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    setLoaded(true);

    function onChanged() {
      const s = readStored();
      setStored(s);
      const kp = getSessionKeypair();
      if (!s) {
        setSessionKeypair(null);
        setWallet(null);
      } else if (kp) {
        // Another hook instance (e.g. UnlockWalletPanel) may have decrypted
        // and set the session keypair — sync our wallet state to match.
        setWallet({ keypair: kp, publicKey: kp.publicKey.toBase58() });
      } else {
        setWallet(null);
      }
    }
    window.addEventListener(CHANGE_EVENT, onChanged);
    return () => window.removeEventListener(CHANGE_EVENT, onChanged);
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function applyKeypair(kp: Keypair) {
    setSessionKeypair(kp);
    setWallet({ keypair: kp, publicKey: kp.publicKey.toBase58() });
  }

  async function saveAndUnlock(secretKey: Uint8Array, password: string) {
    const enc = await encryptSecretKey(secretKey, password);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enc));
    setStored(enc);
    const kp = Keypair.fromSecretKey(secretKey);
    applyKeypair(kp);
    notifyChange();
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  const createWallet = useCallback(async (mnemonic: string, password: string): Promise<void> => {
    const clean = mnemonic.trim().toLowerCase();
    if (!bip39.validateMnemonic(clean)) throw new Error("Invalid seed phrase.");
    const seed = await bip39.mnemonicToSeed(clean);
    const { key } = derivePath("m/44'/501'/0'/0'", Buffer.from(seed).toString("hex"));
    const kp = Keypair.fromSeed(key);
    await saveAndUnlock(kp.secretKey, password);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFromMnemonic = useCallback(async (mnemonic: string, password: string): Promise<void> => {
    const clean = mnemonic.trim().toLowerCase();
    if (!bip39.validateMnemonic(clean)) throw new Error("Invalid seed phrase. Check all 12 words are correct.");
    const seed = await bip39.mnemonicToSeed(clean);
    const { key } = derivePath("m/44'/501'/0'/0'", Buffer.from(seed).toString("hex"));
    const kp = Keypair.fromSeed(key);
    await saveAndUnlock(kp.secretKey, password);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFromPrivateKey = useCallback(async (input: string, password: string): Promise<void> => {
    const clean = input.trim();
    let secretKey: Uint8Array;
    if (/^[0-9a-fA-F]{128}$/.test(clean)) {
      secretKey = new Uint8Array(clean.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    } else {
      secretKey = bs58.decode(clean);
    }
    if (secretKey.length !== 64) throw new Error("Invalid private key. Must be 64 bytes (base58 or hex).");
    await saveAndUnlock(secretKey, password);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlockWallet = useCallback(async (password: string): Promise<void> => {
    const s = readStored();
    if (!s) throw new Error("No wallet found.");
    const secretKey = await decryptSecretKey(s, password); // throws "Incorrect password." if wrong
    const kp = Keypair.fromSecretKey(secretKey);
    applyKeypair(kp);
    notifyChange(); // broadcast to all other useBrowserWallet instances
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockWallet = useCallback((): void => {
    setSessionKeypair(null);
    setWallet(null);
  }, []);

  const removeWallet = useCallback((): void => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionKeypair(null);
    setWallet(null);
    setStored(null);
    notifyChange();
  }, []);

  const exportPrivateKey = useCallback((): string | null => {
    const kp = getSessionKeypair();
    return kp ? bs58.encode(kp.secretKey) : null;
  }, []);

  const hasWallet = stored !== null;
  const locked    = hasWallet && wallet === null;

  return {
    wallet,
    loaded,
    hasWallet,
    locked,
    publicKeyStored: stored?.publicKey ?? null,
    createWallet,
    importFromMnemonic,
    importFromPrivateKey,
    unlockWallet,
    lockWallet,
    removeWallet,
    exportPrivateKey,
  };
}
