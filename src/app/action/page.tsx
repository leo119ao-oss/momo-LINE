'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ActionPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('user_id');

  useEffect(() => {
    // /dailyページにリダイレクト（user_idパラメータを保持）
    if (userId) {
      window.location.href = `/daily?user_id=${userId}`;
    } else {
      window.location.href = '/daily';
    }
  }, [userId]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <p>リダイレクト中...</p>
    </div>
  );
}

