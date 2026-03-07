// 認証ハンドラー

import { hashPassword, verifyPassword } from './crypto.js';

// セッショントークン生成
function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ユーザー登録
export async function register(env, email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  // メールアドレスの重複チェック
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  
  if (existing) {
    return { success: false, error: 'Email already exists' };
  }

  // パスワードハッシュ化
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  // ユーザー作成
  const result = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)'
  )
    .bind(email, passwordHash, now)
    .run();

  const userId = result.meta.last_row_id;

  // セッショントークン生成
  const sessionToken = generateSessionToken();
  await env.KV.put(`session:${sessionToken}`, JSON.stringify({ userId, email }), {
    expirationTtl: 30 * 24 * 60 * 60, // 30日
  });

  return { success: true, userId, sessionToken };
}

// ログイン
export async function login(env, email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  // ユーザー取得
  const user = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  // パスワード検証
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // セッショントークン生成
  const sessionToken = generateSessionToken();
  await env.KV.put(`session:${sessionToken}`, JSON.stringify({ userId: user.id, email: user.email }), {
    expirationTtl: 30 * 24 * 60 * 60, // 30日
  });

  return { success: true, userId: user.id, sessionToken };
}

// ログアウト
export async function logout(env, sessionToken) {
  if (!sessionToken) {
    return { success: false, error: 'Session token is required' };
  }

  await env.KV.delete(`session:${sessionToken}`);
  return { success: true };
}

// パスワード変更
export async function changePassword(env, sessionToken, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    return { success: false, error: 'Current password and new password are required' };
  }

  const session = await verifySession(env, sessionToken);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .bind(session.userId)
    .first();

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const newPasswordHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newPasswordHash, user.id)
    .run();

  return { success: true };
}

// セッション検証
export async function verifySession(env, sessionToken) {
  if (!sessionToken) {
    return null;
  }

  const sessionData = await env.KV.get(`session:${sessionToken}`);
  if (!sessionData) {
    return null;
  }

  try {
    return JSON.parse(sessionData);
  } catch {
    return null;
  }
}
