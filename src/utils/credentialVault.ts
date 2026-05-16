import type { DeviceCredential, PlacedDevice, ValidationIssue } from '../types/rack';

const ENCODING = 'base64';
const SALT_PREFIX = 'hrs_v1_';

// Simple fallback for test environments where crypto.subtle is unavailable
function getCrypto(): typeof crypto {
  if (typeof crypto !== 'undefined') return crypto;
  // Node.js crypto module fallback for vitest/jsdom
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.webcrypto as Crypto;
  } catch {
    throw new Error('Web Crypto API is not available');
  }
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const c = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await c.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return c.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptValue(password: string, plaintext: string): Promise<string> {
  const c = getCrypto();
  const enc = new TextEncoder();
  const salt = c.getRandomValues(new Uint8Array(16));
  const iv = c.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return SALT_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decryptValue(password: string, encrypted: string): Promise<string> {
  const c = getCrypto();
  if (!encrypted.startsWith(SALT_PREFIX)) {
    throw new Error('Invalid credential format');
  }
  const data = Uint8Array.from(atob(encrypted.slice(SALT_PREFIX.length)), (ch) => ch.charCodeAt(0));
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await c.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

export interface CredentialVaultState {
  unlocked: boolean;
  masterPassword: string | null;
  deviceId: string | null;
}

let vaultState: CredentialVaultState = { unlocked: false, masterPassword: null, deviceId: null };

export function getVaultState(): CredentialVaultState {
  return { ...vaultState };
}

export function unlockVault(password: string): void {
  vaultState = { unlocked: true, masterPassword: password, deviceId: null };
}

export function lockVault(): void {
  vaultState = { unlocked: false, masterPassword: null, deviceId: null };
}

export function isVaultUnlocked(): boolean {
  return vaultState.unlocked && vaultState.masterPassword !== null;
}

export function getDeviceCredentials(device: PlacedDevice): DeviceCredential[] {
  return device.credentials ?? [];
}

export function getCredentialTypeLabel(type: DeviceCredential['type']): string {
  switch (type) {
    case 'password': return 'Password';
    case 'url': return 'URL';
    case 'text': return 'Text';
    case 'ssh-key': return 'SSH Key';
    case 'snmp': return 'SNMP';
  }
}

export function summarizeCredentials(devices: PlacedDevice[]): {
  totalDevices: number;
  totalCredentials: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  let totalCredentials = 0;
  const devicesWithCreds = devices.filter((d) => (d.credentials ?? []).length > 0);

  for (const d of devicesWithCreds) {
    for (const c of d.credentials ?? []) {
      totalCredentials++;
      byType[c.type] = (byType[c.type] ?? 0) + 1;
    }
  }

  return {
    totalDevices: devicesWithCreds.length,
    totalCredentials,
    byType,
  };
}

export function validateCredentials(devices: PlacedDevice[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const d of devices) {
    const creds = d.credentials ?? [];
    for (const c of creds) {
      if (!c.label.trim()) {
        issues.push({
          id: `cred-empty-label-${c.id}`,
          severity: 'warning',
          title: 'Credential missing label',
          detail: `A credential on ${d.name} has no label.`,
          deviceIds: [d.id],
        });
      }
      if (!c.value.trim()) {
        issues.push({
          id: `cred-empty-value-${c.id}`,
          severity: 'warning',
          title: 'Credential has empty value',
          detail: `Credential "${c.label}" on ${d.name} has no encrypted value.`,
          deviceIds: [d.id],
        });
      }
      if (!c.value.startsWith(SALT_PREFIX)) {
        issues.push({
          id: `cred-unencrypted-${c.id}`,
          severity: 'critical',
          title: 'Credential appears unencrypted',
          detail: `Credential "${c.label}" on ${d.name} does not use the expected encryption format.`,
          deviceIds: [d.id],
        });
      }
    }
  }

  return issues;
}

export async function exportCredentialsMarkdown(
  devices: PlacedDevice[],
  password: string
): Promise<string> {
  const lines: string[] = [
    '# Credential Vault Export',
    '',
    '> ⚠️ This export contains decrypted credentials. Store it securely and delete when no longer needed.',
    '',
  ];

  for (const d of devices) {
    const creds = d.credentials ?? [];
    if (creds.length === 0) continue;

    lines.push(`## ${d.name}`, '');
    for (const c of creds) {
      let decrypted: string;
      try {
        decrypted = await decryptValue(password, c.value);
      } catch {
        decrypted = '[decryption failed]';
      }
      lines.push(`- **${c.label}** (${getCredentialTypeLabel(c.type)}): ${decrypted}`);
    }
    lines.push('');
  }

  lines.push('---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}
