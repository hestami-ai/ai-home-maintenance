import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { encrypt, decrypt, generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { openDirect, FirmDal, MatterKeysDal } from '../lib/database/index.js';

describe('AES-256-GCM cipher', () => {
  it('round-trips plaintext', () => {
    const k = generateKey();
    const env = encrypt(k, 'hello world');
    const out = decrypt(k, env);
    expect(out.toString('utf8')).toBe('hello world');
  });

  it('different keys cannot decrypt each other', () => {
    const a = generateKey();
    const b = generateKey();
    const env = encrypt(a, 'secret');
    expect(() => decrypt(b, env)).toThrow();
  });

  it('tampered ciphertext fails the GCM auth tag', () => {
    const k = generateKey();
    const env = encrypt(k, 'sensitive');
    const tampered = Buffer.from(env.bytes);
    tampered[20] = tampered[20] ^ 0xff; // flip a byte in the ciphertext region
    expect(() => decrypt(k, { bytes: tampered })).toThrow();
  });
});

describe('key hierarchy', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;
  let firmKey: FirmKey;
  let svc: MatterKeyService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-keys-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    firmDal = new FirmDal(db);
    firmKey = new FirmKey(generateKey());
    svc = new MatterKeyService(new MatterKeysDal(db), firmKey);

    firmDal.insertFirm('f1', 'JC Law', 'MD');
    firmDal.insertClient('f1', 'c1', 'Client 1');
    firmDal.insertClient('f1', 'c2', 'Client 2');
    firmDal.insertMatter({ firmId: 'f1', clientId: 'c1', matterId: 'm1', matterName: 'M1', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertMatter({ firmId: 'f1', clientId: 'c2', matterId: 'm2', matterName: 'M2', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('client wrap key is deterministic per (firm, client)', () => {
    const k1 = firmKey.deriveClientWrapKey('f1', 'c1');
    const k2 = firmKey.deriveClientWrapKey('f1', 'c1');
    const k3 = firmKey.deriveClientWrapKey('f1', 'c2');
    expect(k1.equals(k2)).toBe(true);
    expect(k1.equals(k3)).toBe(false);
  });

  it('provisions and round-trips matter content + mental keys', () => {
    const scope = { firmId: 'f1', clientId: 'c1', matterId: 'm1' };
    const provisioned = svc.provision(scope);
    const loaded = svc.load(scope);
    expect(loaded.contentKey.equals(provisioned.contentKey)).toBe(true);
    expect(loaded.mentalKey.equals(provisioned.mentalKey)).toBe(true);
  });

  it('content and mental keys are different (mental sub-segment isolation)', () => {
    const scope = { firmId: 'f1', clientId: 'c1', matterId: 'm1' };
    const k = svc.provision(scope);
    expect(k.contentKey.equals(k.mentalKey)).toBe(false);
  });

  it('keys for different matters never collide', () => {
    const a = svc.provision({ firmId: 'f1', clientId: 'c1', matterId: 'm1' });
    const b = svc.provision({ firmId: 'f1', clientId: 'c2', matterId: 'm2' });
    expect(a.contentKey.equals(b.contentKey)).toBe(false);
    expect(a.mentalKey.equals(b.mentalKey)).toBe(false);
  });

  it('a different firm key cannot unwrap a matter provisioned under another', () => {
    const scope = { firmId: 'f1', clientId: 'c1', matterId: 'm1' };
    svc.provision(scope);
    const wrongKey = new FirmKey(generateKey());
    const wrongSvc = new MatterKeyService(new MatterKeysDal(db), wrongKey);
    expect(() => wrongSvc.load(scope)).toThrow();
  });
});
