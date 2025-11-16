# プロジェクトクリーンアップ完了サマリー

## 完了した作業

### 1. 必要なAPIエンドポイントの作成 ✅
以下の9つのAPIエンドポイントを作成しました：
- `/api/coach/start` - コーチセッション開始
- `/api/coach/status` - コーチ状態取得
- `/api/coach/questions` - 質問生成
- `/api/coach/acknowledge` - 承認メッセージ生成
- `/api/coach/outline` - アウトライン生成
- `/api/coach/generate` - リード文生成
- `/api/coach/save` - 記事保存
- `/api/coach/history` - 記事履歴取得
- `/api/coach/pdf` - PDF生成

### 2. 認証トークンAPIの作成 ✅
- `/api/auth/token` - 一時認証トークンの生成・検証（10分間有効）

### 3. `/coach`と`/action`の統合 ✅
- `momoLogic.ts`のコメントを`/action`に統一
- `/coach`は`/action`へのリダイレクトとして維持（後方互換性のため）

### 4. 不要ファイルの削除 ✅
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
- `src/app/api/cron/daily-question/route.ts`
- `src/app/api/cron/evening-journal/route.ts`
- `src/app/api/cron/morning-quiz/route.ts`
- `src/app/api/cron/morning-reco/route.ts`
- `src/app/api/cron/weekly-summary/route.ts`
- `src/app/api/articles/create/route.ts`
- `src/app/api/articles/[id]/route.ts`
- `src/app/api/analytics/quiz-stats/route.ts`
- `src/app/api/family/feedback/route.ts`
- `src/app/api/cta/click/route.ts`
- `src/app/api/waitlist/route.ts`
- `src/app/api/test/quiz-generate/route.ts`
- `src/app/api/test/quiz-send/route.ts`
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

### 5. 依存関係の追加 ✅
- `pdf-lib` - PDF生成用
- `@pdf-lib/fontkit` - 日本語フォント対応用

### 6. コードの修正 ✅
- `webhook/route.ts`の画像処理で使用するAIモデルを`gpt-5.1-mini`に統一
- 画像処理のプロンプトを修正

## 現在のプロジェクト構成

### コア機能
1. **LINE Bot** (`/api/line/webhook`)
   - テキストメッセージ処理
   - 画像アップロード処理（`media_entries`テーブル使用）
   - AI応答生成（GPT-5.1-mini）

2. **記事作成サポート** (`/action`)
   - ウォームアップ
   - momoとの対話
   - アウトライン生成
   - 下書き入力・保存
   - PDF生成

3. **アンケート** (`/survey/pen` - 要確認)
   - ペン効果アンケート

### 必須ファイル構成

#### フロントエンド
- `src/app/action/page.tsx` - 記事作成ページ
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
- `src/app/api/survey/[phase]/route.ts` - アンケート（要確認）

#### ライブラリ
- `src/lib/momoLogic.ts` - LINE Botロジック
- `src/lib/lineClient.ts` - LINE SDK
- `src/lib/supabaseAdmin.ts` - Supabase管理
- `src/lib/participants.ts` - 参加者管理
- `src/lib/liffClient.ts` - LIFFクライアント
- `src/lib/session.ts` - セッション管理（webhookで使用）
- `src/lib/search.ts` - 記事検索（使用中？要確認）
- `src/lib/rag.ts` - RAG機能（使用中？要確認）

## 残りの確認事項

### 要確認ファイル
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

## 次のステップ

1. **ビルドテスト** - 削除したファイルが原因でビルドエラーが発生しないか確認
2. **動作確認** - `/action`ページが正常に動作するか確認
3. **残りの要確認ファイルの整理** - 上記のファイルが実際に使用されているか確認し、不要なら削除

