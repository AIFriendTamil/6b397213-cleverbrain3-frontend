import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedRoute, useAuth } from '../src/components/protected_route';
import { ApiError } from '../src/lib/api_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially while checking authentication', async () => {
    const mockGetUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                user_id: 'usr_123',
                email: 'user@example.com',
                full_name: 'Test User',
                tenant_id: 'ten_456',
              }),
            50
          )
        )
    );

    render(
      <ProtectedRoute fetchUser={mockGetUser}>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('renders custom fallback while loading if provided', async () => {
    const mockGetUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                user_id: 'usr_123',
                email: 'user@example.com',
                full_name: 'Test User',
                tenant_id: 'ten_456',
              }),
            50
          )
        )
    );

    render(
      <ProtectedRoute
        fetchUser={mockGetUser}
        fallback={<div data-testid="custom-fallback">Custom Loader</div>}
      >
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('renders protected children when user is authenticated', async () => {
    const mockUser = {
      user_id: 'usr_123',
      email: 'user@example.com',
      full_name: 'Test User',
      tenant_id: 'ten_456',
    };
    const mockGetUser = vi.fn().mockResolvedValueOnce(mockUser);

    render(
      <ProtectedRoute fetchUser={mockGetUser}>
        <div data-testid="protected-content">Dashboard Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to /login and hides children when user is unauthenticated', async () => {
    const mockGetUser = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Unauthorized', 401, 'UNAUTHORIZED'));

    render(
      <ProtectedRoute fetchUser={mockGetUser}>
        <div data-testid="protected-content">Secret Portal</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to custom redirectTo path when unauthenticated', async () => {
    const mockGetUser = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Unauthorized', 401, 'UNAUTHORIZED'));

    render(
      <ProtectedRoute fetchUser={mockGetUser} redirectTo="/auth/signin">
        <div>Private Page</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/signin');
    });
  });

  it('provides AuthContext to child components', async () => {
    const mockUser = {
      user_id: 'usr_123',
      email: 'user@example.com',
      full_name: 'Test User',
      tenant_id: 'ten_456',
    };
    const mockGetUser = vi.fn().mockResolvedValueOnce(mockUser);

    function TestChild() {
      const { user } = useAuth();
      return <div data-testid="user-email">{user?.email}</div>;
    }

    render(
      <ProtectedRoute fetchUser={mockGetUser}>
        <TestChild />
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('user@example.com');
    });
  });
});
