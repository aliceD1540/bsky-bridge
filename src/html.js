// フロントエンドHTMLテンプレート

// 共通フッターHTML
const FOOTER_HTML = `
  <div class="page-footer">
    <a onclick="openModal('helpModal')">使い方</a>
    <a onclick="openModal('termsModal')">利用規約</a>
    <a onclick="openModal('privacyModal')">プライバシーポリシー</a>
    <span style="display:block;margin-top:8px">&copy; <a href="https://project-grimoire.dev/" target="_blank" rel="noopener">project-grimoire.dev</a></span>
  </div>
`;
const MODAL_STYLES = `
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    justify-content: center;
    align-items: flex-start;
    padding: 40px 16px;
    overflow-y: auto;
    box-sizing: border-box;
  }
  .modal-overlay.open {
    display: flex;
  }
  .modal {
    background: white;
    border-radius: 8px;
    max-width: 680px;
    width: 100%;
    padding: 32px;
    position: relative;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  }
  .modal h2 {
    margin-top: 0;
    color: #333;
  }
  .modal h3 {
    color: #444;
    margin-top: 1.5em;
  }
  .modal p, .modal li {
    color: #555;
    line-height: 1.7;
    font-size: 14px;
  }
  .modal ul {
    padding-left: 1.4em;
  }
  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #657786;
    width: auto;
    padding: 4px 8px;
  }
  .modal-close:hover {
    color: #333;
    background: none;
  }
  .page-footer {
    text-align: center;
    margin-top: 20px;
    font-size: 13px;
    color: #657786;
  }
  .page-footer a {
    color: #1da1f2;
    text-decoration: none;
    margin: 0 8px;
    cursor: pointer;
  }
  .page-footer a:hover {
    text-decoration: underline;
  }
`;

// 共通モーダルHTML（使い方・利用規約）
const MODAL_HTML = `
  <!-- 使い方モーダル -->
  <div class="modal-overlay" id="helpModal">
    <div class="modal">
      <button class="modal-close" onclick="closeModal('helpModal')">✕</button>
      <h2>使い方</h2>
      <h3>このサービスについて</h3>
      <p>Bluesky Bridge は、Bluesky アカウントの新着ポストを自動的に Threads および Misskey.io へ転記するサービスです。5分ごとに新着ポストを確認し、未投稿のポストを順次転送します。</p>

      <h3>セットアップ手順</h3>
      <ol style="color:#555;line-height:1.8;font-size:14px;padding-left:1.4em">
        <li>アカウントを作成してログインします。</li>
        <li>設定画面の「転記元」に Bluesky のアカウント名とアプリパスワードを入力し、「保存」します。アプリパスワードはアカウント所有確認のために使用され、サーバーには保存されません。</li>
        <li>転記先の「Threads」欄で「Threadsに接続」ボタンを押し、OAuth認証を完了します。</li>
        <li>転記先の「Misskey.io」欄にアクセストークンを入力し、「保存」します（オプション）。</li>
        <li>設定完了後、5分以内に転記が開始されます。</li>
      </ol>

      <h3>転記対象</h3>
      <ul>
        <li>通常のポスト（テキスト・画像付き）※センシティブラベル（性的・暴力的等）が付いた画像は転載されず、元ポストへのリンクに差し替えられます</li>
        <li>リポスト → 転記先に元ポストの URL を添えて投稿されます</li>
        <li>引用ポスト → テキストに引用元 URL が追加されます</li>
        <li>リプライは転記されません</li>
      </ul>

      <h3>注意事項</h3>
      <ul>
        <li>画像は最大4枚まで転記されます。</li>
        <li>複数のポストが同時に検出された場合、5秒間隔で順番に転記されます。</li>
        <li>Threads は1日250件の投稿制限があります。</li>
        <li>アカウント登録日時以前のポストは転記されません。</li>
        <li>Bluesky のアプリパスワードは設定→「アプリパスワード」から作成できます。</li>
        <li>Threads トークンの有効期限は60日です。期限の7日前に自動更新されます。</li>
        <li>60日以上ポストがない場合はトークンが期限切れになることがあります。その場合、設定画面に再連携を促すメッセージが表示されます。</li>
      </ul>
    </div>
  </div>

  <!-- 利用規約モーダル -->
  <div class="modal-overlay" id="termsModal">
    <div class="modal">
      <button class="modal-close" onclick="closeModal('termsModal')">✕</button>
      <h2>利用規約</h2>
      <h3>第1条（サービスの利用）</h3>
      <p>本サービスを利用するにあたり、利用者は本規約に同意したものとみなします。本サービスは個人利用を前提としており、商業目的での利用はお断りする場合があります。</p>

      <h3>第2条（禁止事項）</h3>
      <p>利用者は以下の行為を行ってはなりません。</p>
      <ul>
        <li>法令または公序良俗に反するコンテンツの転記</li>
        <li>他者の著作権・肖像権・プライバシーを侵害するコンテンツの転記</li>
        <li>スパムや自動生成コンテンツの大量転記</li>
        <li>本サービスのシステムへの不正アクセスや過負荷をかける行為</li>
        <li>第三者になりすます行為</li>
      </ul>

      <h3>第3条（利用者の責任）</h3>
      <p>転記されるコンテンツが各SNSプラットフォーム（Threads・Misskey.io 等）の利用規約に違反するか否かの判断および責任は、利用者本人に帰属します。本サービスはコンテンツの適法性・適切性を保証せず、プラットフォームの規約違反による利用停止・ペナルティ等について一切の責任を負いません。</p>

      <h3>第4条（免責事項）</h3>
      <p>本サービスは現状有姿で提供されます。運営者は以下について責任を負いません。</p>
      <ul>
        <li>転記の遅延・失敗・中断</li>
        <li>各SNSプラットフォームの仕様変更による機能停止</li>
        <li>本サービス利用により生じた損害</li>
        <li>第三者が投稿したコンテンツの内容</li>
      </ul>

      <h3>第5条（サービスの変更・終了）</h3>
      <p>運営者は予告なくサービスの内容を変更、または提供を終了することがあります。</p>

      <h3>第6条（個人情報の取り扱い）</h3>
      <p>登録されたメールアドレスおよびSNS認証情報はサービス提供のみに使用します。第三者への提供は行いません。SNS認証情報はAES-GCMにより暗号化して保管します。</p>

      <h3>第7条（規約の変更）</h3>
      <p>本規約は予告なく変更される場合があります。変更後も本サービスを継続して利用した場合、変更後の規約に同意したものとみなします。</p>
    </div>
  </div>

  <!-- プライバシーポリシーモーダル -->
  <div class="modal-overlay" id="privacyModal">
    <div class="modal">
      <button class="modal-close" onclick="closeModal('privacyModal')">✕</button>
      <h2>プライバシーポリシー</h2>

      <h3>収集する情報</h3>
      <p>本サービスは以下の情報を収集・保存します。</p>
      <ul>
        <li>メールアドレス（アカウント登録時）</li>
        <li>パスワード（PBKDF2+saltによりハッシュ化して保管）</li>
        <li>Bluesky のユーザーハンドル</li>
        <li>Threads の長期アクセストークンおよび有効期限</li>
        <li>Misskey.io のアクセストークン</li>
      </ul>
      <p>SNS のアクセストークンは AES-GCM により暗号化して保管します。Bluesky のアプリパスワードはアカウント所有確認のみに使用し、保存しません。</p>

      <h3>情報の利用目的</h3>
      <p>収集した情報は以下の目的にのみ使用します。</p>
      <ul>
        <li>ユーザー認証およびセッション管理</li>
        <li>Bluesky の新着ポストを Threads・Misskey.io へ転記する処理</li>
      </ul>

      <h3>第三者への提供</h3>
      <p>収集した個人情報を第三者に販売・提供・開示することはありません。ただし、転記処理の性質上、投稿内容は各 SNS プラットフォームの API を通じて送信されます。</p>

      <h3>情報の保管・削除</h3>
      <p>アカウントを削除すると、登録されたすべての情報（メールアドレス・SNS 設定・投稿履歴）が削除されます。</p>

      <h3>アクセスログ</h3>
      <p>本サービスは Cloudflare Workers 上で動作しており、リクエストに関する情報が Cloudflare のインフラにより処理されます。Cloudflare のプライバシーポリシーについては <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">こちら</a> をご確認ください。</p>

      <h3>ポリシーの変更</h3>
      <p>本ポリシーは予告なく変更される場合があります。変更後も本サービスを継続して利用した場合、変更後のポリシーに同意したものとみなします。</p>

      <h3>お問い合わせ</h3>
      <p>プライバシーに関するお問い合わせは <a href="https://project-grimoire.dev/" target="_blank" rel="noopener">project-grimoire.dev</a> までご連絡ください。</p>
    </div>
  </div>
`;

// 共通モーダルスクリプト
const MODAL_SCRIPT = `
  function openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname);
  }
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
    }
  });
  // URLハッシュによるモーダル自動オープン（例: /login#terms, /login#howto）
  const hashMap = { terms: 'termsModal', howto: 'howtoModal', privacy: 'privacyModal' };
  const hash = location.hash.replace('#', '');
  if (hashMap[hash]) openModal(hashMap[hash]);
`;

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
    ${MODAL_STYLES}
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
  ${FOOTER_HTML}
  ${MODAL_HTML}
  <script>
    ${MODAL_SCRIPT}
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
    ${MODAL_SCRIPT}
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
    ${MODAL_STYLES}
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
            <p id="threadsExpiredMsg" class="error" style="display:none">Threadsトークンの有効期限が切れています。再度連携してください。</p>
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
    // 設定読み込み
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings', { credentials: 'same-origin' });
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
      const expiredMsg = document.getElementById('threadsExpiredMsg');

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
        // トークンなし＋過去の有効期限あり → 期限切れで自動削除された状態
        const isExpired = data.threadsTokenExpiresAt && new Date(data.threadsTokenExpiresAt) < new Date();
        expiredMsg.style.display = isExpired ? 'block' : 'none';
      }
    }

    // Threads接続ボタン
    document.getElementById('threadsConnectBtn').addEventListener('click', async () => {
      try {
        const res = await fetch('/auth/threads/start', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (res.status === 401) { window.location.href = '/login'; return; }
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          alert('Threads連携の開始に失敗しました: ' + (data.error || ''));
        }
      } catch (err) {
        alert('エラーが発生しました');
      }
    });

    // Threads連携解除ボタン
    document.getElementById('threadsDisconnectBtn').addEventListener('click', async () => {
      if (!confirm('Threadsの連携を解除しますか？')) return;
      try {
        const res = await fetch('/api/threads/disconnect', {
          method: 'POST',
          credentials: 'same-origin',
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
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
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
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (err) {
        console.error('ログアウトエラー', err);
      }
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
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
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
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ password }),
        });

        const data = await res.json();
        if (data.success) {
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
    ${MODAL_SCRIPT}
  </script>
  ${FOOTER_HTML}
  ${MODAL_HTML}
</body>
</html>
`;
