#!/usr/bin/env node

/**
 * 朝の1分クイズ 自動テストスクリプト
 * 使用方法: node scripts/run-quiz-tests.js
 */

const https = require('https');
const readline = require('readline');

const BASE_URL = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://momo-line.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET environment variable is required');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// テスト1: クイズ生成テスト
async function testQuizGeneration() {
  console.log('\n🧪 テスト1: クイズ自動生成');
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
      console.log(`🔗 記事URL: ${response.data.quiz.article_url}`);
      console.log(`🆔 クイズID: ${response.data.quiz.id}`);
      return response.data.quiz.id;
    } else {
      console.log('❌ クイズ生成失敗');
      console.log('レスポンス:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ クイズ生成エラー:', error.message);
    return null;
  }
}

// テスト2: 統計データ取得テスト
async function testAnalytics() {
  console.log('\n📊 テスト2: 統計データ取得');
  console.log('='.repeat(50));
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/analytics/quiz-stats?days=1`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    
    if (response.status === 200) {
      console.log('✅ 統計データ取得成功');
      console.log(`📈 送信数: ${response.data.summary.total_sent}`);
      console.log(`👆 タップ率: ${response.data.summary.tap_choice_rate}%`);
      console.log(`🔗 記事遷移率: ${response.data.summary.open_rate}%`);
      return true;
    } else {
      console.log('❌ 統計データ取得失敗');
      console.log('レスポンス:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ 統計データ取得エラー:', error.message);
    return false;
  }
}

// テスト3: ダッシュボードアクセステスト
async function testDashboard() {
  console.log('\n🎛️ テスト3: ダッシュボードアクセス');
  console.log('='.repeat(50));
  
  try {
    const response = await makeRequest(`${BASE_URL}/admin/quiz-dashboard`);
    
    if (response.status === 200) {
      console.log('✅ ダッシュボードアクセス成功');
      return true;
    } else {
      console.log('❌ ダッシュボードアクセス失敗');
      return false;
    }
  } catch (error) {
    console.log('❌ ダッシュボードアクセスエラー:', error.message);
    return false;
  }
}

// メインテスト実行
async function runTests() {
  console.log('🚀 朝の1分クイズ 自動テスト開始');
  console.log(`🌐 ベースURL: ${BASE_URL}`);
  
  const results = {
    quizGeneration: false,
    analytics: false,
    dashboard: false
  };
  
  // テスト実行
  const quizId = await testQuizGeneration();
  results.quizGeneration = quizId !== null;
  
  results.analytics = await testAnalytics();
  results.dashboard = await testDashboard();
  
  // 結果サマリー
  console.log('\n📋 テスト結果サマリー');
  console.log('='.repeat(50));
  console.log(`🧪 クイズ生成: ${results.quizGeneration ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`📊 統計データ: ${results.analytics ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`🎛️ ダッシュボード: ${results.dashboard ? '✅ 成功' : '❌ 失敗'}`);
  
  const successCount = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 成功率: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
  
  if (successCount === totalTests) {
    console.log('🎉 全テスト成功！本番運用準備完了です。');
  } else {
    console.log('⚠️ 一部テストが失敗しました。ログを確認してください。');
  }
  
  // 次のステップの案内
  if (results.quizGeneration) {
    console.log('\n📝 次のステップ:');
    console.log('1. LINEでテストユーザーにクイズを送信');
    console.log('2. 選択肢をタップしてリダイレクトを確認');
    console.log('3. 朝7時のCronジョブを有効化');
  }
}

// テスト実行
runTests().catch(console.error).finally(() => {
  rl.close();
});
