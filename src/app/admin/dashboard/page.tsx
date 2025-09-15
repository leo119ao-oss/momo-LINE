"use client";

import { useState, useEffect } from "react";

interface DashboardData {
  totalParticipants: number;
  dailyInputRate: number;
  weeklyActiveRate: number;
  familyShareRate: number;
  articleClickRate: number;
  confirmQuestionRate: number;
  ctaCTR: number;
  waitlistCount: number;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 簡易的なダッシュボードデータ（実際の実装ではSupabaseから取得）
    const mockData: DashboardData = {
      totalParticipants: 45,
      dailyInputRate: 78.5,
      weeklyActiveRate: 65.2,
      familyShareRate: 23.1,
      articleClickRate: 34.7,
      confirmQuestionRate: 12.3,
      ctaCTR: 8.9,
      waitlistCount: 12
    };

    setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">研究ダッシュボード</h1>
          <div className="text-center">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const metrics = [
    { label: "総参加者数", value: data.totalParticipants, unit: "人", color: "bg-blue-500" },
    { label: "初回入力率", value: data.dailyInputRate, unit: "%", color: "bg-green-500" },
    { label: "週3回以上入力率", value: data.weeklyActiveRate, unit: "%", color: "bg-yellow-500" },
    { label: "家族共有世帯率", value: data.familyShareRate, unit: "%", color: "bg-purple-500" },
    { label: "記事クリック率", value: data.articleClickRate, unit: "%", color: "bg-indigo-500" },
    { label: "確認質問発生率", value: data.confirmQuestionRate, unit: "%", color: "bg-red-500" },
    { label: "CTA CTR", value: data.ctaCTR, unit: "%", color: "bg-pink-500" },
    { label: "ウェイトリスト数", value: data.waitlistCount, unit: "人", color: "bg-gray-500" }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">研究ダッシュボード</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metric.value}{metric.unit}
                  </p>
                </div>
                <div className={`w-12 h-12 ${metric.color} rounded-full flex items-center justify-center`}>
                  <span className="text-white font-bold text-lg">
                    {metric.value > 50 ? "📈" : metric.value > 25 ? "📊" : "📉"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">主要指標の推移</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>日次入力率</span>
                <span>{data.dailyInputRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${data.dailyInputRate}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>週次アクティブ率</span>
                <span>{data.weeklyActiveRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{ width: `${data.weeklyActiveRate}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>家族共有率</span>
                <span>{data.familyShareRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full" 
                  style={{ width: `${data.familyShareRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">研究状況サマリー</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">良好な指標</h3>
              <ul className="space-y-1 text-green-700">
                <li>• 日次入力率: {data.dailyInputRate}% (目標: 70%以上)</li>
                <li>• 週次アクティブ率: {data.weeklyActiveRate}% (目標: 60%以上)</li>
                <li>• 記事クリック率: {data.articleClickRate}% (目標: 30%以上)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">改善が必要な指標</h3>
              <ul className="space-y-1 text-orange-700">
                <li>• 家族共有率: {data.familyShareRate}% (目標: 40%以上)</li>
                <li>• CTA CTR: {data.ctaCTR}% (目標: 15%以上)</li>
                <li>• ウェイトリスト: {data.waitlistCount}人 (目標: 20人以上)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
