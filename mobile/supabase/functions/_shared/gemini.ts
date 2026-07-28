type JsonSchema = Record<string, unknown>;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
}

export async function generateStructuredJson<T>(args: {
  systemInstruction: string;
  prompt: string;
  responseSchema: JsonSchema;
}): Promise<T> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: args.systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: args.prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2_000,
          responseMimeType: 'application/json',
          responseSchema: args.responseSchema,
        },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );
  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini returned HTTP ${response.status}.`);
  }
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new Error(
      payload.promptFeedback?.blockReason
        ? `Gemini blocked the request: ${payload.promptFeedback.blockReason}.`
        : 'Gemini returned no content.',
    );
  }
  return JSON.parse(text) as T;
}
