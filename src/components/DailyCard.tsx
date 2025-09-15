"use client";

import { useState } from "react";

interface DailyCardProps {
  userId: string;
  onComplete?: () => void;
}

export default function DailyCard({ userId, onComplete }: DailyCardProps) {
  const [mood, setMood] = useState(5);
  const [load, setLoad] = useState(5);
  const [efficacy, setEfficacy] = useState(5);
  const [choice, setChoice] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          mood,
          load,
          efficacy,
          choice,
          memo: memo.slice(0, 80)
        })
      });

      if (response.ok) {
        onComplete?.();
      } else {
        alert("送信に失敗しました。もう一度お試しください。");
      }
    } catch (error) {
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md space-y-6">
      <h2 className="text-xl font-semibold text-center">今日のひとこと</h2>
      
      {/* 気分スライダー */}
      <div>
        <label className="block text-sm font-medium mb-2">
          気分: {mood}/10
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={mood}
          onChange={(e) => setMood(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* 負担スライダー */}
      <div>
        <label className="block text-sm font-medium mb-2">
          負担: {load}/10
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={load}
          onChange={(e) => setLoad(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* 自信スライダー */}
      <div>
        <label className="block text-sm font-medium mb-2">
          自信: {efficacy}/10
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={efficacy}
          onChange={(e) => setEfficacy(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* 選択肢 */}
      <div>
        <label className="block text-sm font-medium mb-2">今日の選択</label>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="">選択してください</option>
          <option value="子育てに集中">子育てに集中</option>
          <option value="自分の時間を作った">自分の時間を作った</option>
          <option value="家族と過ごした">家族と過ごした</option>
          <option value="新しいことに挑戦">新しいことに挑戦</option>
          <option value="休息を取った">休息を取った</option>
        </select>
      </div>

      {/* 一言メモ */}
      <div>
        <label className="block text-sm font-medium mb-2">
          一言メモ ({memo.length}/80)
        </label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={80}
          placeholder="今日の気持ちや出来事を一言で..."
          className="w-full p-2 border border-gray-300 rounded-md h-20 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !choice}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "送信中..." : "送信"}
      </button>
    </form>
  );
}
