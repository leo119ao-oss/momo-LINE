# プロジェクトクリーンアップ計画

## 完了した作業
✅ `/api/coach/*` エンドポイントの作成（9個）
✅ `/coach`と`/action`の統合（コメント修正完了）
✅ PDF生成用依存関係のインストール

## 削除候補ファイル（確認済み）

### ページ（研究目的外）
- `src/app/daily/page.tsx` - 日次機能
- `src/app/daily/RagWidget.tsx` - 日次用ウィジェット
- `src/app/diary/page.tsx` - 日記一覧
- `src/app/diary/[slug]/page.tsx` - 日記詳細
- `src/app/weekly/page.tsx` - 週次機能
- `src/app/articles/[id]/page.tsx` - 記事閲覧
- `src/app/read/page.tsx` - 読書機能
- `src/app/register/page.tsx` - 登録ページ
- `src/app/help/page.tsx` - ヘルプページ
- `src/app/debug/liff/page.tsx` - デバッグページ
- `src/app/admin/dashboard/page.tsx` - 管理ダッシュボード（研究目的外？）
- `src/app/admin/quiz-dashboard/page.tsx` - クイズ管理（研究目的外）

### API Routes（研究目的外）
- `src/app/api/daily/route.ts` - 日次機能
- `src/app/api/diary/create/route.ts` - 日記作成
- `src/app/api/diary/finalize/route.ts` - 日記確定
- `src/app/api/diary/upload/route.ts` - 日記画像アップロード（画像機能はwebhookで使用中？要確認）
- `src/app/api/weekly/route.ts` - 週次機能
- `src/app/api/cron/daily-question/route.ts` - 日次質問送信
- `src/app/api/cron/evening-journal/route.ts` - 夕方日記
- `src/app/api/cron/morning-quiz/route.ts` - 朝のクイズ
- `src/app/api/cron/morning-reco/route.ts` - 朝の推薦
- `src/app/api/cron/weekly-summary/route.ts` - 週次サマリー
- `src/app/api/cron/send-daily-question/` - ディレクトリ（空？）
- `src/app/api/cron/send-weekly-summary/` - ディレクトリ（空？）
- `src/app/api/articles/create/route.ts` - 記事作成（旧実装）
- `src/app/api/articles/[id]/route.ts` - 記事取得（旧実装）
- `src/app/api/analytics/quiz-stats/route.ts` - クイズ統計
- `src/app/api/family/feedback/route.ts` - 家族フィードバック
- `src/app/api/cta/click/route.ts` - CTAクリック
- `src/app/api/waitlist/route.ts` - ウェイトリスト
- `src/app/api/test/quiz-generate/route.ts` - テスト用クイズ生成
- `src/app/api/test/quiz-send/route.ts` - テスト用クイズ送信
- `src/app/api/test-token/route.ts` - テストトークン
- `src/app/api/test-webhook/route.ts` - テストWebhook
- `src/app/api/debug/rag/route.ts` - デバッグ用RAG

### コンポーネント（未使用？）
- `src/components/ArticleSearchWidget.tsx` - 記事検索ウィジェット（研究目的外？）
- `src/components/DailyCard.tsx` - 日次カード（研究目的外）
- `src/components/ResearchBanner.tsx` - 研究バナー（使用中？要確認）

### ライブラリ（未使用？）
- `src/lib/articleRecommender.ts` - 記事推薦（研究目的外）
- `src/lib/conversationFlow.ts` - 会話フロー（旧実装？）
- `src/lib/diaryRecommender.ts` - 日記推薦（研究目的外）
- `src/lib/insightGenerator.ts` - インサイト生成（研究目的外）
- `src/lib/quiz.ts` - クイズ機能（研究目的外）
- `src/lib/reflectiveCore.ts` - リフレクティブコア（研究目的外）
- `src/lib/style/insightCue.ts` - スタイル関連（未使用？）
- `src/lib/style/reflective.ts` - スタイル関連（未使用？）

## 要確認ファイル

### 使用中かもしれないファイル
- `src/app/api/diary/upload/route.ts` - webhookの画像処理で使用されている可能性
- `src/lib/session.ts` - webhookで使用中（必要）
- `src/app/research/consent/page.tsx` - 研究同意ページ（必要かも）
- `src/app/api/consent/route.ts` - 同意API（必要かも）
- `src/app/api/consent/set/route.ts` - 同意設定API（必要かも）
- `src/app/api/search/articles/route.ts` - 記事検索（研究目的外？）
- `src/app/api/search/google/route.ts` - Google検索（momoLogicで使用中？）
- `src/app/api/ask/route.ts` - 質問応答（momoLogicで使用中？）
- `src/app/api/ping/route.ts` - ヘルスチェック（必要かも）
- `src/app/api/health/route.ts` - ヘルスチェック（必要かも）
- `src/app/api/survey/[phase]/route.ts` - アンケート（旧実装？）

## 削除前の確認事項

1. **画像アップロード機能** - `webhook/route.ts`で`media_entries`テーブルを使用しているか確認
2. **セッション管理** - `session.ts`は`webhook`で使用中なので必要
3. **検索機能** - `momoLogic.ts`でGoogle検索や記事検索を使用しているか確認
4. **アンケート** - `/survey/pen`ページが存在するか確認（削除済み？）

## 削除手順

1. まず、要確認ファイルの使用状況を確認
2. 確実に不要なファイルから削除開始
3. 削除後、ビルドエラーがないか確認
4. コミット

