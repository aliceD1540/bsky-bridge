// Brevo メール配信サービス統合

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Brevo の日次送信上限に達した場合のエラー
export class EmailDailyLimitError extends Error {
  constructor() {
    super('Daily email sending limit reached');
    this.name = 'EmailDailyLimitError';
  }
}

// メール送信（Brevo API）
async function sendEmail(apiKey, { to, subject, htmlContent }) {
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: 'Bluesky Bridge',
        email: 'noreply@project-grimoire.dev',
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // 429 または Brevo の日次上限エラー（400 + "daily_limit" コード）
    if (response.status === 429 || (response.status === 400 && error.includes('daily_limit'))) {
      throw new EmailDailyLimitError();
    }
    throw new Error(`Failed to send email: ${response.status} ${error}`);
  }

  return await response.json();
}

// メール確認メール送信
export async function sendVerificationEmail(env, email, token) {
  const verifyUrl = `${env.APP_URL}/verify-email?token=${token}`;
  const htmlContent = `
    <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Bluesky Bridge - メール確認</h2>
        <p>アカウント登録ありがとうございます。</p>
        <p>以下のリンクをクリックして、メールアドレスの確認を完了してください：</p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1da1f2; color: white; text-decoration: none; border-radius: 4px;">メールアドレスを確認</a></p>
        <p>または、以下のURLをブラウザにコピー＆ペーストしてください：</p>
        <p style="word-break: break-all; color: #657786;">${verifyUrl}</p>
        <p style="margin-top: 30px; color: #657786; font-size: 12px;">このリンクは24時間有効です。</p>
        <p style="color: #657786; font-size: 12px;">このメールに心当たりがない場合は、無視してください。</p>
      </body>
    </html>
  `;

  await sendEmail(env.BREVO_API_KEY, {
    to: email,
    subject: 'Bluesky Bridge - メール確認',
    htmlContent,
  });
}

// パスワードリセットメール送信
export async function sendPasswordResetEmail(env, email, token) {
  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
  const htmlContent = `
    <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Bluesky Bridge - パスワードリセット</h2>
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1da1f2; color: white; text-decoration: none; border-radius: 4px;">パスワードをリセット</a></p>
        <p>または、以下のURLをブラウザにコピー＆ペーストしてください：</p>
        <p style="word-break: break-all; color: #657786;">${resetUrl}</p>
        <p style="margin-top: 30px; color: #657786; font-size: 12px;">このリンクは1時間有効です。</p>
        <p style="color: #657786; font-size: 12px;">このメールに心当たりがない場合は、無視してください。</p>
      </body>
    </html>
  `;

  await sendEmail(env.BREVO_API_KEY, {
    to: email,
    subject: 'Bluesky Bridge - パスワードリセット',
    htmlContent,
  });
}

// メール確認が必要かチェック（環境変数で制御）
export function isEmailVerificationEnabled(env) {
  return env.EMAIL_VERIFICATION_ENABLED === 'true';
}
