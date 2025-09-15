export default function Page(){
  return (
    <main style={{maxWidth:560, margin:"0 auto", padding:"20px 16px"}}>
      <h1 style={{fontSize:22, fontWeight:700}}>ヘルプ / よくある質問</h1>
      <details style={dl}><summary>これは医療ですか？</summary>
        <p>いいえ。これは生活を軽くするための研究・サービスです。つらい時は各地域の相談窓口をご利用ください。</p>
      </details>
      <details style={dl}><summary>毎日できない日があっても大丈夫？</summary>
        <p>大丈夫です。できる日に60秒だけでOKです。</p>
      </details>
      <details style={dl}><summary>データの扱いは？</summary>
        <p>研究と改善のために活用します。いつでも中止・削除のご希望を承ります。</p>
      </details>
    </main>
  );
}
const dl:any = {border:"1px solid #eee", borderRadius:10, padding:"10px 12px", margin:"10px 0"};
