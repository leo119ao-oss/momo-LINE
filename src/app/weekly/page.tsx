"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export default function WeeklyPage() {
  const [uid, setUid] = useState<string>();
  const [participant, setParticipant] = useState<{id: string, condition: string} | null>(null);
  const [weeklyData, setWeeklyData] = useState({
    did: "",
    relied: "",
    next_step: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardUrl, setCardUrl] = useState("");
  const [showCTAs, setShowCTAs] = useState(false);
  const router = useRouter();

  useEffect(() => { 
    (async () => {
      await ensureLiff(process.env.NEXT_PUBLIC_LIFF_WEEKLY_ID!);
      setUid(await getLineUserId());
    })(); 
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("participant");
    if (stored) {
      setParticipant(JSON.parse(stored));
    } else {
      router.push("/research/consent");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participant || !uid) return;

    setIsSubmitting(true);
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 今週の日曜日

      const response = await fetch("/api/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid, // LINE userIdを使用
          week_start: weekStart.toISOString().split('T')[0],
          ...weeklyData,
          shared_card: true,
          share_link: cardUrl
        })
      });

      if (response.ok) {
        setShowCTAs(true);
      } else {
        alert("週次まとめの送信に失敗しました。");
      }
    } catch (error) {
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCTAClick = async (kind: string) => {
    if (!participant) return;

    try {
      // CTAクリックを記録
      await fetch("/api/cta/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: participant.id,
          kind
        })
      });

      // ウェイトリストに登録（任意）
      const shouldWaitlist = confirm(`${kind}の先行登録をしますか？`);
      if (shouldWaitlist) {
        await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: participant.id,
            kind,
            contact: "",
            note: "週次まとめからの登録"
          })
        });
        alert("先行登録が完了しました！");
      }
    } catch (error) {
      console.error("CTA処理エラー:", error);
    }
  };

  if (!uid) {
    return <div className="p-4 text-sm">LINE連携中…</div>;
  }

  if (!participant) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">今週のまとめ</h1>
      
      {!showCTAs ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">今週やったこと</label>
            <select
              value={weeklyData.did}
              onChange={(e) => setWeeklyData(prev => ({...prev, did: e.target.value}))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">選択してください</option>
              <option value="新しい遊びを試した">新しい遊びを試した</option>
              <option value="規則正しい生活を心がけた">規則正しい生活を心がけた</option>
              <option value="家族との時間を増やした">家族との時間を増やした</option>
              <option value="自分の時間を作った">自分の時間を作った</option>
              <option value="子どもの成長を記録した">子どもの成長を記録した</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">頼れたこと</label>
            <select
              value={weeklyData.relied}
              onChange={(e) => setWeeklyData(prev => ({...prev, relied: e.target.value}))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">選択してください</option>
              <option value="家族のサポート">家族のサポート</option>
              <option value="友人のアドバイス">友人のアドバイス</option>
              <option value="専門家の情報">専門家の情報</option>
              <option value="AIアシスタント">AIアシスタント</option>
              <option value="自分の直感">自分の直感</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">来週の一手</label>
            <select
              value={weeklyData.next_step}
              onChange={(e) => setWeeklyData(prev => ({...prev, next_step: e.target.value}))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">選択してください</option>
              <option value="もっと外遊びを増やす">もっと外遊びを増やす</option>
              <option value="睡眠リズムを整える">睡眠リズムを整える</option>
              <option value="新しい食材に挑戦">新しい食材に挑戦</option>
              <option value="家族会議を開く">家族会議を開く</option>
              <option value="自分の時間を確保">自分の時間を確保</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">家族カードを作る（任意）</label>
            <input
              type="text"
              placeholder="カードのURL（例: /diary/abc123）"
              value={cardUrl}
              onChange={(e) => setCardUrl(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !weeklyData.did || !weeklyData.relied || !weeklyData.next_step}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "送信中..." : "週次まとめを完了"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 rounded-md">
            <h3 className="font-semibold text-green-800">週次まとめが完了しました！</h3>
            <p className="text-sm text-green-700 mt-1">お疲れさまでした。</p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">おすすめサービス</h3>
            
            <button
              onClick={() => handleCTAClick("family_auto")}
              className="w-full p-4 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 text-left"
            >
              <div className="font-medium text-blue-800">家族サマリー自動配信(β)</div>
              <div className="text-sm text-blue-600">週次レポートを家族に自動送信</div>
            </button>

            <button
              onClick={() => handleCTAClick("photobook")}
              className="w-full p-4 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 text-left"
            >
              <div className="font-medium text-purple-800">フォトブック作成</div>
              <div className="text-sm text-purple-600">思い出を美しい本に</div>
            </button>

            <button
              onClick={() => handleCTAClick("grandparents")}
              className="w-full p-4 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 text-left"
            >
              <div className="font-medium text-orange-800">祖父母共有</div>
              <div className="text-sm text-orange-600">孫の成長を祖父母と共有</div>
            </button>

            <button
              onClick={() => handleCTAClick("b2b_report")}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 text-left"
            >
              <div className="font-medium text-gray-800">職場レポート</div>
              <div className="text-sm text-gray-600">子育てと仕事のバランス分析</div>
            </button>
          </div>

          <button
            onClick={() => router.push("/")}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
          >
            ホームに戻る
          </button>
        </div>
      )}
    </div>
  );
}
