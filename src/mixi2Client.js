// mixi2 APIクライアント（gRPC over HTTP/2）
// mixi2のAPIはREST非対応で純粋なgRPCのみ対応。
// Cloudflare Workersのfetch()でHTTP/2 gRPCを呼び出す。
// protobufはサードパーティライブラリなしで手動エンコード/デコードする。

const MIXI2_API = 'https://application-api.mixi.social';
const MIXI2_AUTH_URL = 'https://application-auth.mixi.social/oauth2/token';
const MIXI2_SERVICE = 'social.mixi.application.service.application_api.v1.ApplicationService';

// ---- Protobuf ユーティリティ ----

function concatBytes(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// varint エンコード（BigInt 対応）
function encodeVarint(value) {
  const bytes = [];
  let n = typeof value === 'bigint' ? value : BigInt(Math.floor(value));
  do {
    let byte = Number(n & 0x7Fn);
    n >>= 7n;
    if (n > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (n > 0n);
  return new Uint8Array(bytes);
}

// wire type 2 (length-delimited): 文字列フィールド
function pbString(fieldNumber, str) {
  if (!str) return new Uint8Array(0);
  const encoded = new TextEncoder().encode(str);
  return concatBytes(encodeVarint((fieldNumber << 3) | 2), encodeVarint(encoded.length), encoded);
}

// wire type 0 (varint): enum / uint64 フィールド（0はデフォルト値なのでスキップ）
function pbVarint(fieldNumber, value) {
  const v = typeof value === 'bigint' ? value : BigInt(Math.floor(value));
  if (v === 0n) return new Uint8Array(0);
  return concatBytes(encodeVarint((fieldNumber << 3) | 0), encodeVarint(v));
}

// wire type 2: embedded message フィールド
function pbMessage(fieldNumber, bytes) {
  if (!bytes || bytes.length === 0) return new Uint8Array(0);
  return concatBytes(encodeVarint((fieldNumber << 3) | 2), encodeVarint(bytes.length), bytes);
}

const dec = new TextDecoder();
function pbStr(bytes) { return bytes ? dec.decode(bytes) : ''; }

// protobuf バイナリをデコード: Map<fieldNumber, value[]>
// value は varint → BigInt、length-delimited → Uint8Array
function pbDecode(bytes) {
  const buf = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const fields = new Map();
  let pos = 0;

  while (pos < buf.length) {
    let tag = 0, shift = 0;
    while (pos < buf.length) {
      const b = buf[pos++];
      tag |= (b & 0x7F) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    let value;
    if (wireType === 0) {
      let v = 0n, s = 0n;
      while (pos < buf.length) {
        const b = buf[pos++];
        v |= BigInt(b & 0x7F) << s;
        if (!(b & 0x80)) break;
        s += 7n;
      }
      value = v;
    } else if (wireType === 2) {
      let len = 0, s = 0;
      while (pos < buf.length) {
        const b = buf[pos++];
        len |= (b & 0x7F) << s;
        if (!(b & 0x80)) break;
        s += 7;
      }
      value = buf.slice(pos, pos + len);
      pos += len;
    } else {
      // 非対応 wire type はここで終了
      break;
    }

    if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
    fields.get(fieldNumber).push(value);
  }
  return fields;
}

// ---- gRPC フレーミング ----

// 5バイトプレフィックス（1バイト compressed フラグ + 4バイト big-endian length）を付与
function grpcEncode(msgBytes) {
  const frame = new Uint8Array(5 + msgBytes.length);
  frame[0] = 0; // not compressed
  new DataView(frame.buffer).setUint32(1, msgBytes.length, false);
  frame.set(msgBytes, 5);
  return frame;
}

// 5バイトプレフィックスを除去してメッセージ本体を返す
function grpcDecode(buf) {
  const view = buf instanceof ArrayBuffer ? buf : buf.buffer;
  if (view.byteLength < 5) return new Uint8Array(0);
  const msgLen = new DataView(view).getUint32(1, false);
  const offset = buf instanceof ArrayBuffer ? 5 : buf.byteOffset + 5;
  return new Uint8Array(view, offset, msgLen);
}

// gRPC 呼び出し（fetch()経由）
async function grpcCall(method, accessToken, reqBytes) {
  const res = await fetch(`${MIXI2_API}/${MIXI2_SERVICE}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc+proto',
      'Authorization': `Bearer ${accessToken}`,
      'te': 'trailers',
    },
    body: grpcEncode(reqBytes),
  });

  // 初期ヘッダーに grpc-status がある場合はエラー
  const grpcStatus = res.headers.get('grpc-status');
  if (grpcStatus && grpcStatus !== '0') {
    const msg = res.headers.get('grpc-message') || '';
    throw new Error(`mixi2 gRPC ${method} error ${grpcStatus}: ${decodeURIComponent(msg)}`);
  }
  if (!res.ok) {
    throw new Error(`mixi2 gRPC ${method} failed: HTTP ${res.status}`);
  }

  return grpcDecode(await res.arrayBuffer());
}

// ---- OAuth ----

// OAuth 2.0でアクセストークンを取得
// Basic Auth（AuthStyleInHeader）と body params（AuthStyleInParams）の両方を試みる
export async function fetchMixi2AccessToken(clientId, clientSecret) {
  // mixi2 は URL エンコードなしの生の値を Basic Auth で期待する（RFC 6749 §2.3.1 の encodeURIComponent は不要）
  const credentials = btoa(`${clientId}:${clientSecret}`);

  // まず Basic Auth 方式を試みる
  let res = await fetch(MIXI2_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  // Basic Auth で invalid_client の場合は body params 方式（AuthStyleInParams）にフォールバック
  if (res.status === 401 || res.status === 400) {
    const firstError = await res.text().catch(() => '');
    if (firstError.includes('invalid_client')) {
      res = await fetch(MIXI2_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`mixi2 oauth/token failed (both auth styles): ${res.status} - ${text} [first attempt: ${firstError}]`);
      }
    } else {
      throw new Error(`mixi2 oauth/token failed: ${res.status} - ${firstError}`);
    }
  } else if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mixi2 oauth/token failed: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// ---- 転記元：ユーザー識別情報を取得（GetUsers gRPC） ----

export async function fetchMixi2Identity(userId) {
  // GetUsersRequest: user_id_list (field 1, repeated string)
  // アクセストークンがないため、スタブを返す（管理者専用機能）
  return { userId, username: userId };
}

// ---- 転記元：新着投稿ポーリング ----

// mixi2 gRPC APIにはユーザータイムラインのポーリングエンドポイントが存在しない。
// Webhook または gRPC ストリームが必要なため、転記元としての利用は現時点では非対応。
export async function fetchMixi2PostsSince({ userId: _userId, since: _since }) {
  return [];
}

// ---- 転記元：単一投稿を取得（GetPosts gRPC） ----

export async function fetchMixi2Post(postId, accessToken) {
  if (!accessToken) return null;
  // GetPostsRequest: post_id_list (field 1, repeated string)
  const reqBytes = pbString(1, postId);
  const resBytes = await grpcCall('GetPosts', accessToken, reqBytes);
  const resFields = pbDecode(resBytes);
  const postBytes = resFields.get(1)?.[0];
  return postBytes ? normalizeMixi2PostProto(pbDecode(postBytes)) : null;
}

// ---- gRPC Post レスポンスを共通フォーマットに変換 ----

function normalizeMixi2PostProto(postFields) {
  const postId = pbStr(postFields.get(1)?.[0]);
  const text = pbStr(postFields.get(4)?.[0]);
  const replyToId = pbStr(postFields.get(7)?.[0]);

  // created_at: google.protobuf.Timestamp (field 5) → seconds (field 1)
  const tsBytes = postFields.get(5)?.[0];
  const tsFields = tsBytes ? pbDecode(tsBytes) : new Map();
  const seconds = Number(tsFields.get(1)?.[0] ?? 0n);
  const createdAt = seconds ? new Date(seconds * 1000).toISOString() : new Date().toISOString();

  return {
    uri: postId,
    createdAt,
    text,
    reply: replyToId ? true : null,
    type: 'post',
    images: [],
  };
}

// 後方互換のためエクスポートを維持（normalizeMixi2Post は gRPC 移行後は内部利用のみ）
export function normalizeMixi2Post(post) {
  return normalizeMixi2PostProto(post);
}

// ---- 転記先：画像アップロード ----

async function uploadImage(imageUrl, accessToken) {
  // 1. 画像データを取得
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status} ${imageUrl}`);
  const blob = await imgRes.blob();
  const contentType = blob.type || 'image/jpeg';

  // 2. InitiatePostMediaUpload (gRPC): presigned upload URL と media_id を取得
  //    InitiatePostMediaUploadRequest: content_type (1), data_size (2), media_type (3: TYPE_IMAGE=1)
  const initiateReq = concatBytes(
    pbString(1, contentType),
    pbVarint(2, blob.size),
    pbVarint(3, 1),
  );
  const initiateRes = await grpcCall('InitiatePostMediaUpload', accessToken, initiateReq);
  const initiateFields = pbDecode(initiateRes);
  const mediaId = pbStr(initiateFields.get(1)?.[0]);
  const uploadUrl = pbStr(initiateFields.get(2)?.[0]);

  // 3. presigned URL に画像データを PUT（mixi2独自エンドポイントのためBearerトークンが必要）
  const arrayBuffer = await blob.arrayBuffer();
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: arrayBuffer,
  });
  if (!uploadRes.ok) {
    const errBody = await uploadRes.text().catch(() => '');
    throw new Error(`mixi2 media PUT failed: ${uploadRes.status}${errBody ? ` - ${errBody}` : ''}`);
  }

  // 4. GetPostMediaStatus (gRPC) で処理完了を待機
  //    GetPostMediaStatusResponse.status: STATUS_COMPLETED=3, STATUS_FAILED=4
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusReq = pbString(1, mediaId);
    const statusRes = await grpcCall('GetPostMediaStatus', accessToken, statusReq);
    const statusFields = pbDecode(statusRes);
    const status = Number(statusFields.get(1)?.[0] ?? 0n);
    if (status === 3) return mediaId;
    if (status === 4) throw new Error('mixi2 media processing failed');
  }
  throw new Error('mixi2 media upload timed out');
}

// ---- 転記先：投稿実行（CreatePost gRPC） ----

export async function postToMixi2({ text, images = [], accessToken }) {
  const mediaIds = images.length > 0
    ? await Promise.all(images.map((url) => uploadImage(url, accessToken)))
    : [];

  // CreatePostRequest: text (field 1), media_id_list (field 5, repeated string)
  const reqBytes = concatBytes(
    pbString(1, text),
    ...mediaIds.map((id) => pbString(5, id)),
  );

  const resBytes = await grpcCall('CreatePost', accessToken, reqBytes);

  // CreatePostResponse.post (field 1) → Post.post_id (field 1)
  const resFields = pbDecode(resBytes);
  const postBytes = resFields.get(1)?.[0];
  const postId = postBytes ? pbStr(pbDecode(postBytes).get(1)?.[0]) : undefined;

  return { success: true, postId };
}
