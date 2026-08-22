/**
 * Complete TypeScript definitions for Chrome Built-in AI APIs
 * (window.ai: languageModel, summarizer, rewriter, writer, translator).
 */

export type AICapabilityAvailability = 'readily' | 'after-download' | 'no';

export interface AICapabilities {
  readonly available: AICapabilityAvailability;
  readonly defaultTemperature?: number;
  readonly maxTemperature?: number;
  readonly defaultTopK?: number;
  readonly maxTopK?: number;
}

export interface AILanguageModelCapabilities extends AICapabilities {
  readonly defaultTemperature: number;
  readonly maxTemperature: number;
  readonly defaultTopK: number;
  readonly maxTopK: number;
}

export interface AILanguageModelCreateOptions {
  signal?: AbortSignal;
  systemPrompt?: string;
  initialPrompts?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  topK?: number;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AICreateMonitor extends EventTarget {
  ondownloadprogress?: (event: AICreateMonitorDownloadProgressEvent) => void;
  addEventListener(
    type: 'downloadprogress',
    listener: (event: AICreateMonitorDownloadProgressEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
}

export interface AICreateMonitorDownloadProgressEvent extends Event {
  readonly loaded: number;
  readonly total: number;
}

export interface AILanguageModel {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(
    input: string,
    options?: { signal?: AbortSignal }
  ): ReadableStream<string>;
  countPromptTokens(input: string, options?: { signal?: AbortSignal }): Promise<number>;
  readonly maxTokens: number;
  readonly tokensSoFar: number;
  readonly tokensLeft: number;
  readonly topK: number;
  readonly temperature: number;
  clone(options?: { signal?: AbortSignal }): Promise<AILanguageModel>;
  destroy(): void;
}

export interface AILanguageModelFactory {
  capabilities(): Promise<AILanguageModelCapabilities>;
  create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
}

// Summarizer
export type AISummarizerType = 'tl;dr' | 'key-points' | 'teaser' | 'headline';
export type AISummarizerFormat = 'plain-text' | 'markdown';
export type AISummarizerLength = 'short' | 'medium' | 'long';

export interface AISummarizerCapabilities extends AICapabilities {}

export interface AISummarizerCreateOptions {
  signal?: AbortSignal;
  type?: AISummarizerType;
  format?: AISummarizerFormat;
  length?: AISummarizerLength;
  sharedContext?: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AISummarizer {
  summarize(
    input: string,
    options?: { context?: string; signal?: AbortSignal }
  ): Promise<string>;
  summarizeStreaming(
    input: string,
    options?: { context?: string; signal?: AbortSignal }
  ): ReadableStream<string>;
  readonly ready: Promise<void>;
  destroy(): void;
}

export interface AISummarizerFactory {
  capabilities(): Promise<AISummarizerCapabilities>;
  create(options?: AISummarizerCreateOptions): Promise<AISummarizer>;
}

// Writer
export type AIWriterTone = 'formal' | 'neutral' | 'casual';
export type AIWriterFormat = 'plain-text' | 'markdown';
export type AIWriterLength = 'short' | 'medium' | 'long';

export interface AIWriterCapabilities extends AICapabilities {}

export interface AIWriterCreateOptions {
  signal?: AbortSignal;
  tone?: AIWriterTone;
  format?: AIWriterFormat;
  length?: AIWriterLength;
  sharedContext?: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AIWriter {
  write(
    input: string,
    options?: { context?: string; signal?: AbortSignal }
  ): Promise<string>;
  writeStreaming(
    input: string,
    options?: { context?: string; signal?: AbortSignal }
  ): ReadableStream<string>;
  readonly ready: Promise<void>;
  destroy(): void;
}

export interface AIWriterFactory {
  capabilities(): Promise<AIWriterCapabilities>;
  create(options?: AIWriterCreateOptions): Promise<AIWriter>;
}

// Rewriter
export type AIRewriterTone = 'as-is' | 'more-formal' | 'more-casual';
export type AIRewriterFormat = 'as-is' | 'plain-text' | 'markdown';
export type AIRewriterLength = 'as-is' | 'shorter' | 'longer';

export interface AIRewriterCapabilities extends AICapabilities {}

export interface AIRewriterCreateOptions {
  signal?: AbortSignal;
  tone?: AIRewriterTone;
  format?: AIRewriterFormat;
  length?: AIRewriterLength;
  sharedContext?: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AIRewriter {
  rewrite(
    input: string,
    options?: { context?: string; signal?: AbortSignal }
  ): Promise<string>;
  rewriteStreaming(
    input: string,
    options?: { context?: string; signal?: AbortSignal }
  ): ReadableStream<string>;
  readonly ready: Promise<void>;
  destroy(): void;
}

export interface AIRewriterFactory {
  capabilities(): Promise<AIRewriterCapabilities>;
  create(options?: AIRewriterCreateOptions): Promise<AIRewriter>;
}

// Translator
export interface AITranslatorCapabilities extends AICapabilities {
  languagePairAvailable(sourceLanguage: string, targetLanguage: string): AICapabilityAvailability;
}

export interface AITranslatorCreateOptions {
  signal?: AbortSignal;
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AITranslator {
  translate(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  translateStreaming(
    input: string,
    options?: { signal?: AbortSignal }
  ): ReadableStream<string>;
  readonly ready: Promise<void>;
  destroy(): void;
}

export interface AITranslatorFactory {
  capabilities(): Promise<AITranslatorCapabilities>;
  create(options: AITranslatorCreateOptions): Promise<AITranslator>;
}

// Global ChromeAI interface
export interface ChromeAI {
  readonly languageModel?: AILanguageModelFactory;
  readonly summarizer?: AISummarizerFactory;
  readonly writer?: AIWriterFactory;
  readonly rewriter?: AIRewriterFactory;
  readonly translator?: AITranslatorFactory;
}

// Global Window interface augmentation
declare global {
  interface Window {
    ai?: ChromeAI;
    translation?: {
      canTranslate(options: { sourceLanguage: string; targetLanguage: string }): Promise<AICapabilityAvailability>;
      createTranslator(options: AITranslatorCreateOptions): Promise<AITranslator>;
    };
  }
}
