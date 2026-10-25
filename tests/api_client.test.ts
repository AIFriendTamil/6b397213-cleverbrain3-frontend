import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient, ApiError, apiClient } from '../src/lib/api_client';

describe('ApiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should make a successful GET request with credentials: include', async () => {
    const client = new ApiClient('http://localhost:8000');
    const mockData = { id: '123', name: 'Test' };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const result = await client.get('/api/v1/test');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/test',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({
          'Accept': 'application/json',
        }),
      })
    );
  });

  it('should append query parameters to the request URL', async () => {
    const client = new ApiClient('http://localhost:8000');

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
    });

    await client.get('/api/v1/items', {
      params: { page: 1, limit: 10, filter: 'active', skipped: undefined, empty: null },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/items?page=1&limit=10&filter=active',
      expect.anything()
    );
  });

  it('should make a POST request with JSON payload', async () => {
    const client = new ApiClient('http://localhost:8000');
    const payload = { email: 'user@example.com', password: 'secretpassword' };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ user_id: 'usr_1' }),
    });

    const res = await client.post('/api/v1/auth/register', payload);

    expect(res).toEqual({ user_id: 'usr_1' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
      })
    );
  });

  it('should attach session token in headers when session token is set', async () => {
    const client = new ApiClient('http://localhost:8000');
    client.setSessionToken('sess_abc123');

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ user_id: 'usr_1' }),
    });

    await client.get('/api/v1/auth/me');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Session-ID': 'sess_abc123',
          'Authorization': 'Bearer sess_abc123',
        }),
      })
    );

    client.clearSessionToken();
    expect(client.getSessionToken()).toBeNull();
  });

  it('should handle 204 No Content responses', async () => {
    const client = new ApiClient('http://localhost:8000');

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const res = await client.delete('/api/v1/auth/logout');
    expect(res).toBeNull();
  });

  it('should parse formatted ApiError from JSON response with detail object', async () => {
    const client = new ApiClient('http://localhost:8000');

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        detail: {
          code: 'ACCOUNT_EXISTS',
          message: 'Account with given email already exists',
          details: {},
        },
      }),
    });

    await expect(client.post('/api/v1/auth/register', {})).rejects.toThrow(ApiError);

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        detail: {
          code: 'ACCOUNT_EXISTS',
          message: 'Account with given email already exists',
          details: {},
        },
      }),
    });

    try {
      await client.post('/api/v1/auth/register', {});
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(409);
      expect(err.code).toBe('ACCOUNT_EXISTS');
      expect(err.message).toBe('Account with given email already exists');
    }
  });

  it('should parse FastAPI 422 validation errors', async () => {
    const client = new ApiClient('http://localhost:8000');

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        detail: [
          { loc: ['body', 'email'], msg: 'field required', type: 'value_error.missing' },
        ],
      }),
    });

    try {
      await client.post('/api/v1/auth/login', {});
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toHaveProperty('errors');
    }
  });

  it('should handle network errors cleanly', async () => {
    const client = new ApiClient('http://localhost:8000');

    (global.fetch as any).mockRejectedValueOnce(new Error('Failed to fetch'));

    try {
      await client.get('/api/v1/health');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(0);
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.message).toContain('Failed to fetch');
    }
  });

  it('exports default singleton apiClient', () => {
    expect(apiClient).toBeInstanceOf(ApiClient);
  });
});
