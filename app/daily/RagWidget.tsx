"use client";
import { useState } from "react";
import { ConfirmPayload, RecPayload, TConfirmPayload, TRecPayload } from "@/lib/schema";

export default function RagWidget({ contact }:{ contact:string }) {
  const [q, setQ] = useState("");
  const [payload, setPayload] = useState<TConfirmPayload | TRecPayload | null>(null);
  const [pending, setPending] = useState(false);

  async function ask(body:any) {
    setPending(true);
    const r = await fetch("/api/ask", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(body) });
    const t = await r.json();
    setPending(false);
    if (ConfirmPayload.safeParse(t).success) setPayload(t);
    else if (RecPayload.safeParse(t).success) setPayload(t);
    else setPayload(null);
  }

  return (
    <div style={{marginTop:14, border:"1px solid #eee", borderRadius:12, padding:12}}>
      <div style={{fontSize:13, color:"#444", marginBottom:6}}>困ったときの質問（任意）</div>
      <div style={{display:"flex", gap:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="例：子どもの朝食が大変で…" style={{flex:1, border:"1px solid #ddd", borderRadius:8, padding:"10px 12px"}}/>
        <button onClick={()=> ask({ contact, q })} disabled={!q || pending} style={btn}>聞く</button>
      </div>

      {pending && <p style={{fontSize:12, color:"#999", marginTop:8}}>検索中…</p>}

      {payload && ("type" in payload) && payload.type === "confirm" && (
        <div style={{marginTop:10}}>
          <p style={{margin:"6px 0"}}>{payload.message}</p>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {(payload as TConfirmPayload).options.map(opt =>
              <button key={opt} onClick={()=> ask({ contact, q: q + " " + opt })} style={chip}>{opt}</button>
            )}
          </div>
          {payload.freeTextHint && <p style={{fontSize:12, color:"#888", marginTop:6}}>{payload.freeTextHint}</p>}
        </div>
      )}

      {payload && ("type" in payload) && payload.type === "recommendations" && (
        <div style={{marginTop:10}}>
          <p style={{fontSize:13, color:"#666", marginBottom:8}}>おすすめ（3件＋理由）</p>
          <ul style={{display:"grid", gap:8}}>
            {(payload as TRecPayload).items.map((it, i) => (
              <li key={i} style={{border:"1px solid #eee", borderRadius:10, padding:10}}>
                <a href={it.url} target="_blank" style={{fontWeight:600, textDecoration:"none", color:"#333"}}>{it.title ?? "リンク"}</a>
                <div style={{fontSize:12, color:"#666", marginTop:4}}>理由：{it.why}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const btn:any = { background:"#FF8FA3", color:"#fff", border:"none", padding:"10px 14px", borderRadius:10, fontWeight:700 };
const chip:any = { padding:"6px 10px", borderRadius:999, border:"1px solid #ddd", background:"#FFEEF2", color:"#D33" };
