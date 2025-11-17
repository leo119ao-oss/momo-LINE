# ユーザー情報読み込みエラーとタブレットユーザー表示問題の原因仮説

## 問題の概要
- 「ユーザー情報が読み込めませんでした」というエラーが発生
- タブレットのユーザー情報が表示されてしまう（別ユーザーの情報が表示される）

## 原因の仮説

### 🔴 仮説1: サーバーレス環境でのメモリ共有問題（最も可能性が高い）

**問題点:**
- `src/app/api/auth/token/route.ts`の12行目で、トークンストアが`Map`でメモリ内に保存されている
- Vercelなどのサーバーレス環境では、リクエストごとに異なるサーバーインスタンスが使われる可能性がある
- トークンが生成されたインスタンスと検証されるインスタンスが異なると、トークンが見つからず検証に失敗する

**影響:**
- トークン検証に失敗すると、`queryUserId`（URLパラメータ）にフォールバックする
- URLパラメータは改ざん可能なため、セキュリティ上の問題がある

**コード箇所:**
```typescript
// src/app/api/auth/token/route.ts:12
const tokenStore = new Map<string, { user_id: string; expires_at: number }>();
```

```typescript
// src/app/action/page.tsx:122-124
if (queryUserId) {
  if (!active) return;
  setUserId(queryUserId);  // 検証なしで直接使用
  return;
}
```

---

### 🟡 仮説2: URLパラメータの直接使用によるセキュリティ問題

**問題点:**
- `src/app/action/page.tsx`の122-124行目で、`queryUserId`が検証なしで直接使用されている
- URLパラメータは改ざん可能なため、別のユーザーIDを指定すればなりすましが可能

**影響:**
- 悪意のあるユーザーがURLを改ざんして、別のユーザーの情報を閲覧できる可能性がある
- タブレットでURLを共有した場合、誤って別のユーザーのIDが含まれる可能性がある

**コード箇所:**
```typescript
// src/app/action/page.tsx:122-124
if (queryUserId) {
  if (!active) return;
  setUserId(queryUserId);  // 検証なし
  return;
}
```

---

### 🟡 仮説3: ブラウザキャッシュやストレージの問題

**問題点:**
- タブレットのブラウザに古いユーザー情報がキャッシュされている可能性がある
- LocalStorageやSessionStorageに別のユーザーの情報が残っている可能性がある

**影響:**
- ページを再読み込みした際に、キャッシュされた古いユーザー情報が表示される
- 複数のユーザーが同じタブレットを使用している場合、前のユーザーの情報が残る

---

### 🟡 仮説4: トークン検証の失敗時のエラーハンドリング不足

**問題点:**
- トークン検証に失敗した場合、エラーメッセージは表示されるが、`queryUserId`にフォールバックしている
- エラーが発生しても、ユーザーは気づかずに進んでしまう可能性がある

**影響:**
- トークンが無効でも、URLパラメータがあればそのまま進んでしまう
- セキュリティ上の問題が発生する

**コード箇所:**
```typescript
// src/app/action/page.tsx:128-137
if (token) {
  const res = await fetch(`/api/auth/token?token=${encodeURIComponent(token)}`);
  if (res.ok) {
    const data = await res.json();
    if (data.ok && data.user_id && active) {
      setUserId(data.user_id);
      return;
    }
  }
}
// トークン検証に失敗しても、queryUserIdがあれば進んでしまう
```

---

### 🟢 仮説5: LINE User IDの混同

**問題点:**
- 複数のデバイスで同じLINEアカウントを使用している場合、user_idは同じになるはず
- しかし、何らかの理由で別のユーザーのIDが混入している可能性がある

**影響:**
- タブレットとスマホで異なるユーザーIDが使われている可能性がある
- LINE Botから送信されるリンクに誤ったuser_idが含まれている可能性がある

---

## 推奨される対策

### 1. トークンストアをデータベースに移行（最優先）

**現在の問題:**
- メモリ内の`Map`はサーバーレス環境では共有されない

**対策:**
- Supabaseの`tokens`テーブルを作成して、トークンをデータベースに保存
- すべてのサーバーインスタンスから同じデータベースを参照する

**実装例:**
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tokens_token ON tokens(token);
CREATE INDEX idx_tokens_expires_at ON tokens(expires_at);
```

### 2. URLパラメータの検証を強化

**現在の問題:**
- `queryUserId`が検証なしで使用されている

**対策:**
- トークン検証に失敗した場合、`queryUserId`にフォールバックしない
- 必ずトークンを使用するようにする
- または、`queryUserId`を使用する場合も、サーバー側で検証する

### 3. エラーハンドリングの改善

**現在の問題:**
- トークン検証に失敗しても、エラーが明確に表示されない

**対策:**
- トークン検証に失敗した場合、明確なエラーメッセージを表示
- ユーザーにLINE Botから再度アクセスするよう促す

### 4. ブラウザキャッシュのクリア

**対策:**
- ページ読み込み時に、古いキャッシュをクリアする
- LocalStorageやSessionStorageをクリアする処理を追加

---

## 緊急対応（一時的な対策）

1. **トークン検証の失敗時は、queryUserIdにフォールバックしない**
   - `src/app/action/page.tsx`の122-124行目を削除またはコメントアウト
   - トークンが必須になるようにする

2. **エラーメッセージを明確にする**
   - トークン検証に失敗した場合、明確なエラーメッセージを表示
   - ユーザーにLINE Botから再度アクセスするよう促す

3. **ログを追加**
   - トークン検証の成功/失敗をログに記録
   - どのuser_idが使用されているかをログに記録

