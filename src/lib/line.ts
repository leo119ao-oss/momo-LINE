/**
 * LINE Messaging API の共通ビルダー
 */

import type { FlexMessage, FlexContainer, Message } from '@line/bot-sdk';

export interface FlexBubbleOptions {
  title: string;
  subtitle?: string;
  body?: string;
  buttonText?: string;
  buttonUri?: string;
  color?: string;
}

export function buildFlexBubble(options: FlexBubbleOptions): FlexMessage {
  const contents: FlexContainer = {
    type: 'bubble' as const,
    body: {
      type: 'box' as const,
      layout: 'vertical' as const,
      spacing: 'md' as const,
      contents: [
        {
          type: 'text' as const,
          text: options.title,
          size: 'lg' as const,
          weight: 'bold' as const,
          wrap: true
        },
        ...(options.subtitle ? [{
          type: 'text' as const,
          text: options.subtitle,
          size: 'sm' as const,
          color: '#888888',
          wrap: true
        }] : []),
        ...(options.body ? [{
          type: 'text' as const,
          text: options.body,
          size: 'md' as const,
          wrap: true
        }] : []),
        ...(options.buttonText && options.buttonUri ? [{
          type: 'button' as const,
          style: 'primary' as const,
          action: {
            type: 'uri' as const,
            label: options.buttonText,
            uri: options.buttonUri
          }
        }] : [])
      ]
    }
  };

  return {
    type: 'flex' as const,
    altText: options.title,
    contents
  };
}

export function buildQuizFlex(quiz: {
  title: string;
  question: string;
  article_url: string;
}): FlexMessage {
  return buildFlexBubble({
    title: quiz.title,
    subtitle: '今日の1分クイズ',
    body: quiz.question,
    buttonText: 'ヒントを見る',
    buttonUri: quiz.article_url
  });
}

export function buildTextMessage(text: string): Message {
  return {
    type: 'text',
    text
  };
}
