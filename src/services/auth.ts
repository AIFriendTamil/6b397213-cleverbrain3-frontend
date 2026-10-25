/**
 * Authentication API service client wrapper for user registration, login, logout, and session context.
 */

import { apiClient, ApiClient } from '../lib/api_client';

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  tenant_name: string;
}

export interface RegisterResponse {
  user_id: string;
  email: string;
  tenant_id: string;
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  tenant_id: string;
}

export interface LoginResponse {
  status: string;
  user: UserSummary;
}

export interface LogoutResponse {
  status: string;
}

export interface CurrentUserResponse {
  user_id: string;
  email: string;
  full_name: string;
  tenant_id: string;
}

export class AuthService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Register a new user account and initial tenant.
   */
  public async register(data: RegisterRequest): Promise<RegisterResponse> {
    return this.client.post<RegisterResponse>('/api/v1/auth/register', data);
  }

  /**
   * Authenticate user credentials and establish a server-managed session.
   */
  public async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.client.post<LoginResponse>('/api/v1/auth/login', credentials);
  }

  /**
   * Terminate active user session and clear client session state.
   */
  public async logout(): Promise<LogoutResponse> {
    const response = await this.client.post<LogoutResponse>('/api/v1/auth/logout', {});
    this.client.clearSessionToken();
    return response;
  }

  /**
   * Retrieve current authenticated user profile and tenant context.
   */
  public async getCurrentUser(): Promise<CurrentUserResponse> {
    return this.client.get<CurrentUserResponse>('/api/v1/auth/me');
  }
}

// Default singleton instance
export const authService = new AuthService();

// Standalone function exports for modular usage
export const register = (data: RegisterRequest): Promise<RegisterResponse> =>
  authService.register(data);

export const login = (credentials: LoginRequest): Promise<LoginResponse> =>
  authService.login(credentials);

export const logout = (): Promise<LogoutResponse> => authService.logout();

export const getCurrentUser = (): Promise<CurrentUserResponse> =>
  authService.getCurrentUser();
