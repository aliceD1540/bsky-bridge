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

export const HTML_LOGIN = `
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
`;

export const HTML_REGISTER = `
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
`;

export const HTML_SETTINGS = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>投稿設定 - Bluesky Bridge</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 1100px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .page-header h1 {
      color: #333;
      margin: 0;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    @media (max-width: 700px) {
      .columns {
        grid-template-columns: 1fr;
      }
    }
    .card {
      background: white;
      padding: 32px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h2 {
      color: #333;
      font-size: 18px;
      margin-top: 0;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f0f0f0;
    }
    h3 {
      color: #555;
      font-size: 15px;
      margin-top: 24px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
    }
    h3:first-of-type {
      margin-top: 0;
    }
    h4 {
      color: #666;
      font-size: 14px;
      margin-top: 16px;
      margin-bottom: 10px;
    }
    .form-group {
      margin-bottom: 16px;
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
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 8px;
    }
    button {
      padding: 10px 20px;
      background: #1da1f2;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover {
      background: #1a8cd8;
    }
    .btn-logout {
      background: #657786;
    }
    .btn-logout:hover {
      background: #56646f;
    }
    .btn-danger {
      background: #e0245e;
    }
    .btn-danger:hover {
      background: #b81d4e;
    }
    .card-danger {
      border: 1px solid #e0245e;
    }
    .card-danger h2 {
      color: #e0245e;
    }
    .danger-description {
      color: #657786;
      font-size: 0.9em;
      margin-bottom: 1rem;
    }
    .right-column {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
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
  <div class="page-header">
    <h1>Bluesky Bridge</h1>
    <button type="button" class="btn-logout" onclick="logout()">ログアウト</button>
  </div>

  <div class="columns">
    <!-- 左カラム: 投稿設定 -->
    <div class="card">
      <h2>投稿設定</h2>
      <form id="settingsForm">
        <h3>転記元</h3>
        <h4>Bluesky</h4>
        <div class="form-group">
          <label for="blueskyHandle">アカウント名</label>
          <input type="text" id="blueskyHandle" placeholder="example.bsky.social">
        </div>
        <div class="form-group">
          <label for="blueskyPassword">アプリパスワード</label>
          <input type="password" id="blueskyPassword" placeholder="変更しない場合は空欄のまま">
          <div class="info">Blueskyの設定からアプリパスワードを生成してください。</div>
        </div>

        <h3>転記先</h3>
        <h4>Misskey.io</h4>
        <div class="form-group">
          <label for="misskeyToken">アクセストークン</label>
          <input type="password" id="misskeyToken" placeholder="変更しない場合は空欄のまま">
          <div class="info">Misskey.ioの設定から「ドライブを操作する」「ノートを作成・削除する」の権限を持つアクセストークンを生成してください。</div>
        </div>

        <h4>Threads</h4>
        <div class="form-group">
          <div id="threadsStatus" class="info">読み込み中...</div>
          <div id="threadsConnected" style="display:none">
            <p id="threadsExpiry"></p>
            <button type="button" id="threadsDisconnectBtn" class="btn-danger">Threadsの連携を解除</button>
          </div>
          <div id="threadsDisconnected" style="display:none">
            <button type="button" id="threadsConnectBtn">Threadsに接続</button>
          </div>
        </div>

        <div class="actions">
          <button type="submit">保存</button>
        </div>
        <div id="message"></div>
      </form>
    </div>

    <!-- 右カラム: パスワード変更 / アカウント削除 -->
    <div class="right-column">
      <div class="card">
      <h2>パスワード変更</h2>
      <form id="changePasswordForm">
        <div class="form-group">
          <label for="currentPassword">現在のパスワード</label>
          <input type="password" id="currentPassword" required>
        </div>
        <div class="form-group">
          <label for="newPassword">新しいパスワード</label>
          <input type="password" id="newPassword" required minlength="8">
        </div>
        <div class="form-group">
          <label for="confirmPassword">新しいパスワード（確認）</label>
          <input type="password" id="confirmPassword" required minlength="8">
        </div>
        <div class="actions">
          <button type="submit">パスワードを変更</button>
        </div>
        <div id="passwordMessage"></div>
      </form>
    </div>

    <!-- アカウント削除 -->
    <div class="card card-danger">
      <h2>アカウントを削除する</h2>
      <p class="danger-description">アカウントを削除すると、すべての設定データが削除されます。この操作は取り消せません。</p>
      <form id="deleteAccountForm">
        <div class="form-group">
          <label for="deletePassword">パスワードを入力して確認</label>
          <input type="password" id="deletePassword" required>
        </div>
        <div class="actions">
          <button type="submit" class="btn-danger">アカウントを削除する</button>
        </div>
        <div id="deleteMessage"></div>
      </form>
    </div>
    </div>
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
        updateThreadsStatus(data);
      } catch (err) {
        console.error('設定の読み込みに失敗しました', err);
      }
    }

    function updateThreadsStatus(data) {
      const statusDiv = document.getElementById('threadsStatus');
      const connectedDiv = document.getElementById('threadsConnected');
      const disconnectedDiv = document.getElementById('threadsDisconnected');
      const expiryP = document.getElementById('threadsExpiry');

      statusDiv.style.display = 'none';
      if (data.hasThreadsToken) {
        connectedDiv.style.display = 'block';
        disconnectedDiv.style.display = 'none';
        if (data.threadsTokenExpiresAt) {
          const expiresAt = new Date(data.threadsTokenExpiresAt);
          expiryP.textContent = '有効期限: ' + expiresAt.toLocaleDateString('ja-JP');
        } else {
          expiryP.textContent = '';
        }
      } else {
        connectedDiv.style.display = 'none';
        disconnectedDiv.style.display = 'block';
      }
    }

    // Threads接続ボタン
    document.getElementById('threadsConnectBtn').addEventListener('click', () => {
      window.location.href = '/auth/threads?session=' + encodeURIComponent(token);
    });

    // Threads連携解除ボタン
    document.getElementById('threadsDisconnectBtn').addEventListener('click', async () => {
      if (!confirm('Threadsの連携を解除しますか？')) return;
      try {
        const res = await fetch('/api/threads/disconnect', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (res.ok) {
          updateThreadsStatus({ hasThreadsToken: false });
        }
      } catch (err) {
        console.error('Threads連携解除に失敗しました', err);
      }
    });

    // OAuth認証後のメッセージ表示
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('threads_connected') === '1') {
      const messageDiv = document.getElementById('message');
      messageDiv.className = 'success';
      messageDiv.textContent = 'Threadsと連携しました（保存ボタンの押下は不要です）';
      history.replaceState(null, '', '/settings');
    } else if (urlParams.get('threads_error')) {
      const messageDiv = document.getElementById('message');
      messageDiv.className = 'error';
      messageDiv.textContent = 'Threads連携に失敗しました: ' + urlParams.get('threads_error');
      history.replaceState(null, '', '/settings');
    }

    loadSettings();

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageDiv = document.getElementById('message');
      
      const settings = {
        blueskyHandle: document.getElementById('blueskyHandle').value,
        blueskyPassword: document.getElementById('blueskyPassword').value,
        misskeyToken: document.getElementById('misskeyToken').value,
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

    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageDiv = document.getElementById('passwordMessage');
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (newPassword !== confirmPassword) {
        messageDiv.className = 'error';
        messageDiv.textContent = '新しいパスワードが一致しません';
        return;
      }

      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }

        const data = await res.json();
        if (data.success) {
          messageDiv.className = 'success';
          messageDiv.textContent = 'パスワードを変更しました';
          document.getElementById('changePasswordForm').reset();
        } else {
          messageDiv.className = 'error';
          messageDiv.textContent = data.error === 'Current password is incorrect'
            ? '現在のパスワードが正しくありません'
            : (data.error || 'パスワードの変更に失敗しました');
        }
      } catch (err) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'エラーが発生しました';
      }
    });

    document.getElementById('deleteAccountForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageDiv = document.getElementById('deleteMessage');
      const password = document.getElementById('deletePassword').value;

      if (!confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return;

      try {
        const res = await fetch('/api/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ password }),
        });

        const data = await res.json();
        if (data.success) {
          localStorage.removeItem('sessionToken');
          window.location.href = '/login';
        } else {
          messageDiv.className = 'error';
          messageDiv.textContent = data.error === 'Password is incorrect'
            ? 'パスワードが正しくありません'
            : (data.error || 'アカウントの削除に失敗しました');
        }
      } catch (err) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'エラーが発生しました';
      }
    });
  </script>
</body>
</html>
`;
