# チャット入力欄のフォーカス問題 - コードレビュー用

## 問題
テキスト入力欄で文字を入力すると、毎回フォーカスが外れて選択し直さないといけない。

## 関連コード

### 1. ChatInputコンポーネントの定義（880-947行目）
```typescript
// チャット入力欄コンポーネント（メモ化して再レンダリングを防ぐ）
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
          >
            <span className="send-icon">✉️</span>
            送信
          </button>
        </div>
      )}
    </StickyFooter>
  );
});
```

### 2. renderChatStepの定義（949-1007行目）
```typescript
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
            <div className="chat-bubble chat-bubble-system">
              <div className="chat-text">
                <p>3つの質問に答えていただき、ありがとうございました。</p>
                <p>記事の構成案を作ることができます。</p>
              </div>
            </div>
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
```

### 3. ChatInputの使用箇所（1185-1194行目付近）
```typescript
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
    {_message && currentStep !== 'chat' && (
      <div className="toast-message">
        <div className={`toast-content ${_saveStatus === 'error' ? 'error' : ''}`}>
          {_message}
        </div>
      </div>
    )}
    {/* ... */}
  </div>
);
```

### 4. 状態変数の定義（65-68行目）
```typescript
const [_currentAnswer, setCurrentAnswer] = useState<string>('');
```

### 5. インポート（1-5行目）
```typescript
'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import './action.css';
```

### 6. StickyFooterコンポーネント（770-776行目）
```typescript
function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky-footer">
      <div className="sticky-footer-content">{children}</div>
    </div>
  );
}
```

## 現在の実装の意図
1. `ChatInput`を`memo`でメモ化して、propsが変更されない限り再レンダリングしないようにしている
2. `renderChatStep`の依存配列から`_currentAnswer`を削除して、`_currentAnswer`が変更されても`renderChatStep`が再作成されないようにしている
3. `ChatInput`を`renderChatStep`の外に移動して、`renderChatStep`の再作成の影響を受けないようにしている

## 問題の症状
- テキスト入力欄で1文字入力するたびにフォーカスが外れる
- 毎回テキストボックスを選択し直さないといけない

## 考えられる原因
1. `ChatInput`が`memo`でメモ化されているが、propsの比較で問題がある可能性
2. `onChange={setCurrentAnswer}`が毎回新しい関数参照として認識されている可能性
3. `ChatInput`コンポーネント自体が再マウントされている可能性
4. `StickyFooter`コンポーネントが再作成されている可能性
5. 親コンポーネント（`ActionPageContent`）の再レンダリングが原因の可能性

