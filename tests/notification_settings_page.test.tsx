import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationSettingsPage, {
  NotificationSettingsContent,
} from '../src/app/settings/notifications/page';
import { CurrentUserResponse } from '../src/services/auth';
import {
  NotificationPreference,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../src/services/financialApi';
import { DEFAULT_MOCK_PREFERENCES } from '../src/components/notifications/PreferenceMatrix';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/settings/notifications',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock financial API service
vi.mock('../src/services/financialApi', async () => {
  const actual = await vi.importActual<typeof import('../src/services/financialApi')>('../src/services/financialApi');
  return {
    ...actual,
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
  };
});

const mockUser: CurrentUserResponse = {
  user_id: 'usr-fin-exec-101',
  email: 'exec@example.com',
  full_name: 'Executive User',
  tenant_id: 'tnt-corp-101',
};

const testPreferences: NotificationPreference[] = [
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

describe('Notification Settings Matrix Page Route Component (T027)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotificationPreferences).mockResolvedValue(testPreferences);
    vi.mocked(updateNotificationPreferences).mockResolvedValue(testPreferences);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially when session is resolving via ProtectedRoute', async () => {
    const mockFetchUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockUser), 50)
        )
    );

    render(
      <NotificationSettingsPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialPreferences={testPreferences}
      />
    );

    expect(screen.getByText('Authenticating session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Notification Channel Settings Matrix')).toBeInTheDocument();
    });
  });

  it('renders page layout, hero title, navigation breadcrumbs, and requirement badges', () => {
    render(
      <NotificationSettingsContent
        user={mockUser}
        autoFetch={false}
        initialPreferences={testPreferences}
      />
    );

    expect(screen.getByText('Notification Channel Settings Matrix')).toBeInTheDocument();
    expect(screen.getByText('[FR-6] Centralized Multi-Channel Matrix')).toBeInTheDocument();
    expect(screen.getByText('[FR-7] Category-Specific Dispatches')).toBeInTheDocument();
    expect(screen.getByText('[NFR-3] Immediate Dispatch Propagation')).toBeInTheDocument();

    expect(screen.getByTestId('link-to-notification-hub')).toBeInTheDocument();
    expect(screen.getByTestId('link-to-financial-hub')).toBeInTheDocument();
    expect(screen.getByTestId('notification-matrix-section')).toBeInTheDocument();
  });

  it('fetches notification preferences automatically on mount', async () => {
    render(<NotificationSettingsContent user={mockUser} autoFetch={true} />);

    await waitFor(() => {
      expect(getNotificationPreferences).toHaveBeenCalled();
    });

    expect(screen.getByTestId('preference-row-financial')).toBeInTheDocument();
    expect(screen.getByTestId('preference-row-milestone')).toBeInTheDocument();
    expect(screen.getByTestId('preference-row-sla')).toBeInTheDocument();
  });

  it('toggles channel preference immediately and triggers API update (NFR-3)', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(testPreferences);
    render(
      <NotificationSettingsContent
        user={mockUser}
        autoFetch={false}
        initialPreferences={testPreferences}
        updatePreferences={mockUpdate}
      />
    );

    const smsToggle = screen.getByTestId('toggle-milestone-sms');
    expect(smsToggle).toHaveTextContent('OFF');

    fireEvent.click(smsToggle);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith([
        {
          category: 'Milestone',
          channel_email: true,
          channel_sms: true,
          channel_in_app: true,
          phone_number: '+14155552671',
        },
      ]);
    });
  });

  it('updates mobile phone number across categories when saved', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(testPreferences);
    render(
      <NotificationSettingsContent
        user={mockUser}
        autoFetch={false}
        initialPreferences={testPreferences}
        updatePreferences={mockUpdate}
      />
    );

    const editPhoneBtn = screen.getByTestId('edit-phone-btn');
    fireEvent.click(editPhoneBtn);

    const phoneInput = screen.getByTestId('phone-number-input');
    fireEvent.change(phoneInput, { target: { value: '+14155559876' } });

    const savePhoneBtn = screen.getByTestId('save-phone-btn');
    fireEvent.click(savePhoneBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it('applies quick channel preset (Disable All) and triggers matrix save', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(testPreferences);
    render(
      <NotificationSettingsContent
        user={mockUser}
        autoFetch={false}
        initialPreferences={testPreferences}
        updatePreferences={mockUpdate}
      />
    );

    const disableAllBtn = screen.getByTestId('preset-disable-all');
    fireEvent.click(disableAllBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it('handles error gracefully when API fetch fails and falls back to default mock dataset', async () => {
    vi.mocked(getNotificationPreferences).mockRejectedValue(new Error('Network connection timeout'));

    render(<NotificationSettingsContent user={mockUser} autoFetch={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });

    expect(screen.getByTestId('preference-matrix-table')).toBeInTheDocument();
  });
});
