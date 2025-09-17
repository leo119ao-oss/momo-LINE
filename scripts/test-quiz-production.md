# 朝の1分クイズ 本番テスト手順書

## 事前準備

### 1. データベースマイグレーション実行
```sql
-- Supabaseダッシュボードで実行
\i migrations/create_quiz_logs.sql
```

### 2. 環境変数確認
```bash
# .env.local に以下が設定されているか確認
OPENAI_API_KEY=your_openai_key
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
NEXT_PUBLIC_APP_ORIGIN=https://momo-line.vercel.app
CRON_SECRET=your_cron_secret
```

## テスト手順

### ステップ1: クイズ生成テスト
```bash
# 自動記事検索でクイズ生成
curl -X POST https://momo-line.vercel.app/api/test/quiz-generate \
  -H "Content-Type: application/json" \
  -d '{"mode": "auto"}'

# 期待されるレスポンス
{
  "success": true,
  "quiz": {
    "id": 1,
    "question": "朝の献立、迷いを減らすコツはどれ？",
    "choices": ["主菜だけ固定", "3品すべて新作", "毎回ゼロから考える"],
    "correct_index": 0,
    "article_url": "https://www.okaasan.net/..."
  }
}
```

### ステップ2: テスト送信
```bash
# 特定ユーザーにテスト送信
curl -X POST https://momo-line.vercel.app/api/test/quiz-send \
  -H "Content-Type: application/json" \
  -d '{
    "quizId": 1,
    "testUserIds": ["your_line_user_id"]
  }'
```

### ステップ3: リダイレクトテスト
1. LINEでクイズメッセージを受信
2. 選択肢A、B、Cのいずれかをタップ
3. `/read?quizId=1&picked=0` に遷移することを確認
4. 記事URLにリダイレクトされることを確認

### ステップ4: ログ確認
```bash
# 統計データの確認
curl "https://momo-line.vercel.app/api/analytics/quiz-stats?days=1" \
  -H "Authorization: Bearer your_cron_secret"
```

## 本番運用チェックリスト

### 自動配信テスト
- [ ] 07:00にCronジョブが実行される
- [ ] テキスト＋Flexの2通が送信される
- [ ] 全ユーザーに配信される
- [ ] エラーが発生しない

### ユーザー体験テスト
- [ ] 通知文が適切な長さ（18-24文字）
- [ ] Flexメッセージが正しく表示される
- [ ] 選択肢をタップすると記事に遷移する
- [ ] 「記事で答えを見る」ボタンも記事に遷移する

### データ収集テスト
- [ ] quiz_logsにsentが記録される
- [ ] 選択肢タップでtap_choiceが記録される
- [ ] 記事遷移でopenが記録される

### パフォーマンステスト
- [ ] タップ率が12-18%の範囲内
- [ ] 記事遷移率が18-25%の範囲内
- [ ] エラー率が5%以下

## トラブルシューティング

### よくある問題

1. **クイズ生成失敗**
   - OpenAI APIキーの確認
   - RAG検索で記事が見つからない場合の対処
   - フォールバッククイズの動作確認

2. **LINE送信失敗**
   - LINEチャンネルアクセストークンの確認
   - ユーザーIDの存在確認
   - レート制限の確認

3. **リダイレクト失敗**
   - NEXT_PUBLIC_APP_ORIGINの設定確認
   - 記事URLの有効性確認

### ログ確認方法
```bash
# Vercelのログを確認
vercel logs --follow

# Supabaseのログを確認
# Supabaseダッシュボード > Logs > Database
```

## 運用開始後の監視

### 日次チェック項目
- [ ] 朝7時の配信が正常に完了している
- [ ] エラーログに異常がない
- [ ] 統計データが正常に収集されている

### 週次チェック項目
- [ ] タップ率・記事遷移率の推移
- [ ] ユーザーからのフィードバック
- [ ] クイズ品質の評価

### 月次チェック項目
- [ ] 全体的なパフォーマンス評価
- [ ] 機能改善の検討
- [ ] 新機能の追加検討
