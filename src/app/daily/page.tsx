"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export default function Page() {
  const [uid, setUid] = useState<string>();
  useEffect(()=>{ (async()=>{
    await ensureLiff(process.env.NEXT_PUBLIC_LIFF_DAILY_ID!);
    setUid(await getLineUserId());
  })(); },[]);
  if (!uid) return <div className="p-6">LINE連携中…</div>;
  async function send() {
    const r = await fetch("/api/daily", {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ contact: uid, mood:5, load:5, efficacy:5, choice:"test", memo:"" })
    });
    alert(r.ok ? "送信しました" : "送信エラー");
  }
  return <div className="p-6 space-y-3"><h1 className="text-xl font-semibold">今日の1分</h1><button onClick={send} className="border px-4 py-2 rounded">テスト送信</button></div>;
}
