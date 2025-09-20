"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";
import LiffLayout from "@/components/LiffLayout";
import LiffCard from "@/components/LiffCard";
import LiffButton from "@/components/LiffButton";
import LiffField from "@/components/LiffField";
import LiffSlider from "@/components/LiffSlider";
import LiffChips from "@/components/LiffChips";
import LiffInput from "@/components/LiffInput";
import RagWidget from "./RagWidget";

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

  if (!uid) {
    return (
      <LiffLayout 
        title="今日の1分" 
        subtitle="読み込み中..." 
        isLoading={true}
      />
    );
  }

  return (
    <LiffLayout 
      title="今日の1分" 
      subtitle="スライダーを動かして、最後に一言。60秒で終わります。"
    >
      <LiffCard>
        <LiffField label="気分">
          <LiffSlider 
            label="気分" 
            value={mood} 
            onChange={setMood} 
            leftLabel="低い" 
            rightLabel="高い" 
          />
        </LiffField>

        <LiffField label="負担">
          <LiffSlider 
            label="負担" 
            value={load} 
            onChange={setLoad} 
            leftLabel="軽い" 
            rightLabel="重い" 
          />
        </LiffField>

        <LiffField label="自信">
          <LiffSlider 
            label="自信" 
            value={eff} 
            onChange={setEff} 
            leftLabel="低い" 
            rightLabel="高い" 
          />
        </LiffField>

        <LiffField label="今日のトピック">
          <LiffChips 
            options={["家事","育児","仕事","体調","自分時間"]} 
            value={choice} 
            onChange={setChoice} 
          />
        </LiffField>

        <LiffField label="ひとこと" description="80字まで入力できます">
          <LiffInput
            value={memo}
            onChange={(value) => setMemo(value.slice(0, 80))}
            placeholder="例：寝かしつけで助けてもらえて楽だった"
            maxLength={80}
            multiline
            rows={3}
          />
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
        <p style={{ fontSize: '12px', color: '#666', margin: 0, textAlign: 'center' }}>
          ※必要な時だけ、後続で「確認の質問」や「記事3件」が出ます。
        </p>
      </LiffCard>
      
      <RagWidget contact={uid}/>
    </LiffLayout>
  );
}
