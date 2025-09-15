"use client";

import { useEffect, useState } from "react";
import { ensureLiff, getLineUserId } from "@/lib/liffClient";

export default function LiffDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const checkLiffConfig = async () => {
      const info: any = {
        consentId: process.env.NEXT_PUBLIC_LIFF_CONSENT_ID,
        dailyId: process.env.NEXT_PUBLIC_LIFF_DAILY_ID,
        weeklyId: process.env.NEXT_PUBLIC_LIFF_WEEKLY_ID,
        diaryId: process.env.NEXT_PUBLIC_LIFF_DIARY_ID,
        appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        isInLine: false,
        liffInitialized: false,
        userId: null
      };

      // LINE内かどうかをチェック
      info.isInLine = /Line/i.test(navigator.userAgent);

      // LIFF初期化を試行
      try {
        if (info.consentId) {
          await ensureLiff(info.consentId);
          info.liffInitialized = true;
          info.userId = await getLineUserId();
        }
      } catch (err) {
        setError(`LIFF初期化エラー: ${err}`);
      }

      setDebugInfo(info);
    };

    checkLiffConfig();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">LIFF デバッグ情報</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-md">
          <h2 className="font-semibold mb-2">環境変数</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify({
              consentId: debugInfo.consentId,
              dailyId: debugInfo.dailyId,
              weeklyId: debugInfo.weeklyId,
              diaryId: debugInfo.diaryId,
              appOrigin: debugInfo.appOrigin
            }, null, 2)}
          </pre>
        </div>

        <div className="p-4 bg-gray-50 rounded-md">
          <h2 className="font-semibold mb-2">LIFF URL</h2>
          <div className="space-y-2 text-sm">
            <div>同意: <code>https://liff.line.me/{debugInfo.consentId}</code></div>
            <div>日次: <code>https://liff.line.me/{debugInfo.dailyId}</code></div>
            <div>週次: <code>https://liff.line.me/{debugInfo.weeklyId}</code></div>
            <div>日記: <code>https://liff.line.me/{debugInfo.diaryId}</code></div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-md">
          <h2 className="font-semibold mb-2">環境情報</h2>
          <div className="space-y-2 text-sm">
            <div>現在のURL: <code>{debugInfo.currentUrl}</code></div>
            <div>LINE内: {debugInfo.isInLine ? "✅" : "❌"}</div>
            <div>LIFF初期化: {debugInfo.liffInitialized ? "✅" : "❌"}</div>
            <div>ユーザーID: <code>{debugInfo.userId || "未取得"}</code></div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <h2 className="font-semibold text-red-800 mb-2">エラー</h2>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h2 className="font-semibold text-blue-800 mb-2">テストリンク</h2>
          <div className="space-y-2">
            <a 
              href={`https://liff.line.me/${debugInfo.consentId}`}
              target="_blank"
              className="block p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              同意ページをテスト
            </a>
            <a 
              href={`https://liff.line.me/${debugInfo.dailyId}`}
              target="_blank"
              className="block p-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              日次ページをテスト
            </a>
            <a 
              href={`https://liff.line.me/${debugInfo.weeklyId}`}
              target="_blank"
              className="block p-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              週次ページをテスト
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
