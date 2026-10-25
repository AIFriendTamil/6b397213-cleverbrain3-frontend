import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '../src/app/register/page';
import { ApiError } from '../src/lib/api_client';
import { RegisterRequest, RegisterResponse } from '../src/services/auth';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/register',
}));

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const validData = {
    fullName: 'Alice Smith',
    tenantName: 'Acme Corp',
    email: 'alice@acme.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  it('renders registration form and inputs correctly', () => {
    render(<RegisterPage />);

    expect(screen.getByTestId('register-page')).toBeInTheDocument();
    expect(screen.getByTestId('register-form')).toBeInTheDocument();
    expect(screen.getByTestId('full-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('register-submit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('login-link')).toBeInTheDocument();
  });

  it('validates empty inputs and shows error message without calling registerFn', async () => {
    const mockRegisterFn = vi.fn();
    render(<RegisterPage registerFn={mockRegisterFn} />);

    const submitBtn = screen.getByTestId('register-submit-btn');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Please fill in all required fields.'
    );
    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    const mockRegisterFn = vi.fn();
    render(<RegisterPage registerFn={mockRegisterFn} />);

    fireEvent.change(screen.getByTestId('full-name-input'), { target: { value: validData.fullName } });
    fireEvent.change(screen.getByTestId('tenant-name-input'), { target: { value: validData.tenantName } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: validData.password } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: validData.confirmPassword } });

    fireEvent.click(screen.getByTestId('register-submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Please enter a valid email address.'
    );
    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  it('validates password minimum length requirement', async () => {
    const mockRegisterFn = vi.fn();
    render(<RegisterPage registerFn={mockRegisterFn} />);

    fireEvent.change(screen.getByTestId('full-name-input'), { target: { value: validData.fullName } });
    fireEvent.change(screen.getByTestId('tenant-name-input'), { target: { value: validData.tenantName } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: validData.email } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: '123' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: '123' } });

    fireEvent.click(screen.getByTestId('register-submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Password must be at least 8 characters long.'
    );
    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  it('validates password mismatch', async () => {
    const mockRegisterFn = vi.fn();
    render(<RegisterPage registerFn={mockRegisterFn} />);

    fireEvent.change(screen.getByTestId('full-name-input'), { target: { value: validData.fullName } });
    fireEvent.change(screen.getByTestId('tenant-name-input'), { target: { value: validData.tenantName } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: validData.email } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'DifferentPass123!' } });

    fireEvent.click(screen.getByTestId('register-submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Passwords do not match.'
    );
    expect(mockRegisterFn).not.toHaveBeenCalled();
  });

  it('handles successful registration submission', async () => {
    const mockResponse: RegisterResponse = {
      user_id: 'usr_456',
      email: 'alice@acme.com',
      tenant_id: 'ten_789',
      full_name: 'Alice Smith',
    };
    const mockRegisterFn = vi.fn<[RegisterRequest], Promise<RegisterResponse>>().mockResolvedValue(mockResponse);
    const mockOnSuccess = vi.fn();

    render(<RegisterPage registerFn={mockRegisterFn} onSuccess={mockOnSuccess} />);

    fireEvent.change(screen.getByTestId('full-name-input'), { target: { value: validData.fullName } });
    fireEvent.change(screen.getByTestId('tenant-name-input'), { target: { value: validData.tenantName } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: validData.email } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: validData.password } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: validData.confirmPassword } });

    fireEvent.click(screen.getByTestId('register-submit-btn'));

    await waitFor(() => {
      expect(mockRegisterFn).toHaveBeenCalledWith({
        full_name: 'Alice Smith',
        tenant_name: 'Acme Corp',
        email: 'alice@acme.com',
        password: 'Password123!',
      });
    });

    expect(screen.getByTestId('success-message')).toHaveTextContent(
      'Account created successfully! Redirecting to login...'
    );
    expect(mockOnSuccess).toHaveBeenCalledWith(mockResponse);

    // Fast-forward timeout to verify router navigation
    vi.advanceTimersByTime(1000);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('displays error message on 409 ACCOUNT_EXISTS conflict error', async () => {
    const conflictError = new ApiError('Conflict error', 409, 'ACCOUNT_EXISTS');
    const mockRegisterFn = vi.fn<[RegisterRequest], Promise<RegisterResponse>>().mockRejectedValue(conflictError);

    render(<RegisterPage registerFn={mockRegisterFn} />);

    fireEvent.change(screen.getByTestId('full-name-input'), { target: { value: validData.fullName } });
    fireEvent.change(screen.getByTestId('tenant-name-input'), { target: { value: validData.tenantName } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: validData.email } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: validData.password } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: validData.confirmPassword } });

    fireEvent.click(screen.getByTestId('register-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'An account with this email address already exists.'
      );
    });
  });

  it('displays generic ApiError message when API call fails', async () => {
    const apiError = new ApiError('Invalid request parameters', 400, 'VALIDATION_ERROR');
    const mockRegisterFn = vi.fn<[RegisterRequest], Promise<RegisterResponse>>().mockRejectedValue(apiError);

    render(<RegisterPage registerFn={mockRegisterFn} />);

    fireEvent.change(screen.getByTestId('full-name-input'), { target: { value: validData.fullName } });
    fireEvent.change(screen.getByTestId('tenant-name-input'), { target: { value: validData.tenantName } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: validData.email } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: validData.password } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: validData.confirmPassword } });

    fireEvent.click(screen.getByTestId('register-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Invalid request parameters'
      );
    });
  });
});
