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

// PBKDF2 + ランダムsalt によるパスワードハッシュ化
// イテレーション数 600,000 は OWASP 推奨値
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt);
  return { hash: bufToHex(hash), salt: bufToHex(salt) };
}

async function deriveKey(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bits;
}

// constant-time 比較でタイミングアタックを防止
async function timingSafeEqual(a, b) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

// PBKDF2ハッシュの検証
export async function verifyPassword(password, hash, salt) {
  const saltBytes = hexToBuf(salt);
  const computed = bufToHex(await deriveKey(password, saltBytes));
  return timingSafeEqual(computed, hash);
}

// 旧SHA-256ハッシュの検証（マイグレーション用）
export async function verifySha256Password(password, hash) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const computed = bufToHex(hashBuffer);
  return timingSafeEqual(computed, hash);
}
