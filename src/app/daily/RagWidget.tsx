"use client";
import { useState } from "react";
import { ConfirmPayload, RecPayload, TConfirmPayload, TRecPayload } from "@/lib/schema";

export default function RagWidget({ contact }:{ contact:string }) {
  const [q, setQ] = useState("");
  const [payload, setPayload] = useState<TConfirmPayload | TRecPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>("");

  async function ask(body:any) {
    setPending(true);
    setError("");
    setPayload(null);
    
    try {
      console.log('[RAG] Sending request:', body);
      const r = await fetch("/api/ask", { 
        method:"POST", 
        headers:{ "content-type":"application/json" }, 
        body: JSON.stringify(body) 
      });
      
      if (!r.ok) {
        const errorText = await r.text();
        console.error('[RAG] API error:', r.status, errorText);
        throw new Error(`API Error: ${r.status} ${errorText}`);
      }
      
      const t = await r.json();
      console.log('[RAG] Received response:', t);
      
      if (ConfirmPayload.safeParse(t).success) {
        setPayload(t);
      } else if (RecPayload.safeParse(t).success) {
        setPayload(t);
      } else {
        console.warn('[RAG] Unexpected response format:', t);
        setError("予期しない応答形式です。");
      }
    } catch (err) {
      console.error('[RAG] Error in ask function:', err);
      setError("情報の検索中にエラーが発生しました。しばらく時間をおいてから再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{marginTop:14, border:"1px solid #eee", borderRadius:12, padding:12}}>
      <div style={{fontSize:13, color:"#444", marginBottom:6}}>困ったときの質問（任意）</div>
      <div style={{display:"flex", gap:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="例：子どもの朝食が大変で…" style={{flex:1, border:"1px solid #ddd", borderRadius:8, padding:"10px 12px"}}/>
        <button onClick={()=> ask({ contact, q })} disabled={!q || pending} style={btn}>聞く</button>
      </div>

      {pending && <p style={{fontSize:12, color:"#999", marginTop:8}}>検索中…</p>}

      {error && (
        <div style={{marginTop:10, padding:8, backgroundColor:"#FFF5F5", border:"1px solid #FECACA", borderRadius:8}}>
          <p style={{fontSize:12, color:"#DC2626", margin:0}}>⚠️ {error}</p>
        </div>
      )}

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
