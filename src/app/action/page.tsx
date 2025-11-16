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
        const nextQuestion = data.question ?? '質問を生成できませんでした。';

        setCurrentQuestion(nextQuestion);
        if (data.suggestedTheme) {
          setThemeSuggestion(data.suggestedTheme);
        }
      } else {
        setCurrentQuestion('質問を生成できませんでした。');
      }
    } catch (err) {
      console.error('[ACTION] Failed to fetch question:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ACTION] Error details:', { errorMessage, model: 'gpt-4.1-mini' });
      setCurrentQuestion('質問を生成できませんでした。');
      setMessage(`momo: エラーが発生しました: ${errorMessage}`);
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
                      ? (_currentQuestion || '質問を生成できませんでした。')
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

              {leadSuggestion && (
                <div className="lead-suggestion">
                  <h3>リード文の提案</h3>
                  <p>{leadSuggestion}</p>
                </div>
              )}
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

