// 認証ハンドラー

import { hashPassword, verifyPassword, verifySha256Password } from './crypto.js';

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

  // メールアドレスの重複チェック（ユーザー列挙を防ぐため汎用メッセージを返す）
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  
  if (existing) {
    return { success: false, error: 'Registration failed' };
  }

  // PBKDF2+saltでパスワードハッシュ化
  const { hash: passwordHash, salt: passwordSalt } = await hashPassword(password);
  const now = new Date().toISOString();

  // ユーザー作成
  const result = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, password_salt, password_hash_version, created_at) VALUES (?, ?, ?, 2, ?)'
  )
    .bind(email, passwordHash, passwordSalt, now)
    .run();

  const userId = result.meta.last_row_id;

  // セッショントークン生成・KVに保存（userId逆引き用のインデックスも保持）
  const sessionToken = generateSessionToken();
  await env.KV.put(`session:${sessionToken}`, JSON.stringify({ userId, email }), {
    expirationTtl: 30 * 24 * 60 * 60,
  });
  await env.KV.put(`user_session:${userId}:${sessionToken}`, '1', {
    expirationTtl: 30 * 24 * 60 * 60,
  });

  return { success: true, userId, sessionToken };
}

// ログイン
export async function login(env, email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  // ユーザー取得
  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, password_salt, password_hash_version FROM users WHERE email = ?'
  )
    .bind(email)
    .first();

  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  // パスワード検証（バージョン1はSHA-256、バージョン2はPBKDF2）
  let valid = false;
  if (user.password_hash_version === 1) {
    valid = await verifySha256Password(password, user.password_hash);
    if (valid) {
      // ログイン成功時にPBKDF2へ自動マイグレーション
      const { hash: newHash, salt: newSalt } = await hashPassword(password);
      await env.DB.prepare(
        'UPDATE users SET password_hash = ?, password_salt = ?, password_hash_version = 2 WHERE id = ?'
      ).bind(newHash, newSalt, user.id).run();
    }
  } else {
    valid = await verifyPassword(password, user.password_hash, user.password_salt);
  }

  if (!valid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // セッショントークン生成・KVに保存（userId逆引き用のインデックスも保持）
  const sessionToken = generateSessionToken();
  await env.KV.put(`session:${sessionToken}`, JSON.stringify({ userId: user.id, email: user.email }), {
    expirationTtl: 30 * 24 * 60 * 60,
  });
  await env.KV.put(`user_session:${user.id}:${sessionToken}`, '1', {
    expirationTtl: 30 * 24 * 60 * 60,
  });

  return { success: true, userId: user.id, sessionToken };
}

// ログアウト
export async function logout(env, sessionToken) {
  if (!sessionToken) {
    return { success: false, error: 'Session token is required' };
  }

  // セッションのuserIdを取得してインデックスも削除
  const sessionData = await env.KV.get(`session:${sessionToken}`);
  if (sessionData) {
    const { userId } = JSON.parse(sessionData);
    await env.KV.delete(`user_session:${userId}:${sessionToken}`);
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

  const user = await env.DB.prepare(
    'SELECT id, password_hash, password_salt, password_hash_version FROM users WHERE id = ?'
  )
    .bind(session.userId)
    .first();

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const valid = user.password_hash_version === 1
    ? await verifySha256Password(currentPassword, user.password_hash)
    : await verifyPassword(currentPassword, user.password_hash, user.password_salt);
  if (!valid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ?, password_hash_version = 2 WHERE id = ?'
  ).bind(newHash, newSalt, user.id).run();

  return { success: true };
}

// アカウント削除
export async function deleteAccount(env, sessionToken, password) {
  if (!password) {
    return { success: false, error: 'Password is required' };
  }

  const session = await verifySession(env, sessionToken);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const user = await env.DB.prepare(
    'SELECT id, password_hash, password_salt, password_hash_version FROM users WHERE id = ?'
  )
    .bind(session.userId)
    .first();

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const valid = user.password_hash_version === 1
    ? await verifySha256Password(password, user.password_hash)
    : await verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) {
    return { success: false, error: 'Password is incorrect' };
  }

  // user_settings は ON DELETE CASCADE で自動削除される
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  // 全セッションをKVから削除（user_session:userId:* を列挙）
  const sessions = await env.KV.list({ prefix: `user_session:${user.id}:` });
  await Promise.all(
    sessions.keys.map(async ({ name }) => {
      const token = name.replace(`user_session:${user.id}:`, '');
      await env.KV.delete(`session:${token}`);
      await env.KV.delete(name);
    })
  );

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
