'use client';

import { useState, useEffect } from 'react';
import LiffLayout from '@/components/LiffLayout';
import LiffCard from '@/components/LiffCard';
import LiffButton from '@/components/LiffButton';
// import type { Liff } from '@line/liff'; //
// パッケージが見つからないエラーを解消するため、CDNから直接読み込む方式に変更します。

export default function RegisterPage() {
  const [liffObject, setLiffObject] = useState<any | null>(null); //
  const [lineId, setLineId] = useState<string>('');
  const [status, setStatus] = useState<string>('LIFFアプリを初期化しています...');
  const [error, setError] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  
  useEffect(() => {
    // ブラウザ環境で`process`オブジェクトが存在しないエラーを回避するため、
    // 環境変数の読み込みをuseEffectフック内に移動します。
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    // LIFF SDKをCDNから動的に読み込むことで、ビルドエラーを回避します。
    const script = document.createElement('script');
    script.src = 'https://static.line-scdn.net/liff/edge/2.1/sdk.js';
    script.async = true;
    
    script.onload = () => {
      const liff = (window as any).liff;
      if (!liff) {
        setStatus('エラー: LIFF SDKの読み込みに失敗しました。');
        return;
      }

      console.log('LIFF SDK loaded from CDN');
      if (!liffId) {
        setStatus('エラー: LIFF IDが設定されていません。');
        return;
      }
      
      // LIFFを初期化
      liff.init({ liffId })
        .then(() => {
          console.log('LIFF init succeeded.');
          setLiffObject(liff);
          if (liff.isLoggedIn()) {
            // ログイン済みならユーザー情報を取得
            liff.getProfile()
              .then((profile: { userId: string }) => {
                setLineId(profile.userId);
                setStatus('研究へのご協力ありがとうございます。あなたのアーキタイプを選択してください。');
              })
              .catch((err: Error) => {
                console.error(err);
                setError('ユーザー情報の取得に失敗しました。');
              });
          } else {
            // 未ログインならログインを促す
            setStatus('LINEにログインしてください。');
            liff.login();
          }
        })
        .catch((e: Error) => {
          console.error(e);
          setStatus('LIFFの初期化に失敗しました。');
          setError(e.toString());
        });
    };

    script.onerror = () => {
      setStatus('LIFF SDKの読み込みエラー');
      setError('CDNからのスクリプト読み込みに失敗しました。ネットワーク接続を確認してください。');
    };
    
    document.body.appendChild(script);

    // コンポーネントのアンマウント時にスクリプトをクリーンアップ
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []); // 依存配列は空で問題ありません

  // 登録処理
  const handleRegister = async (archetype: 'A' | 'B') => {
    if (!lineId) {
      setError('LINEユーザーIDが取得できていません。');
      return;
    }
    setStatus('登録処理を実行中...');
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: lineId, archetype }),
      });
      if (!response.ok) {
        throw new Error('サーバーでエラーが発生しました。');
      }
      setStatus('登録が完了しました！このウィンドウを閉じて、Momoとの対話をお楽しみください。');
      setIsRegistered(true);
      // 3秒後にLIFFウィンドウを自動で閉じる
      setTimeout(() => {
        liffObject?.closeWindow();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
      setStatus('登録に失敗しました。');
    }
  };

  return (
    <LiffLayout 
      title="Momo 研究参加者登録" 
      subtitle={status}
      error={error}
      isLoading={!lineId && !error}
    >
      {!isRegistered && lineId && !error && (
        <LiffCard>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              あなたのアーキタイプを選択してください
            </h3>
          </div>
          
          <LiffButton 
            onClick={() => handleRegister('A')} 
            variant="primary" 
            size="large" 
            fullWidth
            style={{ marginBottom: '12px' }}
          >
            私はアーキタイプAです
          </LiffButton>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '20px', textAlign: 'center' }}>
            （書くことを通じた自己表現を実践している）
          </p>
          
          <LiffButton 
            onClick={() => handleRegister('B')} 
            variant="secondary" 
            size="large" 
            fullWidth
          >
            私はアーキタイプBです
          </LiffButton>
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '12px', textAlign: 'center' }}>
            （特定の表現活動には従事していない）
          </p>
        </LiffCard>
      )}
    </LiffLayout>
  );
}


