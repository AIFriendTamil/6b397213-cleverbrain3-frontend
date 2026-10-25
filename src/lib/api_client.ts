/**
 * Base API fetch client wrapper with credential handling and error formatting.
 */

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details: Record<string, unknown>;
  public rawData?: unknown;

  constructor(
    message: string,
    status: number,
    code: string = 'UNKNOWN_ERROR',
    details: Record<string, unknown> = {},
    rawData?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.rawData = rawData;

    // Restore prototype chain for ES5/Custom Error support in TS
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  json?: unknown;
  body?: BodyInit | null;
  token?: string | null;
  baseUrl?: string;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private sessionToken: string | null = null;

  constructor(baseUrl?: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    this.defaultHeaders = {
      'Accept': 'application/json',
      ...defaultHeaders,
    };
  }

  /**
   * Set stored session token for authentication headers.
   */
  public setSessionToken(token: string | null): void {
    this.sessionToken = token;
  }

  /**
   * Get current stored session token.
   */
  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Clear stored session token.
   */
  public clearSessionToken(): void {
    this.sessionToken = null;
  }

  /**
   * Build full URL with query parameters.
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>, customBaseUrl?: string): string {
    const base = (customBaseUrl || this.baseUrl).replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${base}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    return url;
  }

  /**
   * Primary request execution method using fetch with credential handling.
   */
  public async request<T = unknown>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
    const {
      params,
      json,
      body,
      headers = {},
      token,
      baseUrl: customBaseUrl,
      credentials = 'include', // Default credential inclusion for cookies
      ...customOptions
    } = options;

    const url = this.buildUrl(endpoint, params, customBaseUrl);

    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(headers as Record<string, string>),
    };

    if (json !== undefined) {
      mergedHeaders['Content-Type'] = 'application/json';
    }

    // Attach session token in header if provided or present in state
    const activeToken = token !== undefined ? token : this.sessionToken;
    if (activeToken) {
      mergedHeaders['X-Session-ID'] = activeToken;
      mergedHeaders['Authorization'] = `Bearer ${activeToken}`;
    }

    const requestBody: BodyInit | null = json !== undefined ? JSON.stringify(json) : (body ?? null);

    let response: Response;
    try {
      response = await fetch(url, {
        ...customOptions,
        method: options.method || 'GET',
        headers: mergedHeaders,
        body: requestBody,
        credentials, // Ensures cookies are sent with request
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      throw new ApiError(`Network request failed: ${errorMessage}`, 0, 'NETWORK_ERROR');
    }

    if (!response.ok) {
      let errorData: unknown;
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      let errorCode = 'HTTP_ERROR';
      let errorDetails: Record<string, unknown> = {};

      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
          if (errorData && typeof errorData === 'object') {
            const dataObj = errorData as Record<string, any>;
            if (dataObj.detail) {
              if (typeof dataObj.detail === 'object') {
                errorCode = dataObj.detail.code || errorCode;
                errorMessage = dataObj.detail.message || errorMessage;
                errorDetails = dataObj.detail.details || {};
              } else if (typeof dataObj.detail === 'string') {
                errorMessage = dataObj.detail;
              } else if (Array.isArray(dataObj.detail)) {
                // FastAPI validation errors (422)
                errorCode = 'VALIDATION_ERROR';
                errorMessage = 'Validation failed for request parameters';
                errorDetails = { errors: dataObj.detail as unknown as Record<string, unknown> };
              }
            } else if (dataObj.error) {
              if (typeof dataObj.error === 'object') {
                errorCode = dataObj.error.code || errorCode;
                errorMessage = dataObj.error.message || errorMessage;
                errorDetails = dataObj.error.details || {};
              } else if (typeof dataObj.error === 'string') {
                errorMessage = dataObj.error;
              }
            } else if (dataObj.message) {
              errorMessage = String(dataObj.message);
              if (dataObj.code) errorCode = String(dataObj.code);
            }
          }
        } else {
          const text = await response.text();
          if (text) errorMessage = text;
        }
      } catch {
        // Failed to parse response body, keep default statusText error
      }

      throw new ApiError(errorMessage, response.status, errorCode, errorDetails, errorData);
    }

    if (response.status === 204) {
      return null as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    return text as unknown as T;
  }

  /**
   * HTTP GET request wrapper.
   */
  public async get<T = unknown>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * HTTP POST request wrapper.
   */
  public async post<T = unknown>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', json: data });
  }

  /**
   * HTTP PUT request wrapper.
   */
  public async put<T = unknown>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', json: data });
  }

  /**
   * HTTP PATCH request wrapper.
   */
  public async patch<T = unknown>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', json: data });
  }

  /**
   * HTTP DELETE request wrapper.
   */
  public async delete<T = unknown>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export default singleton instance
export const apiClient = new ApiClient();
