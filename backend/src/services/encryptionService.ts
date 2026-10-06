import { generateKeyPairSync, privateDecrypt, constants } from 'crypto';

export class EncryptionService {
  readonly publicKeyPem: string;
  private readonly privateKeyPem: string;

  constructor() {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.publicKeyPem = publicKey;
    this.privateKeyPem = privateKey;
  }

  decrypt(encryptedBase64: string): string {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    const decrypted = privateDecrypt(
      { key: this.privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      buffer,
    );
    return decrypted.toString('utf8');
  }
}
