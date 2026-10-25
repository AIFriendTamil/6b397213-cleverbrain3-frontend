'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  NotificationCategory,
  NotificationPreference,
  NotificationPreferenceUpdate,
  NotificationPreferenceMatrixUpdate,
  updateNotificationPreferences,
  getNotificationPreferences,
} from '../../services/financialApi';

export interface PreferenceMatrixProps {
  /** Array of current notification preference records from API */
  preferences?: NotificationPreference[] | null;
  /** Callback fired when a single or set of category preferences are updated */
  onUpdatePreferences?: (updatedPreferences: NotificationPreferenceUpdate[]) => Promise<void> | void;
  /** Callback fired when a single category channel toggle is switched immediately */
  onToggleChannel?: (
    category: NotificationCategory,
    channel: 'email' | 'sms' | 'in_app',
    enabled: boolean
  ) => Promise<void> | void;
  /** Callback fired when global mobile phone number is updated */
  onPhoneNumberChange?: (phoneNumber: string) => Promise<void> | void;
  /** Callback fired for bulk matrix saving */
  onSaveAll?: (matrix: NotificationPreferenceMatrixUpdate) => Promise<void> | void;
  /** Callback fired to refresh preference data from API */
  onRefresh?: () => void;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Saving/processing state indicator */
  isSaving?: boolean;
  /** Error message string if network operation failed */
  error?: string | null;
  /** Success message string to display */
  successMessage?: string | null;
  /** Read-only mode flag */
  readOnly?: boolean;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Summary metrics aggregated across preference matrix entries.
 */
export interface PreferenceMetricsSummary {
  totalCategories: number;
  enabledEmailCount: number;
  enabledSmsCount: number;
  enabledInAppCount: number;
  totalActiveChannels: number;
  maxPossibleChannels: number;
  coveragePercentage: number;
  hasValidPhoneNumber: boolean;
  smsConfiguredWithoutPhone: boolean;
}

/**
 * Category metadata interface for Linen & Logic visual styling.
 */
export interface CategoryDetails {
  key: NotificationCategory;
  label: string;
  badge: string;
  description: string;
  icon: string;
  colorHex: string;
  sampleEvents: string[];
}

/**
 * Channel metadata interface for matrix table columns.
 */
export interface ChannelDetails {
  key: 'email' | 'sms' | 'in_app';
  label: string;
  badge: string;
  description: string;
  icon: string;
  gatewayName: string;
}

/**
 * Default mock notification preference dataset adhering to Linen & Logic domain schemas.
 */
export const DEFAULT_MOCK_PREFERENCES: NotificationPreference[] = [
  {
    id: 'pref-fin-001',
    user_id: 'usr-fin-exec-101',
    category: 'Financial',
    channel_email: true,
    channel_sms: true,
    channel_in_app: true,
    phone_number: '+14155552671',
    updated_at: '2026-10-24T12:00:00Z',
  },
  {
    id: 'pref-mil-002',
    user_id: 'usr-fin-exec-101',
    category: 'Milestone',
    channel_email: true,
    channel_sms: false,
    channel_in_app: true,
    phone_number: '+14155552671',
    updated_at: '2026-10-24T12:00:00Z',
  },
  {
    id: 'pref-sla-003',
    user_id: 'usr-fin-exec-101',
    category: 'SLA',
    channel_email: true,
    channel_sms: true,
    channel_in_app: true,
    phone_number: '+14155552671',
    updated_at: '2026-10-24T12:00:00Z',
  },
];

/**
 * Validate phone number against E.164 international format standard (e.g. +14155552671).
 */
export function validateE164Phone(phoneNumber: string | undefined | null): boolean {
  if (!phoneNumber || !phoneNumber.trim()) {
    return false;
  }
  const cleaned = phoneNumber.trim();
  // Standard E.164 format: leading +, followed by 1 to 15 digits (no leading 0 after country code)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(cleaned);
}

/**
 * Retrieve visual category metadata and sample event triggers.
 */
export function getCategoryDetails(category: NotificationCategory): CategoryDetails {
  const norm = String(category).toLowerCase();
  if (norm.includes('fin')) {
    return {
      key: 'Financial',
      label: 'Financial Alerts & Revenue',
      badge: 'High Impact',
      description: 'Invoice overdue warnings, quote approval escalations, AR aging 90+ day spikes, and ARR metric anomalies.',
      icon: '💰',
      colorHex: '#59452b',
      sampleEvents: [
        'Invoice Overdue > 30 Days',
        'Commercial Quote Requires Approval',
        'ARR Trend Threshold Warning',
      ],
    };
  }
  if (norm.includes('mil')) {
    return {
      key: 'Milestone',
      label: 'Milestones & Agreements',
      badge: 'Core Workflow',
      description: 'Contract 90/60/30-day renewal warnings, deal stage transitions, e-signature executions, and milestone achievements.',
      icon: '🚩',
      colorHex: '#4a5d73',
      sampleEvents: [
        'Contract Expiration in 30 Days',
        'E-Signature Execution Completed',
        'Deal Pipeline Stage Won',
      ],
    };
  }
  return {
    key: 'SLA',
    label: 'SLA Breaches & Support',
    badge: 'Critical Escalation',
    description: 'P1/P2 support ticket response SLA breach alerts, tier-2 escalation dispatches, and critical service incidents.',
    icon: '🚨',
    colorHex: '#a43b2c',
    sampleEvents: [
      'P1 Ticket Response SLA Warning',
      'Ticket Escalated to Tier 2',
      'Critical Service SLA Breach',
    ],
  };
}

/**
 * Retrieve channel visual metadata and delivery gateway info.
 */
export function getChannelDetails(channel: 'email' | 'sms' | 'in_app'): ChannelDetails {
  switch (channel) {
    case 'email':
      return {
        key: 'email',
        label: 'Email Channel',
        badge: 'SMTP / Gateway',
        description: 'Formatted HTML alert messages dispatched to registered user primary email.',
        icon: '✉️',
        gatewayName: 'Outbound Email Adapter',
      };
    case 'sms':
      return {
        key: 'sms',
        label: 'SMS Text Message',
        badge: 'Twilio / Gateway',
        description: 'Urgent mobile text messages dispatched to verified E.164 phone number.',
        icon: '📱',
        gatewayName: 'Outbound SMS Adapter',
      };
    case 'in_app':
      return {
        key: 'in_app',
        label: 'In-App Hub',
        badge: 'Realtime Feed',
        description: 'Live interactive notifications rendered in central portal notification hub.',
        icon: '🔔',
        gatewayName: 'In-App Hub Repository',
      };
  }
}

/**
 * Calculate aggregate preference statistics across categories and channels.
 */
export function calculatePreferenceMetrics(
  preferences: NotificationPreference[] | null | undefined
): PreferenceMetricsSummary {
  const list = preferences || [];
  const totalCategories = list.length;

  let enabledEmailCount = 0;
  let enabledSmsCount = 0;
  let enabledInAppCount = 0;
  let phoneStr: string | null = null;

  list.forEach((pref) => {
    if (pref.channel_email) enabledEmailCount++;
    if (pref.channel_sms) enabledSmsCount++;
    if (pref.channel_in_app) enabledInAppCount++;
    if (pref.phone_number && !phoneStr) {
      phoneStr = pref.phone_number;
    }
  });

  const totalActiveChannels = enabledEmailCount + enabledSmsCount + enabledInAppCount;
  const maxPossibleChannels = totalCategories * 3;
  const coveragePercentage = maxPossibleChannels > 0
    ? Math.round((totalActiveChannels / maxPossibleChannels) * 100)
    : 0;

  const hasValidPhoneNumber = validateE164Phone(phoneStr);
  const smsConfiguredWithoutPhone = enabledSmsCount > 0 && !hasValidPhoneNumber;

  return {
    totalCategories,
    enabledEmailCount,
    enabledSmsCount,
    enabledInAppCount,
    totalActiveChannels,
    maxPossibleChannels,
    coveragePercentage,
    hasValidPhoneNumber,
    smsConfiguredWithoutPhone,
  };
}

/**
 * Multi-Channel Alert Preference Matrix Configuration Component.
 * Implements FR-6 (Centralized multi-channel matrix), FR-7 (Category separation),
 * and NFR-3 (Immediate preference propagation for subsequent dispatches).
 */
export const PreferenceMatrix: React.FC<PreferenceMatrixProps> = ({
  preferences: initialPreferences,
  onUpdatePreferences,
  onToggleChannel,
  onPhoneNumberChange,
  onSaveAll,
  onRefresh,
  isLoading = false,
  isSaving = false,
  error = null,
  successMessage = null,
  readOnly = false,
  className = '',
  'data-testid': testId = 'preference-matrix',
}) => {
  // Local state for preferences matrix
  const [localPreferences, setLocalPreferences] = useState<NotificationPreference[]>(() => {
    if (initialPreferences && initialPreferences.length > 0) {
      return initialPreferences;
    }
    return DEFAULT_MOCK_PREFERENCES;
  });

  // Keep local preferences synchronized with prop updates
  useEffect(() => {
    if (initialPreferences && initialPreferences.length > 0) {
      setLocalPreferences(initialPreferences);
    }
  }, [initialPreferences]);

  // Extract initial phone number from local preferences
  const extractedPhone = useMemo(() => {
    const found = localPreferences.find((p) => p.phone_number && p.phone_number.trim());
    return found?.phone_number || '';
  }, [localPreferences]);

  const [phoneNumber, setPhoneNumber] = useState<string>(extractedPhone);
  useEffect(() => {
    if (extractedPhone) {
      setPhoneNumber(extractedPhone);
    }
  }, [extractedPhone]);

  // Phone input validation & editing state
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);

  // Immediate propagation feedback state (NFR-3)
  const [instantStatus, setInstantStatus] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(error);

  useEffect(() => {
    setLocalError(error);
  }, [error]);

  // Calculate metrics
  const metrics = useMemo(
    () => calculatePreferenceMetrics(localPreferences),
    [localPreferences]
  );

  // Validate E.164 phone whenever number changes
  const isPhoneValid = useMemo(() => validateE164Phone(phoneNumber), [phoneNumber]);

  /**
   * Immediately toggle a channel preference for a category (NFR-3).
   */
  const handleToggleChannel = useCallback(
    async (category: NotificationCategory, channel: 'email' | 'sms' | 'in_app') => {
      if (readOnly || isLoading) return;

      const categoryNorm = String(category);
      const toggleKey = `${categoryNorm}-${channel}`;
      setUpdatingKey(toggleKey);
      setLocalError(null);

      // Find target record
      const existing = localPreferences.find(
        (p) => String(p.category).toLowerCase() === categoryNorm.toLowerCase()
      );

      const targetCategory = existing ? existing.category : category;
      const currentEmail = existing ? existing.channel_email : true;
      const currentSms = existing ? existing.channel_sms : false;
      const currentInApp = existing ? existing.channel_in_app : true;

      let newEmail = currentEmail;
      let newSms = currentSms;
      let newInApp = currentInApp;

      if (channel === 'email') newEmail = !currentEmail;
      if (channel === 'sms') newSms = !currentSms;
      if (channel === 'in_app') newInApp = !currentInApp;

      const newValue = channel === 'email' ? newEmail : channel === 'sms' ? newSms : newInApp;

      // Optimistic UI update for sub-50ms instant response (NFR-3)
      const updatedList = localPreferences.map((pref) => {
        if (String(pref.category).toLowerCase() === categoryNorm.toLowerCase()) {
          return {
            ...pref,
            channel_email: newEmail,
            channel_sms: newSms,
            channel_in_app: newInApp,
            phone_number: phoneNumber || pref.phone_number,
            updated_at: new Date().toISOString(),
          };
        }
        return pref;
      });

      // If category didn't exist in array, add it
      const categoryExists = localPreferences.some(
        (p) => String(p.category).toLowerCase() === categoryNorm.toLowerCase()
      );
      if (!categoryExists) {
        updatedList.push({
          id: `pref-${categoryNorm.toLowerCase()}-${Date.now()}`,
          user_id: 'current-user',
          category: targetCategory,
          channel_email: newEmail,
          channel_sms: newSms,
          channel_in_app: newInApp,
          phone_number: phoneNumber || null,
          updated_at: new Date().toISOString(),
        });
      }

      setLocalPreferences(updatedList);

      const channelLabel = channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'In-App';
      setInstantStatus(
        `[NFR-3] Updated ${targetCategory} ${channelLabel} preference to ${newValue ? 'ENABLED' : 'DISABLED'}. Propagation immediate.`
      );

      try {
        // Trigger specific toggle callback if provided
        if (onToggleChannel) {
          await onToggleChannel(targetCategory, channel, newValue);
        }

        // Trigger updates callback if provided
        const payload: NotificationPreferenceUpdate[] = [
          {
            category: targetCategory,
            channel_email: newEmail,
            channel_sms: newSms,
            channel_in_app: newInApp,
            phone_number: phoneNumber || null,
          },
        ];

        if (onUpdatePreferences) {
          await onUpdatePreferences(payload);
        } else {
          // Direct API service call
          await updateNotificationPreferences(payload);
        }
      } catch (err: any) {
        // Revert optimistic state on failure
        setLocalPreferences(localPreferences);
        const errMsg = err?.message || 'Failed to update channel preference. Setting reverted.';
        setLocalError(errMsg);
        setInstantStatus(null);
      } finally {
        setUpdatingKey(null);
      }
    },
    [localPreferences, phoneNumber, readOnly, isLoading, onToggleChannel, onUpdatePreferences]
  );

  /**
   * Handle saving updated phone number.
   */
  const handleSavePhoneNumber = useCallback(async () => {
    if (!phoneNumber || !phoneNumber.trim()) {
      setPhoneError('Phone number cannot be empty when updating mobile contact.');
      return;
    }

    if (!validateE164Phone(phoneNumber)) {
      setPhoneError('Must be in valid E.164 format (e.g. +14155552671 with leading country code).');
      return;
    }

    setPhoneError(null);
    setPhoneSuccess(null);

    try {
      if (onPhoneNumberChange) {
        await onPhoneNumberChange(phoneNumber.trim());
      } else {
        // Update phone number across all category preferences
        const updates: NotificationPreferenceUpdate[] = localPreferences.map((p) => ({
          category: p.category,
          channel_email: p.channel_email,
          channel_sms: p.channel_sms,
          channel_in_app: p.channel_in_app,
          phone_number: phoneNumber.trim(),
        }));
        await updateNotificationPreferences(updates);
      }

      // Update local state
      const updatedList = localPreferences.map((p) => ({
        ...p,
        phone_number: phoneNumber.trim(),
      }));
      setLocalPreferences(updatedList);

      setPhoneSuccess('E.164 Mobile contact updated and verified for SMS dispatches.');
      setIsEditingPhone(false);
      setInstantStatus('[NFR-3] Mobile phone number updated immediately for SMS notifications.');
    } catch (err: any) {
      setPhoneError(err?.message || 'Failed to save phone number. Please check format.');
    }
  }, [phoneNumber, localPreferences, onPhoneNumberChange]);

  /**
   * Apply global preset (Enable All, Email Only, In-App Only, Emergency Only, Disable All).
   */
  const handleApplyPreset = useCallback(
    async (presetType: 'all' | 'email_only' | 'in_app_only' | 'emergency' | 'disable_all') => {
      if (readOnly || isLoading) return;

      const updatedList = localPreferences.map((pref) => {
        let e = pref.channel_email;
        let s = pref.channel_sms;
        let a = pref.channel_in_app;

        if (presetType === 'all') {
          e = true;
          s = true;
          a = true;
        } else if (presetType === 'email_only') {
          e = true;
          s = false;
          a = false;
        } else if (presetType === 'in_app_only') {
          e = false;
          s = false;
          a = true;
        } else if (presetType === 'emergency') {
          e = false;
          s = true;
          a = true;
        } else if (presetType === 'disable_all') {
          e = false;
          s = false;
          a = false;
        }

        return {
          ...pref,
          channel_email: e,
          channel_sms: s,
          channel_in_app: a,
          updated_at: new Date().toISOString(),
        };
      });

      setLocalPreferences(updatedList);

      const updates: NotificationPreferenceUpdate[] = updatedList.map((p) => ({
        category: p.category,
        channel_email: p.channel_email,
        channel_sms: p.channel_sms,
        channel_in_app: p.channel_in_app,
        phone_number: phoneNumber || p.phone_number,
      }));

      const presetLabels: Record<string, string> = {
        all: 'Enable All Channels',
        email_only: 'Email Only',
        in_app_only: 'In-App Hub Only',
        emergency: 'Emergency Only (SMS + In-App)',
        disable_all: 'Disable All Channels',
      };

      setInstantStatus(
        `[NFR-3] Preset "${presetLabels[presetType]}" applied. Immediate dispatch synchronization active.`
      );

      try {
        if (onSaveAll) {
          await onSaveAll({ preferences: updates });
        } else if (onUpdatePreferences) {
          await onUpdatePreferences(updates);
        } else {
          await updateNotificationPreferences(updates);
        }
      } catch (err: any) {
        setLocalError(err?.message || 'Failed to apply preset matrix update.');
      }
    },
    [localPreferences, phoneNumber, readOnly, isLoading, onSaveAll, onUpdatePreferences]
  );

  /**
   * Bulk save current preferences matrix state.
   */
  const handleBulkSave = useCallback(async () => {
    if (readOnly || isLoading) return;

    setLocalError(null);
    const updates: NotificationPreferenceUpdate[] = localPreferences.map((p) => ({
      category: p.category,
      channel_email: p.channel_email,
      channel_sms: p.channel_sms,
      channel_in_app: p.channel_in_app,
      phone_number: phoneNumber || p.phone_number,
    }));

    try {
      if (onSaveAll) {
        await onSaveAll({ preferences: updates });
      } else if (onUpdatePreferences) {
        await onUpdatePreferences(updates);
      } else {
        await updateNotificationPreferences(updates);
      }
      setInstantStatus('[NFR-3] Preference matrix successfully saved and propagated to dispatch workers.');
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to save preference matrix.');
    }
  }, [localPreferences, phoneNumber, readOnly, isLoading, onSaveAll, onUpdatePreferences]);

  // Mandatory Categories list
  const categoriesList: NotificationCategory[] = ['Financial', 'Milestone', 'SLA'];

  return (
    <div
      className={`preference-matrix-container ${className}`}
      data-testid={testId}
      style={{
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(115, 92, 65, 0.06)',
        color: 'var(--color-on-surface, #1b1c19)',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      {/* HEADER SECTION */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          paddingBottom: '20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>⚙️</span>
              <h2
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontFamily: 'var(--font-serif, serif)',
                  fontWeight: '500',
                  color: 'var(--color-primary, #59452b)',
                  letterSpacing: '-0.01em',
                }}
              >
                Multi-Channel Alert Preference Matrix
              </h2>
            </div>
            <p
              style={{
                margin: '6px 0 0 0',
                fontSize: '14px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                maxWidth: '680px',
                lineHeight: '1.5',
              }}
            >
              Configure centralized notification preferences across Email, SMS, and In-App channels.
              Updates take effect immediately for all subsequent alert dispatches (NFR-3).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                color: 'var(--color-primary, #59452b)',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#2e6b38',
                }}
              />
              NFR-3 Immediate Dispatch Propagation
            </span>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="Refresh notification preferences"
                data-testid="refresh-preferences-btn"
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  border: '1px solid var(--color-outline, #80756b)',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🔄</span> {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
        </div>

        {/* METRICS SUMMARY STRIP */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', fontWeight: '600' }}>
              Coverage
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--color-primary, #59452b)', marginTop: '2px' }}>
              {metrics.coveragePercentage}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
              {metrics.totalActiveChannels} / {metrics.maxPossibleChannels} Channels
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', fontWeight: '600' }}>
              ✉️ Email
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#4a5d73', marginTop: '2px' }}>
              {metrics.enabledEmailCount} / {metrics.totalCategories}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
              Categories Active
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', fontWeight: '600' }}>
              📱 SMS Text
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#a43b2c', marginTop: '2px' }}>
              {metrics.enabledSmsCount} / {metrics.totalCategories}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
              {metrics.hasValidPhoneNumber ? 'Mobile Verified' : 'No Valid Phone'}
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', fontWeight: '600' }}>
              🔔 In-App Hub
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#2e6b38', marginTop: '2px' }}>
              {metrics.enabledInAppCount} / {metrics.totalCategories}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
              Realtime Feed
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK & ALERTS BANNER */}
      {instantStatus && (
        <div
          role="status"
          aria-live="polite"
          data-testid="instant-status-banner"
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            backgroundColor: '#e8f5e9',
            border: '1px solid #a5d6a7',
            color: '#1b5e20',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span>
            <span>{instantStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => setInstantStatus(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#1b5e20',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {(localError || error) && (
        <div
          role="alert"
          data-testid="error-banner"
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            border: '1px solid var(--color-error, #ba1a1a)',
            color: 'var(--color-on-error-container, #93000a)',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>{localError || error}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocalError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-on-error-container, #93000a)',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && !instantStatus && (
        <div
          role="status"
          data-testid="success-banner"
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            backgroundColor: '#e8f5e9',
            border: '1px solid #a5d6a7',
            color: '#1b5e20',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      {/* SMS PHONE CONFIGURATION BOX */}
      <div
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-md, 0.375rem)',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          border: metrics.smsConfiguredWithoutPhone
            ? '1px solid #ba1a1a'
            : '1px solid var(--color-outline-variant, #d1c4b9)',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📱</span>
              <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-primary, #59452b)' }}>
                SMS Mobile Contact Configuration
              </span>
              {metrics.hasValidPhoneNumber ? (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: '#e8f5e9',
                    color: '#2e6b38',
                    fontWeight: '600',
                  }}
                >
                  Verified E.164
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: '#ffdad6',
                    color: '#93000a',
                    fontWeight: '600',
                  }}
                >
                  Phone Required for SMS
                </span>
              )}
            </div>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Enter international mobile number with country code (E.164 format: e.g.{' '}
              <code>+14155552671</code>) for instant SMS dispatching.
            </p>
          </div>

          {!isEditingPhone && (
            <button
              type="button"
              onClick={() => setIsEditingPhone(true)}
              disabled={readOnly}
              data-testid="edit-phone-btn"
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline, #80756b)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-primary, #59452b)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: readOnly ? 'not-allowed' : 'pointer',
              }}
            >
              {phoneNumber ? 'Change Mobile Number' : 'Set Mobile Number'}
            </button>
          )}
        </div>

        {isEditingPhone ? (
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+14155552671"
                data-testid="phone-number-input"
                style={{
                  flex: '1',
                  minWidth: '220px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  border: phoneError
                    ? '1px solid #ba1a1a'
                    : '1px solid var(--color-outline, #80756b)',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={handleSavePhoneNumber}
                data-testid="save-phone-btn"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  border: 'none',
                  backgroundColor: 'var(--color-primary, #59452b)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Save Phone
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingPhone(false);
                  setPhoneError(null);
                  setPhoneNumber(extractedPhone);
                }}
                data-testid="cancel-phone-btn"
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-on-surface, #1b1c19)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>

            {phoneError && (
              <div
                style={{ fontSize: '12px', color: '#ba1a1a', fontWeight: '500' }}
                data-testid="phone-error-msg"
              >
                ⚠️ {phoneError}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: '500' }}>
            Current Mobile Number:{' '}
            <code
              data-testid="display-phone-number"
              style={{
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                fontFamily: 'monospace',
              }}
            >
              {phoneNumber || 'Not configured'}
            </code>
          </div>
        )}

        {metrics.smsConfiguredWithoutPhone && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: '#fff3e0',
              border: '1px solid #ffe0b2',
              color: '#e65100',
              fontSize: '12px',
              fontWeight: '500',
            }}
            data-testid="sms-warning-banner"
          >
            ⚠️ SMS channels are enabled in your preferences, but no valid E.164 phone number is set.
            SMS alerts will be held until a valid number is saved.
          </div>
        )}

        {phoneSuccess && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '12px',
              color: '#2e6b38',
              fontWeight: '500',
            }}
            data-testid="phone-success-msg"
          >
            ✓ {phoneSuccess}
          </div>
        )}
      </div>

      {/* QUICK PRESETS TOOLBAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-on-surface-variant, #4e453d)' }}>
          Quick Channel Presets:
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleApplyPreset('all')}
            disabled={readOnly || isLoading}
            data-testid="preset-enable-all"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-primary, #59452b)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            ✓ Enable All Channels
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('email_only')}
            disabled={readOnly || isLoading}
            data-testid="preset-email-only"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: '#4a5d73',
              fontSize: '12px',
              fontWeight: '600',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            ✉️ Email Only
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('in_app_only')}
            disabled={readOnly || isLoading}
            data-testid="preset-in-app-only"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: '#2e6b38',
              fontSize: '12px',
              fontWeight: '600',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            🔔 In-App Hub Only
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('emergency')}
            disabled={readOnly || isLoading}
            data-testid="preset-emergency"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: '#a43b2c',
              fontSize: '12px',
              fontWeight: '600',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            🚨 Emergency (SMS + In-App)
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('disable_all')}
            disabled={readOnly || isLoading}
            data-testid="preset-disable-all"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: '#80756b',
              fontSize: '12px',
              fontWeight: '600',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            🚫 Disable All
          </button>
        </div>
      </div>

      {/* MATRIX TABLE SECTION */}
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '14px',
          }}
          data-testid="preference-matrix-table"
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <th
                style={{
                  padding: '14px 16px',
                  fontWeight: '600',
                  color: 'var(--color-primary, #59452b)',
                  width: '38%',
                }}
              >
                Event Category (FR-7)
              </th>
              <th
                style={{
                  padding: '14px 16px',
                  fontWeight: '600',
                  color: 'var(--color-primary, #59452b)',
                  textAlign: 'center',
                  width: '18%',
                }}
              >
                ✉️ Email
              </th>
              <th
                style={{
                  padding: '14px 16px',
                  fontWeight: '600',
                  color: 'var(--color-primary, #59452b)',
                  textAlign: 'center',
                  width: '18%',
                }}
              >
                📱 SMS
              </th>
              <th
                style={{
                  padding: '14px 16px',
                  fontWeight: '600',
                  color: 'var(--color-primary, #59452b)',
                  textAlign: 'center',
                  width: '18%',
                }}
              >
                🔔 In-App Hub
              </th>
              <th
                style={{
                  padding: '14px 16px',
                  fontWeight: '600',
                  color: 'var(--color-primary, #59452b)',
                  textAlign: 'center',
                  width: '8%',
                }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {categoriesList.map((category) => {
              const details = getCategoryDetails(category);
              const pref = localPreferences.find(
                (p) => String(p.category).toLowerCase() === String(category).toLowerCase()
              );

              const emailActive = pref ? pref.channel_email : true;
              const smsActive = pref ? pref.channel_sms : false;
              const inAppActive = pref ? pref.channel_in_app : true;

              const activeCount = (emailActive ? 1 : 0) + (smsActive ? 1 : 0) + (inAppActive ? 1 : 0);

              const categoryLower = String(category).toLowerCase();

              return (
                <tr
                  key={category}
                  data-testid={`preference-row-${categoryLower}`}
                  style={{
                    borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* CATEGORY INFO */}
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '20px', marginTop: '2px' }}>{details.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontWeight: '600',
                              fontSize: '15px',
                              color: 'var(--color-on-surface, #1b1c19)',
                            }}
                          >
                            {details.label}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full, 9999px)',
                              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                              color: details.colorHex,
                              fontWeight: '600',
                            }}
                          >
                            {details.badge}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: '4px 0 6px 0',
                            fontSize: '12px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            lineHeight: '1.4',
                          }}
                        >
                          {details.description}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {details.sampleEvents.map((ev, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-sm, 0.125rem)',
                                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                                color: 'var(--color-on-surface-variant, #4e453d)',
                              }}
                            >
                              • {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* EMAIL TOGGLE */}
                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={emailActive}
                      aria-label={`Toggle Email notifications for ${category}`}
                      onClick={() => handleToggleChannel(category, 'email')}
                      disabled={readOnly || isLoading || updatingKey === `${categoryLower}-email`}
                      data-testid={`toggle-${categoryLower}-email`}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        border: '1px solid',
                        borderColor: emailActive ? '#4a5d73' : 'var(--color-outline-variant, #d1c4b9)',
                        backgroundColor: emailActive ? '#4a5d73' : 'var(--color-surface-container-low, #f5f3ee)',
                        color: emailActive ? '#ffffff' : 'var(--color-on-surface-variant, #4e453d)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: readOnly ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: emailActive ? '0 2px 6px rgba(74, 93, 115, 0.25)' : 'none',
                        minWidth: '90px',
                      }}
                    >
                      {updatingKey === `${categoryLower}-email` ? 'Saving...' : emailActive ? 'ON ✓' : 'OFF'}
                    </button>
                  </td>

                  {/* SMS TOGGLE */}
                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={smsActive}
                      aria-label={`Toggle SMS notifications for ${category}`}
                      onClick={() => handleToggleChannel(category, 'sms')}
                      disabled={readOnly || isLoading || updatingKey === `${categoryLower}-sms`}
                      data-testid={`toggle-${categoryLower}-sms`}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        border: '1px solid',
                        borderColor: smsActive ? '#a43b2c' : 'var(--color-outline-variant, #d1c4b9)',
                        backgroundColor: smsActive ? '#a43b2c' : 'var(--color-surface-container-low, #f5f3ee)',
                        color: smsActive ? '#ffffff' : 'var(--color-on-surface-variant, #4e453d)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: readOnly ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: smsActive ? '0 2px 6px rgba(164, 59, 44, 0.25)' : 'none',
                        minWidth: '90px',
                      }}
                    >
                      {updatingKey === `${categoryLower}-sms` ? 'Saving...' : smsActive ? 'ON ✓' : 'OFF'}
                    </button>
                  </td>

                  {/* IN-APP TOGGLE */}
                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={inAppActive}
                      aria-label={`Toggle In-App Hub notifications for ${category}`}
                      onClick={() => handleToggleChannel(category, 'in_app')}
                      disabled={readOnly || isLoading || updatingKey === `${categoryLower}-in_app`}
                      data-testid={`toggle-${categoryLower}-in_app`}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        border: '1px solid',
                        borderColor: inAppActive ? '#2e6b38' : 'var(--color-outline-variant, #d1c4b9)',
                        backgroundColor: inAppActive ? '#2e6b38' : 'var(--color-surface-container-low, #f5f3ee)',
                        color: inAppActive ? '#ffffff' : 'var(--color-on-surface-variant, #4e453d)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: readOnly ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: inAppActive ? '0 2px 6px rgba(46, 107, 56, 0.25)' : 'none',
                        minWidth: '90px',
                      }}
                    >
                      {updatingKey === `${categoryLower}-in_app` ? 'Saving...' : inAppActive ? 'ON ✓' : 'OFF'}
                    </button>
                  </td>

                  {/* CHANNEL SUMMARY BADGE */}
                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        backgroundColor:
                          activeCount === 3
                            ? '#e8f5e9'
                            : activeCount > 0
                            ? 'var(--color-surface-container-high, #eae8e3)'
                            : '#fdf0ed',
                        color:
                          activeCount === 3
                            ? '#2e6b38'
                            : activeCount > 0
                            ? 'var(--color-primary, #59452b)'
                            : '#a43b2c',
                      }}
                    >
                      {activeCount} / 3 Active
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER BULK ACTIONS */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
          ℹ️ Preference changes propagate immediately to Celery workers and Redis gateway caches (NFR-3).
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setLocalPreferences(DEFAULT_MOCK_PREFERENCES)}
            disabled={readOnly || isLoading || isSaving}
            data-testid="reset-matrix-btn"
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'transparent',
              color: 'var(--color-on-surface, #1b1c19)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={handleBulkSave}
            disabled={readOnly || isLoading || isSaving}
            data-testid="save-all-matrix-btn"
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: 'none',
              backgroundColor: 'var(--color-primary, #59452b)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: readOnly || isLoading || isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(89, 69, 43, 0.2)',
            }}
          >
            {isSaving ? 'Saving Matrix...' : 'Save Matrix Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferenceMatrix;
