'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NavMenu } from '../../components/nav_menu';
import { login as defaultLogin, LoginRequest, LoginResponse } from '../../services/auth';
import { ApiError } from '../../lib/api_client';

export interface LoginPageProps {
  /** Optional custom login function for dependency injection in tests */
  loginFn?: (credentials: LoginRequest) => Promise<LoginResponse>;
  /** Optional callback after successful login */
  onSuccess?: (response: LoginResponse) => void;
  /** Optional default redirect path */
  redirectTo?: string;
}

/**
 * User Login page and user authentication form component.
 * Allows unauthenticated users to authenticate with credentials and establish a server session.
 * Formatted following the Linen & Logic editorial design system.
 */
export default function LoginPage(props: any = {}) {
  const {
    loginFn = defaultLogin,
    onSuccess,
    redirectTo = '/dashboard',
  } = props || {};
  const router = useRouter();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();

    // Client-side validation
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const credentials: LoginRequest = {
        email: trimmedEmail,
        password,
      };

      const response = await loginFn(credentials);

      setSuccessMessage('Login successful! Redirecting...');

      if (onSuccess) {
        onSuccess(response);
      }

      // Resolve redirect destination (query param 'redirect' or default prop)
      let targetPath = redirectTo;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const queryRedirect = urlParams.get('redirect');
        if (queryRedirect) {
          targetPath = queryRedirect;
        }
      }

      setTimeout(() => {
        router.push(targetPath);
      }, 500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
          setError('Invalid email or password. Please try again.');
        } else {
          setError(err.message || 'Login failed. Please check your credentials and try again.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during login.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="login-page"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        color: 'var(--color-on-surface, #1b1c19)',
        fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NavMenu />

      <main
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
            boxShadow: '0 4px 20px rgba(115, 92, 65, 0.06)',
            padding: '40px',
          }}
        >
          <header style={{ marginBottom: '32px', textAlign: 'center' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-primary, #59452b)',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Welcome Back
            </span>
            <h1
              style={{
                fontFamily: "var(--font-serif, 'Libre Caslon Text', Georgia, serif)",
                fontSize: '28px',
                fontWeight: 400,
                color: 'var(--color-on-surface, #1b1c19)',
                margin: '0 0 8px 0',
                lineHeight: 1.2,
              }}
            >
              Sign In to Your Account
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                margin: 0,
              }}
            >
              Enter your credentials to access your organization workspace.
            </p>
          </header>

          {error && (
            <div
              data-testid="error-message"
              role="alert"
              style={{
                backgroundColor: 'var(--color-error-container, #ffdad6)',
                color: 'var(--color-on-error-container, #93000a)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                fontSize: '14px',
                marginBottom: '24px',
                borderLeft: '4px solid var(--color-error, #ba1a1a)',
              }}
            >
              {error}
            </div>
          )}

          {successMessage && (
            <div
              data-testid="success-message"
              role="status"
              style={{
                backgroundColor: '#e6f4ea',
                color: '#137333',
                padding: '12px 16px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                fontSize: '14px',
                marginBottom: '24px',
                borderLeft: '4px solid #137333',
              }}
            >
              {successMessage}
            </div>
          )}

          <form data-testid="login-form" onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '6px',
                }}
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                data-testid="email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={isSubmitting}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                data-testid="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isSubmitting}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '15px',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              data-testid="login-submit-btn"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--color-on-primary, #ffffff)',
                backgroundColor: isSubmitting
                  ? 'var(--color-outline, #80756b)'
                  : 'var(--color-primary, #59452b)',
                border: 'none',
                borderRadius: 'var(--radius-default, 0.25rem)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <footer
            style={{
              marginTop: '28px',
              textAlign: 'center',
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              data-testid="register-link"
              style={{
                color: 'var(--color-primary, #59452b)',
                fontWeight: 500,
              }}
            >
              Register
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
