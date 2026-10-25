import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  NotificationHubList,
  getCategoryBadgeDetails,
  formatNotificationTimestamp,
  calculateNotificationSummary,
  filterNotifications,
  DEFAULT_MOCK_NOTIFICATIONS,
} from '../src/components/notifications/NotificationHubList';
import { NotificationItem } from '../src/services/financialApi';

// Mock financialApi service calls
vi.mock('../src/services/financialApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/financialApi')>();
  return {
    ...actual,
    getNotifications: vi.fn().mockResolvedValue(DEFAULT_MOCK_NOTIFICATIONS),
    updateNotificationReadStatus: vi.fn().mockResolvedValue({
      id: 'notif-sla-001',
      user_id: 'usr-fin-exec-101',
      category: 'SLA',
      title: 'SLA Breach Warning: Ticket #SLA-882 Response Overdue',
      message: 'Ticket #SLA-882 (Severity P1 - Production Down) has exceeded 75% of response SLA duration.',
      is_read: true,
      created_at: '2026-10-24T13:45:00Z',
    }),
    markAllNotificationsAsRead: vi.fn().mockResolvedValue({
      marked_count: 3,
      message: 'All notifications marked as read.',
    }),
    deleteNotification: vi.fn().mockResolvedValue(undefined),
  };
});

describe('NotificationHubList Component & Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions & Summary Logic', () => {
    it('returns Linen & Logic category details for Financial, SLA, and Milestone', () => {
      const fin = getCategoryBadgeDetails('Financial');
      expect(fin.key).toBe('Financial');
      expect(fin.label).toBe('Financial');
      expect(fin.icon).toBe('💰');

      const sla = getCategoryBadgeDetails('SLA');
      expect(sla.key).toBe('SLA');
      expect(sla.label).toBe('SLA Alert');
      expect(sla.icon).toBe('⚠️');

      const mil = getCategoryBadgeDetails('Milestone');
      expect(mil.key).toBe('Milestone');
      expect(mil.label).toBe('Milestone');
      expect(mil.icon).toBe('🎯');

      const custom = getCategoryBadgeDetails('General');
      expect(custom.key).toBe('General');
      expect(custom.label).toBe('General');
    });

    it('formats notification creation timestamps accurately', () => {
      const formatted = formatNotificationTimestamp('2026-10-24T13:45:00Z');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);

      expect(formatNotificationTimestamp('')).toBe('');
      expect(formatNotificationTimestamp('invalid-date')).toBe('invalid-date');
    });

    it('calculates aggregate summary statistics accurately', () => {
      const summary = calculateNotificationSummary(DEFAULT_MOCK_NOTIFICATIONS);
      expect(summary.totalCount).toBe(5);
      expect(summary.unreadCount).toBe(3);
      expect(summary.readCount).toBe(2);
      expect(summary.slaUnread).toBe(1);
      expect(summary.financialUnread).toBe(2);
      expect(summary.milestoneUnread).toBe(0);
    });

    it('filters notification list by category, read status, and text search', () => {
      // Category filter
      const slaOnly = filterNotifications(DEFAULT_MOCK_NOTIFICATIONS, 'SLA', 'ALL', '');
      expect(slaOnly.length).toBe(2);
      expect(slaOnly.every((n) => n.category === 'SLA')).toBe(true);

      // Read status filter
      const unreadOnly = filterNotifications(DEFAULT_MOCK_NOTIFICATIONS, 'ALL', 'UNREAD', '');
      expect(unreadOnly.length).toBe(3);
      expect(unreadOnly.every((n) => !n.is_read)).toBe(true);

      const readOnly = filterNotifications(DEFAULT_MOCK_NOTIFICATIONS, 'ALL', 'READ', '');
      expect(readOnly.length).toBe(2);
      expect(readOnly.every((n) => n.is_read)).toBe(true);

      // Text search query
      const searchResult = filterNotifications(DEFAULT_MOCK_NOTIFICATIONS, 'ALL', 'ALL', 'Quote');
      expect(searchResult.length).toBe(1);
      expect(searchResult[0].title).toContain('Quote');
    });
  });

  describe('Component Rendering & User Interactions', () => {
    it('renders notification hub title, unread badge, KPI cards, and notification items', () => {
      render(<NotificationHubList notifications={DEFAULT_MOCK_NOTIFICATIONS} />);

      expect(screen.getByText('In-App Notification Hub')).toBeInTheDocument();
      expect(screen.getByTestId('unread-badge')).toHaveTextContent('3 Unread');
      expect(screen.getByText('Total In-App Alerts')).toBeInTheDocument();
      expect(screen.getByText('SLA Breach Warning: Ticket #SLA-882 Response Overdue')).toBeInTheDocument();
      expect(screen.getByText('Commercial Quote #Q-9042 Approved')).toBeInTheDocument();
    });

    it('handles category filter selection correctly', () => {
      render(<NotificationHubList notifications={DEFAULT_MOCK_NOTIFICATIONS} />);

      // Click SLA Category Filter Button
      const slaFilterBtn = screen.getByTestId('category-filter-SLA');
      fireEvent.click(slaFilterBtn);

      // Only SLA notifications should remain visible
      expect(screen.getByText('SLA Breach Warning: Ticket #SLA-882 Response Overdue')).toBeInTheDocument();
      expect(screen.queryByText('Commercial Quote #Q-9042 Approved')).not.toBeInTheDocument();
    });

    it('handles read status filter selection correctly', () => {
      render(<NotificationHubList notifications={DEFAULT_MOCK_NOTIFICATIONS} />);

      // Click Unread Filter Button
      const unreadFilterBtn = screen.getByTestId('read-status-filter-UNREAD');
      fireEvent.click(unreadFilterBtn);

      // Only unread items should be rendered
      expect(screen.getByText('SLA Breach Warning: Ticket #SLA-882 Response Overdue')).toBeInTheDocument();
      expect(screen.queryByText('Deal Milestone Achieved: Technical Evaluation Passed')).not.toBeInTheDocument();
    });

    it('filters items dynamically using the search input field', () => {
      render(<NotificationHubList notifications={DEFAULT_MOCK_NOTIFICATIONS} />);

      const searchInput = screen.getByTestId('notification-search-input');
      fireEvent.change(searchInput, { target: { value: 'Invoice' } });

      expect(screen.getByText('Invoice #INV-2026-089 Overdue Warning')).toBeInTheDocument();
      expect(screen.queryByText('Commercial Quote #Q-9042 Approved')).not.toBeInTheDocument();
    });

    it('toggles read status for an individual notification item', async () => {
      const onToggleReadStatus = vi.fn();
      render(
        <NotificationHubList
          notifications={DEFAULT_MOCK_NOTIFICATIONS}
          onToggleReadStatus={onToggleReadStatus}
        />
      );

      const toggleBtn = screen.getByTestId('read-toggle-btn-notif-sla-001');
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(onToggleReadStatus).toHaveBeenCalledWith('notif-sla-001', false);
      });
    });

    it('marks all notifications as read when clicking "Mark All as Read" button (FR-9)', async () => {
      const onMarkAllAsRead = vi.fn();
      render(
        <NotificationHubList
          notifications={DEFAULT_MOCK_NOTIFICATIONS}
          onMarkAllAsRead={onMarkAllAsRead}
        />
      );

      const markAllBtn = screen.getByTestId('mark-all-read-btn');
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(onMarkAllAsRead).toHaveBeenCalledWith(undefined);
      });
    });

    it('deletes an individual notification item when clicking delete button', async () => {
      const onDeleteNotification = vi.fn();
      render(
        <NotificationHubList
          notifications={DEFAULT_MOCK_NOTIFICATIONS}
          onDeleteNotification={onDeleteNotification}
        />
      );

      const deleteBtn = screen.getByTestId('delete-btn-notif-sla-001');
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(onDeleteNotification).toHaveBeenCalledWith('notif-sla-001');
      });
    });

    it('opens detail view modal when clicking a notification item', () => {
      render(<NotificationHubList notifications={DEFAULT_MOCK_NOTIFICATIONS} />);

      const itemCard = screen.getByTestId('notification-item-notif-sla-001');
      fireEvent.click(itemCard);

      expect(screen.getByTestId('notification-detail-modal')).toBeInTheDocument();
      expect(screen.getByText('ID: notif-sla-001')).toBeInTheDocument();
    });

    it('renders empty state when no notifications match filters', () => {
      render(
        <NotificationHubList
          notifications={DEFAULT_MOCK_NOTIFICATIONS}
          defaultCategory="SLA"
        />
      );

      const searchInput = screen.getByTestId('notification-search-input');
      fireEvent.change(searchInput, { target: { value: 'NonExistentSearchQueryXYZ' } });

      expect(screen.getByTestId('notification-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Notifications Found')).toBeInTheDocument();
    });
  });
});
