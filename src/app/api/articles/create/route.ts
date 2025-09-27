import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { contact, selectedArticles, query } = await request.json();
    
    if (!contact || !selectedArticles || selectedArticles.length === 0) {
      return NextResponse.json(
        { error: 'contact and selectedArticles are required' },
        { status: 400 }
      );
    }

    console.log('[ARTICLE_CREATE] Creating article from:', { contact, selectedArticles, query });

    // 選択された記事の内容を取得
    const articleContents = selectedArticles.map((article: any) => 
      `タイトル: ${article.title}\nURL: ${article.url}\n概要: ${article.summary}`
    ).join('\n\n');

    // AIで記事を統合・要約
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはお母さん大学の編集者です。複数の記事を統合して、ユーザーの悩みに特化した実用的な記事を作成してください。

【記事作成のポイント】
- ユーザーの検索クエリ（${query}）に基づいて、最も関連性の高い情報を抽出
- 複数の記事の良い部分を統合し、一貫性のある内容にする
- 実践的で具体的なアドバイスを含める
- 母親の立場に立った温かい語りかけで書く
- 見出しを使って読みやすく構成する
- 1500-2000文字程度でまとめる

【出力形式】
- タイトル: 魅力的で分かりやすいタイトル
- 本文: 見出し付きの構成で、実用的な内容
- 参考記事: 元記事のリンク一覧`
        },
        {
          role: 'user',
          content: `検索クエリ: ${query}\n\n参考記事:\n${articleContents}\n\n上記の記事を統合して、ユーザーの悩みに特化した実用的な記事を作成してください。`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const generatedContent = completion.choices[0]?.message?.content || '';
    
    // 記事をデータベースに保存
    const { data: articleData, error: insertError } = await supabaseAdmin
      .from('user_articles')
      .insert({
        user_id: contact,
        title: `「${query}」に関する記事まとめ`,
        content: generatedContent,
        source_articles: selectedArticles.map(a => a.url),
        search_query: query,
        status: 'published'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[ARTICLE_CREATE] Database insert error:', insertError);
      return NextResponse.json(
        { error: '記事の保存中にエラーが発生しました' },
        { status: 500 }
      );
    }

    // 記事のURLを生成
    const articleUrl = `${process.env.NEXT_PUBLIC_APP_URL}/articles/${articleData.id}`;

    return NextResponse.json({
      success: true,
      articleId: articleData.id,
      url: articleUrl,
      title: articleData.title,
      message: '記事が正常に作成されました'
    });

  } catch (error) {
    console.error('[ARTICLE_CREATE] Error:', error);
    return NextResponse.json(
      { error: '記事作成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
