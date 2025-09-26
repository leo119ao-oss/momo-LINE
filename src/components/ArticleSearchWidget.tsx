"use client";
import { useState } from "react";
import LiffCard from "./LiffCard";
import LiffButton from "./LiffButton";
import LiffInput from "./LiffInput";
import LiffChips from "./LiffChips";

interface ArticleItem {
  title: string;
  url: string;
  summary: string;
  relevance: string;
}

interface ArticleSearchResult {
  articles: ArticleItem[];
  totalCount: number;
  searchQuery: string;
}

export default function ArticleSearchWidget({ contact }: { contact: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleSearchResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedArticles, setSelectedArticles] = useState<ArticleItem[]>([]);

  // よくある検索クエリ
  const commonQueries = [
    "子どもの食事",
    "寝かしつけ",
    "イヤイヤ期",
    "育児の悩み",
    "母親のストレス",
    "子育てのコツ"
  ];

  async function searchArticles() {
    if (!query.trim()) return;
    
    setPending(true);
    setError("");
    setResults(null);
    
    try {
      console.log('[ARTICLE_SEARCH] Searching for:', query);
      const response = await fetch("/api/search/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          contact, 
          query: query.trim(),
          limit: 5
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`検索エラー: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[ARTICLE_SEARCH] Received results:', data);
      setResults(data);
    } catch (err) {
      console.error('[ARTICLE_SEARCH] Error:', err);
      setError("記事の検索中にエラーが発生しました。しばらく時間をおいてから再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  function toggleArticleSelection(article: ArticleItem) {
    setSelectedArticles(prev => {
      const isSelected = prev.some(a => a.url === article.url);
      if (isSelected) {
        return prev.filter(a => a.url !== article.url);
      } else {
        return [...prev, article];
      }
    });
  }

  async function createArticle() {
    if (selectedArticles.length === 0) return;
    
    setPending(true);
    setError("");
    
    try {
      console.log('[ARTICLE_CREATE] Creating article from:', selectedArticles);
      const response = await fetch("/api/articles/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contact,
          selectedArticles,
          query: query.trim()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`記事作成エラー: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[ARTICLE_CREATE] Article created:', data);
      
      // 成功時の処理（ページ遷移など）
      if (data.url) {
        window.open(data.url, '_blank');
      }
      
      // リセット
      setResults(null);
      setSelectedArticles([]);
      setQuery("");
      
    } catch (err) {
      console.error('[ARTICLE_CREATE] Error:', err);
      setError("記事の作成中にエラーが発生しました。しばらく時間をおいてから再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <LiffCard>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
          お母さん大学記事検索
        </h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
          気になるテーマで記事を検索し、参考になる記事をまとめて保存できます
        </p>
      </div>

      {/* 検索フォーム */}
      <div style={{ marginBottom: '16px' }}>
        <LiffInput
          value={query}
          onChange={setQuery}
          placeholder="例：子どもの朝食が大変で困っている"
          style={{ marginBottom: '8px' }}
        />
        
        <LiffChips
          options={commonQueries}
          value={query}
          onChange={setQuery}
          variant="compact"
        />
        
        <LiffButton
          onClick={searchArticles}
          disabled={!query.trim() || pending}
          variant="primary"
          size="medium"
          fullWidth
          style={{ marginTop: '8px' }}
        >
          {pending ? "検索中..." : "記事を検索"}
        </LiffButton>
      </div>

      {/* エラー表示 */}
      {error && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#FFF5F5',
          border: '1px solid #FECACA',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>
            ⚠️ {error}
          </p>
        </div>
      )}

      {/* 検索結果 */}
      {results && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>検索結果: {results.totalCount}件</span>
            <span style={{ fontSize: '12px' }}>
              {selectedArticles.length}件選択中
            </span>
          </div>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {results.articles.map((article, index) => {
              const isSelected = selectedArticles.some(a => a.url === article.url);
              return (
                <div
                  key={index}
                  style={{
                    border: isSelected ? '2px solid #FF6B9D' : '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '12px',
                    backgroundColor: isSelected ? '#FFF0F4' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => toggleArticleSelection(article)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleArticleSelection(article)}
                      style={{ marginTop: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        margin: '0 0 4px 0',
                        color: '#111827'
                      }}>
                        {article.title}
                      </h4>
                      <p style={{ 
                        fontSize: '12px', 
                        color: '#6B7280', 
                        margin: '0 0 4px 0',
                        lineHeight: '1.4'
                      }}>
                        {article.summary}
                      </p>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#9CA3AF',
                        marginTop: '4px'
                      }}>
                        関連度: {article.relevance}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {selectedArticles.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <LiffButton
                onClick={createArticle}
                disabled={pending}
                variant="primary"
                size="large"
                fullWidth
              >
                {pending ? "作成中..." : `選択した${selectedArticles.length}件の記事をまとめる`}
              </LiffButton>
            </div>
          )}
        </div>
      )}
    </LiffCard>
  );
}
