"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LiffLayout from "@/components/LiffLayout";
import LiffCard from "@/components/LiffCard";
import LiffButton from "@/components/LiffButton";

interface Article {
  id: number;
  title: string;
  content: string;
  source_articles: string[];
  search_query: string;
  created_at: string;
}

export default function ArticlePage() {
  const params = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (params.id) {
      fetchArticle(Number(params.id));
    }
  }, [params.id]);

  async function fetchArticle(id: number) {
    try {
      setLoading(true);
      const response = await fetch(`/api/articles/${id}`);
      
      if (!response.ok) {
        throw new Error('記事の取得に失敗しました');
      }
      
      const data = await response.json();
      setArticle(data);
    } catch (err) {
      console.error('[ARTICLE] Error fetching article:', err);
      setError('記事の読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <LiffLayout 
        title="記事を読み込み中..." 
        subtitle="しばらくお待ちください"
        isLoading={true}
      />
    );
  }

  if (error || !article) {
    return (
      <LiffLayout 
        title="エラー" 
        subtitle="記事が見つかりませんでした"
        error={error || "記事が存在しません"}
      />
    );
  }

  return (
    <LiffLayout title={article.title} subtitle="お母さん大学記事まとめ">
      <LiffCard>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginBottom: '8px' 
          }}>
            検索クエリ: {article.search_query}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#999' 
          }}>
            作成日: {new Date(article.created_at).toLocaleDateString('ja-JP')}
          </div>
        </div>

        <div style={{ 
          lineHeight: '1.6',
          fontSize: '14px',
          color: '#333'
        }}>
          {article.content.split('\n').map((paragraph, index) => {
            if (paragraph.trim() === '') return null;
            
            // 見出しの判定（簡易版）
            if (paragraph.startsWith('#') || paragraph.startsWith('##')) {
              return (
                <h3 key={index} style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  margin: '16px 0 8px 0',
                  color: '#111827'
                }}>
                  {paragraph.replace(/^#+\s*/, '')}
                </h3>
              );
            }
            
            return (
              <p key={index} style={{ 
                margin: '8px 0',
                lineHeight: '1.6'
              }}>
                {paragraph}
              </p>
            );
          })}
        </div>

        {article.source_articles && article.source_articles.length > 0 && (
          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            backgroundColor: '#F9FAFB', 
            borderRadius: '8px' 
          }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              margin: '0 0 8px 0',
              color: '#111827'
            }}>
              参考記事
            </h4>
            <ul style={{ 
              margin: 0, 
              paddingLeft: '16px',
              fontSize: '12px',
              color: '#666'
            }}>
              {article.source_articles.map((url, index) => (
                <li key={index} style={{ margin: '4px 0' }}>
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      color: '#FF6B9D', 
                      textDecoration: 'none' 
                    }}
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </LiffCard>

      <LiffCard variant="accent">
        <div style={{ textAlign: 'center' }}>
          <p style={{ 
            fontSize: '14px', 
            color: '#666', 
            margin: '0 0 12px 0' 
          }}>
            この記事は役に立ちましたか？
          </p>
          <LiffButton
            onClick={() => window.history.back()}
            variant="primary"
            size="medium"
          >
            戻る
          </LiffButton>
        </div>
      </LiffCard>
    </LiffLayout>
  );
}
