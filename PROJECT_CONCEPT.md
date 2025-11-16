# momo-LINE プロジェクト コンセプト整理

## プロジェクトの目的

**「The Pen Effect」研究プロジェクト**
- 研究期間：2025年11月8日〜11月24日
- 研究目的：AIコンパニオンとの対話や日記記述を通じて、母親の心理的支援・自己表現・コミュニティ形成への影響を明らかにする

## ユーザー体験フロー

### 3フェーズの体験
1. **意識して過ごす** - ユーザーが日常を意識的に過ごす
2. **書く** - AIコーチと対話しながら記事（日記）を作成
3. **読まれる** - 作成した記事を共有・読んでもらう

### その後
- **アンケート回答** - 「ペンを持つ効果アンケート」に回答

## コア機能

### 1. LINE Bot（`/api/line/webhook`）
- ユーザーからのメッセージを受信
- AI（GPT-5.1-mini）による応答生成
- 記事作成への導線提供
- 画像アップロード対応（日記のキャプション生成）

### 2. 記事作成サポート（`/action`）
- **ウォームアップ** - 今日の気分を選択
- **momoとの対話** - AIが質問を生成し、ユーザーが回答
- **アウトライン生成** - 対話内容から記事の構成案を生成
- **下書き入力** - リッチテキストエディタで記事を執筆
- **保存** - 下書き保存またはマイページに保存
- **PDF生成** - 記事をPDF化してSupabase Storageに保存

### 3. アンケート（`/survey/pen`）
- 10種類の「ペンを持つ効果」を5段階評価
- どのフェーズで効果を感じたかを選択
- 記事歴、読者、自由記述を収集

## 必要なファイル構成

### 必須ファイル

#### フロントエンド
- `src/app/action/page.tsx` - 記事作成ページ（メイン）
- `src/app/action/action.css` - スタイル
- `src/app/survey/pen/page.tsx` - アンケートページ（削除済み？要確認）
- `src/components/LiffLayout.tsx` - LIFF用レイアウト
- `src/components/LiffButton.tsx` - LIFF用ボタン
- `src/components/LiffInput.tsx` - LIFF用入力
- `src/components/LiffCard.tsx` - LIFF用カード

#### API Routes（必須）
- `src/app/api/line/webhook/route.ts` - LINE Webhook受信
- `src/app/api/coach/start/route.ts` - コーチセッション開始
- `src/app/api/coach/status/route.ts` - コーチ状態取得
- `src/app/api/coach/questions/route.ts` - 質問生成
- `src/app/api/coach/acknowledge/route.ts` - 承認メッセージ生成
- `src/app/api/coach/outline/route.ts` - アウトライン生成
- `src/app/api/coach/generate/route.ts` - リード文生成
- `src/app/api/coach/save/route.ts` - 記事保存
- `src/app/api/coach/history/route.ts` - 記事履歴取得
- `src/app/api/coach/pdf/route.ts` - PDF生成（削除済み？要確認）
- `src/app/api/survey/pen_effect/route.ts` - アンケート送信（削除済み？要確認）

#### ライブラリ
- `src/lib/momoLogic.ts` - LINE Botのメインロジック
- `src/lib/lineClient.ts` - LINE SDKクライアント
- `src/lib/supabaseAdmin.ts` - Supabase管理クライアント
- `src/lib/participants.ts` - 参加者管理
- `src/lib/liffClient.ts` - LIFFクライアント

### 不要なファイル（削除候補）

#### 未使用/旧機能のページ
- `src/app/coach/page.tsx` - `/action`へのリダイレクトのみ（統合可能）
- `src/app/daily/page.tsx` - 日次機能（研究目的外）
- `src/app/diary/**` - 日記機能（研究目的外）
- `src/app/weekly/page.tsx` - 週次機能（研究目的外）
- `src/app/articles/[id]/page.tsx` - 記事閲覧（研究目的外）
- `src/app/read/page.tsx` - 読書機能（研究目的外）
- `src/app/register/page.tsx` - 登録ページ（研究目的外）
- `src/app/help/page.tsx` - ヘルプページ（研究目的外）

#### 未使用/旧機能のAPI
- `src/app/api/daily/route.ts` - 日次機能
- `src/app/api/diary/**` - 日記機能
- `src/app/api/weekly/route.ts` - 週次機能
- `src/app/api/cron/daily-question/route.ts` - 日次質問送信
- `src/app/api/cron/evening-journal/route.ts` - 夕方日記
- `src/app/api/cron/morning-quiz/route.ts` - 朝のクイズ
- `src/app/api/cron/morning-reco/route.ts` - 朝の推薦
- `src/app/api/cron/weekly-summary/route.ts` - 週次サマリー
- `src/app/api/analytics/quiz-stats/route.ts` - クイズ統計
- `src/app/api/articles/create/route.ts` - 記事作成（旧実装？）
- `src/app/api/articles/[id]/route.ts` - 記事取得（旧実装？）
- `src/app/api/quiz/**` - クイズ機能（研究目的外）
- `src/app/api/family/feedback/route.ts` - 家族フィードバック（研究目的外）
- `src/app/api/cta/click/route.ts` - CTAクリック（研究目的外）
- `src/app/api/waitlist/route.ts` - ウェイトリスト（研究目的外）

#### デバッグ/テスト用
- `src/app/debug/**` - デバッグページ
- `src/app/api/debug/**` - デバッグAPI
- `src/app/api/test/**` - テストAPI
- `src/app/api/test-token/route.ts` - テストトークン
- `src/app/api/test-webhook/route.ts` - テストWebhook
- `src/app/api/ping/route.ts` - ヘルスチェック（必要か要確認）

#### 管理画面
- `src/app/admin/dashboard/page.tsx` - 管理ダッシュボード（研究目的外？）
- `src/app/admin/quiz-dashboard/page.tsx` - クイズ管理（研究目的外）

#### 未使用ライブラリ
- `src/lib/articleRecommender.ts` - 記事推薦（研究目的外）
- `src/lib/conversationFlow.ts` - 会話フロー（旧実装？）
- `src/lib/diaryRecommender.ts` - 日記推薦（研究目的外）
- `src/lib/insightGenerator.ts` - インサイト生成（研究目的外）
- `src/lib/quiz.ts` - クイズ機能（研究目的外）
- `src/lib/reflectiveCore.ts` - リフレクティブコア（研究目的外）
- `src/lib/session.ts` - セッション管理（使用中？要確認）
- `src/lib/style/**` - スタイル関連（使用中？要確認）

## データベース構成（Supabase）

### 必須テーブル
- `participants` - 参加者情報
- `articles` - 記事データ（`pdf_url`カラム含む）
- `pen_effects_master` - ペン効果マスタ
- `pen_effect_responses` - アンケート回答
- `chat_logs` - チャットログ（AI応答記録）

### 不要テーブル（削除候補）
- `quiz_logs` - クイズログ
- `sessions` - セッション（使用中？要確認）
- `diary_entries` - 日記エントリ
- `media_entries` - メディアエントリ（画像アップロード用、使用中？要確認）

## 環境変数

### 必須
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Botアクセストークン
- `LINE_CHANNEL_SECRET` - LINE Botシークレット
- `OPENAI_API_KEY` - OpenAI APIキー
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase管理キー
- `NEXT_PUBLIC_APP_URL` - アプリURL
- `NEXT_PUBLIC_LIFF_ID` - LIFF ID（記事作成用）

### オプション
- `SUPABASE_PDF_BUCKET` - PDF保存バケット名（デフォルト: `articles-pdf`）
- `NOTO_SANS_JP_FONT_URL` - 日本語フォントURL

## 次のステップ

1. **不要ファイルの削除** - 上記リストに基づいて削除
2. **API統合** - `/coach`を`/action`に統合
3. **データベース整理** - 不要テーブルの削除検討
4. **ドキュメント更新** - README.mdの作成
5. **テスト** - コア機能の動作確認

