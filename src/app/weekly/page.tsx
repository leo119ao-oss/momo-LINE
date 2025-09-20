"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";
import LiffLayout from "@/components/LiffLayout";
import LiffCard from "@/components/LiffCard";
import LiffButton from "@/components/LiffButton";
import LiffField from "@/components/LiffField";

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

  if (!uid) {
  return (
      <LiffLayout 
        title="週次まとめ" 
        subtitle="読み込み中..." 
        isLoading={true}
      />
    );
  }

  return (
    <LiffLayout 
      title="週次まとめ" 
      subtitle="1〜2分で完了します"
    >
      <LiffCard>
        <LiffField label="今週やったこと">
          <select 
            value={did} 
            onChange={e => setDid(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #E5E7EB',
              borderRadius: '12px',
              fontSize: '16px',
              backgroundColor: '#FFFFFF',
              outline: 'none'
            }}
          >
            {["家事","育児","仕事","体調ケア","自分時間"].map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </LiffField>

        <LiffField label="頼れたこと">
          <select 
            value={relied} 
            onChange={e => setRelied(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #E5E7EB',
              borderRadius: '12px',
              fontSize: '16px',
              backgroundColor: '#FFFFFF',
              outline: 'none'
            }}
          >
            {["家族","友人","園/学校","職場","サービス"].map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </LiffField>

        <LiffField label="来週の一手">
          <select 
            value={nextStep} 
            onChange={e => setNext(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #E5E7EB',
              borderRadius: '12px',
              fontSize: '16px',
              backgroundColor: '#FFFFFF',
              outline: 'none'
            }}
          >
            {["早寝","休む宣言","お願いを1つ言う","同じ時間に寝る","外部に頼る"].map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </LiffField>

        <LiffButton 
          onClick={submit} 
          variant="primary" 
          size="large" 
          fullWidth
        >
          送信する
        </LiffButton>
      </LiffCard>

      <LiffCard variant="accent" padding="small">
        <p style={{ fontSize: '14px', color: '#666', margin: '0 0 12px 0', textAlign: 'center' }}>
          任意のオプション：
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <LiffButton 
            variant="outline" 
            size="small" 
            onClick={() => window.location.href = '/diary'}
          >
            家族にカードを送る
          </LiffButton>
          <LiffButton 
            variant="outline" 
            size="small" 
            onClick={() => window.location.href = '/help'}
          >
            ヘルプ / よくある質問
          </LiffButton>
        </div>
      </LiffCard>
    </LiffLayout>
  );
}
