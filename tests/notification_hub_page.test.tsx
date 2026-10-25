import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationHubPage, {
  NotificationHubContent,
} from '../src/app/notifications/page';
import { CurrentUserResponse } from '../src/services/auth';
import {
  NotificationItem,
  getNotifications,
  updateNotificationReadStatus,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../src/services/financialApi';
import { DEFAULT_MOCK_NOTIFICATIONS } from '../src/components/notifications/NotificationHubList';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/notifications',
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
    getNotifications: vi.fn(),
    updateNotificationReadStatus: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  };
});

const mockUser: CurrentUserResponse = {
  user_id: 'usr-fin-exec-101',
  email: 'exec@example.com',
  full_name: 'Executive User',
  tenant_id: 'tnt-corp-101',
};

const testNotifications: NotificationItem[] = [
  {
    id: 'notif-sla-001',
    user_id: 'usr-fin-exec-101',
    category: 'SLA',
    title: 'SLA Breach Warning: Ticket #SLA-882 Response Overdue',
    message: 'Ticket #SLA-882 (Severity P1 - Production Down) has exceeded 75% of response SLA duration.',
    is_read: false,
    created_at: '2026-10-24T13:45:00Z',
  },
  {
    id: 'notif-fin-002',
    user_id: 'usr-fin-exec-101',
    category: 'Financial',
    title: 'Commercial Quote #Q-9042 Approved',
    message: 'Finance Manager approved Quote #Q-9042 ($145,000.00 USD) for ACME Corp.',
    is_read: false,
    created_at: '2026-10-24T12:30:00Z',
  },
  {
    id: 'notif-ms-003',
    user_id: 'usr-fin-exec-101',
    category: 'Milestone',
    title: 'Deal Milestone Achieved: Technical Evaluation Passed',
    message: 'Global Logistics Enterprise deal moved to Stage 4.',
    is_read: true,
    created_at: '2026-10-24T10:15:00Z',
  },
];

describe('Central Notification Hub Page Route Component (T028)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotifications).mockResolvedValue(testNotifications);
    vi.mocked(updateNotificationReadStatus).mockResolvedValue({
      ...testNotifications[0],
      is_read: true,
    });
    vi.mocked(markAllNotificationsAsRead).mockResolvedValue({
      marked_count: 2,
      message: 'All notifications marked as read.',
    });
    vi.mocked(deleteNotification).mockResolvedValue(undefined);
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

    render(<NotificationHubPage fetchUser={mockFetchUser} autoFetch={false} />);

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('notification-hub-page')).toBeInTheDocument();
    });
  });

  it('renders page header title, requirement audit badges, breadcrumbs, and quick controls', () => {
    render(
      <NotificationHubContent
        user={mockUser}
        initialNotifications={testNotifications}
        autoFetch={false}
      />
    );

    expect(screen.getByText('Central Notification Hub')).toBeInTheDocument();
    expect(screen.getByText('[FR-8] SLA Alert Triggers & In-App Hub')).toBeInTheDocument();
    expect(screen.getByText('[FR-9] Read/Unread Toggles & Category Filters')).toBeInTheDocument();
    expect(screen.getByText('[NFR-2] Delivery Latency < 1 Second')).toBeInTheDocument();

    expect(screen.getByTestId('toggle-drawer-btn')).toBeInTheDocument();
    expect(screen.getByTestId('page-mark-all-read-btn')).toBeInTheDocument();
    expect(screen.getByTestId('polling-interval-select')).toBeInTheDocument();
  });

  it('renders SLA alert triggers with timestamp and unread status (FR-8)', () => {
    render(
      <NotificationHubContent
        user={mockUser}
        initialNotifications={testNotifications}
        autoFetch={false}
      />
    );

    const slaAlert = screen.getByText('SLA Breach Warning: Ticket #SLA-882 Response Overdue');
    expect(slaAlert).toBeInTheDocument();
    expect(screen.getByTestId('page-unread-badge')).toHaveTextContent('2 Unread');
  });

  it('bulk marks all unread notifications as read when clicking "Mark all as read" (FR-9)', async () => {
    render(
      <NotificationHubContent
        user={mockUser}
        initialNotifications={testNotifications}
        autoFetch={false}
      />
    );

    const markAllBtn = screen.getByTestId('page-mark-all-read-btn');
    expect(markAllBtn).toBeInTheDocument();

    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(markAllNotificationsAsRead).toHaveBeenCalled();
    });
  });

  it('toggles slide-over quick alert drawer overlay and panel (FR-8, FR-9)', async () => {
    render(
      <NotificationHubContent
        user={mockUser}
        initialNotifications={testNotifications}
        autoFetch={false}
      />
    );

    const toggleDrawerBtn = screen.getByTestId('toggle-drawer-btn');
    fireEvent.click(toggleDrawerBtn);

    expect(screen.getByTestId('notification-drawer-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('notification-drawer-panel')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-unread-count')).toHaveTextContent('2 Unread');

    const closeBtn = screen.getByTestId('close-drawer-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('notification-drawer-overlay')).not.toBeInTheDocument();
  });

  it('allows changing real-time auto-refresh polling speed selector (NFR-2)', () => {
    render(
      <NotificationHubContent
        user={mockUser}
        initialNotifications={testNotifications}
        autoFetch={false}
      />
    );

    const select = screen.getByTestId('polling-interval-select') as HTMLSelectElement;
    expect(select.value).toBe('1000'); // Default NFR-2 1 second polling

    fireEvent.change(select, { target: { value: '3000' } });
    expect(select.value).toBe('3000');
  });

  it('opens detail modal when selecting a notification item', async () => {
    render(
      <NotificationHubContent
        user={mockUser}
        initialNotifications={testNotifications}
        autoFetch={false}
      />
    );

    const slaItemCard = screen.getByTestId('notification-item-notif-sla-001');
    fireEvent.click(slaItemCard);

    await waitFor(() => {
      expect(screen.getByTestId('notification-detail-modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-toggle-read-btn')).toBeInTheDocument();
      expect(screen.getByTestId('modal-delete-btn')).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId('close-modal-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('notification-detail-modal')).not.toBeInTheDocument();
  });

  it('displays error banner when fetching notifications fails', async () => {
    vi.mocked(getNotifications).mockRejectedValueOnce(new Error('Network error syncing alerts'));

    render(<NotificationHubContent user={mockUser} autoFetch={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-error-banner')).toBeInTheDocument();
      expect(screen.getByTestId('notification-error-banner')).toHaveTextContent('Network error syncing alerts');
    });
  });
});
