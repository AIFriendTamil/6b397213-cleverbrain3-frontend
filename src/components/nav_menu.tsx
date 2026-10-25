'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './protected_route';
import { logout as defaultApiLogout, CurrentUserResponse } from '../services/auth';

export interface HubLink {
  /** Display title for the navigation item */
  title: string;
  /** Route path URL */
  href: string;
  /** Short description or category for editorial layout */
  description?: string;
  /** Whether the link requires an active authenticated user session (true) or unauthenticated session (false) */
  requiresAuth?: boolean;
}

export interface NavMenuProps {
  /** Optional explicit user session object to override AuthContext */
  user?: CurrentUserResponse | null;
  /** Optional explicit loading indicator to override AuthContext */
  loading?: boolean;
  /** Custom list of permitted portal hub links */
  permittedHubs?: HubLink[];
  /** Custom logout handler function */
  onLogout?: () => Promise<void>;
  /** Callback fired after successful logout and redirection */
  onLogoutSuccess?: () => void;
  /** Brand title text displayed in the navigation header */
  brandTitle?: string;
  /** Optional active item or path identifier */
  activeItem?: string;
  activePath?: string;
  /** Optional additional CSS class name */
  className?: string;
}

export const DEFAULT_HUB_LINKS: HubLink[] = [
  { title: 'Dashboard', href: '/dashboard', requiresAuth: true },
  { title: 'Hubs', href: '/hubs', requiresAuth: true },
  { title: 'Settings', href: '/settings', requiresAuth: true },
  { title: 'Login', href: '/login', requiresAuth: false },
  { title: 'Register', href: '/register', requiresAuth: false },
];

/**
 * Navigation menu component rendering active user session details and permitted portal hub links.
 * Conforms to the Linen & Logic editorial design system.
 */
export function NavMenu({
  user: explicitUser,
  loading: explicitLoading,
  permittedHubs = DEFAULT_HUB_LINKS,
  onLogout,
  onLogoutSuccess,
  brandTitle = 'Portal Platform',
  className = '',
}: NavMenuProps) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const contextAuth = useAuth();

  // Resolve session and loading state from explicit props or AuthContext fallback
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;
  const loading = explicitLoading !== undefined ? explicitLoading : contextAuth.loading;

  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Filter permitted hub links based on active user authentication status
  const permittedLinks = permittedHubs.filter((hub) => {
    if (user) {
      // Authenticated session: show links that do not explicitly require unauthenticated status
      return hub.requiresAuth !== false;
    } else {
      // Unauthenticated session: show links that are explicitly public/unauthenticated
      return hub.requiresAuth === false;
    }
  });

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      if (onLogout) {
        await onLogout();
      } else {
        await defaultApiLogout();
      }
      if (contextAuth.refetchUser) {
        await contextAuth.refetchUser().catch(() => {});
      }
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }
      router.push('/login');
    } catch (err) {
      // Output warning context for unexpected logout failure
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleMobileMenu = () => {
    setMobileOpen((prev) => !prev);
  };

  if (loading) {
    return (
      <header
        data-testid="nav-menu-loading"
        className={className}
        style={{
          backgroundColor: '#fbf9f4',
          borderBottom: '1px solid #d1c4b9',
          padding: '16px 24px',
          fontFamily: 'DM Sans, sans-serif',
          color: '#80756b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontFamily: 'Libre Caslon Text, Georgia, serif', fontSize: '20px', color: '#59452b' }}>
          {brandTitle}
        </div>
        <div style={{ fontSize: '14px' }}>Loading session...</div>
      </header>
    );
  }

  return (
    <header
      data-testid="nav-menu"
      className={className}
      style={{
        backgroundColor: '#fbf9f4',
        borderBottom: '1px solid #d1c4b9',
        fontFamily: 'DM Sans, sans-serif',
        color: '#1b1c19',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href={user ? '/dashboard' : '/'}
            style={{
              fontFamily: 'Libre Caslon Text, Georgia, serif',
              fontSize: '22px',
              fontWeight: '400',
              color: '#59452b',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
            }}
            data-testid="nav-brand"
          >
            {brandTitle}
          </Link>
        </div>

        {/* Desktop Navigation & Permitted Hub Links */}
        <nav
          aria-label="Main Navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            {permittedLinks.map((hub) => {
              const isActive = pathname === hub.href || (hub.href !== '/' && pathname.startsWith(hub.href));
              const linkId = hub.title.toLowerCase().replace(/\s+/g, '-');
              return (
                <Link
                  key={hub.href}
                  href={hub.href}
                  data-testid={`nav-link-${linkId}`}
                  style={{
                    fontSize: '14px',
                    fontWeight: isActive ? '600' : '400',
                    color: isActive ? '#59452b' : '#4e453d',
                    textDecoration: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#f5f3ee' : 'transparent',
                    borderBottom: isActive ? '2px solid #59452b' : '2px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {hub.title}
                </Link>
              );
            })}
          </div>

          {/* User Session Details or Auth Actions */}
          {user ? (
            <div
              data-testid="nav-user-info"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                paddingLeft: '16px',
                borderLeft: '1px solid #d1c4b9',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                <span
                  data-testid="nav-user-name"
                  style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#1b1c19',
                  }}
                >
                  {user.full_name || user.email}
                </span>
                <span
                  data-testid="nav-tenant-id"
                  style={{
                    fontSize: '11px',
                    color: '#80756b',
                    letterSpacing: '0.05em',
                  }}
                >
                  Tenant: {user.tenant_id}
                </span>
              </div>

              <button
                type="button"
                data-testid="nav-logout-btn"
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#ffffff',
                  backgroundColor: '#59452b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 14px',
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  opacity: isLoggingOut ? 0.7 : 1,
                  transition: 'background-color 0.2s ease',
                }}
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          ) : null}
        </nav>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          data-testid="nav-mobile-toggle"
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
          onClick={toggleMobileMenu}
          style={{
            display: 'none', // Controlled via CSS / media queries if used
            background: 'none',
            border: '1px solid #d1c4b9',
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '16px',
            cursor: 'pointer',
            color: '#59452b',
          }}
        >
          ☰
        </button>
      </div>

      {/* Mobile Drawer Navigation Links */}
      {mobileOpen ? (
        <div
          data-testid="nav-mobile-menu"
          style={{
            borderTop: '1px solid #d1c4b9',
            backgroundColor: '#f5f3ee',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {permittedLinks.map((hub) => {
            const linkId = hub.title.toLowerCase().replace(/\s+/g, '-');
            return (
              <Link
                key={hub.href}
                href={hub.href}
                data-testid={`mobile-nav-link-${linkId}`}
                onClick={() => setMobileOpen(false)}
                style={{
                  fontSize: '15px',
                  color: '#59452b',
                  textDecoration: 'none',
                  padding: '6px 0',
                }}
              >
                {hub.title}
              </Link>
            );
          })}
          {user ? (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #d1c4b9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>{user.full_name}</div>
                <div style={{ fontSize: '11px', color: '#80756b' }}>Tenant: {user.tenant_id}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  fontSize: '13px',
                  color: '#ffffff',
                  backgroundColor: '#59452b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export default NavMenu;
