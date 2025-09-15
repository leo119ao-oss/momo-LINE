"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConsentPage() {
  const [consent, setConsent] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [contact, setContact] = useState("");
  const [cohort, setCohort] = useState("community");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participant, setParticipant] = useState<{id: string, condition: string} | null>(null);
  const [preSurvey, setPreSurvey] = useState({
    stress: 5,
    support: 5,
    confidence: 5
  });
  const router = useRouter();

  const handleConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || !displayName || !contact) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          contact,
          cohort
        })
      });

      if (response.ok) {
        const data = await response.json();
        setParticipant(data.participant);
        localStorage.setItem("participant", JSON.stringify(data.participant));
      } else {
        alert("同意の送信に失敗しました。");
      }
    } catch (error) {
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participant) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/survey/pre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: participant.id,
          answers: preSurvey,
          minutes: 2
        })
      });

      if (response.ok) {
        router.push("/");
      } else {
        alert("アンケートの送信に失敗しました。");
      }
    } catch (error) {
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (participant) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">開始前アンケート</h2>
        <p className="text-sm text-gray-600 mb-6">
          研究にご参加いただき、ありがとうございます。<br />
          割付: {participant.condition === "minimal" ? "基本版" : "拡張版"}
        </p>

        <form onSubmit={handlePreSurvey} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              ストレスレベル: {preSurvey.stress}/10
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={preSurvey.stress}
              onChange={(e) => setPreSurvey(prev => ({...prev, stress: Number(e.target.value)}))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              サポート感: {preSurvey.support}/10
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={preSurvey.support}
              onChange={(e) => setPreSurvey(prev => ({...prev, support: Number(e.target.value)}))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              子育て自信: {preSurvey.confidence}/10
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={preSurvey.confidence}
              onChange={(e) => setPreSurvey(prev => ({...prev, confidence: Number(e.target.value)}))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-300"
          >
            {isSubmitting ? "送信中..." : "研究を開始"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">研究参加同意</h1>
      
      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold mb-2">研究の目的</h3>
        <p className="text-sm text-gray-700">
          この研究は、AIアシスタントが母親の子育て支援にどのような効果があるかを調査することを目的としています。
        </p>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold mb-2">参加内容</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• 日次1分の気持ちチェック</li>
          <li>• AIアシスタントとの対話</li>
          <li>• 週次まとめの作成</li>
          <li>• 簡単なアンケート（開始前・中間・終了後）</li>
        </ul>
      </div>

      <form onSubmit={handleConsent} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">お名前</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">連絡先（メール）</label>
          <input
            type="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">参加コホート</label>
          <select
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="community">コミュニティ参加者</option>
            <option value="general">一般参加者</option>
          </select>
        </div>

        <div className="flex items-start space-x-2">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="mt-1"
          />
          <label htmlFor="consent" className="text-sm">
            上記の研究内容を理解し、データの使用に同意します。
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !consent || !displayName || !contact}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "送信中..." : "同意して参加"}
        </button>
      </form>
    </div>
  );
}
