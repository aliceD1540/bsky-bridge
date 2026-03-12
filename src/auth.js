// 認証ハンドラー

import { hashPassword, verifyPassword, verifySha256Password } from './crypto.js';
import { sendVerificationEmail, sendPasswordResetEmail, isEmailVerificationEnabled, EmailDailyLimitError } from './emailService.js';

// セッショントークン生成
function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// トークン生成（メール確認・パスワードリセット用）
function generateToken() {
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

  // メール確認が有効な場合、トークン生成
  const emailVerificationEnabled = isEmailVerificationEnabled(env);
  let emailVerified = 1;
  let emailVerificationToken = null;
  let emailVerificationExpiresAt = null;

  if (emailVerificationEnabled) {
    emailVerified = 0;
    emailVerificationToken = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    emailVerificationExpiresAt = expiresAt.toISOString();
  }

  // ユーザー作成
  const result = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, password_salt, password_hash_version, email_verified, email_verification_token, email_verification_expires_at, created_at) VALUES (?, ?, ?, 2, ?, ?, ?, ?)'
  )
    .bind(email, passwordHash, passwordSalt, emailVerified, emailVerificationToken, emailVerificationExpiresAt, now)
    .run();

  const userId = result.meta.last_row_id;

  // メール確認メール送信
  if (emailVerificationEnabled && emailVerificationToken) {
    try {
      await sendVerificationEmail(env, email, emailVerificationToken);
    } catch (e) {
      console.error('Failed to send verification email:', e);
      if (e instanceof EmailDailyLimitError) {
        return { success: false, error: 'メール送信の1日の上限に達しました。翌日以降に再度お試しください。' };
      }
      return { success: false, error: 'Failed to send verification email' };
    }
  }

  // セッショントークン生成・KVに保存（userId逆引き用のインデックスも保持）
  const sessionToken = generateSessionToken();
  await env.KV.put(`session:${sessionToken}`, JSON.stringify({ userId, email }), {
    expirationTtl: 30 * 24 * 60 * 60,
  });
  await env.KV.put(`user_session:${userId}:${sessionToken}`, '1', {
    expirationTtl: 30 * 24 * 60 * 60,
  });

  return { success: true, userId, sessionToken, emailVerificationRequired: emailVerificationEnabled };
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

// メール確認
export async function verifyEmail(env, token) {
  if (!token) {
    return { success: false, error: 'Token is required' };
  }

  const user = await env.DB.prepare(
    'SELECT id, email, email_verification_token, email_verification_expires_at FROM users WHERE email_verification_token = ?'
  )
    .bind(token)
    .first();

  if (!user) {
    return { success: false, error: 'Invalid or expired token' };
  }

  const now = new Date();
  const expiresAt = user.email_verification_expires_at ? new Date(user.email_verification_expires_at) : null;

  if (!expiresAt || expiresAt < now) {
    return { success: false, error: 'Invalid or expired token' };
  }

  await env.DB.prepare(
    'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = ?'
  )
    .bind(user.id)
    .run();

  return { success: true };
}

// パスワードリセット要求
export async function requestPasswordReset(env, email) {
  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user) {
    return { success: true };
  }

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await env.DB.prepare(
    'UPDATE users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?'
  )
    .bind(token, expiresAt.toISOString(), user.id)
    .run();

  try {
    await sendPasswordResetEmail(env, email, token);
  } catch (e) {
    console.error('Failed to send password reset email:', e);
    if (e instanceof EmailDailyLimitError) {
      return { success: false, error: 'メール送信の1日の上限に達しました。翌日以降に再度お試しください。' };
    }
    return { success: false, error: 'Failed to send email' };
  }

  return { success: true };
}

// パスワードリセット
export async function resetPassword(env, token, newPassword) {
  if (!token || !newPassword) {
    return { success: false, error: 'Token and new password are required' };
  }

  const user = await env.DB.prepare(
    'SELECT id, password_reset_token, password_reset_expires_at FROM users WHERE password_reset_token = ?'
  )
    .bind(token)
    .first();

  if (!user) {
    return { success: false, error: 'Invalid or expired token' };
  }

  const now = new Date();
  const expiresAt = user.password_reset_expires_at ? new Date(user.password_reset_expires_at) : null;

  if (!expiresAt || expiresAt < now) {
    return { success: false, error: 'Invalid or expired token' };
  }

  const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);

  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ?, password_hash_version = 2, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?'
  )
    .bind(newHash, newSalt, user.id)
    .run();

  return { success: true };
}

