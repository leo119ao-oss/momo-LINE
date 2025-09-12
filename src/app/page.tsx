export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🤖 Momo LINE Bot</h1>
      <p>LINE Botアプリケーションが正常に動作しています！</p>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h2>📋 セットアップ手順</h2>
        <ol>
          <li>Supabaseで<code>supabase_setup.sql</code>を実行してテーブルを作成</li>
          <li>環境変数を設定（.envファイルまたはVercelの環境変数）</li>
          <li>LINE DevelopersでWebhook URLを設定</li>
          <li>LINEアプリでMomoにメッセージを送信</li>
        </ol>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
        <h2>🔗 Webhook URL</h2>
        <p>LINE Developersで設定するWebhook URL:</p>
        <code style={{ backgroundColor: '#fff', padding: '5px', borderRadius: '4px' }}>
          {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/line/webhook
        </code>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
        <h2>⚠️ 注意事項</h2>
        <ul>
          <li>環境変数が正しく設定されているか確認してください</li>
          <li>Supabaseのテーブルが作成されているか確認してください</li>
          <li>LINE DevelopersでWebhookの利用が有効になっているか確認してください</li>
        </ul>
      </div>
    </div>
  );
}

