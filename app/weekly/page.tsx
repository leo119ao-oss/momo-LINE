"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export default function Page() {
  const [uid, setUid] = useState<string>();
  const [did, setDid] = useState("家事");
  const [relied, setRelied] = useState("家族");
  const [nextStep, setNext] = useState("早寝");

  useEffect(()=>{ (async()=>{
    await ensureLiff(process.env.NEXT_PUBLIC_LIFF_WEEKLY_ID!);
    setUid(await getLineUserId());
  })(); },[]);

  async function submit(){
    if(!uid) return;
    const r = await fetch("/api/weekly", {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ contact: uid, did, relied, next_step: nextStep })
    });
    if (r.ok) {
      alert("1週間のまとめを送信しました。おつかれさま！");
    } else {
      alert("送信エラー：" + (await r.text()));
    }
  }

  if (!uid) return <Shell><p>読み込み中…</p></Shell>;

  return (
    <Shell>
      <h1 style={h1}>週次まとめ（1〜2分）</h1>
      <div style={card}>
        <Field label="今週やったこと">
          <Select options={["家事","育児","仕事","体調ケア","自分時間"]} value={did} onChange={setDid}/>
        </Field>
        <Field label="頼れたこと">
          <Select options={["家族","友人","園/学校","職場","サービス"]} value={relied} onChange={setRelied}/>
        </Field>
        <Field label="来週の一手">
          <Select options={["早寝","休む宣言","お願いを1つ言う","同じ時間に寝る","外部に頼る"]} value={nextStep} onChange={setNext}/>
        </Field>
        <button onClick={submit} style={btn}>送信する</button>
      </div>

      <div style={{marginTop:14}}>
        <p style={{fontSize:13, color:"#666"}}>任意のオプション：</p>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
          <a href="/diary" style={cta}>家族にカードを送る</a>
          <a href="/help" style={cta}>ヘルプ / よくある質問</a>
        </div>
      </div>
    </Shell>
  );
}

function Shell({children}:{children:any}) {
  return <main style={{maxWidth:560, margin:"0 auto", padding:"20px 16px"}}>
    <div style={banner}>momo 研究モード</div>{children}</main>;
}

function Field({label, children}:{label:string, children:any}) {
  return <div style={{margin:"12px 0"}}>
    <div style={{fontSize:13, color:"#444", marginBottom:6}}>{label}</div>
    {children}
  </div>;
}

function Select({options,value,onChange}:{options:string[]; value:string; onChange:(v:string)=>void}) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={sel}>
    {options.map(o=><option key={o} value={o}>{o}</option>)}
  </select>;
}

const banner = {background:"#FFF0F4", color:"#FF6F91", padding:"8px 12px", borderRadius:10, fontSize:12, textAlign:"center" as const, marginBottom:12};
const h1 = {fontSize:22, fontWeight:700, margin:"4px 0 8px"};
const card = {background:"#fff", border:"1px solid #eee", borderRadius:12, padding:16};
const btn:any = {marginTop:8, width:"100%", background:"#FF8FA3", color:"#fff", border:"none", padding:"12px", borderRadius:10, fontWeight:700, fontSize:16};
const sel:any = {width:"100%", border:"1px solid #ddd", borderRadius:8, padding:"10px 12px", fontSize:16};
const cta:any = {display:"block", textAlign:"center", padding:"12px", border:"1px solid #eee", borderRadius:10, background:"#F7F7F7", color:"#333", textDecoration:"none"};
