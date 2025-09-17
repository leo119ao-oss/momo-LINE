'use client';

import { useState, useEffect } from 'react';

interface QuizStats {
  period_days: number;
  summary: {
    total_sent: number;
    total_tap_choice: number;
    total_open: number;
    tap_choice_rate: number;
    open_rate: number;
  };
  daily_stats: Record<string, { sent: number; tap_choice: number; open: number }>;
  quiz_stats: Record<string, { sent: number; tap_choice: number; open: number }>;
}

export default function QuizDashboard() {
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/quiz-stats?days=7');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testQuizGeneration = async () => {
    try {
      const response = await fetch('/api/test/quiz-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }
      
      const data = await response.json();
      alert(`Quiz generated successfully! ID: ${data.quiz.id}\nQuestion: ${data.quiz.question}`);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!stats) return <div className="p-8">No data available</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">朝の1分クイズ ダッシュボード</h1>
      
      {/* テスト機能 */}
      <div className="bg-gray-100 p-4 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">テスト機能</h2>
        <button
          onClick={testQuizGeneration}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          クイズ自動生成テスト
        </button>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">送信数</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.summary.total_sent}</p>
          <p className="text-sm text-gray-500">過去{stats.period_days}日間</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">タップ率</h3>
          <p className="text-3xl font-bold text-green-600">{stats.summary.tap_choice_rate}%</p>
          <p className="text-sm text-gray-500">目標: 12-18%</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">記事遷移率</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.summary.open_rate}%</p>
          <p className="text-sm text-gray-500">目標: 18-25%</p>
        </div>
      </div>

      {/* 詳細統計 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 日別統計 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">日別統計</h3>
          <div className="space-y-2">
            {Object.entries(stats.daily_stats).map(([date, dayStats]) => (
              <div key={date} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-medium">{date}</span>
                <div className="flex space-x-4 text-sm">
                  <span className="text-blue-600">送信: {dayStats.sent}</span>
                  <span className="text-green-600">タップ: {dayStats.tap_choice}</span>
                  <span className="text-purple-600">記事: {dayStats.open}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* クイズ別統計 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">クイズ別統計</h3>
          <div className="space-y-2">
            {Object.entries(stats.quiz_stats).map(([quizId, quizStat]) => (
              <div key={quizId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-medium">Quiz #{quizId}</span>
                <div className="flex space-x-4 text-sm">
                  <span className="text-blue-600">送信: {quizStat.sent}</span>
                  <span className="text-green-600">タップ: {quizStat.tap_choice}</span>
                  <span className="text-purple-600">記事: {quizStat.open}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* パフォーマンス指標 */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">パフォーマンス指標</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">タップ率の評価</h4>
            <div className="flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-4">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${Math.min(stats.summary.tap_choice_rate, 20)}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium">
                {stats.summary.tap_choice_rate >= 12 ? '✅ 良好' : 
                 stats.summary.tap_choice_rate >= 8 ? '⚠️ 改善必要' : '❌ 要改善'}
              </span>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">記事遷移率の評価</h4>
            <div className="flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-4">
                <div 
                  className="bg-purple-500 h-2 rounded-full" 
                  style={{ width: `${Math.min(stats.summary.open_rate, 30)}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium">
                {stats.summary.open_rate >= 18 ? '✅ 良好' : 
                 stats.summary.open_rate >= 12 ? '⚠️ 改善必要' : '❌ 要改善'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
