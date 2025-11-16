# キャッシュクリアガイド

## Next.js/Vercelのキャッシュをクリアする方法

### 1. ローカル環境でのキャッシュクリア

#### Next.jsのビルドキャッシュを削除
```powershell
# PowerShell (Windows)
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

```bash
# Bash (Linux/Mac)
rm -rf .next
npm run build
```

#### Node.jsのモジュールキャッシュもクリア
```powershell
# PowerShell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
npm run build
```

### 2. Vercelでのキャッシュクリア

#### 方法1: Vercelダッシュボードから
1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. Settings → General
4. 「Clear Build Cache」ボタンをクリック
5. 再度デプロイ

#### 方法2: Vercel CLIから
```bash
# Vercel CLIがインストールされている場合
vercel --force
```

#### 方法3: 環境変数でキャッシュを無効化
`.vercelignore`に以下を追加（一時的）:
```
.next
```

または、`vercel.json`でキャッシュを無効化:
```json
{
  "buildCommand": "rm -rf .next && npm run build"
}
```

### 3. Gitキャッシュのクリア

```powershell
# PowerShell
git rm -r --cached .
git add .
git commit -m "Clear git cache"
git push
```

### 4. TypeScriptのキャッシュをクリア

```powershell
# PowerShell
Remove-Item tsconfig.tsbuildinfo -ErrorAction SilentlyContinue
npm run build
```

### 5. 完全なクリーンビルド

```powershell
# PowerShell - すべてのキャッシュをクリア
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
Remove-Item tsconfig.tsbuildinfo -ErrorAction SilentlyContinue
npm run build
```

### 6. Vercelのデプロイキャッシュを強制的にクリア

Vercelでは、以下の方法でキャッシュをクリアできます：

1. **新しいブランチでデプロイ**: 一時的なブランチを作成してデプロイ
2. **環境変数を変更**: 一時的に環境変数を変更してデプロイ（その後戻す）
3. **Vercelダッシュボード**: Settings → General → Clear Build Cache

### 7. ブラウザキャッシュのクリア

開発中は、ブラウザのキャッシュもクリア：
- Chrome: `Ctrl+Shift+Delete` → キャッシュされた画像とファイルを削除
- Firefox: `Ctrl+Shift+Delete` → キャッシュを削除

---

## 推奨される手順

### ローカルで問題を再現する場合
```powershell
# 1. すべてのキャッシュをクリア
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item tsconfig.tsbuildinfo -ErrorAction SilentlyContinue

# 2. クリーンビルド
npm run build
```

### Vercelで問題が続く場合
1. Vercelダッシュボードで「Clear Build Cache」を実行
2. 新しいコミットをプッシュ（空コミットでも可）
3. デプロイを再実行

### それでも解決しない場合
```powershell
# 一時的なブランチを作成
git checkout -b temp-clear-cache
git commit --allow-empty -m "Clear cache"
git push origin temp-clear-cache

# Vercelでこのブランチをデプロイして確認
# 問題が解決したら、mainにマージ
```

