import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavMenu, DEFAULT_HUB_LINKS } from '../src/components/nav_menu';
import { AuthContext } from '../src/components/protected_route';
import * as authService from '../src/services/auth';

const mockPush = vi.fn();
let mockPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}));

describe('NavMenu Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/dashboard';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser: authService.CurrentUserResponse = {
    user_id: 'usr_123',
    email: 'jane.doe@example.com',
    full_name: 'Jane Doe',
    tenant_id: 'ten_999',
  };

  it('renders loading state when session is loading', () => {
    render(<NavMenu loading={true} />);

    expect(screen.getByTestId('nav-menu-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();
  });

  it('renders authenticated session details and permitted hub links when user is logged in', () => {
    render(<NavMenu user={mockUser} loading={false} />);

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.getByTestId('nav-user-info')).toBeInTheDocument();
    expect(screen.getByTestId('nav-user-name')).toHaveTextContent('Jane Doe');
    expect(screen.getByTestId('nav-tenant-id')).toHaveTextContent('Tenant: ten_999');

    // Authenticated hub links should be present
    expect(screen.getByTestId('nav-link-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-hubs')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-settings')).toBeInTheDocument();

    // Unauthenticated links should NOT be present
    expect(screen.queryByTestId('nav-link-login')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-register')).not.toBeInTheDocument();

    expect(screen.getByTestId('nav-logout-btn')).toBeInTheDocument();
  });

  it('renders unauthenticated navigation options when no user session exists', () => {
    render(<NavMenu user={null} loading={false} />);

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user-info')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-logout-btn')).not.toBeInTheDocument();

    // Public links should be present
    expect(screen.getByTestId('nav-link-login')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-register')).toBeInTheDocument();

    // Protected hub links should NOT be present
    expect(screen.queryByTestId('nav-link-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-hubs')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-settings')).not.toBeInTheDocument();
  });

  it('consumes user session from AuthContext when props are omitted', () => {
    render(
      <AuthContext.Provider
        value={{
          user: mockUser,
          loading: false,
          refetchUser: async () => {},
        }}
      >
        <NavMenu />
      </AuthContext.Provider>
    );

    expect(screen.getByTestId('nav-user-name')).toHaveTextContent('Jane Doe');
    expect(screen.getByTestId('nav-link-dashboard')).toBeInTheDocument();
  });

  it('handles logout action, calls service logout, refetches auth context, and redirects to login', async () => {
    const mockRefetch = vi.fn().mockResolvedValue(undefined);
    const mockLogoutSpy = vi.spyOn(authService, 'logout').mockResolvedValue({ status: 'logged_out' });
    const mockOnLogoutSuccess = vi.fn();

    render(
      <AuthContext.Provider
        value={{
          user: mockUser,
          loading: false,
          refetchUser: mockRefetch,
        }}
      >
        <NavMenu onLogoutSuccess={mockOnLogoutSuccess} />
      </AuthContext.Provider>
    );

    const logoutBtn = screen.getByTestId('nav-logout-btn');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockLogoutSpy).toHaveBeenCalledTimes(1);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
      expect(mockOnLogoutSuccess).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('supports custom onLogout handler when provided as prop', async () => {
    const customLogout = vi.fn().mockResolvedValue(undefined);

    render(<NavMenu user={mockUser} loading={false} onLogout={customLogout} />);

    const logoutBtn = screen.getByTestId('nav-logout-btn');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(customLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders custom permitted hub links provided via props', () => {
    const customHubs = [
      { title: 'Analytics', href: '/hubs/analytics', requiresAuth: true },
      { title: 'Billing', href: '/hubs/billing', requiresAuth: true },
      { title: 'Public Notice', href: '/notice', requiresAuth: false },
    ];

    render(<NavMenu user={mockUser} loading={false} permittedHubs={customHubs} />);

    expect(screen.getByTestId('nav-link-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-billing')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-public-notice')).not.toBeInTheDocument();
  });

  it('toggles mobile menu drawer when mobile button is clicked', () => {
    render(<NavMenu user={mockUser} loading={false} />);

    const toggleBtn = screen.getByTestId('nav-mobile-toggle');
    expect(screen.queryByTestId('nav-mobile-menu')).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('nav-mobile-menu')).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('nav-mobile-menu')).not.toBeInTheDocument();
  });
});
