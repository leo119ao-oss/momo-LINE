// src/lib/conversationFlow.ts
// 新しい会話フロー管理システム

export type ConversationStage = 
  | 'emotion_check'      // ①今の感情を確認
  | 'reason_hearing'      // ②何を理由にその感情になっているかヒアリング
  | 'insight_generation'  // ③示唆を提供
  | 'diary_recommendation' // ④日記推奨
  | 'article_recommendation' // ⑥関連記事紹介

export type ConversationState = {
  stage: ConversationStage;
  emotion?: string;
  reason?: string;
  insights?: string[];
  diaryContent?: {
    introduction?: string;
    development?: string;
    twist?: string;
    conclusion?: string;
  };
  articleUrl?: string;
  conversationDepth: number;
  lastUserMessage: string;
  lastAiMessage: string;
}

export type EmotionDetectionResult = {
  emotion: string;
  confidence: number;
  keywords: string[];
}

export type InsightGenerationResult = {
  insights: string[];
  relatedArticles: Array<{
    title: string;
    url: string;
    relevance: string;
  }>;
}

// 感情検出関数
export async function detectEmotion(message: string): Promise<EmotionDetectionResult> {
  const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
  
  const prompt = `
以下のメッセージから感情を検出してください。

メッセージ: "${message}"

以下の形式で回答してください：
{
  "emotion": "主要な感情（疲れ、イライラ、不安、心配、楽しい、嬉しい、悲しい、困る、悩みなど）",
  "confidence": 0.0-1.0の信頼度,
  "keywords": ["関連キーワード1", "関連キーワード2"]
}

感情が不明確な場合は、最も可能性の高い感情を選択してください。
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      const result = JSON.parse(raw);
      return {
        emotion: result.emotion || '不明',
        confidence: result.confidence || 0.5,
        keywords: result.keywords || []
      };
    }
  } catch (error) {
    console.error('Emotion detection failed:', error);
  }
  
  return {
    emotion: '不明',
    confidence: 0.0,
    keywords: []
  };
}

// 理由ヒアリングの質問生成
export function generateReasonQuestion(emotion: string, context: string): string {
  const questions = {
    '疲れ': 'どんなことが一番疲れを感じさせてる？',
    'イライラ': '何がイライラの原因になってる？',
    '不安': 'どんなことが不安にさせてる？',
    '心配': '何を心配してる？',
    '楽しい': 'どんなことが楽しくさせてる？',
    '嬉しい': '何が嬉しくさせてる？',
    '悲しい': 'どんなことが悲しくさせてる？',
    '困る': '何に困ってる？',
    '悩み': 'どんなことで悩んでる？'
  };
  
  return questions[emotion as keyof typeof questions] || 'その感情について、もう少し詳しく教えてもらえる？';
}

// 起承転結の判定
export function checkStoryCompleteness(conversationHistory: Array<{role: string, content: string}>): boolean {
  // 会話の長さと内容の深さを判定
  const userMessages = conversationHistory.filter(msg => msg.role === 'user');
  const totalLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0);
  
  // 一定以上の情報量がある場合に起承転結が満たされたと判定
  return userMessages.length >= 4 && totalLength >= 100;
}

// 起承転結の構造化
export function structureStory(conversationHistory: Array<{role: string, content: string}>): {
  introduction: string;
  development: string;
  twist: string;
  conclusion: string;
} {
  const userMessages = conversationHistory
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content);
  
  const quarter = Math.ceil(userMessages.length / 4);
  
  return {
    introduction: userMessages.slice(0, quarter).join(' '),
    development: userMessages.slice(quarter, quarter * 2).join(' '),
    twist: userMessages.slice(quarter * 2, quarter * 3).join(' '),
    conclusion: userMessages.slice(quarter * 3).join(' ')
  };
}
