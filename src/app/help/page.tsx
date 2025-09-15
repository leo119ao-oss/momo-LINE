"use client";

import { useEffect, useState } from "react";

export default function HelpPage() {
  const [liffInfo, setLiffInfo] = useState<any>({});

  useEffect(() => {
    const info = {
      consentId: process.env.NEXT_PUBLIC_LIFF_CONSENT_ID || '2008112810-zeKELwrx',
      dailyId: process.env.NEXT_PUBLIC_LIFF_DAILY_ID || '2008112810-GLXVgj3z',
      weeklyId: process.env.NEXT_PUBLIC_LIFF_WEEKLY_ID || '2008112810-VRKlky4e',
      diaryId: process.env.NEXT_PUBLIC_LIFF_DIARY_ID || '2008112810-qaB8YQdO',
      appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://momo-line.vercel.app',
      currentUrl: typeof window !== 'undefined' ? window.location.href : '',
      isInLine: typeof window !== 'undefined' ? /Line/i.test(navigator.userAgent) : false
    };
    setLiffInfo(info);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Momo ヘルプ</h1>
      
      <div className="space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h2 className="font-semibold text-blue-800 mb-2">研究参加について</h2>
          <p className="text-blue-700 text-sm mb-2">
            この研究は、AIアシスタントが母親の子育て支援にどのような効果があるかを調査することを目的としています。
          </p>
          <a 
            href={`https://liff.line.me/${liffInfo.consentId}`}
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            研究に参加する
          </a>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <h2 className="font-semibold text-green-800 mb-2">日次チェック</h2>
          <p className="text-green-700 text-sm mb-2">
            毎日1分で気分や負担、自信を記録できます。簡単なスライダーと選択肢で入力できます。
          </p>
          <a 
            href={`https://liff.line.me/${liffInfo.dailyId}`}
            className="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            今日の1分を記録
          </a>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-md">
          <h2 className="font-semibold text-purple-800 mb-2">週次まとめ</h2>
          <p className="text-purple-700 text-sm mb-2">
            週の終わりに、やったこと、頼れたこと、来週の一手を振り返ります。
          </p>
          <a 
            href={`https://liff.line.me/${liffInfo.weeklyId}`}
            className="inline-block px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            週次まとめを作成
          </a>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h2 className="font-semibold text-gray-800 mb-2">LIFF設定情報</h2>
          <div className="text-sm space-y-1">
            <div>同意ページ: <code>https://liff.line.me/{liffInfo.consentId}</code></div>
            <div>日次ページ: <code>https://liff.line.me/{liffInfo.dailyId}</code></div>
            <div>週次ページ: <code>https://liff.line.me/{liffInfo.weeklyId}</code></div>
            <div>日記ページ: <code>https://liff.line.me/{liffInfo.diaryId}</code></div>
            <div>アプリオリジン: <code>{liffInfo.appOrigin}</code></div>
            <div>現在のURL: <code>{liffInfo.currentUrl}</code></div>
            <div>LINE内: {liffInfo.isInLine ? "✅" : "❌"}</div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h2 className="font-semibold text-yellow-800 mb-2">トラブルシューティング</h2>
          <div className="text-yellow-700 text-sm space-y-2">
            <p><strong>404エラーが出る場合:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>LINE Developers ConsoleでLIFFアプリが正しく設定されているか確認</li>
              <li>LIFFアプリのエンドポイントURLが正しいか確認</li>
              <li>アプリの公開設定が正しいか確認</li>
            </ul>
            <p><strong>LIFFが初期化されない場合:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>LINE内でアクセスしているか確認</li>
              <li>ブラウザのコンソールでエラーメッセージを確認</li>
              <li>ネットワーク接続を確認</li>
            </ul>
          </div>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="font-semibold text-red-800 mb-2">LINE Developers Console設定</h2>
          <div className="text-red-700 text-sm space-y-2">
            <p>各LIFFアプリで以下の設定が必要です:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>エンドポイントURL:</strong> {liffInfo.appOrigin}/research/consent (同意)</li>
              <li><strong>エンドポイントURL:</strong> {liffInfo.appOrigin}/daily (日次)</li>
              <li><strong>エンドポイントURL:</strong> {liffInfo.appOrigin}/weekly (週次)</li>
              <li><strong>エンドポイントURL:</strong> {liffInfo.appOrigin}/diary/[slug] (日記)</li>
              <li><strong>スコープ:</strong> profile, openid</li>
              <li><strong>ボットリンク機能:</strong> 有効</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
