"use client";
import { useEffect } from "react";
import { ensureLiff } from "@/lib/liffClient";

export default function Page(){
  useEffect(()=>{ ensureLiff(process.env.NEXT_PUBLIC_LIFF_DIARY_ID!); },[]);

  return (
    <main style={{maxWidth:560, margin:"0 auto", padding:"20px 16px"}}>
      <div style={banner}>momo 研究モード</div>
      <h1 style={h1}>家族カード（絵日記）</h1>
      <p style={{margin:"4px 0 12px", color:"#666"}}>
        写真＋ひとことをカードにして、家族にURLで送れます。<br/>
        たとえば「お願い1つ／感謝1つ」を1分で伝えられます。
      </p>
      <div style={card}>
        <ol style={{paddingLeft:20, lineHeight:1.6}}>
          <li>LINEで写真を送る</li>
          <li>候補キャプションから選ぶ（または自由入力）</li>
          <li>一言メモを足す → カードURLが出ます</li>
        </ol>
      </div>
      <a href="/help#family" style={cta}>家族に伝えるコツを見る</a>
    </main>
  );
}

const banner = {background:"#FFF0F4", color:"#FF6F91", padding:"8px 12px", borderRadius:10, fontSize:12, textAlign:"center" as const, marginBottom:12};
const h1 = {fontSize:22, fontWeight:700, margin:"4px 0 8px"};
const card = {background:"#fff", border:"1px solid #eee", borderRadius:12, padding:16};
const cta:any = {display:"block", textAlign:"center", padding:"12px", border:"1px solid #eee", borderRadius:10, background:"#F7F7F7", color:"#333", textDecoration:"none", marginTop:12};
