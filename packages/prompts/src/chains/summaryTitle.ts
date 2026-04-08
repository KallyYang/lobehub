import type { ChatStreamPayload, OpenAIChatMessage, UIChatMessage } from '@lobechat/types';

export const chainSummaryTitle = (
  messages: (UIChatMessage | OpenAIChatMessage)[],
  locale: string,
): Partial<ChatStreamPayload> => ({
  messages: [
    {
      content: `You are a conversation title generator. Output ONLY a concise topic title.

Rules:
- Output ONLY the title, nothing else
- Maximum 10 words, maximum 50 characters
- No punctuation marks (no period, comma, question mark, exclamation)
- MUST output in the language of locale "${locale}". For example: zh-CN → Chinese, ja-JP → Japanese, es-ES → Spanish
- Capture the main topic, not side details
- Do NOT start with filler like "Discussion about" or "关于...的"
- Summarize the intent, not the emotion (e.g. "Career Change Options" not "User Is Frustrated")
- Keep technical terms (React, TypeScript, Docker, API) in their original form
- If the conversation is very short, keep the title proportionally brief

Examples:
- Node.js installation chat → "Node.js Installation with nvm"
- 蛋炒饭做法问答 → "蛋炒饭做法"
- Python error debugging → "Python NoneType Error Debugging"
- 京都旅行相談 (ja-JP) → "京都旅行のおすすめスポット"`,
      role: 'system',
    },
    {
      content: messages.map((message) => `${message.role}: ${message.content}`).join('\n'),
      role: 'user',
    },
  ],
});
