"use client";
import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";
import LiffLayout from "@/components/LiffLayout";
import LiffCard from "@/components/LiffCard";
import LiffButton from "@/components/LiffButton";
import LiffField from "@/components/LiffField";
import LiffInput from "@/components/LiffInput";
import LiffChips from "@/components/LiffChips";

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
  
  if (!uid) {
    return (
      <LiffLayout 
        title="家族カード（絵日記）" 
        subtitle="読み込み中..." 
        isLoading={true}
      />
    );
  }

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
    <LiffLayout title="家族カード（絵日記）" subtitle="写真をアップロードして家族に送るカードを作成">
      {!entryId && (
        <LiffCard>
          <LiffField label="写真を選択" description="画像ファイルを選択してください">
            <input 
              type="file" 
              accept="image/*" 
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px dashed #E5E7EB',
                borderRadius: '12px',
                backgroundColor: '#FAFAFA',
                fontSize: '16px'
              }}
            />
          </LiffField>
          
          <LiffButton 
            onClick={onUpload} 
            disabled={!file || uploading} 
            variant="primary" 
            size="large" 
            fullWidth
          >
            {uploading ? "アップロード中…" : "アップロード"}
          </LiffButton>
        </LiffCard>
      )}

      {entryId && !doneUrl && (
        <LiffCard>
          {preview && (
            <img 
              src={preview} 
              alt="プレビュー" 
              style={{
                width: '100%', 
                borderRadius: '16px', 
                marginBottom: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
            />
          )}
          
          <LiffField label="キャプション" description="候補から選択するか、自由に入力してください">
            <LiffChips 
              options={suggested} 
              value={title} 
              onChange={setTitle}
              variant="compact"
            />
            <LiffInput
              value={title}
              onChange={setTitle}
              placeholder="キャプションを入力"
              style={{ marginTop: '8px' }}
            />
          </LiffField>

          <LiffField label="一言メモ" description="任意で追加できます（80字まで）">
            <LiffInput
              value={note}
              onChange={(value) => setNote(value.slice(0, 80))}
              placeholder="例：寝かしつけ、ありがとう！"
              maxLength={80}
              multiline
              rows={3}
            />
          </LiffField>

          <LiffButton 
            onClick={onFinalize} 
            disabled={!title} 
            variant="primary" 
            size="large" 
            fullWidth
          >
            カードを作る
          </LiffButton>
        </LiffCard>
      )}

      {doneUrl && (
        <LiffCard variant="accent">
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              カードができました！
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
              家族と共有できるURLが生成されました
            </p>
            <LiffButton 
              onClick={() => window.open(doneUrl, '_blank')}
              variant="primary" 
              size="large" 
              fullWidth
            >
              カードを開く
            </LiffButton>
          </div>
        </LiffCard>
      )}
    </LiffLayout>
  );
}

