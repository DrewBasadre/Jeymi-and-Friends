export const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

export async function readJsonObject(
  request: Request,
  maxBytes = 24_000,
): Promise<Record<string, unknown>> {
  if (request.method !== 'POST') {
    throw new HttpError(405, 'Only POST requests are supported.');
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) {
    throw new HttpError(413, 'Request payload is too large.');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, 'Request payload is too large.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  console.error(
    'Edge function failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  return jsonResponse({ error: 'The service could not complete the request.' }, 500);
}
