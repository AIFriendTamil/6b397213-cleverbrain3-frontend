'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NavMenu } from '../../components/nav_menu';
import { register as defaultRegister, RegisterRequest, RegisterResponse } from '../../services/auth';
import { ApiError } from '../../lib/api_client';

export interface RegisterPageProps {
  /** Optional custom registration function for dependency injection in tests */
  registerFn?: (data: RegisterRequest) => Promise<RegisterResponse>;
  /** Optional callback after successful registration */
  onSuccess?: (response: RegisterResponse) => void;
}

/**
 * User Registration page and input form component.
 * Allows unauthenticated users to create an account with required profile fields and tenant details.
 * Formatted following the Linen & Logic editorial design system.
 */
export default function RegisterPage(props: any = {}) {
  const {
    registerFn = defaultRegister,
    onSuccess,
  } = props || {};
  const router = useRouter();

  const [fullName, setFullName] = useState<string>('');
  const [tenantName, setTenantName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Client-side validation
    const trimmedFullName = fullName.trim();
    const trimmedTenantName = tenantName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFullName || !trimmedTenantName || !trimmedEmail || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const requestData: RegisterRequest = {
        full_name: trimmedFullName,
        tenant_name: trimmedTenantName,
        email: trimmedEmail,
        password,
      };

      const response = await registerFn(requestData);

      setSuccessMessage('Account created successfully! Redirecting to login...');

      if (onSuccess) {
        onSuccess(response);
      }

      // Redirect user to login page
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'ACCOUNT_EXISTS') {
          setError('An account with this email address already exists.');
        } else {
          setError(err.message || 'Registration failed. Please check your inputs and try again.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during registration.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="register-page"
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
            maxWidth: '480px',
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
              Get Started
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
              Create an Account
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                margin: 0,
              }}
            >
              Enter your details to register a new account and organization workspace.
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
              {successMessage}{' '}
              <Link
                href="/login"
                data-testid="login-link-success"
                style={{
                  fontWeight: 600,
                  color: '#137333',
                  textDecoration: 'underline',
                }}
              >
                Log in now
              </Link>
            </div>
          )}

          <form data-testid="register-form" onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="fullName"
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
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                data-testid="full-name-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
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

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="tenantName"
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
                Organization / Tenant Name
              </label>
              <input
                id="tenantName"
                name="tenantName"
                type="text"
                data-testid="tenant-name-input"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="e.g. Acme Corp"
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

            <div style={{ marginBottom: '20px' }}>
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
                placeholder="At least 8 characters"
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
                htmlFor="confirmPassword"
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
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                data-testid="confirm-password-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
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
              data-testid="register-submit-btn"
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
              {isSubmitting ? 'Creating Account...' : 'Register Account'}
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
            Already have an account?{' '}
            <Link
              href="/login"
              data-testid="login-link"
              style={{
                color: 'var(--color-primary, #59452b)',
                fontWeight: 500,
              }}
            >
              Log in
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
