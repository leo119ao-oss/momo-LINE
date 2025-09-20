"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export const dynamic = "force-dynamic";

export default function Page() {
  const [uid, setUid] = useState<string>();
  const [agree1, setA1] = useState(false);
  const [agree2, setA2] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      await ensureLiff(process.env.NEXT_PUBLIC_LIFF_CONSENT_ID!);
      setUid(await getLineUserId());
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    const r = await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type":"application/json" },
      body: JSON.stringify({ display_name: name || "momo", contact: uid, cohort: "community" })
    });
    if (r.ok) {
      location.href = "/daily"; // すぐ日次へ
    } else {
      alert("送信に失敗しました。しばらくしてからお試しください。");
    }
  }

  if (!uid) return <Shell><p>LINE連携中…</p></Shell>;

  return (
    <Shell>
      <h1 style={h1}>研究への参加について</h1>
      <ol style={{margin:"12px 0 18px", paddingLeft:20, lineHeight:1.6}}>
        <li>毎日 <b>60秒</b> の記録、週に一度 <b>1〜2分</b> の振り返りをお願いします。</li>
        <li>これは <b>医療行為ではありません</b>。つらい時は相談先（/help）をご覧ください。</li>
        <li>データは研究とサービス改善のために活用します。いつでも中止できます。</li>
      </ol>

      <form onSubmit={submit} style={card}>
        <label style={label}>ニックネーム</label>
        <input value={name} onChange={e=>setName(e.target.value)}
               placeholder="例：momo" maxLength={20}
               style={input} />

        <div style={{marginTop:12}}>
          <label style={check}><input type="checkbox" checked={agree1} onChange={e=>setA1(e.target.checked)} />
            <span> 研究への参加に同意します</span></label>
          <label style={check}><input type="checkbox" checked={agree2} onChange={e=>setA2(e.target.checked)} />
            <span> 医療行為ではないことを理解しました</span></label>
        </div>

        <button disabled={!(agree1 && agree2)}
                style={{...btn, opacity: (agree1&&agree2)?1:0.5}}>
          同意してはじめる（60秒でOK）
        </button>
      </form>

      <p style={{fontSize:12, color:"#666"}}>※困ったら「ヘルプ」メニューからご連絡ください。</p>
    </Shell>
  );
}

function Shell({children}:{children:any}) {
  return (
    <main style={{maxWidth:560, margin:"0 auto", padding:"20px 16px"}}>
      {children}
    </main>
  );
}

const _banner = {background:"#FFF0F4", color:"#FF6F91", padding:"8px 12px", borderRadius:10, fontSize:12, textAlign:"center" as const, marginBottom:12};
const h1 = {fontSize:22, fontWeight:700, margin:"4px 0 8px"};
const card = {background:"#fff", border:"1px solid #eee", borderRadius:12, padding:16};
const label = {display:"block", fontSize:13, color:"#444", marginBottom:6};
const input:any = {width:"100%", border:"1px solid #ddd", borderRadius:8, padding:"10px 12px", fontSize:16};
const check:any = {display:"block", margin:"10px 0", fontSize:14};
const btn:any = {marginTop:16, width:"100%", background:"#FF8FA3", color:"#fff", border:"none", padding:"12px", borderRadius:10, fontWeight:700, fontSize:16};
