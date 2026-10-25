import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../src/app/login/page';
import { ApiError } from '../src/lib/api_client';
import { LoginRequest, LoginResponse } from '../src/services/auth';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/login',
}));

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const validCredentials = {
    email: 'user@example.com',
    password: 'SecurePassword123!',
  };

  const mockLoginResponse: LoginResponse = {
    status: 'success',
    user: {
      id: 'usr-123',
      email: 'user@example.com',
      full_name: 'Test User',
      tenant_id: 'tnt-456',
    },
  };

  it('renders login form and inputs correctly', () => {
    render(<LoginPage />);

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('register-link')).toBeInTheDocument();
  });

  it('validates empty inputs and shows error message without calling loginFn', async () => {
    const mockLoginFn = vi.fn();
    render(<LoginPage loginFn={mockLoginFn} />);

    const submitBtn = screen.getByTestId('login-submit-btn');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Please enter both email and password.'
    );
    expect(mockLoginFn).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    const mockLoginFn = vi.fn();
    render(<LoginPage loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'invalid-email-format' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByTestId('login-submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Please enter a valid email address.'
    );
    expect(mockLoginFn).not.toHaveBeenCalled();
  });

  it('submits valid credentials, displays success message, calls onSuccess, and redirects', async () => {
    const mockLoginFn = vi.fn().mockResolvedValue(mockLoginResponse);
    const mockOnSuccess = vi.fn();

    render(<LoginPage loginFn={mockLoginFn} onSuccess={mockOnSuccess} />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: `  ${validCredentials.email}  ` },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: validCredentials.password },
    });

    fireEvent.click(screen.getByTestId('login-submit-btn'));

    expect(mockLoginFn).toHaveBeenCalledWith({
      email: validCredentials.email,
      password: validCredentials.password,
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toHaveTextContent(
        'Login successful! Redirecting...'
      );
    });

    expect(mockOnSuccess).toHaveBeenCalledWith(mockLoginResponse);

    // Fast-forward timers for router redirection
    vi.advanceTimersByTime(500);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to specified custom redirectTo path after successful login', async () => {
    const mockLoginFn = vi.fn().mockResolvedValue(mockLoginResponse);

    render(<LoginPage loginFn={mockLoginFn} redirectTo="/hubs" />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: validCredentials.email },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: validCredentials.password },
    });

    fireEvent.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });

    vi.advanceTimersByTime(500);

    expect(mockPush).toHaveBeenCalledWith('/hubs');
  });

  it('handles invalid credentials (401 ApiError) correctly', async () => {
    const apiError = new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    const mockLoginFn = vi.fn().mockRejectedValue(apiError);

    render(<LoginPage loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: validCredentials.email },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'WrongPassword' },
    });

    fireEvent.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Invalid email or password. Please try again.'
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles general API error on submission failure', async () => {
    const apiError = new ApiError('Server maintenance in progress', 503, 'SERVICE_UNAVAILABLE');
    const mockLoginFn = vi.fn().mockRejectedValue(apiError);

    render(<LoginPage loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: validCredentials.email },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: validCredentials.password },
    });

    fireEvent.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Server maintenance in progress'
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
