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
      <p>Bluesky Bridge は、SNS アカウントの新着ポストを自動的に他のプラットフォームへ転記するサービスです。Bluesky・Misskey.io・Threads のいずれかを転記元として選択し、認証情報を設定した他プラットフォームへ5分ごとに自動転送します。</p>

      <h3>セットアップ手順</h3>
      <ol style="color:#555;line-height:1.8;font-size:14px;padding-left:1.4em">
        <li>アカウントを作成してログインします。</li>
        <li>設定画面「転記元指定」で転記元にするプラットフォームを選択し、「保存」します。</li>
        <li>設定画面「認証情報」で、使用するプラットフォームの認証情報を入力します。
          <ul style="margin-top:4px">
            <li><b>Bluesky</b>：アカウント名とアプリパスワードを入力し「保存」します。</li>
            <li><b>Misskey.io</b>：アクセストークンを入力し「保存」します。</li>
            <li><b>Threads</b>：「Threadsに接続」ボタンから OAuth 認証を完了します（完了時に自動保存）。</li>
          </ul>
        </li>
        <li>（オプション）設定画面「リプライ通知設定」で、転記先でリプライがあった場合に通知を受け取るプラットフォームを選択できます。</li>
        <li>設定完了後、5分以内に転記が開始されます。転記元以外の認証済みプラットフォームがすべて転記先になります。認証情報が未設定のプラットフォームは転記先から除外されます（設定画面に赤文字で表示されます）。</li>
      </ol>

      <h3>転記対象</h3>
      <ul>
        <li>通常のポスト（テキスト・画像付き）</li>
        <li>リポスト → 転記先に元ポストの URL を添えて投稿されます</li>
        <li>引用ポスト → テキストに引用元 URL が追加されます</li>
        <li>リプライは転記されません</li>
      </ul>

      <h3>センシティブ・ネタバレコンテンツの扱い</h3>
      <ul>
        <li><b>Bluesky</b>：センシティブラベル（性的・暴力的等）が付いた画像は転載されず、元ポストへのリンクに差し替えられます。</li>
        <li><b>Misskey.io</b>：CW（コンテンツ警告）付きポストは転記されません。</li>
        <li><b>Threads</b>：ネタバレラベル付きポストは画像が転載されず、「ネタバレタグつきポストです。」というメッセージと元ポストへのリンクに差し替えられます。</li>
      </ul>

      <h3>注意事項</h3>
      <ul>
        <li>画像は最大4枚まで転記されます。</li>
        <li>複数のポストが同時に検出された場合、5秒間隔で順番に転記されます。</li>
        <li>Threads は1日250件の投稿制限があります。</li>
        <li>アカウント登録日時以前のポストは転記されません。</li>
        <li>転記元を切り替えると、切り替え時点以降の新着ポストのみが転記されます。切り替え前のポストは転記されません。</li>
        <li>Bluesky のアプリパスワードは設定→「アプリパスワード」から作成できます。</li>
        <li>Misskey.io のアクセストークンは設定→「API」から「アカウントの情報を見る」「ドライブを操作する」「ノートを作成・削除する」の権限で作成してください。</li>
        <li>Threads トークンの有効期限は60日です。期限の7日前に自動更新されます。60日以上ポストがない場合はトークンが期限切れになることがあります。その場合、設定画面に再連携を促すメッセージが表示されます。</li>
        <li>アカウント登録やパスワードリセットに使用するメール送信はサーバの都合により1日の送信件数に上限があります。エラーが発生した場合は翌日以降に再度お試しください。</li>
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
        <li>Bluesky のユーザーハンドルおよびアプリパスワード</li>
        <li>Threads の長期アクセストークンおよび有効期限</li>
        <li>Misskey.io のアクセストークン</li>
      </ul>
      <p>Bluesky のアプリパスワード・Threads のアクセストークン・Misskey.io のアクセストークンは AES-GCM により暗号化して保管します。</p>
      <p>なお、メール認証・パスワードリセットのためにメールアドレスを Brevo（メール配信サービス）へ送信します。Brevo のプライバシーポリシーについては <a href="https://www.brevo.com/legal/privacypolicy/" target="_blank" rel="noopener">こちら</a> をご確認ください。</p>

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
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .login-layout {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }
    .login-section {
      flex: 0 0 380px;
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
    .announcement-section {
      flex: 1;
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: none;
    }
    .announcement-section h2 {
      margin-top: 0;
      color: #333;
      font-size: 16px;
      border-bottom: 2px solid #1da1f2;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .announcement-body {
      color: #444;
      font-size: 14px;
      line-height: 1.7;
    }
    .announcement-body h1,
    .announcement-body h2,
    .announcement-body h3 {
      color: #333;
      margin: 0.5em 0;
    }
    .announcement-body p {
      margin: 0.5em 0;
    }
    .announcement-body a {
      color: #1da1f2;
    }
    @media (max-width: 640px) {
      .login-layout { flex-direction: column; }
      .login-section { flex: none; width: 100%; }
    }
    ${MODAL_STYLES}
  </style>
</head>
<body>
  <div class="login-layout">
    <div class="login-section">
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
          <a href="/forgot-password">パスワードを忘れた場合</a>
        </div>
        <div class="link">
          <a href="/register">新規登録はこちら</a>
        </div>
      </div>
    </div>
    <div class="announcement-section" id="announcementSection">
      <h2>📢 お知らせ</h2>
      <div class="announcement-body" id="announcementBody"></div>
    </div>
  </div>
  ${FOOTER_HTML}
  ${MODAL_HTML}
  <script>
    ${MODAL_SCRIPT}

    function renderMarkdown(text) {
      if (!text) return '';
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      html = html.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
      html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      const blocks = html.split(/\\n\\n+/);
      html = blocks.map(b => {
        b = b.trim();
        if (!b) return '';
        if (/^<h[1-3]/.test(b)) return b;
        return '<p>' + b.replace(/\\n/g, '<br>') + '</p>';
      }).join('');
      return html;
    }

    async function loadAnnouncement() {
      try {
        const res = await fetch('/api/announcement');
        const data = await res.json();
        if (data.content) {
          document.getElementById('announcementBody').innerHTML = renderMarkdown(data.content);
          document.getElementById('announcementSection').style.display = 'block';
        }
      } catch (err) {
        // お知らせの読み込みに失敗した場合は非表示のまま
      }
    }

    loadAnnouncement();

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
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .radio-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .radio-label input[type="radio"] {
      margin: 0;
      flex-shrink: 0;
      width: auto;
      padding: 0;
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 8px;
      justify-content: flex-end;
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
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .user-info-email {
      font-size: 13px;
      color: #555;
      font-weight: 500;
    }
    .user-info-count {
      font-size: 12px;
      color: #657786;
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
    .right-column, .left-column {
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
    .text-danger {
      color: #e0245e;
      font-size: 12px;
      margin-top: 5px;
    }
    ${MODAL_STYLES}
  </style>
</head>
<body>
  <div class="page-header">
    <h1>Bluesky Bridge</h1>
    <div class="header-right">
      <div class="user-info">
        <span class="user-info-email" id="headerEmail"></span>
        <span class="user-info-count" id="headerPostCount"></span>
      </div>
      <button type="button" class="btn-logout" onclick="logout()">ログアウト</button>
    </div>
  </div>

  <!-- メール未確認警告 -->
  <div id="emailVerificationWarning" style="display:none; background:#fff3cd; border:1px solid #ffc107; border-radius:8px; padding:16px; margin-bottom:24px;">
    <p style="margin:0; color:#856404; font-weight:500;">⚠️ メールアドレスが未確認です。自動転記機能を利用するには、送信されたメール内のリンクをクリックしてメールアドレスを確認してください。</p>
  </div>

  <div class="columns">
    <!-- 左カラム: 転記元指定 / 認証情報 -->
    <div class="left-column">
      <div class="card">
        <h2>転記元指定</h2>
        <p class="info">選択したプラットフォームの新着投稿が、認証情報を設定済みの他プラットフォームへ自動転記されます。</p>
        <p class="info">⚠️ 転記元を切り替えると、切り替え時点以降の新着投稿のみが転記されます。切り替え前の投稿は転記されません。</p>
        <form id="settingsForm">
          <div class="form-group radio-group">
            <label class="radio-label"><input type="radio" name="sourcePlatform" value="bluesky" id="srcBluesky"><span>Bluesky</span><span class="text-danger" id="srcBlueskyWarning" style="display:none; margin-left: 8px;">認証情報未設定</span></label>
            <label class="radio-label"><input type="radio" name="sourcePlatform" value="misskey" id="srcMisskey"><span>Misskey.io</span><span class="text-danger" id="srcMisskeyWarning" style="display:none; margin-left: 8px;">認証情報未設定</span></label>
            <label class="radio-label"><input type="radio" name="sourcePlatform" value="threads" id="srcThreads"><span>Threads</span><span class="text-danger" id="srcThreadsWarning" style="display:none; margin-left: 8px;">認証情報未設定</span></label>

          </div>
          <div class="actions">
            <button type="submit">保存</button>
          </div>
          <div id="message"></div>
        </form>
      </div>

      <div class="card">
        <h2>認証情報</h2>
        <p class="info">転記元・転記先として使用するプラットフォームの認証情報を設定してください。</p>

        <h3>Bluesky <span class="text-danger" id="blueskyStatusWarning" style="display:none;">認証情報未設定</span></h3>
        <div class="form-group">
          <label for="blueskyHandle">アカウント名</label>
          <input type="text" id="blueskyHandle" placeholder="example.bsky.social" autocomplete="off">
        </div>
        <div class="form-group">
          <label for="blueskyAppPassword">アプリパスワード</label>
          <input type="password" id="blueskyAppPassword" placeholder="変更しない場合は空欄のまま" autocomplete="off">
          <div class="info">Blueskyの設定からアプリパスワードを生成してください。転記元・転記先どちらで使用する場合も設定が必要です。</div>
        </div>
        <div id="blueskyDeleteBtnContainer" style="display:none;">
          <button type="button" id="blueskyDeleteBtn" class="btn-danger">認証情報削除</button>
        </div>

        <h3>Misskey.io <span class="text-danger" id="misskeyStatusWarning" style="display:none;">認証情報未設定</span></h3>
        <div class="form-group">
          <label for="misskeyToken">アクセストークン</label>
          <input type="password" id="misskeyToken" placeholder="変更しない場合は空欄のまま" autocomplete="off">
          <div class="info">Misskey.ioの設定から「アカウントの情報を見る」「ドライブを操作する」「ノートを作成・削除する」の権限を持つアクセストークンを生成してください。</div>
        </div>
        <div id="misskeyDeleteBtnContainer" style="display:none;">
          <button type="button" id="misskeyDeleteBtn" class="btn-danger">認証情報削除</button>
        </div>

        <h3>Threads <span class="text-danger" id="threadsStatusWarning" style="display:none;">認証情報未設定</span></h3>
        <div class="form-group">
          <div class="info">連携ボタンから認証が完了した時点で自動保存されます。保存ボタンの押下は不要です。</div>
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

        <div id="mixi2Section" style="display:none;">
          <h3>mixi2（管理者のみ） <span class="text-danger" id="mixi2StatusWarning" style="display:none;">認証情報未設定</span></h3>
          <div class="form-group">
            <label for="mixi2ClientId">Botアカウント クライアントID</label>
            <input type="password" id="mixi2ClientId" placeholder="変更しない場合は空欄のまま" autocomplete="off">
            <div class="info">投稿用BotアカウントのOAuth 2.0クライアントIDを入力してください。</div>
          </div>
          <div class="form-group">
            <label for="mixi2ClientSecret">Botアカウント クライアントシークレット</label>
            <input type="password" id="mixi2ClientSecret" placeholder="変更しない場合は空欄のまま" autocomplete="off">
            <div class="info">投稿用BotアカウントのOAuth 2.0クライアントシークレットを入力してください。</div>
          </div>
          <div id="mixi2DeleteBtnContainer" style="display:none;">
            <button type="button" id="mixi2DeleteBtn" class="btn-danger">認証情報削除</button>
          </div>
        </div>

        <div class="actions">
          <button type="button" id="saveCredentialsBtn">保存</button>
        </div>
        <div id="credentialsMessage"></div>
      </div>

      <div class="card">
        <h2>リプライ通知設定</h2>
        <p class="info">転記先でリプライがあった場合、転記元アカウントに通知を送信できます。各プラットフォームのWebhook設定に以下のURLを登録してください。</p>
        
        <div class="form-group">
          <label class="radio-label" style="cursor:auto;">
            <input type="checkbox" id="notifyReplyMisskey" style="width:auto;">
            <span>Misskey.ioのリプライを通知</span>
          </label>
        </div>
        
        <div class="form-group">
          <label class="radio-label" style="cursor:auto;">
            <input type="checkbox" id="notifyReplyThreads" style="width:auto;">
            <span>Threadsのリプライを通知</span>
          </label>
        </div>
        
        <div class="form-group" id="notifyReplyMixi2Container" style="display:none;">
          <label class="radio-label" style="cursor:auto;">
            <input type="checkbox" id="notifyReplyMixi2" style="width:auto;">
            <span>mixi2のリプライを通知</span>
          </label>
        </div>

        <div class="form-group" id="webhookInfoSection" style="display:none;">
          <h3 style="font-size:1rem; margin-bottom:8px;">Webhook設定情報</h3>

          <label>Misskey.io Webhook URL</label>
          <div style="display:flex; gap:8px; margin-bottom:4px;">
            <input type="text" id="webhookUrlMisskey" readonly onclick="this.select()" style="flex:1;">
          </div>
          <div class="info" style="margin-bottom:12px;">Misskey.io のWebhook設定で上記URLを登録してください。シークレットは任意ですが、設定する場合は下記のトークンを使用してください。</div>

          <div id="threadsWebhookSection" style="display:none;">
            <label>Threads Webhook URL</label>
            <div style="display:flex; gap:8px; margin-bottom:4px;">
              <input type="text" id="webhookUrlThreads" readonly onclick="this.select()" style="flex:1;">
            </div>
            <div class="info" style="margin-bottom:12px;">Meta Developer Console のWebhook設定でコールバックURLに上記URLを、確認トークンに下記のトークンを設定してください。</div>
          </div>

          <label>mixi2 Webhook URL</label>
          <div style="display:flex; gap:8px; margin-bottom:4px;">
            <input type="text" id="webhookUrlMixi2" readonly onclick="this.select()" style="flex:1;">
          </div>
          <div class="info" style="margin-bottom:12px;">mixi2 のWebhook設定で上記URLを登録してください。</div>

          <div id="mixi2PublicKeySection" style="display:none;">
            <label for="mixi2WebhookPublicKey">mixi2 署名検証用公開鍵（Base64）</label>
            <textarea id="mixi2WebhookPublicKey" rows="3" placeholder="mixi2のWebhook設定で共有された署名検証用公開鍵を貼り付けてください（Base64形式）" style="font-family:monospace; font-size:0.85rem;"></textarea>
            <div class="info" style="margin-bottom:12px;">mixi2 のWebhook設定を行うと署名検証用の公開鍵が発行されます。これを入力するとWebhookの署名を検証できます（管理者のみ）。</div>
          </div>

          <label for="webhookToken">Webhook認証トークン（共通）</label>
          <input type="text" id="webhookToken" readonly onclick="this.select()">
          <div class="info">このトークンはすべてのプラットフォームで共通です。外部に漏らさないようにしてください。</div>
        </div>

        <div class="actions">
          <button type="button" id="saveNotificationBtn">保存</button>
        </div>
        <div id="notificationMessage"></div>
      </div>
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

    <!-- 管理者用: お知らせ編集（管理者のみ表示） -->
    <div class="card" id="announcementEditorCard" style="display:none;">
      <h2>📢 お知らせ編集</h2>
      <p class="info">ログイン画面に表示するお知らせを入力してください。Markdown形式で記述できます。空欄にすると非表示になります。</p>
      <div class="form-group">
        <label for="announcementContent">お知らせ内容</label>
        <textarea id="announcementContent" rows="8" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;resize:vertical;font-family:monospace;"></textarea>
      </div>
      <div class="actions">
        <button type="button" id="saveAnnouncementBtn">保存</button>
      </div>
      <div id="announcementMessage"></div>
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
        
        // ヘッダーにメールアドレスと本日の転記回数を表示
        if (data.email) {
          document.getElementById('headerEmail').textContent = data.email;
        }
        document.getElementById('headerPostCount').textContent = '本日の転記回数: ' + (data.todayPostCount ?? 0) + ' / ' + (data.dailyLimit ?? 20) + ' 回';
        
        // メール未確認警告の表示
        const warningDiv = document.getElementById('emailVerificationWarning');
        if (data.emailVerified === false) {
          warningDiv.style.display = 'block';
        } else {
          warningDiv.style.display = 'none';
        }
        
        // 管理者の場合はお知らせ編集カード・mixi2設定・mixi2通知・公開鍵・Threads Webhook URLを表示
        if (data.isAdmin) {
          document.getElementById('announcementEditorCard').style.display = 'block';
          document.getElementById('mixi2Section').style.display = 'block';
          loadAnnouncement();
          updateAuthStatus('mixi2', data.hasMixi2Config);
          if (data.hasMixi2Config) {
            document.getElementById('mixi2ClientId').placeholder = '設定済み（変更する場合のみ入力）';
            document.getElementById('mixi2ClientSecret').placeholder = '設定済み（変更する場合のみ入力）';
          }
          document.getElementById('notifyReplyMixi2Container').style.display = 'block';
          document.getElementById('mixi2PublicKeySection').style.display = 'block';
          document.getElementById('threadsWebhookSection').style.display = 'block';
          if (data.mixi2WebhookPublicKey) {
            document.getElementById('mixi2WebhookPublicKey').value = data.mixi2WebhookPublicKey;
          }
        }
        
        if (data.blueskyHandle) {
          document.getElementById('blueskyHandle').value = data.blueskyHandle;
        }
        
        // 各プラットフォームの認証状態を更新
        updateAuthStatus('bluesky', data.hasBlueskyAppPassword);
        updateAuthStatus('misskey', data.hasMisskeyToken);
        updateAuthStatus('threads', data.hasThreadsToken);
        
        // アプリパスワード設定状態を反映
        if (data.hasBlueskyAppPassword) {
          document.getElementById('blueskyAppPassword').placeholder = '設定済み（変更する場合のみ入力）';
        } else {
          document.getElementById('blueskyAppPassword').placeholder = '変更しない場合は空欄のまま';
        }
        
        // Misskey.io トークン設定状態を反映
        if (data.hasMisskeyToken) {
          document.getElementById('misskeyToken').placeholder = '設定済み（変更する場合のみ入力）';
        } else {
          document.getElementById('misskeyToken').placeholder = '変更しない場合は空欄のまま';
        }
        
        // 転記元プラットフォームを設定
        const src = data.sourcePlatform || 'bluesky';
        const radio = document.querySelector('input[name="sourcePlatform"][value="' + src + '"]');
        if (radio && !radio.disabled) {
          radio.checked = true;
        } else if (radio && radio.disabled) {
          // 現在の転記元が無効化されている場合、何も選択しない
        }
        
        updateThreadsStatus(data);

        // 通知設定の読み込み
        document.getElementById('notifyReplyMisskey').checked = data.notifyReplyMisskey || false;
        document.getElementById('notifyReplyThreads').checked = data.notifyReplyThreads || false;
        document.getElementById('notifyReplyMixi2').checked = data.notifyReplyMixi2 || false;
        
        // Webhook情報の表示（userId と webhookToken が揃っている場合）
        if (data.userId && data.webhookToken) {
          const origin = window.location.origin;
          document.getElementById('webhookUrlMisskey').value = \`\${origin}/api/webhook/misskey/\${data.userId}?token=\${data.webhookToken}\`;
          document.getElementById('webhookUrlThreads').value = \`\${origin}/api/webhook/threads\`;
          document.getElementById('webhookUrlMixi2').value = \`\${origin}/api/webhook/mixi2/\${data.userId}?token=\${data.webhookToken}\`;
          document.getElementById('webhookToken').value = data.webhookToken;
          document.getElementById('webhookInfoSection').style.display = 'block';
        }
      } catch (err) {
        console.error('設定の読み込みに失敗しました', err);
      }
    }
    
    // 認証状態の更新（ラジオボタンのdisabled状態と警告表示）
    function updateAuthStatus(platform, hasAuth) {
      const radioBtn = document.getElementById('src' + platform.charAt(0).toUpperCase() + platform.slice(1));
      const radioWarning = document.getElementById('src' + platform.charAt(0).toUpperCase() + platform.slice(1) + 'Warning');
      const statusWarning = document.getElementById(platform + 'StatusWarning');
      const deleteBtn = document.getElementById(platform + 'DeleteBtnContainer');
      
      if (hasAuth) {
        if (radioBtn) radioBtn.disabled = false;
        if (radioWarning) radioWarning.style.display = 'none';
        if (statusWarning) statusWarning.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'block';
      } else {
        if (radioBtn) radioBtn.disabled = true;
        if (radioWarning) radioWarning.style.display = 'inline';
        if (statusWarning) statusWarning.style.display = 'inline';
        if (deleteBtn) deleteBtn.style.display = 'none';
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
      
      // 認証状態を更新
      updateAuthStatus('threads', data.hasThreadsToken);
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

    // Bluesky 認証情報削除ボタン
    document.getElementById('blueskyDeleteBtn').addEventListener('click', async () => {
      if (!confirm('Blueskyの認証情報を削除しますか？')) return;
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            blueskyHandle: null,
            blueskyAppPassword: null,
          }),
        });
        if (res.ok) {
          document.getElementById('blueskyHandle').value = '';
          document.getElementById('blueskyAppPassword').value = '';
          document.getElementById('blueskyAppPassword').placeholder = '変更しない場合は空欄のまま';
          updateAuthStatus('bluesky', false);
          const messageDiv = document.getElementById('credentialsMessage');
          messageDiv.className = 'success';
          messageDiv.textContent = 'Blueskyの認証情報を削除しました';
        }
      } catch (err) {
        console.error('Bluesky認証情報削除に失敗しました', err);
      }
    });

    // Misskey.io 認証情報削除ボタン
    document.getElementById('misskeyDeleteBtn').addEventListener('click', async () => {
      if (!confirm('Misskey.ioの認証情報を削除しますか？')) return;
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            misskeyToken: null,
          }),
        });
        if (res.ok) {
          document.getElementById('misskeyToken').value = '';
          document.getElementById('misskeyToken').placeholder = '変更しない場合は空欄のまま';
          updateAuthStatus('misskey', false);
          const messageDiv = document.getElementById('credentialsMessage');
          messageDiv.className = 'success';
          messageDiv.textContent = 'Misskey.ioの認証情報を削除しました';
        }
      } catch (err) {
        console.error('Misskey.io認証情報削除に失敗しました', err);
      }
    });

    // mixi2 認証情報削除ボタン（管理者のみ）
    const mixi2DeleteBtn = document.getElementById('mixi2DeleteBtn');
    if (mixi2DeleteBtn) {
      mixi2DeleteBtn.addEventListener('click', async () => {
        if (!confirm('mixi2の認証情報を削除しますか？')) return;
        try {
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              mixi2ClientId: null,
              mixi2ClientSecret: null,
              mixi2AccessToken: null,
            }),
          });
          if (res.ok) {
            document.getElementById('mixi2ClientId').value = '';
            document.getElementById('mixi2ClientSecret').value = '';
            document.getElementById('mixi2ClientId').placeholder = '変更しない場合は空欄のまま';
            document.getElementById('mixi2ClientSecret').placeholder = '変更しない場合は空欄のまま';
            updateAuthStatus('mixi2', false);
            const messageDiv = document.getElementById('credentialsMessage');
            messageDiv.className = 'success';
            messageDiv.textContent = 'mixi2の認証情報を削除しました';
          }
        } catch (err) {
          console.error('mixi2認証情報削除に失敗しました', err);
        }
      });
    }

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

    // お知らせ読み込み（管理者用エディタの初期値設定）
    async function loadAnnouncement() {
      try {
        const res = await fetch('/api/announcement');
        const data = await res.json();
        document.getElementById('announcementContent').value = data.content || '';
      } catch (err) {
        console.error('お知らせの読み込みに失敗しました', err);
      }
    }

    // お知らせ保存
    document.getElementById('saveAnnouncementBtn').addEventListener('click', async () => {
      const messageDiv = document.getElementById('announcementMessage');
      const content = document.getElementById('announcementContent').value;
      try {
        const res = await fetch('/api/announcement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        messageDiv.className = data.success ? 'success' : 'error';
        messageDiv.textContent = data.success ? 'お知らせを保存しました' : (data.error || '保存に失敗しました');
      } catch (err) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'エラーが発生しました';
      }
    });

    // 転記元指定フォームの保存
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageDiv = document.getElementById('message');

      const sourcePlatformRadio = document.querySelector('input[name="sourcePlatform"]:checked');
      const settings = {
        sourcePlatform: sourcePlatformRadio ? sourcePlatformRadio.value : 'bluesky',
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(settings),
        });

        if (res.status === 401) { window.location.href = '/login'; return; }

        const data = await res.json();
        messageDiv.className = data.success ? 'success' : 'error';
        messageDiv.textContent = data.success ? '転記元を保存しました' : (data.error || '保存に失敗しました');
      } catch (err) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'エラーが発生しました';
      }
    });

    // 通知設定の保存
    document.getElementById('saveNotificationBtn').addEventListener('click', async () => {
      const messageDiv = document.getElementById('notificationMessage');
      
      const settings = {
        notifyReplyMisskey: document.getElementById('notifyReplyMisskey').checked,
        notifyReplyThreads: document.getElementById('notifyReplyThreads').checked,
        notifyReplyMixi2: document.getElementById('notifyReplyMixi2').checked,
      };

      // 管理者の場合はmixi2公開鍵も保存
      const mixi2KeyEl = document.getElementById('mixi2WebhookPublicKey');
      if (mixi2KeyEl && mixi2KeyEl.closest('[style*="display:none"]') === null) {
        settings.mixi2WebhookPublicKey = mixi2KeyEl.value.trim() || null;
      }

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(settings),
        });

        if (res.status === 401) { window.location.href = '/login'; return; }

        const data = await res.json();
        messageDiv.className = data.success ? 'success' : 'error';
        messageDiv.textContent = data.success ? '通知設定を保存しました' : (data.error || '保存に失敗しました');
        
        if (data.success) {
          await loadSettings();
        }
      } catch (err) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'エラーが発生しました';
      }
    });

    // 認証情報の保存
    document.getElementById('saveCredentialsBtn').addEventListener('click', async () => {
      const messageDiv = document.getElementById('credentialsMessage');

      const settings = {
        blueskyHandle: document.getElementById('blueskyHandle').value,
        blueskyAppPassword: document.getElementById('blueskyAppPassword').value,
        misskeyToken: document.getElementById('misskeyToken').value,
        mixi2ClientId: document.getElementById('mixi2ClientId').value,
        mixi2ClientSecret: document.getElementById('mixi2ClientSecret').value,
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(settings),
        });

        if (res.status === 401) { window.location.href = '/login'; return; }

        const data = await res.json();
        messageDiv.className = data.success ? 'success' : 'error';
        messageDiv.textContent = data.success ? '認証情報を保存しました' : (data.error || '保存に失敗しました');
        
        // 保存成功後、設定を再読み込みして認証状態を更新
        if (data.success) {
          loadSettings();
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

// メール確認完了ページ
export const HTML_VERIFY_EMAIL = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>メール確認 - Bluesky Bridge</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 500px;
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
    .success {
      color: #17bf63;
      margin: 20px 0;
      font-size: 18px;
    }
    .error {
      color: #e0245e;
      margin: 20px 0;
      font-size: 16px;
    }
    a {
      display: inline-block;
      margin-top: 20px;
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
  </style>
</head>
<body>
  <div class="container">
    <h1>メール確認</h1>
    <div id="message">確認中...</div>
  </div>
  <script>
    async function verifyEmail() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const messageDiv = document.getElementById('message');

      if (!token) {
        messageDiv.className = 'error';
        messageDiv.innerHTML = 'トークンが無効です。<br><a href="/login">ログインページへ</a>';
        return;
      }

      try {
        const res = await fetch('/api/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (data.success) {
          messageDiv.className = 'success';
          messageDiv.innerHTML = '✓ メールアドレスの確認が完了しました！<br><a href="/settings">設定画面へ</a>';
        } else {
          messageDiv.className = 'error';
          messageDiv.innerHTML = (data.error || 'メール確認に失敗しました') + '<br><a href="/login">ログインページへ</a>';
        }
      } catch (err) {
        messageDiv.className = 'error';
        messageDiv.innerHTML = 'エラーが発生しました。<br><a href="/login">ログインページへ</a>';
      }
    }

    verifyEmail();
  </script>
</body>
</html>
`;

// パスワードリセット要求ページ
export const HTML_FORGOT_PASSWORD = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>パスワードリセット - Bluesky Bridge</title>
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
    <h1>パスワードリセット</h1>
    <p style="color: #555; font-size: 14px;">登録したメールアドレスを入力してください。パスワードリセット用のリンクを送信します。</p>
    <form id="forgotPasswordForm">
      <div class="form-group">
        <label for="email">メールアドレス</label>
        <input type="email" id="email" required>
      </div>
      <button type="submit">リセットリンクを送信</button>
      <div id="message"></div>
    </form>
    <div class="link">
      <a href="/login">ログインページへ戻る</a>
    </div>
  </div>
  <script>
    document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const messageDiv = document.getElementById('message');

      try {
        const res = await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (data.success) {
          messageDiv.className = 'success';
          messageDiv.textContent = 'パスワードリセット用のメールを送信しました。メールをご確認ください。';
          document.getElementById('forgotPasswordForm').reset();
        } else {
          messageDiv.className = 'error';
          messageDiv.textContent = data.error || 'メール送信に失敗しました';
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

// パスワードリセットページ
export const HTML_RESET_PASSWORD = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>パスワードリセット - Bluesky Bridge</title>
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
  </style>
</head>
<body>
  <div class="container">
    <h1>新しいパスワードを設定</h1>
    <form id="resetPasswordForm">
      <div class="form-group">
        <label for="password">新しいパスワード</label>
        <input type="password" id="password" required minlength="8">
      </div>
      <div class="form-group">
        <label for="confirmPassword">新しいパスワード（確認）</label>
        <input type="password" id="confirmPassword" required minlength="8">
      </div>
      <button type="submit">パスワードをリセット</button>
      <div id="message"></div>
    </form>
  </div>
  <script>
    document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const messageDiv = document.getElementById('message');

      if (password !== confirmPassword) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'パスワードが一致しません';
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'トークンが無効です';
        return;
      }

      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        });
        const data = await res.json();

        if (data.success) {
          messageDiv.className = 'success';
          messageDiv.innerHTML = 'パスワードをリセットしました。<br><a href="/login">ログインページへ</a>';
        } else {
          messageDiv.className = 'error';
          messageDiv.textContent = data.error || 'パスワードリセットに失敗しました';
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
