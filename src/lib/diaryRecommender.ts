// src/lib/diaryRecommender.ts
// 日記推奨機能

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type DiaryStructure = {
  introduction: string;
  development: string;
  twist: string;
  conclusion: string;
}

export type DiaryRecommendation = {
  shouldRecommend: boolean;
  structure?: DiaryStructure;
  recommendationMessage: string;
  liffUrl: string;
}

// 日記推奨の判定と構造化
export async function recommendDiary(
  conversationHistory: Array<{role: string, content: string}>,
  participantId: string
): Promise<DiaryRecommendation> {
  try {
    // 会話の完全性をチェック
    const isComplete = checkStoryCompleteness(conversationHistory);
    
    if (!isComplete) {
      return {
        shouldRecommend: false,
        recommendationMessage: '',
        liffUrl: ''
      };
    }

    // 起承転結の構造化
    const structure = await structureStory(conversationHistory);
    
    // 推奨メッセージの生成
    const recommendationMessage = await generateDiaryRecommendationMessage(structure);
    
    // LIFFアプリのURL生成
    const liffUrl = generateLiffUrl(participantId);
    
    return {
      shouldRecommend: true,
      structure,
      recommendationMessage,
      liffUrl
    };
  } catch (error) {
    console.error('Diary recommendation failed:', error);
    return {
      shouldRecommend: false,
      recommendationMessage: '',
      liffUrl: ''
    };
  }
}

// 会話の完全性をチェック
function checkStoryCompleteness(conversationHistory: Array<{role: string, content: string}>): boolean {
  const userMessages = conversationHistory.filter(msg => msg.role === 'user');
  const totalLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0);
  
  // 一定以上の情報量がある場合に起承転結が満たされたと判定
  return userMessages.length >= 4 && totalLength >= 100;
}

// 起承転結の構造化
async function structureStory(conversationHistory: Array<{role: string, content: string}>): Promise<DiaryStructure> {
  const userMessages = conversationHistory
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content);
  
  const prompt = `
以下の会話を起承転結の構造で整理してください。

【会話内容】
${userMessages.join('\n')}

以下の形式で回答してください：
起（導入）: [会話の始まりや背景]
承（展開）: [詳細な状況や感情]
転（転換）: [気づきや変化]
結（結論）: [現在の気持ちや学び]

各項目は1-2文で簡潔にまとめてください。
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      return parseDiaryStructure(raw);
    }
  } catch (error) {
    console.error('Story structuring failed:', error);
  }
  
  // フォールバック: 単純な分割
  const quarter = Math.ceil(userMessages.length / 4);
  return {
    introduction: userMessages.slice(0, quarter).join(' '),
    development: userMessages.slice(quarter, quarter * 2).join(' '),
    twist: userMessages.slice(quarter * 2, quarter * 3).join(' '),
    conclusion: userMessages.slice(quarter * 3).join(' ')
  };
}

// 日記構造をパース
function parseDiaryStructure(rawText: string): DiaryStructure {
  const structure: DiaryStructure = {
    introduction: '',
    development: '',
    twist: '',
    conclusion: ''
  };
  
  const lines = rawText.split('\n');
  
  for (const line of lines) {
    if (line.includes('起（導入）:')) {
      structure.introduction = line.replace(/起（導入）:\s*/, '').trim();
    } else if (line.includes('承（展開）:')) {
      structure.development = line.replace(/承（展開）:\s*/, '').trim();
    } else if (line.includes('転（転換）:')) {
      structure.twist = line.replace(/転（転換）:\s*/, '').trim();
    } else if (line.includes('結（結論）:')) {
      structure.conclusion = line.replace(/結（結論）:\s*/, '').trim();
    }
  }
  
  return structure;
}

// 日記推奨メッセージの生成
async function generateDiaryRecommendationMessage(structure: DiaryStructure): Promise<string> {
  const prompt = `
以下の起承転結の内容を基に、日記を書くことを推奨する温かいメッセージを生成してください。

【起承転結】
起: ${structure.introduction}
承: ${structure.development}
転: ${structure.twist}
結: ${structure.conclusion}

【指示】
1. 温かく、共感的な口調で
2. 起承転結の内容を簡潔に振り返る
3. 日記を書くことの価値を伝える
4. プレッシャーを感じさせない
5. 2-3文で簡潔に

メッセージのみを回答してください。
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      return raw.trim();
    }
  } catch (error) {
    console.error('Diary recommendation message generation failed:', error);
  }
  
  return '今日のお話、とても大切な気づきがたくさんありましたね。日記にしてみませんか？';
}

// LIFFアプリのURL生成
function generateLiffUrl(participantId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/daily?participant=${participantId}`;
}
