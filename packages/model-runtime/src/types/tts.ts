import type { RuntimeHeaders } from './chat';

export interface TextToSpeechPayload {
  input: string;
  model: string;
  voice: string;
}

export interface TextToSpeechOptions {
  headers?: RuntimeHeaders;
  signal?: AbortSignal;
  /**
   * userId for the embeddings
   */
  user?: string;
}
