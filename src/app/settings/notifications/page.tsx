'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../../components/protected_route';
import { NavMenu } from '../../../components/nav_menu';
import { CurrentUserResponse } from '../../../services/auth';
import {
  PreferenceMatrix,
  DEFAULT_MOCK_PREFERENCES,
} from '../../../components/notifications/PreferenceMatrix';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreference,
  NotificationPreferenceUpdate,
  NotificationPreferenceMatrixUpdate,
  NotificationCategory,
} from '../../../services/financialApi';

export interface NotificationSettingsPageProps {
  /** Optional explicit authenticated user context override (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Custom session fetcher passed to ProtectedRoute */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded notification preference records */
  initialPreferences?: NotificationPreference[] | null;
  /** Custom fetcher for notification preferences */
  fetchPreferences?: () => Promise<NotificationPreference[]>;
  /** Custom updater for notification preferences */
  updatePreferences?: (
    payload: NotificationPreferenceUpdate[] | NotificationPreferenceMatrixUpdate
  ) => Promise<NotificationPreference[]>;
  /** Whether to automatically fetch preferences on mount (default: true) */
  autoFetch?: boolean;
  /** Read-only mode flag */
  readOnly?: boolean;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Inner Notification Settings Page Content component consuming active user session context.
 * Integrates the multi-channel notification preference matrix (Email, SMS, In-App) across
 * Financial, Milestone, and SLA event categories with immediate dispatch propagation (NFR-3).
 * Styled following the Linen & Logic editorial design system.
 */
function _NotificationSettingsContent({
  user: explicitUser,
  onLogout,
  initialPreferences = null,
  fetchPreferences: customFetchPreferences,
  updatePreferences: customUpdatePreferences,
  autoFetch = true,
  readOnly = false,
  className = '',
  'data-testid': testId = 'notification-settings-page',
}: NotificationSettingsPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Local state for notification preferences
  const [preferences, setPreferences] = useState<NotificationPreference[]>(() => {
    if (initialPreferences && initialPreferences.length > 0) {
      return initialPreferences;
    }
    return DEFAULT_MOCK_PREFERENCES;
  });

  const [isLoading, setIsLoading] = useState<boolean>(autoFetch && !initialPreferences);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Fetch notification preferences from API or custom prop fetcher.
   */
  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data: NotificationPreference[];
      if (customFetchPreferences) {
        data = await customFetchPreferences();
      } else {
        data = await getNotificationPreferences();
      }

      if (data && data.length > 0) {
        setPreferences(data);
      } else {
        // Use default mock preferences if backend returns empty dataset
        setPreferences(DEFAULT_MOCK_PREFERENCES);
      }
    } catch (err: any) {
      console.error('Error fetching notification preferences:', err);
      const errMsg = err?.message || 'Failed to load notification preferences from server.';
      setError(errMsg);
      // Fallback to default mock preferences on error so UI remains usable
      if (!preferences || preferences.length === 0) {
        setPreferences(DEFAULT_MOCK_PREFERENCES);
      }
    } finally {
      setIsLoading(false);
    }
  }, [customFetchPreferences, preferences]);

  // Initial load effect
  useEffect(() => {
    if (autoFetch) {
      loadPreferences();
    }
  }, [autoFetch, loadPreferences]);

  /**
   * Handle updates to preference matrix entries.
   */
  const handleUpdatePreferences = useCallback(
    async (updates: NotificationPreferenceUpdate[]) => {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      try {
        let result: NotificationPreference[];
        if (customUpdatePreferences) {
          result = await customUpdatePreferences(updates);
        } else {
          result = await updateNotificationPreferences(updates);
        }

        if (result && result.length > 0) {
          setPreferences(result);
        } else {
          // Optimistically update local state if result is empty
          setPreferences((prev) =>
            prev.map((pref) => {
              const matched = updates.find(
                (u) => String(u.category).toLowerCase() === String(pref.category).toLowerCase()
              );
              if (matched) {
                return {
                  ...pref,
                  channel_email: matched.channel_email ?? pref.channel_email,
                  channel_sms: matched.channel_sms ?? pref.channel_sms,
                  channel_in_app: matched.channel_in_app ?? pref.channel_in_app,
                  phone_number: matched.phone_number !== undefined ? matched.phone_number : pref.phone_number,
                  updated_at: new Date().toISOString(),
                };
              }
              return pref;
            })
          );
        }

        setSuccessMessage('Notification channel preferences updated and propagated immediately (NFR-3).');
      } catch (err: any) {
        console.error('Failed to save notification preferences:', err);
        const errMsg = err?.message || 'Failed to update notification preferences.';
        setError(errMsg);
      } finally {
        setIsSaving(false);
      }
    },
    [customUpdatePreferences]
  );

  /**
   * Handle single channel toggle switch event.
   */
  const handleToggleChannel = useCallback(
    async (category: NotificationCategory, channel: 'email' | 'sms' | 'in_app', enabled: boolean) => {
      setError(null);
      setSuccessMessage(null);

      // Find target preference or construct default update
      const existing = preferences.find(
        (p) => String(p.category).toLowerCase() === String(category).toLowerCase()
      );

      const email = channel === 'email' ? enabled : existing ? existing.channel_email : true;
      const sms = channel === 'sms' ? enabled : existing ? existing.channel_sms : false;
      const inApp = channel === 'in_app' ? enabled : existing ? existing.channel_in_app : true;
      const phone = existing?.phone_number || null;

      const payload: NotificationPreferenceUpdate[] = [
        {
          category,
          channel_email: email,
          channel_sms: sms,
          channel_in_app: inApp,
          phone_number: phone,
        },
      ];

      await handleUpdatePreferences(payload);
    },
    [preferences, handleUpdatePreferences]
  );

  /**
   * Handle phone number change for SMS channel dispatches.
   */
  const handlePhoneNumberChange = useCallback(
    async (phoneNumber: string) => {
      setError(null);
      setSuccessMessage(null);

      const payload: NotificationPreferenceUpdate[] = preferences.map((p) => ({
        category: p.category,
        channel_email: p.channel_email,
        channel_sms: p.channel_sms,
        channel_in_app: p.channel_in_app,
        phone_number: phoneNumber,
      }));

      await handleUpdatePreferences(payload);
    },
    [preferences, handleUpdatePreferences]
  );

  /**
   * Handle bulk matrix save operation.
   */
  const handleSaveAll = useCallback(
    async (matrix: NotificationPreferenceMatrixUpdate) => {
      await handleUpdatePreferences(matrix.preferences);
    },
    [handleUpdatePreferences]
  );

  return (
    <div
      className={`notification-settings-page ${className}`}
      data-testid={testId}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      {/* NAVIGATION BAR */}
      <NavMenu user={user} onLogout={onLogout} brandTitle="Portal Platform" />

      {/* MAIN CONTAINER */}
      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
        }}
      >
        {/* BREADCRUMB NAVIGATION & QUICK LINKS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '24px',
            fontSize: '13px',
            color: 'var(--color-on-surface-variant, #4e453d)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              href="/dashboard"
              style={{
                color: 'var(--color-primary, #59452b)',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              Dashboard
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--color-outline, #80756b)' }}>Settings</span>
            <span>/</span>
            <span style={{ fontWeight: '600', color: 'var(--color-on-surface, #1b1c19)' }}>
              Notifications
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link
              href="/notifications"
              data-testid="link-to-notification-hub"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--color-primary, #59452b)',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <span>🔔</span> Go to Central Notification Hub →
            </Link>

            <Link
              href="/financial-hub"
              data-testid="link-to-financial-hub"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--color-primary, #59452b)',
                textDecoration: 'none',
                fontWeight: '500',
                fontSize: '13px',
              }}
            >
              <span>💰</span> Financial Hub
            </Link>
          </div>
        </div>

        {/* PAGE HERO HEADER */}
        <div
          style={{
            marginBottom: '32px',
            paddingBottom: '24px',
            borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>⚙️</span>
            <h1
              style={{
                margin: 0,
                fontSize: '32px',
                fontFamily: 'var(--font-serif, serif)',
                fontWeight: '400',
                color: 'var(--color-primary, #59452b)',
                letterSpacing: '-0.01em',
              }}
            >
              Notification Channel Settings Matrix
            </h1>
          </div>

          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '16px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              maxWidth: '820px',
              lineHeight: '1.6',
            }}
          >
            Manage multi-channel alert delivery preferences (Email, SMS, and In-App Hub) across
            critical event categories: <strong>Financial Alerts</strong>, <strong>Milestones</strong>,
            and <strong>SLA Breaches</strong> (FR-6, FR-7). Preference updates take effect
            immediately for all subsequent event dispatches (NFR-3).
          </p>

          {/* REQUIREMENT BADGES */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                color: 'var(--color-primary, #59452b)',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              [FR-6] Centralized Multi-Channel Matrix
            </span>

            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                color: '#4a5d73',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              [FR-7] Category-Specific Dispatches
            </span>

            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: '#e8f5e9',
                color: '#2e6b38',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              [NFR-3] Immediate Dispatch Propagation
            </span>
          </div>
        </div>

        {/* PREFERENCE MATRIX COMPONENT */}
        <section data-testid="notification-matrix-section">
          <PreferenceMatrix
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            onToggleChannel={handleToggleChannel}
            onPhoneNumberChange={handlePhoneNumberChange}
            onSaveAll={handleSaveAll}
            onRefresh={loadPreferences}
            isLoading={isLoading}
            isSaving={isSaving}
            error={error}
            successMessage={successMessage}
            readOnly={readOnly}
          />
        </section>

        {/* FOOTER INFORMATIONAL CARDS */}
        <div
          style={{
            marginTop: '40px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              boxShadow: '0 2px 10px rgba(115, 92, 65, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                NFR-3 Propagation Speed
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', lineHeight: '1.5' }}>
              All matrix modifications update the Redis gateway cache and Celery dispatch workers synchronously.
              Subsequent event notifications adhere immediately to your newly saved channels.
            </p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              boxShadow: '0 2px 10px rgba(115, 92, 65, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔒</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                E.164 Phone Verification
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', lineHeight: '1.5' }}>
              SMS text dispatches require a verified international mobile phone number formatted in E.164
              (e.g., <code>+14155552671</code>). Unverified numbers automatically hold SMS dispatches until updated.
            </p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              boxShadow: '0 2px 10px rgba(115, 92, 65, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                In-App Hub Retention
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', lineHeight: '1.5' }}>
              In-app alerts enabled for Financial, Milestone, or SLA events appear in your Central Notification Hub.
              You can filter, mark as read, or clear alert records directly from the hub page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Default export wrapping content in ProtectedRoute guard for session authentication.
 */
export default function NotificationSettingsPage(props: any = {}) {
  return (
    <ProtectedRoute fetchUser={props?.fetchUser}>
      <_NotificationSettingsContent {...props} />
    </ProtectedRoute>
  );
}
