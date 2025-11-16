# momo-LINE プロジェクト 引き継ぎドキュメント

**作成日**: 2025年1月（セッション引き継ぎ用）  
**プロジェクト**: momo-LINE - The Pen Effect 研究プロジェクト

---

## 📋 プロジェクト概要

### 目的
「The Pen Effect」研究プロジェクト（2025年11月8日〜11月24日）
- AIコンパニオンとの対話や日記記述を通じて、母親の心理的支援・自己表現・コミュニティ形成への影響を明らかにする

### ユーザー体験フロー
1. **意識して過ごす** - ユーザーが日常を意識的に過ごす
2. **書く** - AIコーチと対話しながら記事（日記）を作成
3. **読まれる** - 作成した記事を共有・読んでもらう
4. **アンケート回答** - 「ペンを持つ効果アンケート」に回答

### コア機能
1. **LINE Bot** (`/api/line/webhook`) - メッセージ処理と画像アップロード
2. **記事作成サポート** (`/action`) - AIコーチによる記事作成フロー
3. **認証** (`/api/auth/token`) - 一時トークン認証

---

## ✅ 完了した作業

### 1. プロジェクトコンセプトの整理
- `PROJECT_CONCEPT.md` を作成
- プロジェクトの目的、構成、必要なファイルを整理

### 2. 必要なAPIエンドポイントの作成（9個）
以下のAPIエンドポイントを作成しました：

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/coach/start` | POST | コーチセッション開始 |
| `/api/coach/status` | GET | コーチ状態取得 |
| `/api/coach/questions` | POST | 質問生成 |
| `/api/coach/acknowledge` | POST | 承認メッセージ生成 |
| `/api/coach/outline` | POST | アウトライン生成 |
| `/api/coach/generate` | POST | リード文生成 |
| `/api/coach/save` | POST | 記事保存 |
| `/api/coach/history` | GET | 記事履歴取得 |
| `/api/coach/pdf` | POST | PDF生成 |

**実装場所**: `src/app/api/coach/*/route.ts`

### 3. 認証トークンAPIの作成
- `/api/auth/token` - 一時認証トークンの生成・検証（10分間有効）
- **実装場所**: `src/app/api/auth/token/route.ts`

### 4. `/coach`と`/action`の統合
- `momoLogic.ts`のコメントを`/action`に統一
- `/coach`は`/action`へのリダイレクトとして維持（後方互換性のため）

### 5. 不要ファイルの削除（39ファイル）
以下のファイルを削除しました：

#### ページ（11ファイル）
- `src/app/daily/page.tsx`
- `src/app/daily/RagWidget.tsx`
- `src/app/diary/page.tsx`
- `src/app/diary/[slug]/page.tsx`
- `src/app/weekly/page.tsx`
- `src/app/articles/[id]/page.tsx`
- `src/app/read/page.tsx`
- `src/app/register/page.tsx`
- `src/app/help/page.tsx`
- `src/app/debug/liff/page.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/quiz-dashboard/page.tsx`

#### API Routes（20ファイル）
- `src/app/api/daily/route.ts`
- `src/app/api/diary/create/route.ts`
- `src/app/api/diary/finalize/route.ts`
- `src/app/api/weekly/route.ts`
- `src/app/api/cron/*` (5ファイル)
- `src/app/api/articles/*` (2ファイル)
- `src/app/api/analytics/quiz-stats/route.ts`
- `src/app/api/family/feedback/route.ts`
- `src/app/api/cta/click/route.ts`
- `src/app/api/waitlist/route.ts`
- `src/app/api/test/*` (2ファイル)
- `src/app/api/test-token/route.ts`
- `src/app/api/test-webhook/route.ts`
- `src/app/api/debug/rag/route.ts`

#### コンポーネント（2ファイル）
- `src/components/ArticleSearchWidget.tsx`
- `src/components/DailyCard.tsx`

#### ライブラリ（6ファイル）
- `src/lib/articleRecommender.ts`
- `src/lib/conversationFlow.ts`
- `src/lib/diaryRecommender.ts`
- `src/lib/insightGenerator.ts`
- `src/lib/quiz.ts`
- `src/lib/reflectiveCore.ts`

### 6. 依存関係の追加
- `pdf-lib` - PDF生成用
- `@pdf-lib/fontkit` - 日本語フォント対応用

### 7. ビルドエラーの修正
- `src/app/api/coach/save/route.ts` - `body`変数の重複定義を修正
- `src/app/action/page.tsx` - UTF-8エンコーディングエラーを修正（258行目、262行目）

### 8. コードの改善
- `webhook/route.ts`の画像処理で使用するAIモデルを`gpt-5.1-mini`に統一
- 画像処理のプロンプトを改善

---

## 📁 現在のプロジェクト構成

### 必須ファイル

#### フロントエンド
- `src/app/action/page.tsx` - 記事作成ページ（メイン）
- `src/app/action/action.css` - スタイル
- `src/app/coach/page.tsx` - `/action`へのリダイレクト
- `src/components/LiffLayout.tsx` - LIFF用レイアウト
- `src/components/LiffButton.tsx` - LIFF用ボタン
- `src/components/LiffInput.tsx` - LIFF用入力
- `src/components/LiffCard.tsx` - LIFF用カード
- `src/components/LiffChips.tsx` - LIFF用チップ
- `src/components/LiffField.tsx` - LIFF用フィールド
- `src/components/LiffSlider.tsx` - LIFF用スライダー

#### API Routes
- `src/app/api/line/webhook/route.ts` - LINE Webhook
- `src/app/api/auth/token/route.ts` - 認証トークン
- `src/app/api/coach/*` - 記事作成用API（9個）
- `src/app/api/diary/upload/route.ts` - 画像アップロード（webhookで使用）

#### ライブラリ
- `src/lib/momoLogic.ts` - LINE Botロジック
- `src/lib/lineClient.ts` - LINE SDK
- `src/lib/supabaseAdmin.ts` - Supabase管理
- `src/lib/participants.ts` - 参加者管理
- `src/lib/liffClient.ts` - LIFFクライアント
- `src/lib/session.ts` - セッション管理（webhookで使用）

### ドキュメント
- `PROJECT_CONCEPT.md` - プロジェクトのコンセプトと構成
- `CLEANUP_PLAN.md` - クリーンアップ計画
- `CLEANUP_SUMMARY.md` - クリーンアップ完了サマリー
- `HANDOFF_DOCUMENT.md` - この引き継ぎドキュメント

---

## ⚠️ 注意事項

### 文字化けの問題
`src/app/action/page.tsx`には、まだ多くの文字化けした文字列が残っている可能性があります。ビルドエラーが発生した場合は、該当箇所を確認して修正してください。

**確認が必要な箇所**:
- 287行目付近
- 290行目付近
- 342-343行目付近
- 356行目付近
- 429行目付近
- 451行目付近
- その他多数

### 使用中のテーブル
- `participants` - 参加者情報
- `articles` - 記事データ（`pdf_url`カラム含む）
- `media_entries` - 画像アップロード用（webhookで使用）
- `chat_logs` - チャットログ（AI応答記録）

### 環境変数
必須の環境変数：
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_LIFF_ID`

オプション：
- `SUPABASE_PDF_BUCKET` (デフォルト: `articles-pdf`)
- `NOTO_SANS_JP_FONT_URL`

---

## 🔍 残りのタスク

### 1. 文字化けの修正（優先度高）
`src/app/action/page.tsx`に残っている文字化けした文字列をすべて修正する必要があります。

**確認方法**:
```bash
grep -n "縺" src/app/action/page.tsx
```

### 2. 要確認ファイル
以下のファイルが実際に使用されているか確認が必要です：

- `src/app/api/diary/upload/route.ts` - 画像アップロード（webhookで`media_entries`を使用しているが、このAPIは使用されていない可能性）
- `src/app/api/search/articles/route.ts` - 記事検索（使用中？）
- `src/app/api/search/google/route.ts` - Google検索（使用中？）
- `src/app/api/ask/route.ts` - 質問応答（使用中？）
- `src/app/api/survey/[phase]/route.ts` - アンケート（旧実装？）
- `src/app/research/consent/page.tsx` - 研究同意ページ（必要？）
- `src/app/api/consent/route.ts` - 同意API（必要？）
- `src/app/api/consent/set/route.ts` - 同意設定API（必要？）
- `src/app/api/ping/route.ts` - ヘルスチェック（必要？）
- `src/app/api/health/route.ts` - ヘルスチェック（必要？）
- `src/components/ResearchBanner.tsx` - 研究バナー（使用中？）

### 3. ビルドテスト
削除したファイルが原因でビルドエラーが発生しないか確認

### 4. 動作確認
- `/action`ページが正常に動作するか確認
- `/api/coach/*`エンドポイントが正常に動作するか確認

---

## 🚀 次のステップ

1. **ビルドエラーの確認**
   - Vercelでのビルドが成功するか確認
   - ローカルで`npm run build`を実行してエラーがないか確認

2. **文字化けの修正**
   - `src/app/action/page.tsx`の残りの文字化けを修正
   - ビルドエラーが発生する箇所から優先的に修正

3. **動作確認**
   - `/action`ページの各機能が正常に動作するか確認
   - LINE Botからの導線が正常に動作するか確認

4. **要確認ファイルの整理**
   - 上記の要確認ファイルが実際に使用されているか確認
   - 使用されていない場合は削除を検討

---

## 📝 重要なコミット履歴

- `6c0661f` - Add missing /api/coach endpoints for article creation flow
- `d54add5` - Clean up unused files and update momoLogic comments, fix webhook image processing
- `3fbf812` - Fix webhook image processing prompts and remove empty directories
- `d17061c` - Fix build errors: UTF-8 encoding in action page and body variable name conflict
- `8e16412` - Fix UTF-8 encoding errors in handleWarmupSubmit function
- `b96355d` - Fix missing backtick in template literal

---

## 🔗 関連ドキュメント

- `PROJECT_CONCEPT.md` - プロジェクトのコンセプトと構成の詳細
- `CLEANUP_PLAN.md` - クリーンアップ計画の詳細
- `CLEANUP_SUMMARY.md` - クリーンアップ完了サマリー

---

## 💡 技術的な注意点

### PDF生成
- `pdf-lib`と`@pdf-lib/fontkit`を使用
- 日本語フォントはGoogle FontsのNoto Sans JPを使用（デフォルト）
- Supabase Storageの`articles-pdf`バケットに保存

### AIモデル
- すべて`gpt-5.1-mini`を使用（画像処理も含む）
- 以前は`gpt-4o-mini`を使用していたが、統一しました

### 認証
- `/api/auth/token`で一時トークンを生成（10分間有効）
- メモリ内の`Map`で管理（本番環境ではRedis等の使用を推奨）

---

## 📞 引き継ぎ時の確認事項

1. 現在のビルド状態は？
2. 文字化けが残っている箇所は？
3. 動作確認は完了しているか？
4. 環境変数は正しく設定されているか？
5. Supabaseのテーブル構造は正しいか？

---

**最後の更新**: 2025年1月（セッション引き継ぎ時）

