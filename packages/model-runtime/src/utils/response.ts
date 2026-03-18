import type { RuntimeHeaders } from '../types/chat';
import { toHeadersInit } from './headers';

export const StreamingResponse = (
  stream: ReadableStream,
  options?: { headers?: RuntimeHeaders },
) => {
  const headers = new Headers({
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    // for Nginx: disable chunk buffering
    'X-Accel-Buffering': 'no',
  });

  if (options?.headers) {
    const extraHeaders = new Headers(toHeadersInit(options.headers));
    extraHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return new Response(stream, {
    headers,
  });
};
