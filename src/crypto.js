// 暗号化ユーティリティ（Web Crypto API使用）

function bufToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function getMasterKey(env) {
  const masterKeyHex = env.MASTER_KEY;
  if (!masterKeyHex) {
    throw new Error('MASTER_KEY is not set in environment');
  }
  
  const keyData = hexToBuf(masterKeyHex);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text, env) {
  if (!text) return { cipherText: null, iv: null };
  
  const key = await getMasterKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    cipherText: bufToHex(encrypted),
    iv: bufToHex(iv),
  };
}

export async function decrypt(cipherTextHex, ivHex, env) {
  if (!cipherTextHex || !ivHex) return null;
  
  const key = await getMasterKey(env);
  const encrypted = hexToBuf(cipherTextHex);
  const iv = hexToBuf(ivHex);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

// パスワードハッシュ化（bcryptの代わりにシンプルなSHA-256を使用）
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(hashBuffer);
}

export async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}
