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
  const [_leadSuggestion, setLeadSuggestion] = useState<string>('');
  const [_themeSuggestion, setThemeSuggestion] = useState<string>('');
  const [_warmupMood, _setWarmupMood] = useState<string>('');
  const [_warmupNote, _setWarmupNote] = useState<string>('');
  const [_warmupComplete, setWarmupComplete] = useState<boolean>(false);
  const [_memoText, _setMemoText] = useState<string>('');
  const [_history, setHistory] = useState<HistoryArticle[]>([]);
  const [_historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [_previewArticle, _setPreviewArticle] = useState<HistoryArticle | null>(null);
  const [_pauseAfterOutline, setPauseAfterOutline] = useState<boolean>(false);
  const [_manualProgress, _setManualProgress] = useState<boolean>(false);
  const [showCorrectionReminder, setShowCorrectionReminder] = useState<boolean>(true);
  const [correctionMode, setCorrectionMode] = useState<boolean>(false);
  const latestAnswerRef = useRef<string>('');
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const refreshHistory = useCallback(async (targetParticipant?: string) => {
    const pid = targetParticipant || participantId;
    if (!pid) {
      return;
    }

    try {
      setHistoryLoading(true);
      const res = await fetch(`/api/coach/history?participant_id=${encodeURIComponent(pid)}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setHistory(data.articles || []);
      }
    } catch (err) {
      console.error('[ACTION] History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [participantId]);

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
        if (queryUserId) {
          if (!active) return;
          setUserId(queryUserId);
          return;
        }

        if (token) {
          const res = await fetch(`/api/auth/token?token=${encodeURIComponent(token)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.user_id && active) {
              setUserId(data.user_id);
              return;
            }
          }
        }

        if (active) {
          setError('ユーザー情報を取得できませんでした。LINE Bot から再度アクセスしてください。');
        }
      } catch (err) {
        console.error('[ACTION] Failed to resolve user:', err);
        if (active) {
          setError(getErrorMessage(err, 'ユーザー情報の取得に失敗しました。'));
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

        refreshHistory(statusData.participant_id || startData.participant_id || null);
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
  const _canEdit = Boolean(userId && articleId && !loading && _conversationReady);

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
        }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        const latestAnswer = latestAnswerRef.current;
        const nextQuestion = data.question ?? '質問を生成できませんでした。';

        let prompt = nextQuestion;
        if (showCorrectionReminder) {
          prompt = `もしよければ、前の回答を修正してから次の質問に進んでください。\n${nextQuestion}`;
          setShowCorrectionReminder(false);
        } else if (latestAnswer) {
          prompt = `前の回答「${latestAnswer.length > 32 ? `${latestAnswer.slice(0, 32)}...` : latestAnswer}」について、もう少し詳しく教えてください。\n${nextQuestion}`;
        }

        setCurrentQuestion(prompt);
        if (data.suggestedTheme) {
          setThemeSuggestion(data.suggestedTheme);
        }
      } else {
        setCurrentQuestion('質問を生成できませんでした。');
      }
    } catch (err) {
      console.error('[ACTION] Failed to fetch question:', err);
      setCurrentQuestion('質問を生成できませんでした。');
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
        throw new Error(data?.error || 'アウトラインの生成に失敗しました');
      }

      const outlines = (data.outlines || []) as OutlineSuggestion[];
      setOutlineSuggestions(outlines);
      setLeadSuggestion('');
      setPauseAfterOutline(true);
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
      setMessage('momo: アウトラインを作成しました。これを使って本文を書いてみてください。もし修正したい点があれば、対話を続けることもできます。');
    } catch (err) {
      console.error('[ACTION] Outline generation error:', err);
      setMessage(getErrorMessage(err, 'アウトラインの生成に失敗しました'));
    } finally {
      setIsGeneratingOutline(false);
      setShowOutlinePrompt(false);
      setCurrentQuestion('');
    }
  }

  function _applyOutline(outline: OutlineSuggestion) {
    if (!outline) return;
    if (!title) {
      setTitle(outline.title);
    }

    const outlineText = outline.points.map((point, idx) => `${idx + 1}. ${point}`).join('\n');
    if (!body.trim()) {
      const intro = leadSuggestion ? `${leadSuggestion}\n\n` : '';
      setBody(`${intro}${outlineText}\n\nここから本文を書いてみてください。`);
    } else {
      setBody((prev) => `${prev}\n\n${outlineText}`);
    }
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
        <h1>momo - 記事コーチ</h1>
      </header>
      <main>
        {/* いったん main の中身は全部コメントアウトでもOK */}
      </main>
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

