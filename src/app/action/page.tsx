'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
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

type StepId = 'intro' | 'warmup' | 'chat' | 'outline' | 'draft' | 'complete';

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

// StickyFooterコンポーネント（ファイルトップレベルで定義）
function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky-footer">
      <div className="sticky-footer-content">{children}</div>
    </div>
  );
}

// チャット入力欄コンポーネント（ファイルトップレベルで定義して再生成を防ぐ）
const ChatInput = memo(function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  questionLoading,
  showOutlinePrompt,
  onOutlinePromptDecline,
  onOutlinePromptAccept,
  isGeneratingOutline,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  questionLoading: boolean;
  showOutlinePrompt: boolean;
  onOutlinePromptDecline: () => void;
  onOutlinePromptAccept: () => void;
  isGeneratingOutline: boolean;
}) {
  return (
    <StickyFooter>
      {showOutlinePrompt ? (
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onOutlinePromptDecline}
            disabled={isGeneratingOutline}
          >
            後で考える
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onOutlinePromptAccept}
            disabled={isGeneratingOutline}
          >
            {isGeneratingOutline ? '生成中...' : '📝 構成案を作る'}
          </button>
        </>
      ) : (
        <div className="chat-input-container">
          <textarea
            key="chat-input-textarea"
            className="chat-input"
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="答えたいことを自由に書いてみてください..."
            disabled={disabled || questionLoading}
          />
          <button
            type="button"
            className="btn-primary btn-send"
            onClick={onSubmit}
            disabled={questionLoading || !value.trim() || disabled}
            aria-label="送信"
          >
            {/* 紙飛行機のSVGアイコン */}
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ transform: 'translateX(-1px) rotate(-10deg)' }}
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      )}
    </StickyFooter>
  );
});

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
  const [selectedOutline, setSelectedOutline] = useState<number | null>(null);
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
  
  // ステップ管理
  const [currentStep, setCurrentStep] = useState<StepId>('intro');
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

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

  // ステップの初期化と同期
  useEffect(() => {
    if (loading || initializingUser || !userId) {
      return;
    }

    // 既に記事が保存済みの場合はcompleteステップ（最優先）
    if (status === 'submitted' && _submittedAt) {
      setCurrentStep('complete');
      return;
    }

    // 本文が既にある場合はdraftステップ
    if (body.trim().length > 0 && articleId) {
      setCurrentStep('draft');
      return;
    }

    // アウトラインが生成されている場合はoutlineステップ（ただし、completeステップ中は遷移しない）
    if (_outlineSuggestions.length > 0) {
      // completeステップ中は遷移しない（保存完了後はcomplete画面を維持）
      if (currentStep !== 'complete') {
        setCurrentStep('outline');
      }
      return;
    }

    // 会話が始まっている場合はchatステップ
    if (_qaTurns.length > 0 || _currentQuestion) {
      setCurrentStep('chat');
      return;
    }

    // ウォームアップが完了している場合はwarmupステップ（次のステップへ進む準備）
    if (_warmupComplete) {
      setCurrentStep('chat');
      return;
    }

    // デフォルトはintroステップ
    setCurrentStep('intro');
  }, [loading, initializingUser, userId, status, _submittedAt, body, articleId, _outlineSuggestions.length, _qaTurns.length, _currentQuestion, _warmupComplete]);

  // 初回の対話を開始
  useEffect(() => {
    if (!_warmupComplete || loading || initializingUser || !userId) {
      return;
    }

    if (_qaTurns.length === 0 && !_currentQuestion && currentStep === 'chat') {
      fetchNextQuestion([], { force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initializingUser, userId, _warmupComplete, currentStep]);

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
    setCurrentStep('chat');
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
      const snippet = trimmed.length > 36 ? `${trimmed.slice(0, 36)}窶ｦ` : trimmed;
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
    setPauseAfterOutline(false);
    // 次の質問を生成して対話を続ける
    fetchNextQuestion(_qaTurns, { force: true });
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
      
      // アウトライン生成後、outlineステップへは遷移しない（封筒をタップするまで待つ）
      
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
    setCurrentStep('draft');
    setSelectedOutline(null); // 選択状態をリセット
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
        setOutlineSuggestions([]); // アウトラインもクリア
        setShowOutlinePrompt(false);
        setSelectedOutline(null);
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
        // アウトラインをクリアしてからcompleteステップに遷移（useEffectでoutlineに戻されないようにする）
        setOutlineSuggestions([]);
        setShowOutlinePrompt(false);
        setSelectedOutline(null);
        setCurrentStep('complete');
        // 新しい記事を作成するために状態をリセット（非同期で実行）
        createNewArticle().catch((err) => {
          console.error('[ACTION] Failed to create new article after save:', err);
        });
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

  // プログレスバーのステップ情報
  const stepInfo = [
    { id: 'intro', label: 'はじめに', icon: '👋' },
    { id: 'warmup', label: '気分選択', icon: '💭' },
    { id: 'chat', label: '対話', icon: '💬' },
    { id: 'outline', label: '構成案', icon: '📝' },
    { id: 'draft', label: '執筆', icon: '✍️' },
    { id: 'complete', label: '完了', icon: '✅' },
  ];

  const currentStepIndex = stepInfo.findIndex(s => s.id === currentStep);

  // プログレスバーコンポーネント
  function ProgressBar() {
    if (currentStep === 'intro' || currentStep === 'complete') {
      return null;
    }

    return (
      <div className="step-progress-bar">
        {stepInfo.map((step, index) => {
          if (step.id === 'intro' || step.id === 'complete') return null;
          const isActive = index <= currentStepIndex;
          const isCurrent = step.id === currentStep;
          return (
            <div
              key={step.id}
              className={`step-progress-item ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <div className="step-progress-icon">{step.icon}</div>
              <div className="step-progress-label">{step.label}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // Sticky Footerコンポーネント
  function StickyFooter({ children }: { children: React.ReactNode }) {
    return (
      <div className="sticky-footer">
        <div className="sticky-footer-content">{children}</div>
      </div>
    );
  }

  // Introステップ（momoからの招待状）
  function renderIntroStep() {
    return (
      <div className="step-container step-intro">
        <div className="step-content">
          <div className="intro-card">
            <div className="intro-icon-wrapper">
              <span className="intro-icon">🍑</span>
              <div className="intro-leaf">🍃</div>
            </div>
            
            <h1 className="intro-title">
              momo<br />
              <span className="intro-subtitle">くらしのノート</span>
            </h1>
            
            <div className="intro-divider"></div>
            
            <p className="intro-message">
              こんにちは。<br />
              今日あった出来事や気持ちを、<br />
              少しだけお話ししませんか？
            </p>

            <button
              type="button"
              className="forest-btn forest-btn-primary intro-start-btn"
              onClick={() => setCurrentStep('warmup')}
            >
              <span>お話しする</span>
              {/* 右矢印アイコン */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Warmupステップ
  function renderWarmupStep() {
    return (
      <div className="step-container step-warmup">
        <div className="step-content">
          <h2 className="step-title">今日の気分を選んでください</h2>
          <p className="step-description">
            記事を書く気分をmomoに伝えてみてください。気分がまだ整理できていない場合は、スキップすることもできます。
          </p>
          <div className="mood-buttons-large">
            {_moodPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`mood-button-large ${_warmupMood === preset.value ? 'active' : ''}`}
                onClick={() => _setWarmupMood(preset.value)}
              >
                <div className="mood-button-icon">
                  {preset.value === 'いい感じ' && '😊'}
                  {preset.value === 'まあまあ' && '😐'}
                  {preset.value === 'ドキドキ' && '😰'}
                  {preset.value === 'しんどい◆' && '😔'}
                  {preset.value === 'わからない' && '🤔'}
                </div>
                <div className="mood-button-label">{preset.label}</div>
              </button>
            ))}
          </div>
        </div>
        <StickyFooter>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setWarmupComplete(true);
              _setWarmupMood('スキップ');
              setCurrentStep('chat');
            }}
          >
            スキップする
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={_handleWarmupSubmit}
            disabled={!_warmupMood}
          >
            💬 対話をはじめる
          </button>
        </StickyFooter>
      </div>
    );
  }

  // チャットスクロールを自動化
  useEffect(() => {
    if (currentStep === 'chat' && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [_qaTurns, _currentQuestion, _questionLoading, currentStep]);


  // Chatステップ（_currentAnswerを依存配列から削除）
  const renderChatStep = useCallback(() => {
    return (
      <div className="step-container step-chat">
        <div className="step-content">
          <div className="chat-container" ref={chatContainerRef}>
            {_qaTurns.map((turn, index) => (
              <div key={`turn-${index}`} className="chat-messages">
                <div className="chat-bubble chat-bubble-ai">
                  <div className="chat-avatar">momo</div>
                  <div className="chat-text">{turn.question}</div>
                </div>
                <div className="chat-bubble chat-bubble-user">
                  <div className="chat-text">{turn.answer}</div>
                </div>
                {turn.acknowledgment && (
                  <div className="chat-bubble chat-bubble-ai">
                    <div className="chat-avatar">momo</div>
                    <div className="chat-text">{turn.acknowledgment.replace(/^momo:\s*/i, '')}</div>
                  </div>
                )}
              </div>
            ))}
            {_questionLoading && (
              <div className="chat-bubble chat-bubble-ai">
                <div className="chat-avatar">momo</div>
                <div className="chat-text chat-typing">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}
            {_currentQuestion && !_questionLoading && (
              <div className="chat-bubble chat-bubble-ai">
                <div className="chat-avatar">momo</div>
                <div className="chat-text">{_currentQuestion}</div>
              </div>
            )}
            {_showOutlinePrompt && (
              <>
                <div className="chat-bubble chat-bubble-ai">
                  <div className="chat-avatar">momo</div>
                  <div className="chat-text">
                    3つの質問に答えていただき、ありがとうございました。<br />
                    構成案の準備ができました。
                  </div>
                </div>
                {/* 封筒（ギフトカード）風のコンポーネント */}
                <div 
                  className="outline-gift-card"
                  onClick={() => {
                    if (_outlineSuggestions.length > 0) {
                      setCurrentStep('outline');
                    } else {
                      _handleOutlinePromptAccept();
                    }
                  }}
                >
                  <div className="gift-card-envelope">
                    <div className="gift-card-flap">✉️</div>
                    <div className="gift-card-body">
                      <div className="gift-card-icon">📝</div>
                      <div className="gift-card-text">構成案を見る</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    _qaTurns,
    _currentQuestion,
    _questionLoading,
    _showOutlinePrompt,
    // _currentAnswerを依存配列から削除
  ]);

  // Outlineステップ
  function renderOutlineStep() {
    return (
      <div className="step-container step-outline">
        <div className="step-content">
          <h2 className="step-title">記事の構成案</h2>
          <p className="step-description">
            momoが対話の内容から、記事の構成案を作りました。これを使って本文を書いてみてください。
          </p>
          {leadSuggestion && (
            <div className="lead-suggestion-card">
              <h3>リード文の提案</h3>
              <p>{leadSuggestion}</p>
            </div>
          )}
          <div className="outline-cards">
            {_outlineSuggestions.map((outline, index) => (
              <div 
                key={`outline-${index}`} 
                className={`outline-card-item ${selectedOutline === index ? 'selected' : ''}`}
                onClick={() => setSelectedOutline(index)}
              >
                {selectedOutline === index && (
                  <div className="outline-card-check">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                )}
                <h3 className="outline-card-title">{outline.title}</h3>
                <ul className="outline-card-points">
                  {outline.points.map((point, pointIndex) => (
                    <li key={pointIndex}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <StickyFooter>
              {_outlineSuggestions.length > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (selectedOutline !== null) {
                      _applyOutline(_outlineSuggestions[selectedOutline]);
                    }
                  }}
                  disabled={status === 'submitted' || selectedOutline === null}
                >
                  ✍️ この構成で書く
                </button>
              )}
        </StickyFooter>
      </div>
    );
  }

  // Draftステップ
  function renderDraftStep() {
    return (
      <div className="step-container step-draft">
        <div className="step-content">
          <div className="draft-editor">
            <input
              className="draft-title-input"
              type="text"
              value={title}
              placeholder="タイトルを入力..."
              onChange={(e) => setTitle(e.target.value)}
              disabled={!_canEdit}
            />
            <div className="draft-body-container">
              <textarea
                className="draft-body-input"
                value={body}
                placeholder="ここから本文を書いてみてください..."
                onChange={(e) => setBody(e.target.value)}
                rows={20}
                disabled={!_canEdit}
              />
              <div className="draft-word-count">{wordCount}文字</div>
            </div>
          </div>
        </div>
        <StickyFooter>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => _handleSave(false)}
            disabled={!_canEdit || _saveStatus === 'saving'}
          >
            {_saveStatus === 'saving' ? '保存中...' : '💾 下書き保存'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => _handleSave(true)}
            disabled={!_canEdit || _saveStatus === 'saving'}
          >
            ✅ 保存して完了
          </button>
        </StickyFooter>
      </div>
    );
  }

  // Completeステップ
  function renderCompleteStep() {
    // 現在の記事情報をHistoryArticle形式で作成
    const currentArticle: HistoryArticle = {
      id: articleId || '',
      title: title || null,
      body: body || null,
      word_count: wordCount,
      status: status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted_at: _submittedAt || null,
    };

    return (
      <div className="step-container step-complete">
        <div className="step-content">
          <div className="complete-hero">
            <div className="complete-icon">✅</div>
            <h1 className="complete-title">保存が完了しました</h1>
            <p className="complete-description">
              記事をマイページに保存しました。お疲れさまでした！
            </p>
            {_submittedAt && (
              <p className="complete-meta">
                保存日時: {new Date(_submittedAt).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
          <div className="complete-actions">
            <button
              type="button"
              className="forest-btn forest-btn-primary"
              onClick={() => _handleGeneratePdf(currentArticle)}
              disabled={!body || body.trim().length === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>手紙として受け取る</span>
            </button>
            <button
              type="button"
              className="forest-btn forest-btn-secondary"
              onClick={() => copyArticleBody(currentArticle)}
              disabled={!body || body.trim().length === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>コピーする</span>
            </button>
            <a
              className="forest-btn forest-btn-mint"
              href={_GOOGLE_FORM_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>アンケートに回答する</span>
            </a>
          </div>
        </div>
      </div>
    );
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

  // ステップに応じたレンダリング
  function renderCurrentStep() {
    switch (currentStep) {
      case 'intro':
        return renderIntroStep();
      case 'warmup':
        return renderWarmupStep();
      case 'chat':
        return renderChatStep();
      case 'outline':
        return renderOutlineStep();
      case 'draft':
        return renderDraftStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderIntroStep();
    }
  }

  return (
    <div className="action-wrapper wizard-mode">
      <ProgressBar />
      {renderCurrentStep()}
      {/* ChatInputをrenderChatStepの外に移動して、_currentAnswer変更時に再マウントされないようにする */}
      {currentStep === 'chat' && (
        <ChatInput
          value={_currentAnswer}
          onChange={setCurrentAnswer}
          onSubmit={_handleAnswerSubmit}
          disabled={status === 'submitted' || !_warmupComplete}
          questionLoading={_questionLoading}
          showOutlinePrompt={_showOutlinePrompt}
          onOutlinePromptDecline={_handleOutlinePromptDecline}
          onOutlinePromptAccept={_handleOutlinePromptAccept}
          isGeneratingOutline={_isGeneratingOutline}
        />
      )}
      {_message && currentStep !== 'chat' && currentStep !== 'outline' && currentStep !== 'draft' && (
        <div className="toast-message">
          <div className={`toast-content ${_saveStatus === 'error' ? 'error' : ''}`}>
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

