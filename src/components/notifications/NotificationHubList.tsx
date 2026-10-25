'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  NotificationItem,
  NotificationCategory,
  getNotifications,
  updateNotificationReadStatus,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../services/financialApi';

export interface NotificationHubListProps {
  /** Initial or controlled array of notification items from API */
  notifications?: NotificationItem[] | null;
  /** Callback fired when a single notification's read status is toggled */
  onToggleReadStatus?: (notificationId: string, currentIsRead: boolean) => Promise<void> | void;
  /** Callback fired when bulk marking notifications as read */
  onMarkAllAsRead?: (category?: string) => Promise<void> | void;
  /** Callback fired when deleting a single notification */
  onDeleteNotification?: (notificationId: string) => Promise<void> | void;
  /** Callback fired to trigger refresh from parent */
  onRefresh?: () => void;
  /** Callback fired when selecting a notification item for deep view */
  onSelectNotification?: (notification: NotificationItem) => void;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Processing / mutation state indicator */
  isProcessing?: boolean;
  /** Error message string if network operation failed */
  error?: string | null;
  /** Success message string to display */
  successMessage?: string | null;
  /** Pre-selected category filter ('ALL', 'Financial', 'Milestone', 'SLA') */
  defaultCategory?: string;
  /** Pre-selected read status filter ('ALL', 'UNREAD', 'READ') */
  defaultReadStatus?: 'ALL' | 'UNREAD' | 'READ';
  /** Auto-refresh polling interval in milliseconds (0 to disable) */
  autoRefreshIntervalMs?: number;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Summary metrics aggregated across notifications.
 */
export interface NotificationSummary {
  totalCount: number;
  unreadCount: number;
  readCount: number;
  financialUnread: number;
  milestoneUnread: number;
  slaUnread: number;
}

/**
 * Category styling and visual metadata details.
 */
export interface CategoryBadgeDetails {
  key: NotificationCategory;
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: string;
  description: string;
}

/**
 * Default mock notification dataset adhering to Linen & Logic domain schemas.
 */
export const DEFAULT_MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-sla-001',
    user_id: 'usr-fin-exec-101',
    category: 'SLA',
    title: 'SLA Breach Warning: Ticket #SLA-882 Response Overdue',
    message: 'Ticket #SLA-882 (Severity P1 - Production Down) has exceeded 75% of response SLA duration. Immediate agent assignment required.',
    is_read: false,
    created_at: '2026-10-24T13:45:00Z',
  },
  {
    id: 'notif-fin-002',
    user_id: 'usr-fin-exec-101',
    category: 'Financial',
    title: 'Commercial Quote #Q-9042 Approved',
    message: 'Finance Manager approved Quote #Q-9042 ($145,000.00 USD) for ACME Corp. Ready for customer execution.',
    is_read: false,
    created_at: '2026-10-24T12:30:00Z',
  },
  {
    id: 'notif-ms-003',
    user_id: 'usr-fin-exec-101',
    category: 'Milestone',
    title: 'Deal Milestone Achieved: Technical Evaluation Passed',
    message: 'Global Logistics Enterprise deal moved to Stage 4 (Contract Negotiation) following technical review signoff.',
    is_read: true,
    created_at: '2026-10-24T10:15:00Z',
  },
  {
    id: 'notif-fin-004',
    user_id: 'usr-fin-exec-101',
    category: 'Financial',
    title: 'Invoice #INV-2026-089 Overdue Warning',
    message: 'Invoice #INV-2026-089 ($32,500.00 USD) for TechCorp is now 15 days past due date.',
    is_read: false,
    created_at: '2026-10-24T08:00:00Z',
  },
  {
    id: 'notif-sla-005',
    user_id: 'usr-fin-exec-101',
    category: 'SLA',
    title: 'Support Resolution SLA Target Approaching',
    message: 'Support Ticket #T-402 (P2 High) resolution SLA target in 1 hour.',
    is_read: true,
    created_at: '2026-10-23T16:20:00Z',
  },
];

/**
 * Utility helper to retrieve rich Linen & Logic category visual details.
 */
export function getCategoryBadgeDetails(category: NotificationCategory | string): CategoryBadgeDetails {
  switch (category) {
    case 'Financial':
      return {
        key: 'Financial',
        label: 'Financial',
        badgeBg: 'var(--color-primary-container, #735c41)',
        badgeText: 'var(--color-on-primary-container, #f5d6b4)',
        borderColor: '#735c41',
        icon: '💰',
        description: 'ARR updates, invoice statuses, quote approvals, and financial metrics.',
      };
    case 'SLA':
      return {
        key: 'SLA',
        label: 'SLA Alert',
        badgeBg: '#fdf0ed',
        badgeText: '#a43b2c',
        borderColor: '#a43b2c',
        icon: '⚠️',
        description: 'Service level agreement threshold warnings and ticket escalation alerts.',
      };
    case 'Milestone':
      return {
        key: 'Milestone',
        label: 'Milestone',
        badgeBg: '#e8f5e9',
        badgeText: '#2e6b38',
        borderColor: '#2e6b38',
        icon: '🎯',
        description: 'Deal pipeline progression, key achievement steps, and contract milestones.',
      };
    default:
      return {
        key: category as NotificationCategory,
        label: category,
        badgeBg: 'var(--color-surface-container-high, #eae8e3)',
        badgeText: 'var(--color-on-surface, #1b1c19)',
        borderColor: '#80756b',
        icon: '🔔',
        description: 'General system notification event.',
      };
  }
}

/**
 * Utility helper to format notification creation timestamp.
 */
export function formatNotificationTimestamp(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 172800) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Calculate aggregate summary statistics across notifications.
 */
export function calculateNotificationSummary(items: NotificationItem[]): NotificationSummary {
  if (!items || items.length === 0) {
    return {
      totalCount: 0,
      unreadCount: 0,
      readCount: 0,
      financialUnread: 0,
      milestoneUnread: 0,
      slaUnread: 0,
    };
  }

  return items.reduce(
    (acc, item) => {
      acc.totalCount += 1;
      if (!item.is_read) {
        acc.unreadCount += 1;
        if (item.category === 'Financial') acc.financialUnread += 1;
        else if (item.category === 'Milestone') acc.milestoneUnread += 1;
        else if (item.category === 'SLA') acc.slaUnread += 1;
      } else {
        acc.readCount += 1;
      }
      return acc;
    },
    {
      totalCount: 0,
      unreadCount: 0,
      readCount: 0,
      financialUnread: 0,
      milestoneUnread: 0,
      slaUnread: 0,
    }
  );
}

/**
 * Filter notifications array by category, read status, and text search query.
 */
export function filterNotifications(
  items: NotificationItem[],
  categoryFilter: string,
  readFilter: string,
  searchQuery: string
): NotificationItem[] {
  if (!items) return [];

  return items.filter((item) => {
    // Category match
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
      return false;
    }

    // Read status match
    if (readFilter === 'UNREAD' && item.is_read) return false;
    if (readFilter === 'READ' && !item.is_read) return false;

    // Search query match
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = item.title ? item.title.toLowerCase().includes(q) : false;
      const messageMatch = item.message ? item.message.toLowerCase().includes(q) : false;
      if (!titleMatch && !messageMatch) return false;
    }

    return true;
  });
}

/**
 * In-App Central Notification Hub List Component (T025).
 * Implements real-time alert listing, read/unread state toggles, category filters,
 * bulk "Mark all as read", deletion, search, and detail modal viewing.
 */
export const NotificationHubList: React.FC<NotificationHubListProps> = ({
  notifications: initialNotificationsProp,
  onToggleReadStatus,
  onMarkAllAsRead,
  onDeleteNotification,
  onRefresh,
  onSelectNotification,
  isLoading: externalLoading = false,
  isProcessing: externalProcessing = false,
  error: externalError = null,
  successMessage: externalSuccessMessage = null,
  defaultCategory = 'ALL',
  defaultReadStatus = 'ALL',
  autoRefreshIntervalMs = 0,
  className = '',
  'data-testid': testId = 'notification-hub-list',
}) => {
  // Local state for notification items
  const [items, setItems] = useState<NotificationItem[]>(
    initialNotificationsProp ?? DEFAULT_MOCK_NOTIFICATIONS
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(externalError);
  const [successBanner, setSuccessBanner] = useState<string | null>(externalSuccessMessage);

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [selectedReadStatus, setSelectedReadStatus] = useState<'ALL' | 'UNREAD' | 'READ'>(defaultReadStatus);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected notification for modal drawer
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);

  // Auto-refresh timer state
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Sync external props with internal state
  useEffect(() => {
    if (initialNotificationsProp !== undefined && initialNotificationsProp !== null) {
      setItems(initialNotificationsProp);
    }
  }, [initialNotificationsProp]);

  useEffect(() => {
    setErrorMessage(externalError);
  }, [externalError]);

  useEffect(() => {
    setSuccessBanner(externalSuccessMessage);
  }, [externalSuccessMessage]);

  // Fetch notifications from backend API if no initial prop supplied
  const fetchNotificationsData = useCallback(async () => {
    if (initialNotificationsProp !== undefined && initialNotificationsProp !== null) {
      if (onRefresh) onRefresh();
      setLastUpdated(new Date());
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const categoryParam = selectedCategory !== 'ALL' ? selectedCategory : undefined;
      const readParam = selectedReadStatus === 'UNREAD' ? false : selectedReadStatus === 'READ' ? true : undefined;

      const data = await getNotifications({ category: categoryParam, is_read: readParam });
      setItems(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch in-app notifications.');
    } finally {
      setLoading(false);
    }
  }, [initialNotificationsProp, selectedCategory, selectedReadStatus, onRefresh]);

  // Handle auto-refresh interval for real-time delivery latency (NFR-2)
  useEffect(() => {
    if (autoRefreshIntervalMs <= 0) return;

    const timer = setInterval(() => {
      fetchNotificationsData();
    }, autoRefreshIntervalMs);

    return () => clearInterval(timer);
  }, [autoRefreshIntervalMs, fetchNotificationsData]);

  // Compute summary metrics
  const summary = useMemo(() => calculateNotificationSummary(items), [items]);

  // Compute filtered list
  const filteredList = useMemo(
    () => filterNotifications(items, selectedCategory, selectedReadStatus, searchQuery),
    [items, selectedCategory, selectedReadStatus, searchQuery]
  );

  // Single item read/unread toggle handler
  const handleToggleReadStatus = async (item: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newReadState = !item.is_read;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: newReadState } : n))
    );
    if (selectedItem?.id === item.id) {
      setSelectedItem((prev) => (prev ? { ...prev, is_read: newReadState } : null));
    }

    try {
      setActionProcessingId(item.id);
      if (onToggleReadStatus) {
        await onToggleReadStatus(item.id, item.is_read);
      } else {
        await updateNotificationReadStatus(item.id, newReadState);
      }
      setSuccessBanner(
        newReadState
          ? `Notification marked as read.`
          : `Notification marked as unread.`
      );
    } catch (err: any) {
      // Revert optimism on error
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: item.is_read } : n))
      );
      setErrorMessage(err.message || 'Failed to update notification read status.');
    } finally {
      setActionProcessingId(null);
    }
  };

  // Bulk mark all as read handler (FR-9)
  const handleMarkAllAsRead = async () => {
    const unreadCount = items.filter((n) => !n.is_read).length;
    if (unreadCount === 0) {
      setSuccessBanner('All notifications are already marked as read.');
      return;
    }

    const targetCategory = selectedCategory !== 'ALL' ? selectedCategory : undefined;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((n) => {
        if (!targetCategory || n.category === targetCategory) {
          return { ...n, is_read: true };
        }
        return n;
      })
    );

    try {
      setBulkProcessing(true);
      setErrorMessage(null);

      if (onMarkAllAsRead) {
        await onMarkAllAsRead(targetCategory);
      } else {
        await markAllNotificationsAsRead({ category: targetCategory });
      }

      setSuccessBanner(
        targetCategory
          ? `All ${targetCategory} notifications marked as read.`
          : `All notifications marked as read.`
      );
    } catch (err: any) {
      // Revert optimism
      setErrorMessage(err.message || 'Failed to mark all notifications as read.');
      if (onRefresh) onRefresh();
    } finally {
      setBulkProcessing(false);
    }
  };

  // Delete notification handler
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Optimistic UI update
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }

    try {
      setActionProcessingId(id);
      if (onDeleteNotification) {
        await onDeleteNotification(id);
      } else {
        await deleteNotification(id);
      }
      setSuccessBanner('Notification deleted successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete notification.');
      if (onRefresh) onRefresh();
    } finally {
      setActionProcessingId(null);
    }
  };

  // Select item for detail view
  const handleSelectItem = (item: NotificationItem) => {
    setSelectedItem(item);
    if (onSelectNotification) {
      onSelectNotification(item);
    }
    // Auto mark as read on view if unread
    if (!item.is_read) {
      handleToggleReadStatus(item);
    }
  };

  const isGlobalLoading = externalLoading || loading;
  const isGlobalProcessing = externalProcessing || bulkProcessing;

  return (
    <div
      data-testid={testId}
      className={`notification-hub-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-on-surface, #1b1c19)',
      }}
    >
      {/* Top Header Strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                fontWeight: 'normal',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            >
              In-App Notification Hub
            </h2>
            {summary.unreadCount > 0 && (
              <span
                data-testid="unread-badge"
                style={{
                  backgroundColor: 'var(--color-secondary, #a43b2c)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  letterSpacing: '0.05em',
                }}
              >
                {summary.unreadCount} Unread
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
            Real-time event updates across SLA alerts, commercial approvals, and deal milestones.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            data-testid="refresh-btn"
            onClick={fetchNotificationsData}
            disabled={isGlobalLoading || isGlobalProcessing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '500',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              color: 'var(--color-on-surface, #1b1c19)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              cursor: isGlobalLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '14px' }}>🔄</span>
            <span>Refresh</span>
          </button>

          <button
            data-testid="mark-all-read-btn"
            onClick={handleMarkAllAsRead}
            disabled={isGlobalProcessing || summary.unreadCount === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor:
                summary.unreadCount > 0
                  ? 'var(--color-primary, #59452b)'
                  : 'var(--color-surface-container-high, #eae8e3)',
              color: summary.unreadCount > 0 ? '#ffffff' : 'var(--color-outline, #80756b)',
              border: 'none',
              borderRadius: 'var(--radius-md, 0.375rem)',
              cursor: summary.unreadCount > 0 && !isGlobalProcessing ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
            }}
          >
            <span>✓✓</span>
            <span>
              {bulkProcessing
                ? 'Updating...'
                : selectedCategory !== 'ALL'
                ? `Mark ${selectedCategory} Read`
                : 'Mark All as Read'}
            </span>
          </button>
        </div>
      </div>

      {/* Banners for Error or Success */}
      {errorMessage && (
        <div
          data-testid="notification-error-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            border: '1px solid #f5c2c0',
            borderRadius: 'var(--radius-md, 0.375rem)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-on-error-container, #93000a)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {successBanner && (
        <div
          data-testid="notification-success-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
            color: 'var(--color-trend-up, #2e6b38)',
            border: '1px solid #c8e6c9',
            borderRadius: 'var(--radius-md, 0.375rem)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✓ {successBanner}</span>
          <button
            onClick={() => setSuccessBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-trend-up, #2e6b38)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary KPI Cards Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Total In-App Alerts
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '2px' }}>
            {summary.totalCount}
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: summary.unreadCount > 0 ? '#fdf0ed' : 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: summary.unreadCount > 0 ? '1px solid #fd7d69' : '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: summary.unreadCount > 0 ? '#a43b2c' : 'var(--color-on-surface-variant, #4e453d)' }}>
            Unread Alerts
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: summary.unreadCount > 0 ? '#a43b2c' : 'inherit', marginTop: '2px' }}>
            {summary.unreadCount}
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            SLA Unread Warnings
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#a43b2c', marginTop: '2px' }}>
            {summary.slaUnread}
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Financial & Quotes
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#735c41', marginTop: '2px' }}>
            {summary.financialUnread}
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px',
          backgroundColor: 'var(--color-surface-container, #f0eee9)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-on-surface-variant, #4e453d)', marginRight: '4px' }}>
            Category:
          </span>
          {['ALL', 'Financial', 'Milestone', 'SLA'].map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                data-testid={`category-filter-${cat}`}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: isSelected ? '600' : 'normal',
                  backgroundColor: isSelected ? 'var(--color-primary, #59452b)' : 'var(--color-surface-container-lowest, #ffffff)',
                  color: isSelected ? '#ffffff' : 'var(--color-on-surface, #1b1c19)',
                  border: isSelected ? '1px solid var(--color-primary, #59452b)' : '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-full, 9999px)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
                {cat === 'Financial' && summary.financialUnread > 0 && ` (${summary.financialUnread})`}
                {cat === 'Milestone' && summary.milestoneUnread > 0 && ` (${summary.milestoneUnread})`}
                {cat === 'SLA' && summary.slaUnread > 0 && ` (${summary.slaUnread})`}
              </button>
            );
          })}
        </div>

        {/* Read Status Filter & Search Box */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Status:
            </span>
            {(['ALL', 'UNREAD', 'READ'] as const).map((status) => {
              const isSelected = selectedReadStatus === status;
              return (
                <button
                  key={status}
                  data-testid={`read-status-filter-${status}`}
                  onClick={() => setSelectedReadStatus(status)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: isSelected ? '600' : 'normal',
                    backgroundColor: isSelected ? 'var(--color-on-surface, #1b1c19)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--color-on-surface, #1b1c19)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    cursor: 'pointer',
                  }}
                >
                  {status === 'ALL' ? 'All' : status === 'UNREAD' ? 'Unread' : 'Read'}
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              data-testid="notification-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              style={{
                padding: '6px 12px 6px 28px',
                fontSize: '12px',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                outline: 'none',
                width: '180px',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: 'var(--color-outline, #80756b)',
              }}
            >
              🔍
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  fontSize: '10px',
                  color: 'var(--color-outline, #80756b)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Notification List Table / Items Stack */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: '200px',
        }}
      >
        {isGlobalLoading ? (
          <div
            data-testid="notification-loading-spinner"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              color: 'var(--color-outline, #80756b)',
              fontSize: '14px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                border: '2px solid var(--color-outline-variant, #d1c4b9)',
                borderTopColor: 'var(--color-primary, #59452b)',
                borderRadius: '50%',
                animation: 'pulse 1s linear infinite',
                marginBottom: '12px',
              }}
            />
            <span>Loading in-app alerts...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div
            data-testid="notification-empty-state"
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px dashed var(--color-outline-variant, #d1c4b9)',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
              No Notifications Found
            </h4>
            <p style={{ margin: 0, fontSize: '13px' }}>
              {searchQuery || selectedCategory !== 'ALL' || selectedReadStatus !== 'ALL'
                ? 'Try adjusting your category filter, status toggle, or search keywords.'
                : 'You have no active alerts in your central notification hub.'}
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const badge = getCategoryBadgeDetails(item.category);
            const formattedTime = formatNotificationTimestamp(item.created_at);
            const isItemProcessing = actionProcessingId === item.id;

            return (
              <div
                key={item.id}
                data-testid={`notification-item-${item.id}`}
                onClick={() => handleSelectItem(item)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: item.is_read
                    ? 'var(--color-surface-container-lowest, #ffffff)'
                    : 'var(--color-surface-container-low, #f5f3ee)',
                  borderLeft: `4px solid ${
                    item.is_read ? 'var(--color-outline-variant, #d1c4b9)' : badge.borderColor
                  }`,
                  borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRight: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease, transform 0.1s ease',
                  opacity: isItemProcessing ? 0.6 : 1,
                }}
              >
                {/* Left Content Area */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                    }}
                  >
                    {/* Category Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: badge.badgeBg,
                        color: badge.badgeText,
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                      }}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>

                    {/* Unread Visual Indicator Tag */}
                    {!item.is_read && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#a43b2c',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        • NEW UNREAD
                      </span>
                    )}

                    {/* Timestamp */}
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-outline, #80756b)',
                        marginLeft: 'auto',
                      }}
                    >
                      {formattedTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h4
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: '15px',
                      fontWeight: item.is_read ? '500' : 'bold',
                      color: 'var(--color-on-surface, #1b1c19)',
                      lineHeight: '1.4',
                    }}
                  >
                    {item.title}
                  </h4>

                  {/* Message body preview */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: item.is_read
                        ? 'var(--color-on-surface-variant, #4e453d)'
                        : 'var(--color-on-surface, #1b1c19)',
                      lineHeight: '1.5',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.message}
                  </p>
                </div>

                {/* Right Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingLeft: '8px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Toggle Read Status Button */}
                  <button
                    type="button"
                    data-testid={`read-toggle-btn-${item.id}`}
                    onClick={(e) => handleToggleReadStatus(item, e)}
                    disabled={isItemProcessing}
                    title={item.is_read ? 'Mark as Unread' : 'Mark as Read'}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: item.is_read
                        ? 'var(--color-surface-container-high, #eae8e3)'
                        : 'var(--color-primary, #59452b)',
                      color: item.is_read ? 'var(--color-on-surface, #1b1c19)' : '#ffffff',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      cursor: isItemProcessing ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {item.is_read ? 'Mark Unread' : 'Mark Read'}
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    data-testid={`delete-btn-${item.id}`}
                    onClick={(e) => handleDelete(item.id, e)}
                    disabled={isItemProcessing}
                    title="Delete Notification"
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      backgroundColor: 'transparent',
                      color: 'var(--color-error, #ba1a1a)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      cursor: isItemProcessing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
          fontSize: '12px',
          color: 'var(--color-outline, #80756b)',
        }}
      >
        <span>
          Showing {filteredList.length} of {items.length} notifications
        </span>
        <span>
          Last synced: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* Detail Modal / Drawer View */}
      {selectedItem && (
        <div
          data-testid="notification-detail-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(27, 28, 25, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(115, 92, 65, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    backgroundColor: getCategoryBadgeDetails(selectedItem.category).badgeBg,
                    color: getCategoryBadgeDetails(selectedItem.category).badgeText,
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                  }}
                >
                  {selectedItem.category} Alert
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-outline, #80756b)', marginLeft: '10px' }}>
                  {formatNotificationTimestamp(selectedItem.created_at)}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: 'var(--color-outline, #80756b)',
                }}
              >
                ✕
              </button>
            </div>

            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: '20px',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            >
              {selectedItem.title}
            </h3>

            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                fontSize: '14px',
                lineHeight: '1.6',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            >
              {selectedItem.message}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-outline, #80756b)' }}>
                ID: {selectedItem.id}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleToggleReadStatus(selectedItem)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '500',
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    cursor: 'pointer',
                  }}
                >
                  {selectedItem.is_read ? 'Mark as Unread' : 'Mark as Read'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationHubList;
