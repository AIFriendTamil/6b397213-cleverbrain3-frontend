import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AuthService,
  authService,
  register,
  login,
  logout,
  getCurrentUser,
  RegisterRequest,
  LoginRequest,
} from '../src/services/auth';
import { ApiClient } from '../src/lib/api_client';

describe('AuthService', () => {
  let mockClient: ApiClient;
  let service: AuthService;

  beforeEach(() => {
    mockClient = new ApiClient('http://localhost:8000');
    service = new AuthService(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should send POST request to /api/v1/auth/register with user registration payload', async () => {
      const payload: RegisterRequest = {
        email: 'newuser@example.com',
        password: 'Password123!',
        full_name: 'New User',
        tenant_name: 'Acme Corp',
      };
      const expectedResponse = {
        user_id: 'usr_123',
        email: payload.email,
        tenant_id: 'ten_456',
        full_name: payload.full_name,
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(expectedResponse);

      const result = await service.register(payload);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/register', payload);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    it('should send POST request to /api/v1/auth/login with credentials', async () => {
      const credentials: LoginRequest = {
        email: 'user@example.com',
        password: 'Password123!',
      };
      const expectedResponse = {
        status: 'success',
        user: {
          id: 'usr_123',
          email: credentials.email,
          full_name: 'Test User',
          tenant_id: 'ten_456',
        },
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(expectedResponse);

      const result = await service.login(credentials);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/login', credentials);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('logout', () => {
    it('should send POST request to /api/v1/auth/logout and clear session token', async () => {
      const expectedResponse = { status: 'logged_out' };
      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(expectedResponse);
      const clearSpy = vi.spyOn(mockClient, 'clearSessionToken');

      const result = await service.logout();

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/logout', {});
      expect(clearSpy).toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getCurrentUser', () => {
    it('should send GET request to /api/v1/auth/me', async () => {
      const expectedResponse = {
        user_id: 'usr_123',
        email: 'user@example.com',
        full_name: 'Test User',
        tenant_id: 'ten_456',
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(expectedResponse);

      const result = await service.getCurrentUser();

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/me');
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('standalone exports', () => {
    it('should delegate standalone helper functions to default authService', async () => {
      const registerSpy = vi.spyOn(authService, 'register').mockResolvedValueOnce({
        user_id: 'u1',
        email: 'e1',
        tenant_id: 't1',
        full_name: 'f1',
      });
      const loginSpy = vi.spyOn(authService, 'login').mockResolvedValueOnce({
        status: 'success',
        user: { id: 'u1', email: 'e1', full_name: 'f1', tenant_id: 't1' },
      });
      const logoutSpy = vi.spyOn(authService, 'logout').mockResolvedValueOnce({ status: 'logged_out' });
      const meSpy = vi.spyOn(authService, 'getCurrentUser').mockResolvedValueOnce({
        user_id: 'u1',
        email: 'e1',
        full_name: 'f1',
        tenant_id: 't1',
      });

      await register({ email: 'a', password: 'b', full_name: 'c', tenant_name: 'd' });
      await login({ email: 'a', password: 'b' });
      await logout();
      await getCurrentUser();

      expect(registerSpy).toHaveBeenCalled();
      expect(loginSpy).toHaveBeenCalled();
      expect(logoutSpy).toHaveBeenCalled();
      expect(meSpy).toHaveBeenCalled();
    });
  });
});
