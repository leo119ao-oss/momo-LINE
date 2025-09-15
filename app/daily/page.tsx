"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export default function Page() {
  const [uid, setUid] = useState<string>();
  const [mood, setMood] = useState(5);
  const [load, setLoad] = useState(5);
  const [eff, setEff] = useState(5);
  const [choice, setChoice] = useState("家事");
  const [memo, setMemo] = useState("");

  useEffect(() => { (async () => {
    await ensureLiff(process.env.NEXT_PUBLIC_LIFF_DAILY_ID!);
    setUid(await getLineUserId());
  })(); }, []);

  async function submit() {
    if (!uid) return;
    const r = await fetch("/api/daily", {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ contact: uid, mood, load, efficacy: eff, choice, memo })
    });
    if (r.ok) {
      alert("今日の1分を送信しました。おつかれさま！");
      history.back(); // そのままLINEに戻る動線（任意）
    } else {
      alert("送信エラー：" + (await r.text()));
    }
  }

  if (!uid) return <Shell><p>読み込み中…</p></Shell>;

  return (
    <Shell>
      <h1 style={h1}>今日の1分</h1>
      <p style={{margin:"4px 0 12px", color:"#666"}}>スライダーを動かして、最後に一言。<b>60秒で終わります。</b></p>

      <div style={card}>
        <Slider label="気分" value={mood} onChange={setMood} left="低い" right="高い" />
        <Slider label="負担" value={load} onChange={setLoad} left="軽い" right="重い" />
        <Slider label="自信" value={eff} onChange={setEff} left="低い" right="高い" />

        <Field label="今日のトピック（選択）">
          <Chips options={["家事","育児","仕事","体調","自分時間"]} value={choice} onChange={setChoice} />
        </Field>

        <Field label="ひとこと（80字まで）">
          <textarea value={memo} onChange={e=>setMemo(e.target.value.slice(0,80))}
                    placeholder="例：寝かしつけで助けてもらえて楽だった"
                    style={ta}/>
          <div style={{textAlign:"right", fontSize:12, color:"#999"}}>{memo.length}/80</div>
        </Field>

        <button onClick={submit} style={btn}>送信する</button>
      </div>

      <p style={{fontSize:12, color:"#666"}}>※必要な時だけ、後続で「確認の質問」や「記事3件」が出ます。</p>
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

function Slider({label, value, onChange, left, right}:{label:string; value:number; onChange:(n:number)=>void; left:string; right:string;}) {
  return <div style={{margin:"12px 0"}}>
    <div style={{display:"flex", justifyContent:"space-between", fontSize:13, color:"#444"}}>
      <span>{label}</span><span>{value}</span>
    </div>
    <input type="range" min={0} max={10} value={value}
           onChange={e=>onChange(Number(e.target.value))}
           style={{width:"100%"}} />
    <div style={{display:"flex", justifyContent:"space-between", fontSize:12, color:"#888"}}>
      <span>{left}</span><span>{right}</span>
    </div>
  </div>;
}

function Chips({options,value,onChange}:{options:string[]; value:string; onChange:(v:string)=>void}) {
  return <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
    {options.map(o=><button key={o} onClick={()=>onChange(o)}
      style={{padding:"6px 10px", borderRadius:999, border:"1px solid #ddd",
              background: value===o ? "#FFEEF2" : "#fff", color: value===o ? "#D33" : "#333"}}>
      {o}
    </button>)}
  </div>;
}

const banner = {background:"#FFF0F4", color:"#FF6F91", padding:"8px 12px", borderRadius:10, fontSize:12, textAlign:"center" as const, marginBottom:12};
const h1 = {fontSize:22, fontWeight:700, margin:"4px 0 8px"};
const card = {background:"#fff", border:"1px solid #eee", borderRadius:12, padding:16};
const btn:any = {marginTop:8, width:"100%", background:"#FF8FA3", color:"#fff", border:"none", padding:"12px", borderRadius:10, fontWeight:700, fontSize:16};
const ta:any = {width:"100%", height:80, border:"1px solid #ddd", borderRadius:8, padding:"10px 12px", fontSize:16};
