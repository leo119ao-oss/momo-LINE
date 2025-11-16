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

const GOOGLE_FORM_URL = 'https://forms.gle/nqzrEALFxcBHoALVA';

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
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initializingUser, setInitializingUser] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [qaTurns, setQaTurns] = useState<QATurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [questionLoading, setQuestionLoading] = useState<boolean>(false);
  const [showOutlinePrompt, setShowOutlinePrompt] = useState<boolean>(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState<boolean>(false);
  const [outlineSuggestions, setOutlineSuggestions] = useState<OutlineSuggestion[]>([]);
  const [leadSuggestion, setLeadSuggestion] = useState<string>('');
  const [themeSuggestion, setThemeSuggestion] = useState<string>('');
  const [warmupMood, setWarmupMood] = useState<string>('');
  const [warmupNote, setWarmupNote] = useState<string>('');
  const [warmupComplete, setWarmupComplete] = useState<boolean>(false);
  const [memoText, setMemoText] = useState<string>('');
  const [history, setHistory] = useState<HistoryArticle[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [previewArticle, setPreviewArticle] = useState<HistoryArticle | null>(null);
  const [pauseAfterOutline, setPauseAfterOutline] = useState<boolean>(false);
  const [manualProgress, setManualProgress] = useState<boolean>(false);
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

  const tasks = useMemo(() => (
    [
      { key: 'warmup' as TaskKey, label: 'ウォームアップ', done: warmupComplete },
      { key: 'conversation' as TaskKey, label: 'momoとの対話', done: qaTurns.length >= 3 },
      { key: 'draft' as TaskKey, label: '下書きを書く', done: body.trim().length >= 200 },
      { key: 'save' as TaskKey, label: 'マイページに保存', done: status === 'submitted' },
      { key: 'survey' as TaskKey, label: 'アンケート回答', done: false },
    ]
  ), [warmupComplete, qaTurns.length, body, status]);

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
    if (!warmupComplete || loading || initializingUser || !userId) {
      return;
    }

    if (qaTurns.length === 0 && !currentQuestion) {
      fetchNextQuestion([], { force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initializingUser, userId, warmupComplete]);

  const wordCount = useMemo(() => {
    return body ? body.replace(/\s+/g, '').length : 0;
  }, [body]);

  const conversationReady = qaTurns.length >= 3;
  const canEdit = Boolean(userId && articleId && !loading && conversationReady);

  const moodPresets = [
    { value: 'いい感じ', label: 'いい感じ！気分が良い' },
    { value: 'まあまあ', label: 'まあまあ' },
    { value: 'ドキドキ', label: 'ちょっとドキドキ' },
    { value: 'しんどい◆', label: '縺ｻ縺｣縺ｨ荳諱ｯ縺､縺代◆' },
    { value: 'わからない', label: 'わからない。まだ整理できていない' },
  ];

  function handleWarmupSubmit() {
    if (!warmupMood) {
      setMessage('momo: 気分を選んでから1つずつ進めていきましょう。まずは気分を選んでください。');
      return;
    }
    setWarmupComplete(true);
    setMessage(`momo: ${warmupMood}を選んでくれてありがとう。それでは、momoとの対話を始めましょう。`);
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
        const nextQuestion = data.question ?? '莉頑律荳逡ｪ蜊ｰ雎｡縺ｫ谿九▲縺溘％縺ｨ縺ｯ菴輔〒縺吶°・・;

        let prompt = nextQuestion;
        if (showCorrectionReminder) {
          prompt = `繧ゅ＠蜿励￠蜿悶ｊ譁ｹ縺碁＆縺｣縺溘ｉ驕諷ｮ縺ｪ縺乗蕗縺医※縺ｭ縲・n${nextQuestion}`;
          setShowCorrectionReminder(false);
        } else if (latestAnswer) {
          prompt = `縺輔▲縺阪・縲・{latestAnswer.length > 32 ? `${latestAnswer.slice(0, 32)}窶ｦ` : latestAnswer}縲阪↓縺､縺・※縲√ｂ縺・ｰ代＠縺縺台ｼｺ縺｣縺ｦ繧ゅ＞縺・°縺ｪ・歃n${nextQuestion}`;
        }

        setCurrentQuestion(prompt);
        if (data.suggestedTheme) {
          setThemeSuggestion(data.suggestedTheme);
        }
      } else {
        setCurrentQuestion('莉頑律荳逡ｪ蜊ｰ雎｡縺ｫ谿九▲縺溘％縺ｨ縺ｯ菴輔〒縺吶°・・);
      }
    } catch (err) {
      console.error('[ACTION] Failed to fetch question:', err);
      setCurrentQuestion('莉頑律荳逡ｪ蜊ｰ雎｡縺ｫ谿九▲縺溘％縺ｨ縺ｯ菴輔〒縺吶°・・);
    } finally {
      setQuestionLoading(false);
    }
  }

  async function handleAnswerSubmit() {
    const trimmed = currentAnswer.trim();
    if (!trimmed || !currentQuestion) return;

    const draftTurns = [...qaTurns, { question: currentQuestion, answer: trimmed }];
    setQaTurns(draftTurns);
    setCurrentAnswer('');
    setCurrentQuestion('');
    latestAnswerRef.current = trimmed;
    setMessage('momo: 莨昴∴縺ｦ縺上ｌ縺ｦ縺ゅｊ縺後→縺・ょｰ代＠閠・∴縺ｦ縺九ｉ谺｡縺ｮ縺願ｩｱ繧偵☆繧九・縲・);

    let ackText = 'momo: 謨吶∴縺ｦ縺上ｌ縺ｦ縺ゅｊ縺後→縺・よｰ玲戟縺｡縺後ｈ縺丈ｼ昴ｏ縺｣縺溘ｈ縲・;

    try {
      const ackRes = await fetch('/api/coach/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
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
      if (ackText !== 'momo: 謨吶∴縺ｦ縺上ｌ縺ｦ縺ゅｊ縺後→縺・よｰ玲戟縺｡縺後ｈ縺丈ｼ昴ｏ縺｣縺溘ｈ.') {
        return ackText;
      }
      const snippet = trimmed.length > 36 ? `${trimmed.slice(0, 36)}窶ｦ` : trimmed;
      return `momo: 縲・{snippet}縲阪▲縺ｦ諢溘§縺溘ｓ縺縺ｭ縲よ蕗縺医※縺上ｌ縺ｦ縺ゅｊ縺後→縺・Ａ;
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
      setMessage('momo: 縺薙％縺ｾ縺ｧ縺ｧ螟ｧ莠九↑縺願ｩｱ縺後◆縺上＆繧灘・縺ｦ縺阪◆繧医りｨ倅ｺ九・蠖｢縺ｫ縺励※縺ｿ繧具ｼ滓ｰ励↓縺ｪ繧九→縺薙ｍ縺後≠繧後・縺薙・縺ゅ→荳邱偵↓逶ｴ縺昴≧縲・);
    } else {
      if (correctionMode) {
        setCorrectionMode(false);
        fetchNextQuestion(acknowledgedTurns, { force: true });
      } else {
        fetchNextQuestion(acknowledgedTurns);
      }
    }
  }

  function handleOutlinePromptDecline() {
    setShowOutlinePrompt(false);
    fetchNextQuestion(qaTurns);
  }

  async function handleOutlinePromptAccept() {
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
          qa_context: qaTurns,
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
      setMessage('momo: 繧｢繧ｦ繝医Λ繧､繝ｳ繧呈署譯医＠縺溘ｈ縲ゅ＠縺｣縺上ｊ縺上ｋ繧ゅ・縺後≠繧後・縲√・繧ｿ繝ｳ縺九ｉ譛ｬ譁・↓蜿悶ｊ霎ｼ繧薙〒縺ｿ縺ｦ縲よｰ励↓縺ｪ繧九→縺薙ｍ縺ｯ驕諷ｮ縺ｪ縺剰ｨよｭ｣縺励※縺ｭ縲・);
    } catch (err) {
      console.error('[ACTION] Outline generation error:', err);
      setMessage(getErrorMessage(err, '繧｢繧ｦ繝医Λ繧､繝ｳ縺ｮ逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆'));
    } finally {
      setIsGeneratingOutline(false);
      setShowOutlinePrompt(false);
      setCurrentQuestion('');
    }
  }

  function applyOutline(outline: OutlineSuggestion) {
    if (!outline) return;
    if (!title) {
      setTitle(outline.title);
    }

    const outlineText = outline.points.map((point, idx) => `${idx + 1}. ${point}`).join('\n');
    if (!body.trim()) {
      const intro = leadSuggestion ? `${leadSuggestion}\n\n` : '';
      setBody(`${intro}${outlineText}\n\n縺薙％縺九ｉ譛ｬ譁・ｒ譖ｸ縺・※縺ｿ縺ｾ縺励ｇ縺・Ａ);
    } else {
      setBody((prev) => `${prev}\n\n${outlineText}`);
    }
    setMessage('momo: 繧｢繧ｦ繝医Λ繧､繝ｳ繧貞ｷｮ縺苓ｾｼ繧薙□繧医り・蛻・・險闡峨〒蟆代＠縺壹▽閹ｨ繧峨∪縺帙※縺・％縺・・縲・);
  }

  function handleContinueDialogue() {
    setPauseAfterOutline(false);
    setCorrectionMode(true);
    setShowCorrectionReminder(false);
    setCurrentQuestion('險よｭ｣縺励◆縺・ｓ縺縺ｭ縲√≠繧翫′縺ｨ縺・ゅ←縺ｮ驛ｨ蛻・′驕輔▲縺ｦ縺・◆縺九↑・・);
    setMessage('momo: 謨吶∴縺ｦ縺上ｌ縺ｦ蜉ｩ縺九ｋ繧医る＆縺｣縺ｦ縺・◆縺ｨ縺薙ｍ繧偵◎縺ｮ縺ｾ縺ｾ謨吶∴縺ｦ縺ｭ縲・);
    requestAnimationFrame(() => {
      conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function handleGeneratePdf(targetArticle: HistoryArticle) {
    if (!userId) {
      setMessage('momo: PDF繧剃ｽ懊ｋ縺ｫ縺ｯLINE縺ｧ繝ｭ繧ｰ繧､繝ｳ縺励◆迥ｶ諷九〒繧｢繧ｯ繧ｻ繧ｹ縺励※縺ｭ縲・);
      return;
    }

    if (!targetArticle.body) {
      setMessage('momo: 縺薙・險倅ｺ九・縺ｾ縺譛ｬ譁・′菫晏ｭ倥＆繧後※縺・↑縺・∩縺溘＞縲・);
      return;
    }

    setMessage('momo: PDF繧呈ｺ門ｙ縺吶ｋ縺九ｉ蟆代＠蠕・▲縺ｦ縺ｭ縲・);

    try {
      const res = await fetch('/api/coach/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          article_id: targetArticle.id,
          title: targetArticle.title || '譌･險・,
          content: targetArticle.body,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'PDF縺ｮ逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
      }

      setMessage('momo: PDF縺後〒縺阪◆繧医ゅム繧ｦ繝ｳ繝ｭ繝ｼ繝峨・繧ｿ繝ｳ縺九ｉ隕九※縺ｿ縺ｦ縺ｭ縲・);
      await refreshHistory();
    } catch (err) {
      console.error('[ACTION] PDF generation error:', err);
      setMessage(getErrorMessage(err, 'PDF縺ｮ逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆'));
    }
  }

  async function handleSave(markSubmitted = false) {
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
        throw new Error('菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆');
      }

      if (markSubmitted) {
        setSaveStatus('submitted');
        setStatus('submitted');
        setSubmittedAt(new Date().toISOString());
        setMessage('momo: 縺翫▽縺九ｌ縺輔∪縲ゅ・繧､繝壹・繧ｸ縺ｫ菫晏ｭ倥〒縺阪∪縺励◆・√い繝ｳ繧ｱ繝ｼ繝医〒豌励▼縺阪ｒ蜈ｱ譛峨＠縺ｦ縺上ｌ繧九→縲√→縺｣縺ｦ繧ょｬ峨＠縺・〒縺吶・);
      } else {
        setSaveStatus('saved');
        setMessage('momo: 騾比ｸｭ菫晏ｭ倥・縺｣縺｡繧翫ゅ・縺ｨ諱ｯ縺､縺阪↑縺後ｉ縲∵昴＞縺､縺・◆繧峨∪縺溘Γ繝｢縺励※縺ｭ縲・);
      }

      await refreshHistory();
    } catch (err) {
      console.error('[ACTION] Save error:', err);
      setSaveStatus('error');
      setMessage(getErrorMessage(err, '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆'));
    }
  }

  if (initializingUser) {
    return (
      <div className="action-wrapper">
        <div className="action-card loading">
          <div className="spinner" />
          <p>momo縺梧ｺ門ｙ荳ｭ縺ｧ縺吮ｦ縲・/p>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    return (
      <div className="action-wrapper">
        <div className="action-card error">
          <h1>險倅ｺ倶ｽ懈・縺ｫ繧｢繧ｯ繧ｻ繧ｹ縺ｧ縺阪∪縺帙ｓ</h1>
          <p>{error}</p>
          <p className="action-hint">LINE Bot縲後Δ繝｢縲阪↓縲瑚ｨ倅ｺ九ｒ譖ｸ縺阪◆縺・阪→騾∽ｿ｡縺励∬｡ｨ遉ｺ縺輔ｌ縺溘Μ繝ｳ繧ｯ縺九ｉ繧｢繧ｯ繧ｻ繧ｹ縺励※縺上□縺輔＞縲・/p>
        </div>
      </div>
    );
  }

  return (
    <div className="action-wrapper">
      <header className="action-header">
        <div>
          <h1>momo・郁ｨ倅ｺ倶ｽ懈・繧ｵ繝昴・繝茨ｼ・/h1>
          <p>莉頑律縺ｯ縺ｩ繧薙↑荳譌･縺縺｣縺滂ｼ殞omo縺ｨ縺翫＠繧・∋繧翫＠縺ｪ縺後ｉ縲∝ｰ代＠縺壹▽豌励▼縺阪ｒ險闡峨↓縺励※縺ｿ繧医≧縲・/p>
        </div>
        <a
          className="action-link"
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          繧｢繝ｳ繧ｱ繝ｼ繝医↓騾ｲ繧
        </a>
      </header>

      <div className="action-layout">
        <section className="action-editor">
          <div className="action-card task-card">
            <h2>莉頑律縺ｮ繧・ｋ縺薙→繝ｪ繧ｹ繝・/h2>
            <ul className="task-list">
              {tasks.map((task, index) => {
                const prevIncomplete = !manualProgress && tasks.slice(0, index).some((t) => !t.done);
                return (
                  <li key={task.key} className={`${task.done ? 'done' : ''} ${prevIncomplete ? 'locked' : ''}`}>
                    <span className="task-check">{task.done ? '笨・ : prevIncomplete ? '窶・ : '笳・}</span>
                    <span>{task.label}</span>
                  </li>
                );
              })}
            </ul>
            {!manualProgress && (
              <button
                type="button"
                className="task-free-toggle"
                onClick={() => setManualProgress(true)}
              >
                閾ｪ蛻・・繝壹・繧ｹ縺ｧ騾ｲ繧√ｋ・磯・分繧定ｧ｣髯､・・              </button>
            )}
          </div>

          <div className="action-card warmup-card">
            <h2>繧ｦ繧ｩ繝ｼ繝繧｢繝・・</h2>
            <p>縺ｾ縺壹・縲∽ｻ頑律縺ｮ豌怜・繧・ｮ九＠縺ｦ縺翫″縺溘＞縺薙→繧知omo縺ｫ謨吶∴縺ｦ縺上□縺輔＞縲ゅ＞縺ｾ縺ｮ豌玲戟縺｡縺梧紛逅・〒縺阪ｋ縺ｨ縲√％縺ｮ蜈医・雉ｪ蝠上′縺ゅ↑縺溘↓蜷医ｏ縺帙◆蜀・ｮｹ縺ｫ縺ｪ繧翫∪縺吶・/p>
            <p className="warmup-note">窶ｻ 荳九・繝懊ち繝ｳ縺九ｉ縺・∪縺ｮ豌怜・繧・縺､驕ｸ縺ｶ縺ｨ縲［omo縺後♀隧ｱ繧帝ｲ繧√ｉ繧後∪縺吶・/p>
            <div className="mood-buttons">
              {moodPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`mood-button ${warmupMood === preset.value ? 'active' : ''}`}
                  onClick={() => setWarmupMood(preset.value)}
                  disabled={warmupComplete}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              className="textarea"
              rows={3}
              placeholder="莉頑律縺ゅ▲縺溘％縺ｨ繧・Γ繝｢縺励※縺翫″縺溘＞縺薙→縺後≠繧後・閾ｪ逕ｱ縺ｫ譖ｸ縺・※縺上□縺輔＞"
              value={warmupNote}
              onChange={(e) => setWarmupNote(e.target.value)}
              disabled={warmupComplete}
            />
            <p className="warmup-meta-note">窶ｻ 繝｡繝｢縺ｯ莉ｻ諢上〒縺吶よ嶌縺九↑縺上※繧ょ､ｧ荳亥､ｫ縺ｧ縺吶・/p>
            {!warmupComplete ? (
              <div className="warmup-actions">
                <button
                  type="button"
                  className="primary warmup-submit"
                  onClick={handleWarmupSubmit}
                >
                  繧ｦ繧ｩ繝ｼ繝繧｢繝・・縺ｮ蝗樒ｭ斐ｒ騾∽ｿ｡縺吶ｋ
                </button>
                <button
                  type="button"
                  className="secondary warmup-skip"
                  onClick={() => {
                    setWarmupComplete(true);
                    setWarmupMood('繧ｹ繧ｭ繝・・');
                    setMessage('momo: OK・∽ｻ雁屓縺ｯ繧ｦ繧ｩ繝ｼ繝繧｢繝・・繧帝｣帙・縺励※縲∫峩謗･縺願ｩｱ縺九ｉ蟋九ａ繧医≧縲・);
                  }}
                >
                  莉雁屓縺ｯ繧ｹ繧ｭ繝・・縺吶ｋ
                </button>
              </div>
            ) : (
              <div className="warmup-complete">縺ゅｊ縺後→縺・ゅ％縺薙°繧峨・momo縺後♀隧ｱ繧剃ｼｺ縺・・縲ら判髱｢繧剃ｸ九↓繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺励※蟇ｾ隧ｱ繧ｹ繝・ャ繝励∈騾ｲ繧薙〒縺上□縺輔＞縲・/div>
            )}
          </div>

          <div className="action-card conversation-card" ref={conversationRef}>
            <h2>momo縺ｨ縺ｮ蟇ｾ隧ｱ</h2>
            <p>豌苓ｻｽ縺ｪ縺翫＠繧・∋繧翫→諤昴▲縺ｦ縺ｭ縲よｵｮ縺九ｓ縺縺薙→繧偵◎縺ｮ縺ｾ縺ｾ隧ｱ縺励※縺上ｌ繧後・螟ｧ荳亥､ｫ縲・/p>
            <p className="qa-note">窶ｻ momo縺ｮ謐峨∴譁ｹ縺碁＆縺・→諢溘§縺溘ｉ縲∵ｬ｡縺ｮ蝗樒ｭ斐ｄ縲悟ｯｾ隧ｱ繧堤ｶ壹￠繧具ｼ郁ｨよｭ｣縺吶ｋ・峨阪・繧ｿ繝ｳ縺九ｉ驕諷ｮ縺ｪ縺剰ｨよｭ｣縺励※縺上□縺輔＞縲・/p>

            {!warmupComplete && !manualProgress && (
              <div className="conversation-lock">
                <p>繧ｦ繧ｩ繝ｼ繝繧｢繝・・繧貞ｮ御ｺ・☆繧九→縲√％縺ｮ蜈医・蟇ｾ隧ｱ縺ｫ騾ｲ繧√∪縺吶・/p>
              </div>
            )}

            <div className="qa-entries">
              {qaTurns.map((turn, index) => (
                <div key={`${turn.question}-${index}`} className="qa-entry">
                  <div className="qa-question">Q{index + 1}. {turn.question}</div>
                  <div className="qa-answer">A. {turn.answer}</div>
                  {turn.acknowledgment && (
                    <div className="qa-ack">momo: {turn.acknowledgment.replace(/^momo:\s*/i, '')}</div>
                  )}
                </div>
              ))}
            </div>

            {showOutlinePrompt ? (
              <div className="outline-prompt">
                <p>縺薙％縺ｾ縺ｧ縺ｮ縺願ｩｱ縺ｧ縲∬ｨ倅ｺ九・豬√ｌ縺ｮ縺溘◆縺榊床繧剃ｽ懊▲縺ｦ縺ｿ繧医≧縺具ｼ・/p>
                <div className="prompt-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={handleOutlinePromptAccept}
                    disabled={isGeneratingOutline}
                  >
                    {isGeneratingOutline ? '菴懈・荳ｭ...' : '縺ｯ縺・√♀鬘倥＞縺励∪縺・}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleOutlinePromptDecline}
                    disabled={isGeneratingOutline}
                  >
                    縺ｾ縺邯壹￠繧・                  </button>
                </div>
              </div>
            ) : (
              <div className="qa-input">
                <div className="qa-current-question">
                  {questionLoading
                    ? 'momo縺梧ｬ｡縺ｮ雉ｪ蝠上ｒ閠・∴縺ｦ縺・∪縺吮ｦ'
                    : warmupComplete
                      ? (currentQuestion || '莉頑律荳逡ｪ蜊ｰ雎｡縺ｫ谿九▲縺溘％縺ｨ縺ｯ菴輔〒縺吶°・・)
                      : '縺ｾ縺壹・繧ｦ繧ｩ繝ｼ繝繧｢繝・・繧堤ｵゅ∴縺ｦ縺九ｉ荳邱偵↓騾ｲ繧√ｈ縺・・縲・}
                </div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="諤昴＞縺､縺・◆險闡峨ｒ縺昴・縺ｾ縺ｾ譖ｸ縺・※縺ｿ繧医≧縲ゅ≧縺ｾ縺上∪縺ｨ縺ｾ繧峨↑縺上※繧ょ､ｧ荳亥､ｫ縲・
                  disabled={questionLoading || status === 'submitted' || !warmupComplete}
                />
                <div className="qa-actions">
                  <button
                    type="button"
                    className="primary send-button"
                    onClick={handleAnswerSubmit}
                    disabled={questionLoading || !currentAnswer.trim() || status === 'submitted' || !warmupComplete}
                  >
                    <span className="send-icon" aria-hidden>岫</span>
                    <span>騾∽ｿ｡</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {outlineSuggestions.length > 0 && (
            <div className="action-card outline-card">
              <h2>生成されたアウトライン</h2>
              <p>momoが対話の内容から、記事の構成案を作りました。これを使って本文を書いてみてください。</p>
              <div className="outline-list">
                {outlineSuggestions.map((outline, index) => (
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
                      onClick={() => applyOutline(outline)}
                      disabled={status === 'submitted'}
                    >
                      このアウトラインを使う
                    </button>
                  </div>
                ))}
              </div>

              {leadSuggestion && (
                <div className="lead-suggestion">
                  <h3>譖ｸ縺榊・縺励・謠先｡・/h3>
                  <p>{leadSuggestion}</p>
                </div>
              )}
              <p className="outline-note">窶ｻ 逅・ｧ｣縺ｮ驕輔＞縺ｫ豌励▼縺・◆繧峨∽ｸ九・繝懊ち繝ｳ縺九ｉmomo縺ｨ縺ｮ蟇ｾ隧ｱ繧堤ｶ壹￠縺ｦ險よｭ｣縺ｧ縺阪∪縺吶・/p>
              <button
                type="button"
                className="secondary"
                onClick={handleContinueDialogue}
                disabled={isGeneratingOutline}
              >
                momo縺ｨ蟇ｾ隧ｱ繧堤ｶ壹￠繧具ｼ郁ｨよｭ｣縺吶ｋ・・              </button>
            </div>
          )}

          {loading ? (
            <div className="action-card loading">
              <div className="spinner" />
              <p>險倅ｺ九ョ繝ｼ繧ｿ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺・..</p>
            </div>
          ) : (
            <>
              <div className="action-card">
                <label className="field-label" htmlFor="article-title">繧ｿ繧､繝医Ν</label>
                <input
                  id="article-title"
                  className="text-input"
                  type="text"
                  value={title}
                  placeholder="萓具ｼ壼ｭ舌←繧ゅ・蟇昴°縺励▽縺代〒豌励▼縺・◆縺薙→"
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit || status === 'submitted'}
                />
              </div>

              <div className="action-card">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="article-body">譛ｬ譁・/label>
                  <span className="word-count">{wordCount}譁・ｭ・/span>
                </div>
                {!conversationReady && (
                  <div className="conversation-warning">
                    <p>縺ｾ縺壹・momo縺ｨ縺ｮ蟇ｾ隧ｱ繧・縺､騾ｲ繧√※縺ｿ縺ｦ縺ｭ縲らｵゅｏ縺｣縺溘ｉ譛ｬ譁・ｬ・′髢区叛縺輔ｌ縺ｾ縺吶・/p>
                  </div>
                )}
                <textarea
                  id="article-body"
                  className="textarea"
                  value={body}
                  placeholder="莉頑律諢溘§縺溘％縺ｨ繧・ｭｦ縺ｳ繧定・逕ｱ縺ｫ譖ｸ縺・※縺上□縺輔＞縲・
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  disabled={!canEdit || status === 'submitted'}
                />
                <p className="field-hint">窶ｻ 300縲・00譁・ｭ励ｒ逶ｮ螳峨↓險伜・縺励※縺上□縺輔＞縲・/p>
              </div>

              <div className="action-card memo-card">
                <h2>繝｡繝｢繧ｹ繝壹・繧ｹ</h2>
                <p>譖ｸ縺・※縺・ｋ騾比ｸｭ縺ｧ諤昴＞縺､縺・◆縺薙→縺ｯ縺薙％縺ｫ繝｡繝｢縺励※縺翫￥縺ｨ萓ｿ蛻ｩ縺ｧ縺吶ゆｿ晏ｭ伜ｯｾ雎｡縺ｫ縺ｯ蜷ｫ縺ｾ繧後∪縺帙ｓ縲・/p>
                <textarea
                  className="textarea"
                  rows={6}
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="豌励↓縺ｪ縺｣縺溯ｨ闡峨ｄ谺｡蝗樊嶌縺阪◆縺・ユ繝ｼ繝槭↑縺ｩ縲∬・逕ｱ縺ｫ繝｡繝｢縺励※縺上□縺輔＞"
                />
              </div>

              <div className="action-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleSave(false)}
                  disabled={!canEdit || saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? '菫晏ｭ倅ｸｭ...' : '荳区嶌縺阪ｒ菫晏ｭ倥☆繧・}
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() => handleSave(true)}
                  disabled={!canEdit || saveStatus === 'saving'}
                >
                  繝槭う繝壹・繧ｸ縺ｫ菫晏ｭ倥☆繧・                </button>
              </div>

              {status === 'submitted' && submittedAt && (
                <div className="action-card success">
                  <h2>菫晏ｭ倥′螳御ｺ・＠縺ｾ縺励◆</h2>
                  <p>菫晏ｭ俶律譎・ {new Date(submittedAt).toLocaleString('ja-JP')}</p>
                  <p className="action-hint">蠑輔″邯壹″繧｢繝ｳ繧ｱ繝ｼ繝医∈縺ｮ縺泌鵠蜉帙ｒ縺企｡倥＞縺・◆縺励∪縺吶・/p>
                  <a
                    className="action-link"
                    href={GOOGLE_FORM_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    繧｢繝ｳ繧ｱ繝ｼ繝医↓蝗樒ｭ斐☆繧・                  </a>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="action-sidebar">
          <div className="action-card info">
            <h2>繧｢繝ｳ繧ｱ繝ｼ繝医↓縺､縺・※</h2>
            <p>險倅ｺ九ｒ譖ｸ縺咲ｵゅ∴縺溘ｉ縲；oogle 繝輔か繝ｼ繝縺ｫ縺ｦ莉頑律縺ｮ豌励▼縺阪ｒ蜈ｱ譛峨＠縺ｦ縺上□縺輔＞縲Ｎomo 縺ｮ繧ｵ繝昴・繝医′縺輔ｉ縺ｫ濶ｯ縺上↑繧翫∪縺吶・/p>
            <a
              className="action-link"
              href={GOOGLE_FORM_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              繝壹Φ繧呈戟縺､荳譌･ 繧｢繝ｳ繧ｱ繝ｼ繝・            </a>
            <p className="action-hint">窶ｻ LINE 縺ｮ繝ｪ繝・メ繝｡繝九Η繝ｼ縺九ｉ繧ょ酔縺倥Μ繝ｳ繧ｯ縺ｫ繧｢繧ｯ繧ｻ繧ｹ縺ｧ縺阪∪縺吶・/p>
          </div>

          <div className="action-card info">
            <h2>譖ｸ縺肴婿縺ｮ繝偵Φ繝・/h2>
            <ul className="hint-list">
              <li>蟆主・縺ｧ縺ｯ縲√え繧ｩ繝ｼ繝繧｢繝・・縺ｧ譖ｸ縺・◆繝｡繝｢繧・嶌縺榊・縺励・謠先｡医ｒ豢ｻ縺九☆縺ｨ繧ｹ繝繝ｼ繧ｺ縺ｧ縺吶・/li>
              <li>蜃ｺ譚･莠銀・縺昴・縺ｨ縺阪・豌玲戟縺｡竊偵◎縺薙°繧峨・豌励▼縺坂・閾ｪ蛻・ｒ縺ｭ縺弱ｉ縺・ｨ闡峨√・鬆・〒譖ｸ縺上→縺ｾ縺ｨ縺ｾ繧翫ｄ縺吶＞縺ｧ縺吶・/li>
              <li>荳区嶌縺堺ｿ晏ｭ倥〒騾比ｸｭ縺ｾ縺ｧ谿九○縺ｾ縺吶ゅ後・繧､繝壹・繧ｸ縺ｫ菫晏ｭ倥阪〒謠仙・螳御ｺ・↓縺ｪ繧翫∪縺吶・/li>
            </ul>
          </div>

          <div className="action-card history-card">
            <h2>驕主悉縺ｮ險倅ｺ・/h2>
            {historyLoading && <p>momo縺檎｢ｺ隱阪＠縺ｦ縺・∪縺吮ｦ</p>}
            {!historyLoading && history.length === 0 && (
              <p>縺ｾ縺菫晏ｭ倥＆繧後◆險倅ｺ九・縺ゅｊ縺ｾ縺帙ｓ縲Ｎomo縺ｨ縺ｮ蟇ｾ隧ｱ縺九ｉ譖ｸ縺榊ｧ九ａ縺ｦ縺ｿ縺ｾ縺励ｇ縺・・/p>
            )}
            {!historyLoading && history.length > 0 && (
              <div className="history-list">
                {history.map((article) => (
                  <div key={article.id} className="history-item">
                    <div className="history-header">
                      <div>
                        <div className="history-title">{article.title || '・医ち繧､繝医Ν縺ｪ縺暦ｼ・}</div>
                        <div className="history-meta">
                          <span>{article.status === 'submitted' ? '謠仙・貂医∩' : '荳区嶌縺・}</span>
                          <span>{new Date(article.updated_at).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</span>
                        </div>
                      </div>
                      {article.word_count !== null && (
                        <div className="history-count">{article.word_count}蟄・/div>
                      )}
                    </div>
                    <div className="history-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setPreviewArticle(article)}
                      >
                        譛ｬ譁・ｒ陦ｨ遉ｺ
                      </button>
                      {article.pdf_url ? (
                        <a
                          className="secondary"
                          href={article.pdf_url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          PDF繧帝幕縺・                        </a>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleGeneratePdf(article)}
                        >
                          PDF繧剃ｽ懈・
                        </button>
                      )}
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
              繝槭う繝壹・繧ｸ・磯℃蜴ｻ險倅ｺ具ｼ峨ｒ髢九￥
            </button>
          </div>
        </aside>
      </div>

      {message && (
        <div className="action-message-container">
          <div className={`action-message ${saveStatus === 'error' ? 'error' : ''}`}>
            {message}
          </div>
        </div>
      )}

      {previewArticle && (
        <div className="preview-overlay" onClick={() => setPreviewArticle(null)}>
          <div className="preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h2>{previewArticle.title || '・医ち繧､繝医Ν縺ｪ縺暦ｼ・}</h2>
              <button type="button" onClick={() => setPreviewArticle(null)}>髢峨§繧・/button>
            </div>
            <div className="preview-meta">
              <span>{previewArticle.status === 'submitted' ? '謠仙・貂医∩' : '荳区嶌縺・}</span>
              <span>{new Date(previewArticle.updated_at).toLocaleString('ja-JP')}</span>
            </div>
            <div className="preview-body">
              {previewArticle.body?.split(/\n+/).map((para, idx) => (
                <p key={idx}>{para}</p>
              )) || <p>譛ｬ譁・′縺ｾ縺菫晏ｭ倥＆繧後※縺・∪縺帙ｓ縲・/p>}
            </div>
            <div className="preview-actions">
              {previewArticle.pdf_url ? (
                <a
                  className="primary"
                  href={previewArticle.pdf_url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  PDF繧帝幕縺・                </a>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={() => handleGeneratePdf(previewArticle)}
                >
                  PDF繧剃ｽ懈・
                </button>
              )}
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
            <p>momo縺後・繝ｼ繧ｸ繧呈ｺ門ｙ縺励※縺・∪縺吮ｦ</p>
          </div>
        </div>
      }
    >
      <ActionPageContent />
    </Suspense>
  );
}

