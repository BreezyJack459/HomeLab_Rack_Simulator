import { describe, it, expect, beforeAll } from 'vitest';
import type { PlacedDevice } from '../types/rack';
import {
  encryptValue,
  decryptValue,
  getVaultState,
  unlockVault,
  lockVault,
  isVaultUnlocked,
  getDeviceCredentials,
  getCredentialTypeLabel,
  summarizeCredentials,
  validateCredentials,
} from './credentialVault';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'd1',
    category: 'switch',
    name: 'Switch',
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in',
    weightKg: 4,
    powerW: 40,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

describe('encryptValue / decryptValue', () => {
  it('round-trips plaintext', async () => {
    const password = 'test-password-123';
    const plaintext = 'my-secret-password';
    const encrypted = await encryptValue(password, plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.startsWith('hrs_v1_')).toBe(true);
    const decrypted = await decryptValue(password, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same input', async () => {
    const password = 'test-password-123';
    const plaintext = 'my-secret';
    const encrypted1 = await encryptValue(password, plaintext);
    const encrypted2 = await encryptValue(password, plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('fails with wrong password', async () => {
    const encrypted = await encryptValue('correct-password', 'secret');
    await expect(decryptValue('wrong-password', encrypted)).rejects.toThrow();
  });

  it('fails with invalid format', async () => {
    await expect(decryptValue('password', 'not-encrypted')).rejects.toThrow();
  });
});

describe('vault state', () => {
  it('starts locked', () => {
    lockVault();
    expect(isVaultUnlocked()).toBe(false);
    expect(getVaultState().unlocked).toBe(false);
  });

  it('unlocks with password', () => {
    unlockVault('master-pass');
    expect(isVaultUnlocked()).toBe(true);
    expect(getVaultState().masterPassword).toBe('master-pass');
  });

  it('locks and clears password', () => {
    unlockVault('master-pass');
    lockVault();
    expect(isVaultUnlocked()).toBe(false);
    expect(getVaultState().masterPassword).toBeNull();
  });
});

describe('getDeviceCredentials', () => {
  it('returns credentials from device', () => {
    const device = makeDevice({
      credentials: [
        { id: 'cred-1', label: 'Admin', value: 'enc1', type: 'password' },
      ],
    });
    const creds = getDeviceCredentials(device);
    expect(creds).toHaveLength(1);
    expect(creds[0].label).toBe('Admin');
  });

  it('returns empty array when no credentials', () => {
    const device = makeDevice();
    const creds = getDeviceCredentials(device);
    expect(creds).toHaveLength(0);
  });
});

describe('getCredentialTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(getCredentialTypeLabel('password')).toBe('Password');
    expect(getCredentialTypeLabel('url')).toBe('URL');
    expect(getCredentialTypeLabel('text')).toBe('Text');
    expect(getCredentialTypeLabel('ssh-key')).toBe('SSH Key');
    expect(getCredentialTypeLabel('snmp')).toBe('SNMP');
  });
});

describe('summarizeCredentials', () => {
  it('returns zeros for empty devices', () => {
    const summary = summarizeCredentials([]);
    expect(summary.totalDevices).toBe(0);
    expect(summary.totalCredentials).toBe(0);
  });

  it('counts by type', () => {
    const devices: PlacedDevice[] = [
      makeDevice({
        id: 'd1',
        credentials: [
          { id: 'c1', label: 'Admin', value: 'enc', type: 'password' },
          { id: 'c2', label: 'iDRAC', value: 'enc', type: 'url' },
        ],
      }),
      makeDevice({
        id: 'd2',
        credentials: [
          { id: 'c3', label: 'SNMP', value: 'enc', type: 'snmp' },
        ],
      }),
      makeDevice({ id: 'd3' }),
    ];
    const summary = summarizeCredentials(devices);
    expect(summary.totalDevices).toBe(2);
    expect(summary.totalCredentials).toBe(3);
    expect(summary.byType['password']).toBe(1);
    expect(summary.byType['url']).toBe(1);
    expect(summary.byType['snmp']).toBe(1);
  });
});

describe('validateCredentials', () => {
  it('returns empty for valid credentials', () => {
    const devices = [
      makeDevice({
        credentials: [
          { id: 'c1', label: 'Admin', value: 'hrs_v1_abc123', type: 'password' },
        ],
      }),
    ];
    const issues = validateCredentials(devices);
    expect(issues).toHaveLength(0);
  });

  it('flags empty label', () => {
    const devices = [
      makeDevice({
        credentials: [
          { id: 'c1', label: '  ', value: 'hrs_v1_abc', type: 'password' },
        ],
      }),
    ];
    const issues = validateCredentials(devices);
    expect(issues.some((i) => i.title.includes('missing label'))).toBe(true);
  });

  it('flags empty value', () => {
    const devices = [
      makeDevice({
        credentials: [
          { id: 'c1', label: 'Admin', value: '  ', type: 'password' },
        ],
      }),
    ];
    const issues = validateCredentials(devices);
    expect(issues.some((i) => i.title.includes('empty value'))).toBe(true);
  });

  it('flags unencrypted credential', () => {
    const devices = [
      makeDevice({
        credentials: [
          { id: 'c1', label: 'Admin', value: 'plaintext-password', type: 'password' },
        ],
      }),
    ];
    const issues = validateCredentials(devices);
    expect(issues.some((i) => i.severity === 'critical')).toBe(true);
    expect(issues.some((i) => i.title.includes('unencrypted'))).toBe(true);
  });
});
