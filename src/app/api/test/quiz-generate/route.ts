import { NextRequest, NextResponse } from 'next/server';
import { generateQuizFromAutoSearch, generateQuizFromArticle, validateQuizData } from '@/lib/quiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, articleUrl } = body;

    let quiz;
    
    if (mode === 'auto') {
      // 自動記事検索でクイズ生成
      quiz = await generateQuizFromAutoSearch();
    } else if (mode === 'manual' && articleUrl) {
      // 手動で記事URLを指定
      quiz = await generateQuizFromArticle(articleUrl);
    } else {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (!quiz) {
      return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 });
    }

    // バリデーション
    const isValid = validateQuizData(quiz);
    if (!isValid) {
      return NextResponse.json({ error: 'Generated quiz failed validation' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      quiz,
      message: 'Quiz generated successfully'
    });

  } catch (error) {
    console.error('Quiz generation test error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
