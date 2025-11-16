import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { z } from 'zod';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const pdfSchema = z.object({
  user_id: z.string().min(1),
  article_id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
});

const DEFAULT_FONT_URL =
  process.env.NOTO_SANS_JP_FONT_URL ||
  'https://fonts.gstatic.com/s/notosansjp/v52/-F6qfBvWT1zCPN9zDuYEFs3USBnSvpkopmqNIw.ttf';

const PDF_BUCKET = process.env.SUPABASE_PDF_BUCKET || 'articles-pdf';

async function fetchFont(): Promise<ArrayBuffer> {
  const response = await fetch(DEFAULT_FONT_URL);
  if (!response.ok) {
    throw new Error('フォントの取得に失敗しました');
  }
  return await response.arrayBuffer();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, article_id, title, content } = pdfSchema.parse(body);

    // 文章整形（gpt-4.1）- PDF用に文章を整える
    let formattedContent = content;
    if (content && content.trim().length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: 'あなたはPDF用の文章を整形するAIです。提供された文章をPDF提出物として適切な形式に整えてください。語尾を統一し、読みやすく、自然な日本語にしてください。',
            },
            {
              role: 'user',
              content: `以下の文章をPDF用に整形してください：\n\n${content}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });
        formattedContent = completion.choices[0]?.message?.content?.trim() || content;
      } catch (error) {
        console.error('[COACH_PDF] AI formatting error:', error);
        // エラーが発生しても元の文章を使用
      }
    }

    // PDFを生成
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontBytes = await fetchFont();
    const customFont = await pdfDoc.embedFont(fontBytes, { subset: true });

    const page = pdfDoc.addPage([595, 842]); // A4サイズ
    const { width, height } = page.getSize();

    // タイトル
    page.drawText(title || '無題の記事', {
      x: 50,
      y: height - 50,
      size: 20,
      font: customFont,
      color: rgb(0, 0, 0),
    });

    // 本文
    const lines = formattedContent.split('\n');
    let currentPage = page;
    let y = height - 100;
    const fontSize = 12;
    const lineHeight = fontSize * 1.5;
    const margin = 50;
    const maxWidth = width - margin * 2;

    for (const line of lines) {
      if (y < 50) {
        // 新しいページを追加
        currentPage = pdfDoc.addPage([595, 842]);
        y = height - 50;
      }

      if (line.trim()) {
        // 長い行を折り返す（簡易実装）
        const words = line.split('');
        let currentLine = '';
        const x = margin;

        for (const char of words) {
          const testLine = currentLine + char;
          const textWidth = customFont.widthOfTextAtSize(testLine, fontSize);

          if (textWidth > maxWidth && currentLine) {
            currentPage.drawText(currentLine, {
              x,
              y,
              size: fontSize,
              font: customFont,
              color: rgb(0, 0, 0),
            });
            currentLine = char;
            y -= lineHeight;
            if (y < 50) {
              currentPage = pdfDoc.addPage([595, 842]);
              y = height - 50;
            }
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          currentPage.drawText(currentLine, {
            x: margin,
            y,
            size: fontSize,
            font: customFont,
            color: rgb(0, 0, 0),
          });
          y -= lineHeight;
        }
      } else {
        y -= lineHeight;
      }
    }

    const pdfBytes = await pdfDoc.save();

    // Supabase Storageにアップロード
    const fileName = `${article_id}.pdf`;
    const filePath = `articles/${user_id}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(PDF_BUCKET)
      .upload(filePath, Buffer.from(pdfBytes), {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[COACH_PDF] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'PDFのアップロードに失敗しました' },
        { status: 500 }
      );
    }

    // 公開URLを取得
    const { data: urlData } = supabaseAdmin.storage
      .from(PDF_BUCKET)
      .getPublicUrl(filePath);

    const pdfUrl = urlData.publicUrl;

    // articlesテーブルを更新
    const { error: updateError } = await supabaseAdmin
      .from('articles')
      .update({ pdf_url: pdfUrl })
      .eq('id', article_id);

    if (updateError) {
      console.error('[COACH_PDF] Update error:', updateError);
      // PDFは生成されているので、エラーを返さない
    }

    return NextResponse.json({
      ok: true,
      pdf_url: pdfUrl,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'バリデーションエラー',
          details: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
        { status: 400 }
      );
    }

    console.error('[COACH_PDF] Error:', error);
    return NextResponse.json(
      { error: 'PDFの生成に失敗しました' },
      { status: 500 }
    );
  }
}

