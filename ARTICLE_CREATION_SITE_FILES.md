# 記事作成サポートサイト関連ファイル

このドキュメントには、記事作成サポートサイト（LIFFアプリ）に関連するすべてのファイルが含まれています。

## ファイル一覧

1. **`src/app/action/page.tsx`** - メインのLIFFアプリページ（1154行）
2. **`src/app/action/action.css`** - スタイルファイル（793行）
3. **`src/app/layout.tsx`** - ルートレイアウト（31行）
4. **`src/app/globals.css`** - グローバルスタイル（208行）

---

## 1. src/app/action/page.tsx

```typescript
'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import './action.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'submitted' | 'error';

type QATurn = {
  question: string;
  answer: string;
  acknowledgment?: string;
};

type OutlineSuggestion = {
  title: string;
  points: string[];
};

type TaskKey = 'warmup' | 'conversation' | 'draft' | 'save' | 'survey';

type HistoryArticle = {
  id: string;
  title: string | null;
  body: string | null;
  word_count: number | null;
  status: 'draft' | 'submitted';
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  pdf_url?: string | null;
};

const _GOOGLE_FORM_URL = 'https://forms.gle/nqzrEALFxcBHoALVA';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return fallback;
}

function ActionPageContent() {
  const searchParams = useSearchParams();
  const queryUserId = searchParams.get('user_id') || searchParams.get('uid') || '';
  const token = searchParams.get('token');

  const [userId, setUserId] = useState<string>('');
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft');
  const [_submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initializingUser, setInitializingUser] = useState<boolean>(true);
  const [_saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [_message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [_qaTurns, setQaTurns] = useState<QATurn[]>([]);
  const [_currentQuestion, setCurrentQuestion] = useState<string>('');
  const [_currentAnswer, setCurrentAnswer] = useState<string>('');
  const [_questionLoading, setQuestionLoading] = useState<boolean>(false);
  const [_showOutlinePrompt, setShowOutlinePrompt] = useState<boolean>(false);
  const [_isGeneratingOutline, setIsGeneratingOutline] = useState<boolean>(false);
  const [_outlineSuggestions, setOutlineSuggestions] = useState<OutlineSuggestion[]>([]);
  const [leadSuggestion, setLeadSuggestion] = useState<string>('');
  const [themeSuggestion, setThemeSuggestion] = useState<string>('');
  const [_warmupMood, _setWarmupMood] = useState<string>('');
  const [_warmupNote, _setWarmupNote] = useState<string>('');
  const [_warmupComplete, setWarmupComplete] = useState<boolean>(false);
  const [_memoText, _setMemoText] = useState<string>('');
  const [_history, setHistory] = useState<HistoryArticle[]>([]);
  const [_historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [_previewArticle, _setPreviewArticle] = useState<HistoryArticle | null>(null);
  const [pauseAfterOutline, setPauseAfterOutline] = useState<boolean>(false);
  const [_manualProgress, _setManualProgress] = useState<boolean>(false);
  const [_showCorrectionReminder, setShowCorrectionReminder] = useState<boolean>(false);
  const [correctionMode, setCorrectionMode] = useState<boolean>(false);
  const latestAnswerRef = useRef<string>('');
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const refreshHistory = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setHistoryLoading(true);
      // user_idで履歴を取得（セキュリティのため）
      const res = await fetch(`/api/coach/history?user_id=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setHistory(data.articles || []);
      }
    } catch (err) {
      console.error('[ACTION] History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [userId]);

  const _tasks = useMemo(() => (
    [
      { key: 'warmup' as TaskKey, label: 'ウォームアップ', done: _warmupComplete },
      { key: 'conversation' as TaskKey, label: 'momoとの対話', done: _qaTurns.length >= 3 },
      { key: 'draft' as TaskKey, label: '下書きを書く', done: body.trim().length >= 200 },
      { key: 'save' as TaskKey, label: 'マイページに保存', done: status === 'submitted' },
      { key: 'survey' as TaskKey, label: 'アンケート回答', done: false },
    ]
  ), [_warmupComplete, _qaTurns.length, body, status]);

  // Resolve user id from query parameter or temporary token
  useEffect(() => {
    let active = true;

    async function resolveUser() {
      try {
        // トークンが優先（セキュリティのため）
        if (token) {
          const res = await fetch(`/api/auth/token?token=${encodeURIComponent(token)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.user_id && active) {
              setUserId(data.user_id);
              return;
            } else {
              // トークン検証に失敗した場合、エラーを表示
              if (active) {
                setError('トークンの検証に失敗しました。LINE Bot から再度アクセスしてください。');
              }
              return;
            }
          } else {
            // トークン検証のHTTPエラー
            const errorData = await res.json().catch(() => ({}));
            console.error('[ACTION] Token validation failed:', res.status, errorData);
            if (active) {
              setError('トークンの検証に失敗しました。LINE Bot から再度アクセスしてください。');
            }
            return;
          }
        }

        // トークンがない場合、queryUserIdは使用しない（セキュリティのため）
        // ただし、開発環境ではフォールバックを許可（オプション）
        if (queryUserId && process.env.NODE_ENV === 'development') {
          console.warn('[ACTION] Using queryUserId in development mode. This should not be used in production.');
          if (!active) return;
          setUserId(queryUserId);
          return;
        }

        // トークンもqueryUserIdもない場合、エラー
        if (active) {
          setError('ユーザー情報を取得できませんでした。LINE Bot から再度アクセスしてください。');
        }
      } catch (err) {
        console.error('[ACTION] Failed to resolve user:', err);
        if (active) {
          setError(getErrorMessage(err, 'ユーザー情報の取得に失敗しました。LINE Bot から再度アクセスしてください。'));
        }
      } finally {
        if (active) {
          setInitializingUser(false);
        }
      }
    }

    resolveUser();

    return () => {
      active = false;
    };
  }, [queryUserId, token]);

  useEffect(() => {
    if (!userId || initializingUser) return;

    let aborted = false;

    (async () => {
      setLoading(true);
      setError('');

      try {
        const startRes = await fetch('/api/coach/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            form_version: 'pen-effect-web',
          }),
        });

        const startData = await startRes.json();
        if (!startRes.ok || !startData.ok) {
          throw new Error(startData?.error || '記事コーチの初期化に失敗しました');
        }

        if (aborted) return;

        setParticipantId(startData.participant_id || null);
        if (startData.article_id) {
          setArticleId(startData.article_id);
        }

        const statusRes = await fetch(`/api/coach/status?user_id=${encodeURIComponent(userId)}`);
        const statusData = await statusRes.json();

        if (!statusRes.ok || !statusData.ok) {
          throw new Error(statusData?.error || 'コーチ状態の取得に失敗しました');
        }

        if (aborted) return;

        setParticipantId(statusData.participant_id || null);
        if (statusData.article_id) {
          setArticleId(statusData.article_id);
        }

        setTitle(statusData.title || '');
        setBody(statusData.body || '');
        setStatus(statusData.status === 'submitted' ? 'submitted' : 'draft');
        setSubmittedAt(statusData.submitted_at || null);

        refreshHistory();
      } catch (err) {
        console.error('[ACTION] Bootstrap error:', err);
        if (!aborted) {
          setError(getErrorMessage(err, 'ページの初期化に失敗しました'));
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [userId, initializingUser, refreshHistory]);

  // 初回の対話を開始
  useEffect(() => {
    if (!_warmupComplete || loading || initializingUser || !userId) {
      return;
    }

    if (_qaTurns.length === 0 && !_currentQuestion) {
      fetchNextQuestion([], { force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initializingUser, userId, _warmupComplete]);

  const wordCount = useMemo(() => {
    return body ? body.replace(/\s+/g, '').length : 0;
  }, [body]);

  const _conversationReady = _qaTurns.length >= 3;
  // 編集可能条件：会話が3回以上あるか、既に保存済みの記事がある場合
  // articleIdが存在する場合は常に編集可能（保存済み記事の編集を許可）
  const _canEdit = Boolean(userId && articleId && !loading);

  const _moodPresets = [
    { value: 'いい感じ', label: 'いい感じ！気分が良い' },
    { value: 'まあまあ', label: 'まあまあ' },
    { value: 'ドキドキ', label: 'ちょっとドキドキ' },
    { value: 'しんどい◆', label: 'しんどい、気分が悪い' },
    { value: 'わからない', label: 'わからない。まだ整理できていない' },
  ];

  function _handleWarmupSubmit() {
    if (!_warmupMood) {
      setMessage('momo: 気分を選んでから1つずつ進めていきましょう。まずは気分を選んでください。');
      return;
    }
    setWarmupComplete(true);
    setMessage(`momo: ${_warmupMood}を選んでくれてありがとう。それでは、momoとの対話を始めましょう。`);
  }

  async function fetchNextQuestion(previous: QATurn[], options?: { force?: boolean }) {
    if (pauseAfterOutline && !options?.force) {
      return;
    }
    try {
      setQuestionLoading(true);
      const res = await fetch('/api/coach/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousAnswers: previous,
          currentStep: previous.length,
          warmupMood: previous.length === 0 ? _warmupMood : undefined,
          warmupNote: previous.length === 0 ? _warmupNote : undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        const nextQuestion = data.question ?? '';

        setCurrentQuestion(nextQuestion);
        if (data.suggestedTheme) {
          setThemeSuggestion(data.suggestedTheme);
        }
      } else {
        setCurrentQuestion('');
      }
    } catch (err) {
      console.error('[ACTION] Failed to fetch question:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ACTION] Error details:', { errorMessage, model: 'gpt-4.1-mini' });
      setCurrentQuestion('');
      // エラーメッセージは表示しない（ユーザーに不安を与えないため）
    } finally {
      setQuestionLoading(false);
    }
  }

  async function _handleAnswerSubmit() {
    const trimmed = _currentAnswer.trim();
    if (!trimmed || !_currentQuestion) return;

    const draftTurns = [..._qaTurns, { question: _currentQuestion, answer: trimmed }];
    setQaTurns(draftTurns);
    setCurrentAnswer('');
    setCurrentQuestion('');
    latestAnswerRef.current = trimmed;
    setMessage('momo: 回答を受け取りました。次の質問を考えています...');

    let ackText = 'momo: ありがとうございます。';

    try {
      const ackRes = await fetch('/api/coach/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: _currentQuestion,
          answer: trimmed,
        }),
      });
      const ackData: { message?: string } = await ackRes.json();
      if (ackRes.ok && ackData.message && ackData.message.trim().length > 0) {
        ackText = ackData.message;
      }
    } catch (err) {
      console.error('[ACTION] Acknowledgment error:', err);
    }

    const personalizedAck = (() => {
      if (ackText !== 'momo: ありがとうございます。') {
        return ackText;
      }
      const snippet = trimmed.length > 36 ? `${trimmed.slice(0, 36)}…` : trimmed;
      return `momo: 「${snippet}」について、もう少し詳しく教えてください。`;
    })();

    const acknowledgedTurns = draftTurns.map((turn, index) => (
      index === draftTurns.length - 1 ? { ...turn, acknowledgment: personalizedAck } : turn
    ));
    setQaTurns(acknowledgedTurns);
    setMessage(personalizedAck);

    if (acknowledgedTurns.length % 3 === 0) {
      setShowOutlinePrompt(true);
      setPauseAfterOutline(true);
      setShowCorrectionReminder(true);
      setMessage('momo: 3つの質問に答えていただき、ありがとうございました。対話の内容から、記事の構成案を作ることができます。');
    } else {
      if (correctionMode) {
        setCorrectionMode(false);
        fetchNextQuestion(acknowledgedTurns, { force: true });
      } else {
        fetchNextQuestion(acknowledgedTurns);
      }
    }
  }

  function _handleOutlinePromptDecline() {
    setShowOutlinePrompt(false);
    fetchNextQuestion(_qaTurns);
  }

  async function _handleOutlinePromptAccept() {
    if (!participantId) {
      setMessage('ユーザー情報を取得できませんでした。ページを再読み込みしてください。');
      setShowOutlinePrompt(false);
      return;
    }

    setIsGeneratingOutline(true);
    setMessage('');

    try {
      const res = await fetch('/api/coach/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participantId,
          article_id: articleId,
          qa_context: _qaTurns,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error('[ACTION] Outline generation failed:', res.status, data);
        console.error('[ACTION] Request data:', {
          participant_id: participantId,
          article_id: articleId,
          qa_context_length: _qaTurns?.length || 0,
        });
        const errorMessage = data?.details || data?.error || 'アウトラインの生成に失敗しました';
        const errorCode = data?.code || 'UNKNOWN';
        console.error('[ACTION] Error code:', errorCode);
        throw new Error(errorMessage);
      }

      const outlines = (data.outlines || []) as OutlineSuggestion[];
      if (!outlines || outlines.length === 0) {
        console.warn('[ACTION] No outlines returned from API');
        throw new Error('アウトラインが生成されませんでした。もう一度お試しください。');
      }
      setOutlineSuggestions(outlines);
      setLeadSuggestion('');
      setShowCorrectionReminder(true);

      if (outlines.length > 0) {
        const primary = outlines[0];
        if (!title) {
          setTitle(primary.title);
        }

        // リード文を生成
        const leadRes = await fetch('/api/coach/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'lead',
            context: {
              theme: themeSuggestion || primary.title,
              outline: primary.points,
              tone: '優しい',
            },
          }),
        });

        const leadData = await leadRes.json();
        if (leadRes.ok && leadData.ok && leadData.suggestion) {
          setLeadSuggestion(leadData.suggestion as string);
        }
      }
      
      setMessage('momo: アウトラインを作成しました。これを使って本文を書いてみてください。よければ、もう少し深掘りにお付き合いください。');
      
      // アウトライン生成後、次の質問を生成（深掘りの質問）
      setPauseAfterOutline(false);
      await fetchNextQuestion(_qaTurns, { force: true });
    } catch (err: any) {
      console.error('[ACTION] Outline generation error:', err);
      console.error('[ACTION] Error message:', err?.message);
      console.error('[ACTION] Error stack:', err?.stack);
      
      // エラーメッセージを詳細に表示
      const errorMessage = err?.message || 'アウトラインの生成に失敗しました';
      setMessage(`エラー: ${errorMessage}`);
    } finally {
      setIsGeneratingOutline(false);
      setShowOutlinePrompt(false);
      setCurrentQuestion('');
    }
  }

  function _applyOutline(outline: OutlineSuggestion) {
    if (!outline) return;
    
    // タイトルを置き換え（既存のタイトルがあっても置き換える）
    setTitle(outline.title);

    const outlineText = outline.points.map((point, idx) => `${idx + 1}. ${point}`).join('\n');
    const intro = leadSuggestion ? `${leadSuggestion}\n\n` : '';
    // 本文を置き換え（既存の本文があっても置き換える）
    setBody(`${intro}${outlineText}\n\nここから本文を書いてみてください。`);
    
    setMessage('momo: アウトラインを適用しました。本文を書いてみてください。');
  }

  function _handleContinueDialogue() {
    setPauseAfterOutline(false);
    setCorrectionMode(true);
    setShowCorrectionReminder(false);
    setCurrentQuestion('修正したい点があれば、対話を続けることもできます。');
    setMessage('momo: ありがとうございます。対話を続けましょう。');
    requestAnimationFrame(() => {
      conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function _handleGeneratePdf(targetArticle: HistoryArticle) {
    if (!userId) {
      setMessage('momo: PDFを生成するにはLINEからアクセスしてください。');
      return;
    }

    if (!targetArticle.body) {
      setMessage('momo: この記事には本文がありません。');
      return;
    }

    setMessage('momo: PDFを生成しています...');

    try {
      const res = await fetch('/api/coach/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          article_id: targetArticle.id,
          title: targetArticle.title || '無題',
          content: targetArticle.body,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'PDFの生成に失敗しました');
      }

      setMessage('momo: PDFを作成しました。マイページで確認できます。');
      await refreshHistory();
    } catch (err) {
      console.error('[ACTION] PDF generation error:', err);
      setMessage(getErrorMessage(err, 'PDFの生成に失敗しました'));
    }
  }

  function copyArticleBody(article: HistoryArticle) {
    if (!article.body || article.body.trim().length === 0) {
      setMessage('momo: この記事には本文がありません。');
      return;
    }

    // クリップボードにコピー
    navigator.clipboard.writeText(article.body).then(() => {
      setMessage('momo: 本文をクリップボードにコピーしました。');
    }).catch((err) => {
      console.error('[ACTION] Failed to copy text:', err);
      setMessage('momo: コピーに失敗しました。');
    });
  }

  async function loadArticleForEdit(article: HistoryArticle) {
    if (!userId || !article.id) return;

    try {
      // 記事の詳細を取得
      const res = await fetch(`/api/coach/history?user_id=${encodeURIComponent(userId)}`);
      const data = await res.json();
      
      if (res.ok && data.ok) {
        const targetArticle = data.articles?.find((a: HistoryArticle) => a.id === article.id);
        if (targetArticle) {
          // 記事を編集画面に読み込む
          setArticleId(targetArticle.id);
          setTitle(targetArticle.title || '');
          setBody(targetArticle.body || '');
          // 過去の記事を編集する場合は、statusを'draft'に変更して編集可能にする
          setStatus('draft');
          setSubmittedAt(targetArticle.submitted_at || null);
          setSaveStatus('idle');
          setMessage('momo: 記事を読み込みました。編集できます。');
          
          // ページの上部にスクロール
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setMessage('momo: 記事が見つかりませんでした。');
        }
      }
    } catch (err) {
      console.error('[ACTION] Failed to load article:', err);
      setMessage('momo: 記事の読み込みに失敗しました。');
    }
  }

  async function createNewArticle() {
    if (!userId) return;

    try {
      const startRes = await fetch('/api/coach/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          form_version: 'pen-effect-web',
        }),
      });

      const startData = await startRes.json();
      if (startRes.ok && startData.ok) {
        // 新しい記事の状態にリセット
        setArticleId(startData.article_id || null);
        setParticipantId(startData.participant_id || null);
        setTitle('');
        setBody('');
        setStatus('draft');
        setSubmittedAt(null);
        setQaTurns([]);
        setCurrentQuestion('');
        setCurrentAnswer('');
        setWarmupComplete(false);
        _setWarmupMood('');
        _setWarmupNote('');
        setSaveStatus('idle');
        setMessage('momo: 新しい記事を作成しました。momoとの対話を始めましょう。');
      }
    } catch (err) {
      console.error('[ACTION] Failed to create new article:', err);
    }
  }

  async function _handleSave(markSubmitted = false) {
    if (!articleId) {
      setMessage('記事情報の取得に失敗しました。ページを再読み込みしてください。');
      return;
    }

    if (!body.trim()) {
      setMessage('本文を入力してください。');
      return;
    }

    setSaveStatus('saving');
    setMessage('');

    try {
      const res = await fetch('/api/coach/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: articleId,
          title: title.trim() ? title.trim() : undefined,
          body,
          word_count: wordCount,
          status: markSubmitted ? 'submitted' : 'draft',
        }),
      });

      if (!res.ok) {
        throw new Error('保存に失敗しました');
      }

      if (markSubmitted) {
        setSaveStatus('submitted');
        setStatus('submitted');
        setSubmittedAt(new Date().toISOString());
        setMessage('momo: 記事を保存しました。アンケートに回答していただけると嬉しいです。');
        // 新しい記事を作成するために状態をリセット
        await createNewArticle();
      } else {
        setSaveStatus('saved');
        setMessage('momo: 下書きを保存しました。いつでも編集できます。');
      }

      await refreshHistory();
    } catch (err) {
      console.error('[ACTION] Save error:', err);
      setSaveStatus('error');
      setMessage(getErrorMessage(err, '保存に失敗しました'));
    }
  }

  if (initializingUser) {
    return (
      <div className="action-wrapper">
        <div className="action-card loading">
          <div className="spinner" />
          <p>momoを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    return (
      <div className="action-wrapper">
        <div className="action-card error">
          <h1>エラーが発生しました</h1>
          <p>{error}</p>
          <p className="action-hint">LINE Botから再度アクセスしてください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="action-wrapper">
      <header className="action-header">
        <div>
          <h1>momo - 記事作成サポート</h1>
          <p>記事を書いて、momoと対話しながら、あなたの体験を共有してみてください。</p>
        </div>
        <a
          className="action-link"
          href={_GOOGLE_FORM_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          アンケートに回答
        </a>
      </header>

      <div className="action-layout">
        <section className="action-editor">
          <div className="action-card task-card">
            <h2>記事の進め方</h2>
            <ul className="task-list">
              {_tasks.map((task, index) => {
                const prevIncomplete = !_manualProgress && _tasks.slice(0, index).some((t) => !t.done);
                return (
                  <li key={task.key} className={`${task.done ? 'done' : ''} ${prevIncomplete ? 'locked' : ''}`}>
                    <span className="task-check">{task.done ? '✓' : prevIncomplete ? '🔒' : '○'}</span>
                    <span>{task.label}</span>
                  </li>
                );
              })}
            </ul>
            {!_manualProgress && (
              <button
                type="button"
                className="task-free-toggle"
                onClick={() => _setManualProgress(true)}
              >
                順番を自由に進める
              </button>
            )}
          </div>

          <div className="action-card warmup-card">
            <h2>ウォームアップ</h2>
            <p>今日、記事を書く気分をmomoに伝えてみてください。今日の気分を選んで、momoとの対話を始めましょう。気分がまだ整理できていない場合は、スキップして進むこともできます。</p>
            <p className="warmup-note">※ 気分は後から変更できます。momoとの対話を通じて、気分を整理していきましょう。</p>
            <div className="mood-buttons">
              {_moodPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`mood-button ${_warmupMood === preset.value ? 'active' : ''}`}
                  onClick={() => _setWarmupMood(preset.value)}
                  disabled={_warmupComplete}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              className="textarea"
              rows={3}
              placeholder="記事について、気分や考えを書いてみてください"
              value={_warmupNote}
              onChange={(e) => _setWarmupNote(e.target.value)}
              disabled={_warmupComplete}
            />
            <p className="warmup-meta-note">※ メモは後から変更できます。気分を選んでから進みましょう。</p>
            {!_warmupComplete ? (
              <div className="warmup-actions">
                <button
                  type="button"
                  className="primary warmup-submit"
                  onClick={_handleWarmupSubmit}
                >
                  ウォームアップを完了する
                </button>
                <button
                  type="button"
                  className="secondary warmup-skip"
                  onClick={() => {
                    setWarmupComplete(true);
                    _setWarmupMood('スキップ');
                    setMessage('momo: OK、スキップします。それでは、momoとの対話を始めましょう。');
                  }}
                >
                  気分はスキップする
                </button>
              </div>
            ) : (
              <div className="warmup-complete">完了しました。momoとの対話を始めましょう。気分は後から変更できます。</div>
            )}
          </div>

          <div className="action-card conversation-card" ref={conversationRef}>
            <h2>momoとの対話</h2>
            <p>質問に答えて、momoと対話しながら、あなたの体験を共有してみてください。気分や考えをそのまま書いても大丈夫です。</p>
            <p className="qa-note">※ momoの質問に答えて、対話を続けていきましょう。気分が変わったら、対話を通じて修正することもできます。</p>

            {!_warmupComplete && !_manualProgress && (
              <div className="conversation-lock">
                <p>ウォームアップを完了してから、対話を始めましょう。</p>
              </div>
            )}

            <div className="qa-entries">
              {_qaTurns.map((turn, index) => (
                <div key={`${turn.question}-${index}`} className="qa-entry">
                  <div className="qa-question">Q{index + 1}. {turn.question}</div>
                  <div className="qa-answer">A. {turn.answer}</div>
                  {turn.acknowledgment && (
                    <div className="qa-ack">momo: {turn.acknowledgment.replace(/^momo:\s*/i, '')}</div>
                  )}
                </div>
              ))}
            </div>

            {_showOutlinePrompt ? (
              <div className="outline-prompt">
                <p>3つの質問に答えていただき、ありがとうございました。記事の構成案を作ることができます。</p>
                <div className="prompt-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={_handleOutlinePromptAccept}
                    disabled={_isGeneratingOutline}
                  >
                    {_isGeneratingOutline ? '生成中...' : 'はい、お願いします'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={_handleOutlinePromptDecline}
                    disabled={_isGeneratingOutline}
                  >
                    後で考える
                  </button>
                </div>
              </div>
            ) : (
              <div className="qa-input">
                <div className="qa-current-question">
                  {_questionLoading
                    ? 'momoが質問を考えています...'
                    : _warmupComplete
                      ? (_currentQuestion || '')
                      : 'まず、ウォームアップを完了してから対話を始めましょう。'}
                </div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={_currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="答えたいことを自由に書いてみてください。気分や考えをそのまま書いても大丈夫です。"
                  disabled={_questionLoading || status === 'submitted' || !_warmupComplete}
                />
                <div className="qa-actions">
                  <button
                    type="button"
                    className="primary send-button"
                    onClick={_handleAnswerSubmit}
                    disabled={_questionLoading || !_currentAnswer.trim() || status === 'submitted' || !_warmupComplete}
                  >
                    <span className="send-icon" aria-hidden>📤</span>
                    <span>送信</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {_outlineSuggestions.length > 0 && (
            <div className="action-card outline-card">
              <h2>生成されたアウトライン</h2>
              <p>momoが対話の内容から、記事の構成案を作りました。これを使って本文を書いてみてください。</p>
              
              {leadSuggestion && (
                <div className="lead-suggestion">
                  <h3>リード文の提案</h3>
                  <p>{leadSuggestion}</p>
                </div>
              )}
              
              <div className="outline-list">
                {_outlineSuggestions.map((outline, index) => (
                  <div key={`${outline.title}-${index}`} className="outline-item">
                    <div className="outline-title">{outline.title}</div>
                    <ul>
                      {outline.points.map((point, pointIndex) => (
                        <li key={pointIndex}>{point}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => _applyOutline(outline)}
                      disabled={status === 'submitted'}
                    >
                      このアウトラインを使う
                    </button>
                  </div>
                ))}
              </div>
              
              <p className="outline-note">※ このアウトラインを使って本文を書いてみてください。momoとの対話を通じて、さらに詳しく話すこともできます。</p>
              <button
                type="button"
                className="secondary"
                onClick={_handleContinueDialogue}
                disabled={_isGeneratingOutline}
              >
                momoと対話を続ける
              </button>
            </div>
          )}

          {loading ? (
            <div className="action-card loading">
              <div className="spinner" />
              <p>記事を読み込んでいます...</p>
            </div>
          ) : (
            <>
              <div className="action-card">
                <label className="field-label" htmlFor="article-title">タイトル</label>
                <input
                  id="article-title"
                  className="text-input"
                  type="text"
                  value={title}
                  placeholder="対話の内容から、タイトルを考えてみてください"
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!_canEdit}
                />
              </div>

              <div className="action-card">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="article-body">本文</label>
                  <span className="word-count">{wordCount}文字</span>
                </div>
                {!_conversationReady && !articleId && (
                  <div className="conversation-warning">
                    <p>まず、momoとの対話を3回以上進めてから、本文を書くことができます。</p>
                  </div>
                )}
                <textarea
                  id="article-body"
                  className="textarea"
                  value={body}
                  placeholder="記事について、気分や考えを自由に書いてみてください"
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  disabled={!_canEdit}
                />
                <p className="field-hint">※ 300〜500文字程度を目安に書いてみてください。</p>
              </div>

              <div className="action-card memo-card">
                <h2>メモ</h2>
                <p>書いた内容をメモに残しておくと、後から見返すことができます。メモは記事には含まれません。</p>
                <textarea
                  className="textarea"
                  rows={6}
                  value={_memoText}
                  onChange={(e) => _setMemoText(e.target.value)}
                  placeholder="気分や考えをメモに残しておきたいことを書いてみてください"
                />
              </div>

              <div className="action-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => _handleSave(false)}
                  disabled={!_canEdit || _saveStatus === 'saving'}
                >
                  {_saveStatus === 'saving' ? '保存中...' : '下書きとして保存する'}
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() => _handleSave(true)}
                  disabled={!_canEdit || _saveStatus === 'saving'}
                >
                  マイページに保存する
                </button>

                {status === 'submitted' && _submittedAt && (
                  <div className="action-card success">
                    <h2>保存が完了しました</h2>
                    <p>保存日時: {new Date(_submittedAt).toLocaleString('ja-JP')}</p>
                    <p className="action-hint">アンケートに回答していただけると嬉しいです。</p>
                    <a
                      className="action-link"
                      href={_GOOGLE_FORM_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      アンケートに回答する
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="action-sidebar">
          <div className="action-card info">
            <h2>アンケートについて</h2>
            <p>記事を書いて、Google フォームで記事の体験を共有してください。momo の記事作成サポートが向上します。</p>
            <a
              className="action-link"
              href={_GOOGLE_FORM_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              ペンを持つ効果 アンケート
            </a>
          </div>

          <div className="action-card info">
            <h2>記事作成のコツ</h2>
            <ul className="hint-list">
              <li>気分が悪いときは、ウォームアップをスキップして、対話から始めることもできます。</li>
              <li>気分が変わったら、momoとの対話を通じて、気分を整理していきましょう。</li>
              <li>下書きとして保存して、いつでも編集できます。マイページに保存して、アンケートに回答してください。</li>
            </ul>
          </div>

          <div className="action-card history-card">
            <h2>過去の記事</h2>
            {_historyLoading && <p>momoが読み込んでいます...</p>}
            {!_historyLoading && _history.length === 0 && (
              <p>まだ保存した記事がありません。momoとの対話を通じて、記事を作成してみてください。</p>
            )}
            {!_historyLoading && _history.length > 0 && (
              <div className="history-list">
                {_history.map((article) => (
                  <div key={article.id} className="history-item">
                    <div className="history-header">
                      <div>
                        <div className="history-title">{article.title || 'タイトルなし'}</div>
                        <div className="history-meta">
                          <span>{article.status === 'submitted' ? 'マイページに保存' : '下書き'}</span>
                          <span>{new Date(article.updated_at).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</span>
                        </div>
                      </div>
                      {article.word_count !== null && (
                        <div className="history-count">{article.word_count}文字</div>
                      )}
                    </div>
                    <div className="history-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => loadArticleForEdit(article)}
                      >
                        この記事を編集する
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => _setPreviewArticle(article)}
                      >
                        本文を確認
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => copyArticleBody(article)}
                      >
                        本文をコピー
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="secondary"
              style={{ marginTop: '12px', width: '100%' }}
              onClick={() => window.open('/me', '_blank')}
            >
              マイページに保存した記事を確認する
            </button>
          </div>
        </aside>
      </div>

      {_message && (
        <div className="action-message-container">
          <div className={`action-message ${_saveStatus === 'error' ? 'error' : ''}`}>
            {_message}
          </div>
        </div>
      )}

      {_previewArticle && (
        <div className="preview-overlay" onClick={() => _setPreviewArticle(null)}>
          <div className="preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h2>{_previewArticle.title || 'タイトルなし'}</h2>
              <button type="button" onClick={() => _setPreviewArticle(null)}>閉じる</button>
            </div>
            <div className="preview-meta">
              <span>{_previewArticle.status === 'submitted' ? 'マイページに保存' : '下書き'}</span>
              <span>{new Date(_previewArticle.updated_at).toLocaleString('ja-JP')}</span>
            </div>
            <div className="preview-body">
              {_previewArticle.body?.split(/\n+/).map((para, idx) => (
                <p key={idx}>{para}</p>
              )) || <p>本文がまだ保存されていません。</p>}
            </div>
            <div className="preview-actions">
              <button
                type="button"
                className="primary"
                onClick={() => copyArticleBody(_previewArticle)}
              >
                本文をコピー
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function ActionPage() {
  return (
    <Suspense
      fallback={
        <div className="action-wrapper">
          <div className="action-card loading">
            <div className="spinner" />
            <p>momoを読み込んでいます...</p>
          </div>
        </div>
      }
    >
      <ActionPageContent />
    </Suspense>
  );
}
```

---

## 2. src/app/action/action.css

```css
/* ChatGPT/Gemini風のUIデザイン */

.action-wrapper {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff5f8 0%, #ffffff 60%);
  padding: 32px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.action-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 960px;
  margin: 0 auto;
}

.action-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.action-header p {
  font-size: 15px;
  color: #4b5563;
  margin: 0;
}

.action-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #ff2d75;
  text-decoration: none;
  margin-left: auto;
}

.action-link:hover {
  text-decoration: underline;
}

.action-layout {
  display: grid;
  gap: 24px;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .action-layout {
    grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
    align-items: flex-start;
  }
}

.action-editor,
.action-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.action-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(255, 107, 157, 0.12);
  box-shadow: 0 16px 34px -18px rgba(255, 107, 157, 0.35);
  padding: 24px;
}

.action-card.loading,
.action-card.error {
  text-align: center;
  color: #4b5563;
}

.action-card.success {
  border: 1px solid rgba(34, 197, 94, 0.2);
  box-shadow: 0 16px 38px -18px rgba(34, 197, 94, 0.35);
}

.action-card.info {
  background: linear-gradient(135deg, rgba(255, 122, 162, 0.12), rgba(255, 196, 219, 0.2));
  border: 1px solid rgba(255, 107, 157, 0.18);
}

.action-card h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px;
  color: #111827;
}

.action-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: #111827;
}

.action-card p {
  margin: 0 0 8px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
}

.action-hint {
  font-size: 13px;
  color: #6b7280;
  margin-top: 6px;
}

.field-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.word-count {
  font-size: 13px;
  color: #6b7280;
}

.text-input,
.textarea {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #ffffff;
  padding: 14px 16px;
  font-size: 15px;
  color: #111827;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.textarea {
  resize: vertical;
  min-height: 280px;
  line-height: 1.6;
}

.text-input:focus,
.textarea:focus {
  border-color: #ff7aa2;
  box-shadow: 0 0 0 3px rgba(255, 122, 162, 0.15);
  outline: none;
}

.text-input:disabled,
.textarea:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.field-hint {
  margin-top: 10px;
  font-size: 13px;
  color: #6b7280;
}

.action-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 640px) {
  .action-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}

.action-actions button {
  flex: 1;
  min-height: 48px;
  border-radius: 14px;
  border: none;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.action-actions button.primary {
  background: linear-gradient(135deg, #ff7aa2 0%, #ff4894 100%);
  color: #ffffff;
  box-shadow: 0 14px 32px -16px rgba(255, 72, 148, 0.5);
}

.action-actions button.primary:hover {
  transform: translateY(-1px);
}

.action-actions button.secondary {
  background: #ffffff;
  color: #ff2d75;
  border: 1px solid rgba(255, 107, 157, 0.4);
}

.action-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.action-message {
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  color: #0f172a;
  background: rgba(59, 130, 246, 0.08);
}

.action-message.error {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.hint-list {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
}

.hint-list li {
  margin-bottom: 6px;
}

.task-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #4b5563;
}

.task-list li.done {
  color: #059669;
  font-weight: 600;
}

.task-list li.locked {
  color: #9ca3af;
}

.task-list li.locked .task-check {
  background: rgba(156, 163, 175, 0.18);
  color: #9ca3af;
}

.task-free-toggle {
  margin-top: 8px;
  font-size: 12px;
  color: #2563eb;
  background: transparent;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  align-self: flex-end;
}

.task-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 12px;
}

.task-list li.done .task-check {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.warmup-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.warmup-note {
  font-size: 13px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  border-left: 3px solid #2563eb;
  padding: 8px 10px;
  border-radius: 8px;
}

.warmup-meta-note {
  font-size: 12px;
  color: #6b7280;
  margin: -6px 0 0;
}

.mood-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.mood-button {
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 107, 157, 0.3);
  background: rgba(255, 122, 162, 0.08);
  color: #ff2d75;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mood-button.active {
  background: linear-gradient(135deg, #ff7aa2 0%, #ff4894 100%);
  color: #ffffff;
  border-color: transparent;
}

.mood-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.warmup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.warmup-submit {
  background: linear-gradient(135deg, #f97316 0%, #f43f5e 100%) !important;
  color: #ffffff !important;
  border: none !important;
  padding: 12px 18px !important;
  font-weight: 600;
  box-shadow: 0 16px 32px -18px rgba(244, 63, 94, 0.5);
}

.warmup-submit:hover {
  transform: translateY(-1px);
}

.warmup-skip {
  margin-left: 12px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  color: #475569;
  background: rgba(248, 250, 252, 0.9);
  padding: 10px 16px;
}

.warmup-skip:hover {
  background: rgba(148, 163, 184, 0.12);
}

.warmup-complete {
  font-size: 14px;
  color: #059669;
}

.conversation-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.qa-entries {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.qa-entry {
  background: rgba(255, 122, 162, 0.08);
  border-radius: 14px;
  padding: 12px 16px;
  border: 1px solid rgba(255, 107, 157, 0.15);
}

.qa-question {
  font-size: 14px;
  font-weight: 600;
  color: #ff2d75;
  margin-bottom: 6px;
}

.qa-answer {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
}

.qa-ack {
  margin-top: 8px;
  font-size: 13px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  border-radius: 10px;
  padding: 8px 12px;
  line-height: 1.6;
}

.qa-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qa-current-question {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.qa-note {
  font-size: 12px;
  color: #6b7280;
  margin: -4px 0 4px;
}

.conversation-lock {
  background: rgba(243, 244, 246, 0.9);
  border: 1px dashed rgba(148, 163, 184, 0.7);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}

.qa-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.outline-prompt {
  background: rgba(255, 122, 162, 0.12);
  border: 1px solid rgba(255, 107, 157, 0.28);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.outline-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.outline-list {
  display: grid;
  gap: 14px;
}

.outline-item {
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 14px;
  padding: 14px 16px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.outline-item ul {
  margin: 0;
  padding-left: 18px;
  color: #374151;
  font-size: 14px;
  line-height: 1.5;
}

.outline-note {
  font-size: 12px;
  color: #2563eb;
  margin: 4px 0 0;
}

.outline-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.outline-item button {
  align-self: flex-start;
  padding: 8px 16px;
}

.memo-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.memo-card textarea {
  background: rgba(249, 250, 251, 0.7);
  border-style: dashed;
}

.history-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-item {
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 12px;
  padding: 12px 14px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.history-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.history-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: #6b7280;
}

.history-count {
  font-size: 11px;
  color: #6b7280;
}

.history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.history-actions .secondary {
  padding: 8px 14px;
}

.action-message-container {
  max-width: 960px;
  margin: 16px auto 0;
}

.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1000;
}

.preview-card {
  background: #ffffff;
  border-radius: 18px;
  max-width: 640px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 24px 48px -16px rgba(15, 23, 42, 0.35);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.preview-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.preview-header button {
  border: none;
  background: transparent;
  color: #ff2d75;
  font-weight: 600;
  cursor: pointer;
}

.preview-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.preview-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.7;
  white-space: pre-wrap;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.preview-actions .primary,
.preview-actions a.primary {
  padding: 10px 18px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #ff7aa2 0%, #ff4894 100%);
  color: #ffffff;
  text-decoration: none;
}

.preview-actions .primary:hover,
.preview-actions a.primary:hover {
  transform: translateY(-1px);
}

.lead-suggestion {
  background: rgba(37, 99, 235, 0.08);
  border-radius: 12px;
  padding: 12px 14px;
  color: #1d4ed8;
  font-size: 14px;
  line-height: 1.6;
}

.conversation-warning {
  background: rgba(255, 122, 162, 0.12);
  border: 1px dashed rgba(255, 107, 157, 0.4);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  color: #b91c1c;
  font-size: 14px;
}

.qa-actions button.primary,
.prompt-actions .primary {
  background: linear-gradient(135deg, #ff7aa2 0%, #ff4894 100%);
  color: #ffffff;
  border: none;
  box-shadow: 0 14px 32px -16px rgba(255, 72, 148, 0.5);
  min-width: 160px;
}

.send-button {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 16px 32px -18px rgba(37, 99, 235, 0.6);
  min-width: 140px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px !important;
  font-weight: 600;
}

.send-icon {
  font-size: 16px;
  transform: rotate(-10deg);
}

.prompt-actions .primary:hover,
.qa-actions button.primary:hover {
  transform: translateY(-1px);
}

.qa-actions button.primary:disabled,
.prompt-actions .primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.prompt-actions .secondary,
.outline-item button.secondary {
  background: #ffffff;
  color: #ff2d75;
  border: 1px solid rgba(255, 107, 157, 0.4);
  padding: 10px 16px;
  border-radius: 12px;
  cursor: pointer;
}

.prompt-actions .secondary:hover,
.outline-item button.secondary:hover {
  background: rgba(255, 122, 162, 0.08);
}

.spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 4px solid rgba(255, 122, 162, 0.25);
  border-top-color: #ff2d75;
  margin: 0 auto 16px;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 3. src/app/layout.tsx

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ResearchBanner from '@/components/ResearchBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Momo LINE Bot',
  description: 'LINE Bot application with OpenAI and Supabase integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ResearchBanner />
        {children}
      </body>
    </html>
  )
}
```

---

## 4. src/app/globals.css

```css
* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}

a {
  color: inherit;
  text-decoration: none;
}

@media (prefers-color-scheme: dark) {
  html {
    color-scheme: dark;
  }
}

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
  
  /* LIFF Design System */
  --color-primary: #FF6B9D;
  --color-primary-light: #FFF0F4;
  --color-secondary: #F3F4F6;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary: #9CA3AF;
  --color-border: #E5E7EB;
  --color-background: #FAFAFA;
  --color-surface: #FFFFFF;
  
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 20px;
  --spacing-2xl: 24px;
  --spacing-3xl: 32px;
  
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
    
    /* Dark mode overrides */
    --color-text-primary: #F9FAFB;
    --color-text-secondary: #D1D5DB;
    --color-text-tertiary: #9CA3AF;
    --color-border: #374151;
    --color-background: #111827;
    --color-surface: #1F2937;
  }
}

/* LIFF specific styles */
.liff-container {
  min-height: 100vh;
  background-color: var(--color-background);
}

.liff-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.liff-button {
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.liff-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.liff-input {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  background-color: var(--color-surface);
  outline: none;
  transition: border-color 0.2s ease;
}

.liff-input:focus {
  border-color: var(--color-primary);
}

.liff-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--color-border);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.liff-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.liff-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Loading animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.liff-loading {
  animation: spin 1s linear infinite;
}

/* Responsive design */
@media (max-width: 480px) {
  .liff-container {
    padding: var(--spacing-sm);
  }
  
  .liff-card {
    margin: var(--spacing-sm);
  }
  
  .liff-button {
    font-size: var(--font-size-sm);
    padding: var(--spacing-sm) var(--spacing-md);
  }
}

@media (max-width: 320px) {
  .liff-container {
    padding: var(--spacing-xs);
  }
  
  .liff-card {
    margin: var(--spacing-xs);
    padding: var(--spacing-sm);
  }
}
```

---

## 補足情報

### 使用技術
- **Next.js 14** (App Router)
- **React 18** (Hooks)
- **TypeScript**
- **CSS Modules** (action.css)
- **Google Fonts** (Inter)

### 主な機能
1. **ウォームアップ**: 気分選択とメモ入力
2. **momoとの対話**: AIによる質問生成と回答受付
3. **アウトライン生成**: 対話内容から記事構成案を生成
4. **記事編集**: タイトルと本文の編集
5. **保存機能**: 下書き保存とマイページへの保存
6. **過去記事管理**: 過去の記事の閲覧・編集・コピー

### デザインの特徴
- ピンク系のグラデーション（#ff7aa2, #ff4894）
- カード型レイアウト
- レスポンシブデザイン（モバイル・デスクトップ対応）
- アニメーション効果（ホバー、ローディング）

---

このドキュメントを他のAIエージェントに渡して、デザインを改善することができます。

