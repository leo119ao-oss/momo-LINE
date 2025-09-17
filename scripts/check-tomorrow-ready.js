#!/usr/bin/env node

/**
 * 明日の朝のクイズ送信準備状況チェック
 * 使用方法: node scripts/check-tomorrow-ready.js
 */

const https = require('https');

const BASE_URL = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://momo-line.vercel.app';

// 環境変数チェック
function checkEnvironmentVariables() {
  console.log('🔍 環境変数チェック');
  console.log('='.repeat(50));
  
  const required = [
    'OPENAI_API_KEY',
    'LINE_CHANNEL_ACCESS_TOKEN', 
    'LINE_CHANNEL_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET'
  ];
  
  let allSet = true;
  required.forEach(env => {
    if (process.env[env]) {
      console.log(`✅ ${env}: 設定済み`);
    } else {
      console.log(`❌ ${env}: 未設定`);
      allSet = false;
    }
  });
  
  return allSet;
}

// HTTPリクエストのヘルパー関数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// クイズ生成テスト
async function testQuizGeneration() {
  console.log('\n🧪 クイズ生成テスト');
  console.log('='.repeat(50));
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/test/quiz-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'auto' })
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ クイズ生成成功');
      console.log(`📝 質問: ${response.data.quiz.question}`);
      return true;
    } else {
      console.log('❌ クイズ生成失敗');
      console.log('エラー:', response.data.error);
      return false;
    }
  } catch (error) {
    console.log('❌ クイズ生成エラー:', error.message);
    return false;
  }
}

// ユーザー数チェック
async function checkUserCount() {
  console.log('\n👥 ユーザー数チェック');
  console.log('='.repeat(50));
  
  try {
    // 統計APIでユーザー数を確認
    const response = await makeRequest(`${BASE_URL}/api/analytics/quiz-stats?days=1`, {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });
    
    if (response.status === 200) {
      console.log('✅ 統計API接続成功');
      console.log('📊 過去の送信データ確認可能');
      return true;
    } else {
      console.log('❌ 統計API接続失敗');
      return false;
    }
  } catch (error) {
    console.log('❌ 統計API接続エラー:', error.message);
    return false;
  }
}

// メイン実行
async function checkTomorrowReadiness() {
  console.log('🚀 明日の朝のクイズ送信準備状況チェック');
  console.log(`🌐 ベースURL: ${BASE_URL}`);
  console.log(`🕐 送信予定時刻: 朝7時 (JST)`);
  
  const results = {
    envVars: false,
    quizGen: false,
    apiAccess: false
  };
  
  // チェック実行
  results.envVars = checkEnvironmentVariables();
  results.quizGen = await testQuizGeneration();
  results.apiAccess = await checkUserCount();
  
  // 結果サマリー
  console.log('\n📋 準備状況サマリー');
  console.log('='.repeat(50));
  console.log(`🔧 環境変数: ${results.envVars ? '✅ 完了' : '❌ 要設定'}`);
  console.log(`🧪 クイズ生成: ${results.quizGen ? '✅ 完了' : '❌ 要修正'}`);
  console.log(`🌐 API接続: ${results.apiAccess ? '✅ 完了' : '❌ 要修正'}`);
  
  const readyCount = Object.values(results).filter(Boolean).length;
  const totalChecks = Object.keys(results).length;
  
  console.log(`\n🎯 準備完了度: ${readyCount}/${totalChecks} (${Math.round(readyCount/totalChecks*100)}%)`);
  
  if (readyCount === totalChecks) {
    console.log('\n🎉 明日の朝の送信準備完了！');
    console.log('✅ 朝7時に自動的にクイズが送信されます');
  } else {
    console.log('\n⚠️ 準備が不完全です');
    console.log('\n📝 緊急対応手順:');
    
    if (!results.envVars) {
      console.log('1. 環境変数の設定が必要です');
      console.log('   - .env.localファイルを確認');
      console.log('   - Vercelの環境変数設定を確認');
    }
    
    if (!results.quizGen) {
      console.log('2. データベースマイグレーションが必要です');
      console.log('   - scripts/emergency-setup.sqlを実行');
      console.log('   - Supabaseダッシュボードで実行');
    }
    
    if (!results.apiAccess) {
      console.log('3. API接続の確認が必要です');
      console.log('   - ネットワーク接続を確認');
      console.log('   - Vercelのデプロイ状況を確認');
    }
    
    console.log('\n⏰ 明日の朝までに上記を完了させてください');
  }
  
  // 時刻確認
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);
  
  const hoursUntil = Math.round((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  console.log(`\n⏰ 次回送信まで: 約${hoursUntil}時間`);
  console.log(`📅 次回送信時刻: ${tomorrow.toLocaleString('ja-JP')}`);
}

// 実行
checkTomorrowReadiness().catch(console.error);
