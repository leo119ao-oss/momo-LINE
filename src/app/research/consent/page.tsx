"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export default function Page() {
  const [uid, setUid] = useState<string>();
  useEffect(() => { (async () => {
    await ensureLiff(process.env.NEXT_PUBLIC_LIFF_CONSENT_ID!);
    setUid(await getLineUserId());
  })(); }, []);
  if (!uid) return <div className="p-6">LINE連携中…</div>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/consent", {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({
        display_name: fd.get("name") || "momo",
        contact: uid, cohort: fd.get("cohort") || "community"
      })
    });
    alert(r.ok ? "同意を送信しました" : "送信エラー");
  }

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">研究への参加同意</h1>
      <input className="border p-2 w-full" name="name" placeholder="ニックネーム" />
      <select className="border p-2" name="cohort">
        <option value="community">community</option>
        <option value="general">general</option>
      </select>
      <button className="border px-4 py-2 rounded">同意してはじめる</button>
    </form>
  );
}
