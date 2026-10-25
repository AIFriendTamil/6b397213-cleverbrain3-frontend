import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  PreferenceMatrix,
  validateE164Phone,
  getCategoryDetails,
  getChannelDetails,
  calculatePreferenceMetrics,
  DEFAULT_MOCK_PREFERENCES,
} from '../src/components/notifications/PreferenceMatrix';
import { NotificationPreference } from '../src/services/financialApi';

// Mock financialApi service calls
vi.mock('../src/services/financialApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/financialApi')>();
  return {
    ...actual,
    updateNotificationPreferences: vi.fn().mockResolvedValue([
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
    ]),
    getNotificationPreferences: vi.fn().mockResolvedValue(DEFAULT_MOCK_PREFERENCES),
  };
});

describe('PreferenceMatrix Component & Helper Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions & Validation Logic', () => {
    it('validates E.164 phone numbers accurately', () => {
      expect(validateE164Phone('+14155552671')).toBe(true);
      expect(validateE164Phone('+442079460912')).toBe(true);
      expect(validateE164Phone('+33123456789')).toBe(true);

      expect(validateE164Phone('14155552671')).toBe(false); // missing +
      expect(validateE164Phone('+012345')).toBe(false); // leading zero after +
      expect(validateE164Phone('invalid')).toBe(false);
      expect(validateE164Phone('')).toBe(false);
      expect(validateE164Phone(null)).toBe(false);
      expect(validateE164Phone(undefined)).toBe(false);
    });

    it('returns rich category metadata for Financial, Milestone, and SLA categories', () => {
      const fin = getCategoryDetails('Financial');
      expect(fin.key).toBe('Financial');
      expect(fin.label).toContain('Financial');
      expect(fin.sampleEvents.length).toBeGreaterThan(0);

      const mil = getCategoryDetails('Milestone');
      expect(mil.key).toBe('Milestone');
      expect(mil.label).toContain('Milestone');

      const sla = getCategoryDetails('SLA');
      expect(sla.key).toBe('SLA');
      expect(sla.label).toContain('SLA');
    });

    it('returns channel visual metadata for email, sms, and in_app', () => {
      const email = getChannelDetails('email');
      expect(email.key).toBe('email');
      expect(email.label).toContain('Email');

      const sms = getChannelDetails('sms');
      expect(sms.key).toBe('sms');
      expect(sms.label).toContain('SMS');

      const inApp = getChannelDetails('in_app');
      expect(inApp.key).toBe('in_app');
      expect(inApp.label).toContain('In-App');
    });

    it('calculates aggregate preference metrics accurately', () => {
      const summary = calculatePreferenceMetrics(DEFAULT_MOCK_PREFERENCES);
      expect(summary.totalCategories).toBe(3);
      expect(summary.enabledEmailCount).toBe(3);
      expect(summary.enabledSmsCount).toBe(2);
      expect(summary.enabledInAppCount).toBe(3);
      expect(summary.totalActiveChannels).toBe(8);
      expect(summary.hasValidPhoneNumber).toBe(true);
      expect(summary.smsConfiguredWithoutPhone).toBe(false);
    });
  });

  describe('Component Rendering', () => {
    it('renders header, title, metrics strip, phone section, presets, and matrix table', () => {
      render(<PreferenceMatrix preferences={DEFAULT_MOCK_PREFERENCES} />);

      expect(screen.getByText('Multi-Channel Alert Preference Matrix')).toBeInTheDocument();
      expect(screen.getByText('Coverage')).toBeInTheDocument();
      expect(screen.getByText('SMS Mobile Contact Configuration')).toBeInTheDocument();
      expect(screen.getByTestId('preference-matrix-table')).toBeInTheDocument();

      expect(screen.getByTestId('preference-row-financial')).toBeInTheDocument();
      expect(screen.getByTestId('preference-row-milestone')).toBeInTheDocument();
      expect(screen.getByTestId('preference-row-sla')).toBeInTheDocument();
    });

    it('displays warning when SMS is enabled without valid phone number', () => {
      const noPhonePrefs: NotificationPreference[] = DEFAULT_MOCK_PREFERENCES.map((p) => ({
        ...p,
        phone_number: null,
      }));

      render(<PreferenceMatrix preferences={noPhonePrefs} />);

      expect(screen.getByTestId('sms-warning-banner')).toBeInTheDocument();
    });
  });

  describe('Channel Toggling & Immediate Update (NFR-3)', () => {
    it('toggles channel switch immediately and displays instant status banner', async () => {
      const onToggleSpy = vi.fn();
      render(
        <PreferenceMatrix
          preferences={DEFAULT_MOCK_PREFERENCES}
          onToggleChannel={onToggleSpy}
        />
      );

      const smsToggle = screen.getByTestId('toggle-milestone-sms');
      expect(smsToggle).toHaveTextContent('OFF');

      fireEvent.click(smsToggle);

      await waitFor(() => {
        expect(onToggleSpy).toHaveBeenCalledWith('Milestone', 'sms', true);
      });

      expect(screen.getByTestId('instant-status-banner')).toBeInTheDocument();
      expect(screen.getByTestId('instant-status-banner')).toHaveTextContent('UPDATED Milestone SMS');
    });
  });

  describe('Phone Number Configuration', () => {
    it('opens phone editor and validates E.164 input', async () => {
      const onPhoneSpy = vi.fn();
      render(
        <PreferenceMatrix
          preferences={DEFAULT_MOCK_PREFERENCES}
          onPhoneNumberChange={onPhoneSpy}
        />
      );

      const editBtn = screen.getByTestId('edit-phone-btn');
      fireEvent.click(editBtn);

      const phoneInput = screen.getByTestId('phone-number-input');
      fireEvent.change(phoneInput, { target: { value: 'invalid-phone' } });

      const saveBtn = screen.getByTestId('save-phone-btn');
      fireEvent.click(saveBtn);

      expect(screen.getByTestId('phone-error-msg')).toBeInTheDocument();
      expect(onPhoneSpy).not.toHaveBeenCalled();

      // Fix phone number to valid E.164
      fireEvent.change(phoneInput, { target: { value: '+14155559999' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onPhoneSpy).toHaveBeenCalledWith('+14155559999');
      });
      expect(screen.getByTestId('phone-success-msg')).toBeInTheDocument();
    });
  });

  describe('Presets & Bulk Actions', () => {
    it('applies preset buttons correctly', async () => {
      const onSaveSpy = vi.fn();
      render(
        <PreferenceMatrix
          preferences={DEFAULT_MOCK_PREFERENCES}
          onSaveAll={onSaveSpy}
        />
      );

      const disableAllBtn = screen.getByTestId('preset-disable-all');
      fireEvent.click(disableAllBtn);

      await waitFor(() => {
        expect(onSaveSpy).toHaveBeenCalled();
      });

      expect(screen.getByTestId('instant-status-banner')).toHaveTextContent('Disable All Channels');
    });

    it('triggers bulk save when Save Matrix Settings button is clicked', async () => {
      const onSaveSpy = vi.fn();
      render(
        <PreferenceMatrix
          preferences={DEFAULT_MOCK_PREFERENCES}
          onSaveAll={onSaveSpy}
        />
      );

      const saveAllBtn = screen.getByTestId('save-all-matrix-btn');
      fireEvent.click(saveAllBtn);

      await waitFor(() => {
        expect(onSaveSpy).toHaveBeenCalled();
      });
    });
  });
});
