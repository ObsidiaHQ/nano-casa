export interface HttpConfig {
  timeout?: number;
  validateStatus?: (status: number) => boolean;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
}

export interface HttpClient {
  get(url: string, config?: HttpConfig): Promise<HttpResponse>;
  post(url: string, body?: unknown, config?: HttpConfig): Promise<HttpResponse>;
}

export class HttpError extends Error {
  code?: string;
  response?: { data: any; status: number };

  constructor(message: string, options: { code?: string; data?: any; status?: number } = {}) {
    super(message);
    this.code = options.code;
    if (options.status !== undefined) {
      this.response = { data: options.data, status: options.status };
    }
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

async function requestJson(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
  config: HttpConfig = {}
): Promise<HttpResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Accept-Encoding': 'gzip',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
    });
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new HttpError(`Request timed out after ${config.timeout}ms`, { code: 'ECONNABORTED' });
    }
    throw error;
  }

  const text = await response.text();
  let data: any = text;
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {}
  }

  const validStatus = config.validateStatus?.(response.status) ?? response.ok;
  if (!validStatus) {
    throw new HttpError(`Request failed with status code ${response.status}`, {
      data,
      status: response.status,
    });
  }
  return { data, status: response.status };
}

export const nativeHttp: HttpClient = {
  get: (url, config) => requestJson('GET', url, undefined, config),
  post: (url, body, config) => requestJson('POST', url, body, config),
};
