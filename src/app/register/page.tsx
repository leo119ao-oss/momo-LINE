export default function RegisterPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>📝 ユーザー登録</h1>
      <p>Momo LINE Botにご登録いただき、ありがとうございます。</p>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h2>🤖 LINE Botの使い方</h2>
        <ol>
          <li>LINEアプリでMomoを友だち追加</li>
          <li>メッセージを送信して対話を開始</li>
          <li>AIがカウンセリング特化の応答を提供</li>
        </ol>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
        <h2>🔗 LINE Botの追加</h2>
        <p>LINEアプリで以下のQRコードをスキャンするか、友だち追加してください：</p>
        <p><strong>Bot ID:</strong> @momo-line-bot</p>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
        <h2>⚠️ 注意事項</h2>
        <ul>
          <li>プライバシーを尊重し、安全な対話を心がけています</li>
          <li>対話内容は学習目的で匿名化して保存される場合があります</li>
          <li>緊急時は専門のカウンセラーにご相談ください</li>
        </ul>
      </div>
    </div>
  );
}

