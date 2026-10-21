export interface EncryptedVault {
  version: number;
  salt: string; // base64
  iv: string;   // base64
  ciphertext: string; // base64
  usernameHint?: string;
  createdAt: string;
}

export interface TursoCredentials {
  tursoUrl: string;
  tursoToken: string;
}

const VAULT_STORAGE_KEY = 'ricordo_encrypted_vault';
const SESSION_STORAGE_KEY = 'ricordo_unlocked_session';
const SESSION_EXPIRY_DAYS = 30;

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, username: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(`${username.trim().toLowerCase()}:${password}`);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawKeyMaterial,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 120000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createEncryptedVault(
  creds: TursoCredentials,
  username: string,
  password: string
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, username, salt);

  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(creds));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encodedData
  );

  const vault: EncryptedVault = {
    version: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer),
    usernameHint: username.trim(),
    createdAt: new Date().toISOString()
  };

  return vault;
}

export async function unlockVault(
  vault: EncryptedVault,
  username: string,
  password: string
): Promise<TursoCredentials> {
  const salt = base64ToBuffer(vault.salt);
  const iv = base64ToBuffer(vault.iv);
  const ciphertext = base64ToBuffer(vault.ciphertext);

  const key = await deriveKey(password, username, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    const creds = JSON.parse(jsonStr) as TursoCredentials;
    return creds;
  } catch {
    throw new Error('Incorrect username or password. Decryption failed.');
  }
}

export async function loadStaticVault(): Promise<EncryptedVault | null> {
  try {
    const res = await fetch('./vault.json');
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.ciphertext && data.salt && data.iv) {
      return data as EncryptedVault;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveVaultToStorage(vault: EncryptedVault) {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
}

export function loadVaultFromStorage(): EncryptedVault | null {
  const stored = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function cacheSession(creds: TursoCredentials, username: string) {
  const payload = {
    creds,
    username,
    expiresAt: Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export function getCachedSession(): { creds: TursoCredentials; username: string } | null {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return { creds: data.creds, username: data.username };
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
