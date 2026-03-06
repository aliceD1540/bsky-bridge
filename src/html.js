// フロントエンドHTMLテンプレート

export const HTML_INDEX = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bluesky Bridge</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 { color: #333; }
    .buttons {
      margin-top: 30px;
      display: flex;
      gap: 20px;
      justify-content: center;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      background: #1da1f2;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }
    a:hover {
      background: #1a8cd8;
    }
    .secondary {
      background: #657786 !important;
    }
    .secondary:hover {
      background: #56646f !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Bluesky Bridge</h1>
    <p>BlueskyのポストをThreadsとMisskey.ioに自動投稿</p>
    <div class="buttons">
      <a href="/login">ログイン</a>
      <a href="/register" class="secondary">新規登録</a>
    </div>
  </div>
</body>
</html>
`;

export const HTML_LOGIN = \`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ログイン - Bluesky Bridge</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-top: 0; }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #555;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #1da1f2;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover {
      background: #1a8cd8;
    }
    .error {
      color: #e0245e;
      margin-top: 10px;
      font-size: 14px;
    }
    .link {
      text-align: center;
      margin-top: 20px;
      font-size: 14px;
    }
    a {
      color: #1da1f2;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ログイン</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="email">メールアドレス</label>
        <input type="email" id="email" required>
      </div>
      <div class="form-group">
        <label for="password">パスワード</label>
        <input type="password" id="password" required>
      </div>
      <button type="submit">ログイン</button>
      <div id="error" class="error"></div>
    </form>
    <div class="link">
      <a href="/register">新規登録はこちら</a>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        
        if (data.success) {
          localStorage.setItem('sessionToken', data.sessionToken);
          window.location.href = '/settings';
        } else {
          errorDiv.textContent = data.error || 'ログインに失敗しました';
        }
      } catch (err) {
        errorDiv.textContent = 'エラーが発生しました';
      }
    });
  </script>
</body>
</html>
\`;

export const HTML_REGISTER = \`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>新規登録 - Bluesky Bridge</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-top: 0; }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #555;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #1da1f2;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover {
      background: #1a8cd8;
    }
    .error {
      color: #e0245e;
      margin-top: 10px;
      font-size: 14px;
    }
    .link {
      text-align: center;
      margin-top: 20px;
      font-size: 14px;
    }
    a {
      color: #1da1f2;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>新規登録</h1>
    <form id="registerForm">
      <div class="form-group">
        <label for="email">メールアドレス</label>
        <input type="email" id="email" required>
      </div>
      <div class="form-group">
        <label for="password">パスワード</label>
        <input type="password" id="password" required minlength="8">
      </div>
      <button type="submit">登録</button>
      <div id="error" class="error"></div>
    </form>
    <div class="link">
      <a href="/login">ログインはこちら</a>
    </div>
  </div>
  <script>
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        
        if (data.success) {
          localStorage.setItem('sessionToken', data.sessionToken);
          window.location.href = '/settings';
        } else {
          errorDiv.textContent = data.error || '登録に失敗しました';
        }
      } catch (err) {
        errorDiv.textContent = 'エラーが発生しました';
      }
    });
  </script>
</body>
</html>
\`;

export const HTML_SETTINGS = \`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>投稿設定 - Bluesky Bridge</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-top: 0; }
    h2 {
      color: #555;
      font-size: 18px;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f0f0f0;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #555;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    button {
      padding: 12px 24px;
      background: #1da1f2;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover {
      background: #1a8cd8;
    }
    .logout {
      background: #657786;
      margin-left: 10px;
    }
    .logout:hover {
      background: #56646f;
    }
    .success {
      color: #17bf63;
      margin-top: 10px;
      font-size: 14px;
    }
    .error {
      color: #e0245e;
      margin-top: 10px;
      font-size: 14px;
    }
    .info {
      color: #657786;
      font-size: 12px;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>投稿設定</h1>
    
    <h2>Bluesky</h2>
    <form id="settingsForm">
      <div class="form-group">
        <label for="blueskyHandle">アカウント名</label>
        <input type="text" id="blueskyHandle" placeholder="example.bsky.social">
      </div>
      <div class="form-group">
        <label for="blueskyPassword">アプリパスワード</label>
        <input type="password" id="blueskyPassword" placeholder="アプリパスワードを入力">
        <div class="info">Blueskyの設定からアプリパスワードを生成してください</div>
      </div>
      
      <h2>Misskey.io</h2>
      <div class="form-group">
        <label for="misskeyToken">アクセストークン</label>
        <input type="password" id="misskeyToken" placeholder="Misskeyのアクセストークンを入力">
        <div class="info">Misskey.ioの設定からアクセストークンを生成してください</div>
      </div>
      
      <h2>Threads</h2>
      <div class="form-group">
        <label for="threadsToken">アクセストークン</label>
        <input type="password" id="threadsToken" placeholder="Threadsのアクセストークンを入力">
        <div class="info">Threads APIのアクセストークンを入力してください</div>
      </div>
      
      <button type="submit">保存</button>
      <button type="button" class="logout" onclick="logout()">ログアウト</button>
      <div id="message"></div>
    </form>
  </div>
  <script>
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      window.location.href = '/login';
    }

    // 設定読み込み
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings', {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        if (data.blueskyHandle) {
          document.getElementById('blueskyHandle').value = data.blueskyHandle;
        }
      } catch (err) {
        console.error('設定の読み込みに失敗しました', err);
      }
    }

    loadSettings();

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageDiv = document.getElementById('message');
      
      const settings = {
        blueskyHandle: document.getElementById('blueskyHandle').value,
        blueskyPassword: document.getElementById('blueskyPassword').value,
        misskeyToken: document.getElementById('misskeyToken').value,
        threadsToken: document.getElementById('threadsToken').value,
      };
      
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(settings),
        });
        
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        
        const data = await res.json();
        if (data.success) {
          messageDiv.className = 'success';
          messageDiv.textContent = '設定を保存しました';
        } else {
          messageDiv.className = 'error';
          messageDiv.textContent = data.error || '保存に失敗しました';
        }
      } catch (err) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'エラーが発生しました';
      }
    });

    async function logout() {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
        });
      } catch (err) {
        console.error('ログアウトエラー', err);
      }
      localStorage.removeItem('sessionToken');
      window.location.href = '/login';
    }
  </script>
</body>
</html>
\`;
