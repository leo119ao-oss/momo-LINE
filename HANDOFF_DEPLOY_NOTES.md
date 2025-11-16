# Pen Effect Feature Handoff

## 1. 実装済みの変更概要
- `/coach/article` ページを新規実装。
  - LIFF 認証 → 深掘り質問 → アウトライン生成 → 自動保存付きリッチテキスト入力 → 構成チェック/感想生成 → PDF 出力/共有までをワンページで提供。
  - 保存・AI連携・PDF生成は Next.js API Routes を通じて Supabase / OpenAI を呼び出しています。
- `/survey/pen` ページを新規実装。
  - LIFF 認証で user_id を取得し、`pen_effects_master` の10効果を 5 段階評価 + 属性/自由記述を集約して送信。
- 新規 API Routes を追加/更新。
  - `POST /api/coach/pdf`：日本語フォント付き PDF 生成 → Supabase Storage (`articles-pdf`) 保存 → `articles.pdf_url` 更新。
  - `POST /api/coach/structure`：記事本文の文法・語法チェック結果を JSON 返却。
  - `POST /api/coach/insight`：感想フィードバックメッセージ生成。
  - `GET/POST /api/survey/pen_effect`：ペン効果マスタ取得 & 回答保存。
- 付録として仕様書を `PRESENTATION_OUTLINE.md` に追記済み。

## 2. Supabase 側の作業
- `migrations/20251107_create_pen_effects.sql` および `20251107_alter_articles_add_pdf_url.sql` を適用済み。
- Storage バケット `articles-pdf` を作成済み（公開設定は任意）。
- 環境変数の確認ポイント：
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_PDF_BUCKET`（デフォルト `articles-pdf`）
  - `NOTO_SANS_JP_FONT_URL`（必要に応じて）

## 3. LINE 側設定
- ドメイン: `https://momo-line.vercel.app`
- LINE ログインチャネルに以下 LIFF を追加済み。
  - 記事サポート: `https://momo-line.vercel.app/coach/article`（LIFF ID: `2008100426-K0x5Y24N`）
  - ペン効果アンケート: `https://momo-line.vercel.app/survey/pen`（LIFF ID: `2008100426-Y5P1K5QL`）
- リッチメニュー「記事を書く」「アンケート」にそれぞれ上記 LIFF URL を設定済み。

## 4. これからの作業（別セッションへの指示）
1. **環境変数反映**
   - Vercel プロジェクトの Environment Variables に以下を追加/更新し、再デプロイ可能な状態に。
     - `NEXT_PUBLIC_LIFF_ID` = `2008100426-K0x5Y24N`
     - `NEXT_PUBLIC_LIFF_SURVEY_ID` など、アンケート用 LIFF を使う場合の変数名（アプリ側のコードに合わせる）。
     - `SUPABASE_PDF_BUCKET`（必要に応じて）
2. **デプロイ**
   - Git push → Vercel 自動デプロイ、またはローカルで `vercel --prod`。
3. **動作確認**
   - `/coach/article`：LIFF 認証→質問→アウトライン→本文入力→構成チェック/感想→PDF生成→Storage 保存。
   - `/survey/pen`：全質問回答→送信→Supabase `pen_effect_responses` 挿入。
   - Supabase Storage に PDF が作成され、`articles.pdf_url` が更新されること。
4. **LINE アプリ実機検証**
   - リッチメニューからそれぞれの LIFF を開き、体験が完了するか（UI レイアウト・トースト等の表示も確認）。

## 5. 補足情報
- PDF 生成は `pdf-lib` + Noto Sans JP を Google Fonts から取得（`NOTO_SANS_JP_FONT_URL` で上書き可能）。
- 構成チェック・感想 API は OpenAI GPT-4o-mini に依存。OpenAI API キーが未設定の場合は 500 エラーになるので、`OPENAI_API_KEY` が有効か確認を。
- Storage をプライベートにした場合は Supabase の署名付き URL を返すようロジック調整が必要です（現状は public URL を想定）。
- コード上のトースト/ステータス表示は簡易実装のため、必要に応じて UI 調整可。

このドキュメントを共有し、別セッションでデプロイと最終テストを進めてください。


