"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export default function Page(){
  const [uid, setUid] = useState<string>();
  const [file, setFile] = useState<File|null>(null);
  const [uploading, setUploading] = useState(false);
  const [entryId, setEntryId] = useState<number| null>(null);
  const [preview, setPreview] = useState<string>("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [doneUrl, setDoneUrl] = useState<string>("");

  useEffect(()=>{ (async()=>{ await ensureLiff(process.env.NEXT_PUBLIC_LIFF_DIARY_ID!); setUid(await getLineUserId()); })(); },[]);
  if (!uid) return <Shell><p>読み込み中…</p></Shell>;

  async function onUpload() {
    if (!file || !uid) return;
    const fd = new FormData();
    fd.append("contact", uid);
    fd.append("file", file);
    setUploading(true);
    const r = await fetch("/api/diary/upload", { method:"POST", body: fd });
    setUploading(false);
    if (!r.ok) return alert("アップロード失敗");
    const t = await r.json(); setEntryId(t.entry_id); setPreview(t.public_url); setSuggested(t.suggested); setTitle(t.suggested[0] || "");
  }

  async function onFinalize(){
    const r = await fetch("/api/diary/finalize", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ entry_id: entryId, title, extra_note: note }) });
    if (!r.ok) return alert("作成失敗");
    const t = await r.json(); setDoneUrl(t.url);
  }

  return (
    <Shell>
      <h1 style={h1}>家族カード（絵日記）</h1>

      {!entryId && (
        <div style={card}>
          <input type="file" accept="image/*" onChange={e=> setFile(e.target.files?.[0]||null)} />
          <button onClick={onUpload} disabled={!file || uploading} style={btn}>{uploading ? "アップロード中…" : "アップロード"}</button>
        </div>
      )}

      {entryId && !doneUrl && (
        <div style={card}>
          {preview && <img src={preview} alt="" style={{width:"100%", borderRadius:12, marginBottom:10}}/>}
          <div style={{fontSize:13, color:"#444", marginBottom:6}}>キャプション候補（自由入力もOK）</div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:8}}>
            {suggested.map(s => <button key={s} onClick={()=> setTitle(s)} style={{padding:"6px 10px", borderRadius:999, border:"1px solid #ddd", background: title===s ? "#FFEEF2" : "#fff"}}>{s}</button>)}
          </div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="キャプションを入力" style={inp}/>
          <div style={{marginTop:10}}>
            <div style={{fontSize:13, color:"#444", marginBottom:6}}>一言メモ（任意）</div>
            <textarea value={note} onChange={e=>setNote(e.target.value.slice(0,80))} placeholder="例：寝かしつけ、ありがとう！" style={ta}/>
            <div style={{textAlign:"right", fontSize:12, color:"#999"}}>{note.length}/80</div>
          </div>
          <button onClick={onFinalize} disabled={!title} style={btn}>カードを作る</button>
        </div>
      )}

      {doneUrl && (
        <div style={card}>
          <p>カードができました。</p>
          <a href={doneUrl} style={cta}>カードを開く（共有用URL）</a>
        </div>
      )}
    </Shell>
  );
}

function Shell({children}:{children:any}){ return <main style={{maxWidth:560, margin:"0 auto", padding:"20px 16px"}}>{children}</main> }
const banner = {background:"#FFF0F4", color:"#FF6F91", padding:"8px 12px", borderRadius:10, fontSize:12, textAlign:"center" as const, marginBottom:12};
const h1 = {fontSize:22, fontWeight:700, margin:"4px 0 8px"};
const card = {background:"#fff", border:"1px solid #eee", borderRadius:12, padding:16, marginBottom:12};
const btn:any = {marginTop:8, width:"100%", background:"#FF8FA3", color:"#fff", border:"none", padding:"12px", borderRadius:10, fontWeight:700, fontSize:16};
const ta:any = {width:"100%", height:80, border:"1px solid #ddd", borderRadius:8, padding:"10px 12px", fontSize:16};
const inp:any = {width:"100%", border:"1px solid #ddd", borderRadius:8, padding:"10px 12px", fontSize:16};
const cta:any = {display:"inline-block", padding:"10px 12px", borderRadius:10, border:"1px solid #eee", background:"#F7F7F7", textDecoration:"none", color:"#333"};
