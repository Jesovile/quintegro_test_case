function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptWithPublicKey(publicKeyPem: string, data: object): Promise<string> {
  const keyBuffer = pemToArrayBuffer(publicKeyPem);
  const publicKey = await window.crypto.subtle.importKey(
    'spki',
    keyBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
