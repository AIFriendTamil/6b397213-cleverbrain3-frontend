'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { CurrentUserResponse } from '../../services/auth';
import {
  NotificationHubList,
  getCategoryBadgeDetails,
  formatNotificationTimestamp,
  calculateNotificationSummary,
  DEFAULT_MOCK_NOTIFICATIONS,
} from '../../components/notifications/NotificationHubList';
import {
  NotificationItem,
  NotificationCategory,
  getNotifications,
  updateNotificationReadStatus,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../services/financialApi';

export interface NotificationHubPageProps {
  /** Explicit authenticated user context override (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Custom session fetcher passed to ProtectedRoute */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded in-app notification records */
  initialNotifications?: NotificationItem[] | null;
  /** Custom fetcher for in-app notifications */
  fetchNotifications?: (params?: { category?: string; is_read?: boolean }) => Promise<NotificationItem[]>;
  /** Custom handler for toggling a notification read status */
  onToggleReadStatus?: (notificationId: string, currentIsRead: boolean) => Promise<void> | void;
  /** Custom handler for bulk marking notifications as read */
  onMarkAllAsRead?: (category?: string) => Promise<void> | void;
  /** Custom handler for deleting a notification */
  onDeleteNotification?: (notificationId: string) => Promise<void> | void;
  /** Whether to automatically fetch backend notifications on mount (default: true) */
  autoFetch?: boolean;
  /** Pre-selected category filter ('ALL', 'Financial', 'Milestone', 'SLA') */
  defaultCategory?: string;
  /** Pre-selected read status filter ('ALL', 'UNREAD', 'READ') */
  defaultReadStatus?: 'ALL' | 'UNREAD' | 'READ';
  /** Auto-refresh polling interval in milliseconds for real-time latency (NFR-2 default: 1000ms) */
  autoRefreshIntervalMs?: number;
  /** Initial state of the quick notification drawer overlay */
  initialDrawerOpen?: boolean;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Inner Central Notification Hub Content component consuming active user session context.
 * Integrates real-time in-app alert listings across SLA warnings, commercial quote approvals,
 * and deal milestones (FR-8), read/unread state toggles and category filtering (FR-9),
 * and 1-second auto-refresh latency delivery (NFR-2). Styled following the Linen & Logic editorial design system.
 */
function _NotificationHubContent({
  user: explicitUser,
  onLogout,
  initialNotifications = null,
  fetchNotifications: customFetchNotifications,
  onToggleReadStatus: customOnToggleReadStatus,
  onMarkAllAsRead: customOnMarkAllAsRead,
  onDeleteNotification: customOnDeleteNotification,
  autoFetch = true,
  defaultCategory = 'ALL',
  defaultReadStatus = 'ALL',
  autoRefreshIntervalMs = 1000,
  initialDrawerOpen = false,
  className = '',
  'data-testid': testId = 'notification-hub-page',
}: NotificationHubPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Local state for notification items
  const [items, setItems] = useState<NotificationItem[]>(() => {
    if (initialNotifications && initialNotifications.length > 0) {
      return initialNotifications;
    }
    return DEFAULT_MOCK_NOTIFICATIONS;
  });

  const [isLoading, setIsLoading] = useState<boolean>(autoFetch && !initialNotifications);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick Notification Drawer state (FR-8, FR-9)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(initialDrawerOpen);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [selectedReadStatus, setSelectedReadStatus] = useState<'ALL' | 'UNREAD' | 'READ'>(defaultReadStatus);

  // Selected item for detail drawer/modal view
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);

  // Polling interval state (NFR-2)
  const [pollingInterval, setPollingInterval] = useState<number>(autoRefreshIntervalMs);

  /**
   * Fetch in-app notifications from backend API or custom prop fetcher.
   */
  const loadNotifications = useCallback(async () => {
    if (!autoFetch && initialNotifications) return;

    setError(null);
    try {
      let data: NotificationItem[];
      const categoryParam = selectedCategory !== 'ALL' ? selectedCategory : undefined;
      const readParam = selectedReadStatus === 'UNREAD' ? false : selectedReadStatus === 'READ' ? true : undefined;

      if (customFetchNotifications) {
        data = await customFetchNotifications({ category: categoryParam, is_read: readParam });
      } else {
        data = await getNotifications({ category: categoryParam, is_read: readParam });
      }

      if (data && Array.isArray(data)) {
        setItems(data);
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      // Retain existing items if network fails
      if (!error) {
        setError(err.message || 'Failed to sync latest in-app notifications.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [autoFetch, initialNotifications, selectedCategory, selectedReadStatus, customFetchNotifications, error]);

  // Initial load
  useEffect(() => {
    if (autoFetch && (!initialNotifications || initialNotifications.length === 0)) {
      loadNotifications();
    }
  }, [autoFetch, initialNotifications, loadNotifications]);

  // Real-time polling timer for 1-second delivery latency (NFR-2)
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const timer = setInterval(() => {
      loadNotifications();
    }, pollingInterval);

    return () => clearInterval(timer);
  }, [pollingInterval, loadNotifications]);

  /**
   * Toggle single notification read/unread state (FR-9).
   */
  const handleToggleReadStatus = async (notificationId: string, currentIsRead: boolean) => {
    const newReadState = !currentIsRead;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: newReadState } : n))
    );
    if (selectedItem?.id === notificationId) {
      setSelectedItem((prev) => (prev ? { ...prev, is_read: newReadState } : null));
    }

    try {
      setIsProcessing(true);
      setError(null);
      if (customOnToggleReadStatus) {
        await customOnToggleReadStatus(notificationId, currentIsRead);
      } else {
        await updateNotificationReadStatus(notificationId, newReadState);
      }
      setSuccessMessage(
        newReadState ? 'Notification marked as read.' : 'Notification marked as unread.'
      );
    } catch (err: any) {
      // Revert optimistic state on error
      setItems((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: currentIsRead } : n))
      );
      setError(err.message || 'Failed to update notification read status.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Bulk mark all unread notifications as read (FR-9).
   */
  const handleMarkAllAsRead = async (categoryFilter?: string) => {
    const targetCat = categoryFilter || (selectedCategory !== 'ALL' ? selectedCategory : undefined);

    // Optimistic UI update
    setItems((prev) =>
      prev.map((n) => {
        if (!targetCat || n.category === targetCat) {
          return { ...n, is_read: true };
        }
        return n;
      })
    );

    try {
      setIsProcessing(true);
      setError(null);
      if (customOnMarkAllAsRead) {
        await customOnMarkAllAsRead(targetCat);
      } else {
        await markAllNotificationsAsRead({ category: targetCat });
      }
      setSuccessMessage(
        targetCat ? `All ${targetCat} notifications marked as read.` : 'All notifications marked as read.'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to mark all notifications as read.');
      loadNotifications();
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Delete single notification record.
   */
  const handleDeleteNotification = async (notificationId: string) => {
    // Optimistic UI update
    setItems((prev) => prev.filter((n) => n.id !== notificationId));
    if (selectedItem?.id === notificationId) {
      setSelectedItem(null);
    }

    try {
      setIsProcessing(true);
      setError(null);
      if (customOnDeleteNotification) {
        await customOnDeleteNotification(notificationId);
      } else {
        await deleteNotification(notificationId);
      }
      setSuccessMessage('Notification record deleted.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete notification.');
      loadNotifications();
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Calculate summary metrics across notifications.
   */
  const summary = useMemo(() => calculateNotificationSummary(items), [items]);

  /**
   * Unread items subset for Quick Drawer View.
   */
  const unreadItems = useMemo(() => items.filter((n) => !n.is_read), [items]);

  return (
    <div
      data-testid={testId}
      className={`notification-hub-page-wrapper ${className}`}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        color: 'var(--color-on-surface, #1b1c19)',
        fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
      }}
    >
      {/* GLOBAL NAVIGATION HEADER */}
      <NavMenu user={user} onLogout={onLogout} brandTitle="Portal Platform" />

      {/* MAIN CONTAINER */}
      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
        }}
      >
        {/* BREADCRUMB & HEADER STRIP */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '12px',
            }}
          >
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
            <Link
              href="/settings/notifications"
              style={{
                color: 'var(--color-primary, #59452b)',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              Notification Settings
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--color-on-surface, #1b1c19)', fontWeight: '600' }}>
              Central Notification Hub
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                    fontSize: '32px',
                    fontWeight: 'normal',
                    color: 'var(--color-on-surface, #1b1c19)',
                    lineHeight: '1.2',
                  }}
                >
                  Central Notification Hub
                </h1>
                {summary.unreadCount > 0 && (
                  <span
                    data-testid="page-unread-badge"
                    style={{
                      backgroundColor: 'var(--color-secondary, #a43b2c)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '600',
                      padding: '4px 12px',
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
                  margin: '8px 0 0 0',
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  maxWidth: '720px',
                  lineHeight: '1.5',
                }}
              >
                Real-time central in-app alerts for SLA breach warnings, commercial quote approvals,
                and deal milestone achievements. Configure read/unread statuses or bulk clear alert queues.
              </p>
            </div>

            {/* QUICK ACTIONS BAR */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <button
                data-testid="toggle-drawer-btn"
                onClick={() => setIsDrawerOpen((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  color: 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span style={{ fontSize: '15px' }}>🛎️</span>
                <span>{isDrawerOpen ? 'Close Notification Drawer' : 'Open Quick Drawer'}</span>
                {summary.unreadCount > 0 && (
                  <span
                    style={{
                      backgroundColor: 'var(--color-secondary, #a43b2c)',
                      color: '#ffffff',
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '9999px',
                    }}
                  >
                    {summary.unreadCount}
                  </span>
                )}
              </button>

              <button
                data-testid="page-mark-all-read-btn"
                onClick={() => handleMarkAllAsRead()}
                disabled={isProcessing || summary.unreadCount === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor:
                    summary.unreadCount > 0
                      ? 'var(--color-primary, #59452b)'
                      : 'var(--color-surface-container-high, #eae8e3)',
                  color: summary.unreadCount > 0 ? '#ffffff' : 'var(--color-outline, #80756b)',
                  border: 'none',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  cursor: summary.unreadCount > 0 && !isProcessing ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>✓✓</span>
                <span>Mark All as Read</span>
              </button>
            </div>
          </div>

          {/* REQUIREMENT AUDIT BADGES */}
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              [FR-8] SLA Alert Triggers & In-App Hub
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              [FR-9] Read/Unread Toggles & Category Filters
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
              [NFR-2] Delivery Latency &lt; 1 Second
            </span>
          </div>
        </div>

        {/* POLLING / LATENCY CONTROLS BANNER (NFR-2) */}
        <div
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 2px 10px rgba(115, 92, 65, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⏱️</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                NFR-2 Real-Time Latency Auto-Refresh
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                In-app alerts sync automatically from event generators within 1 second.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label
              htmlFor="polling-interval-select"
              style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              Polling Speed:
            </label>
            <select
              id="polling-interval-select"
              data-testid="polling-interval-select"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                color: 'var(--color-on-surface, #1b1c19)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                cursor: 'pointer',
              }}
            >
              <option value={1000}>1 Second (NFR-2 Strict)</option>
              <option value={3000}>3 Seconds</option>
              <option value={5000}>5 Seconds</option>
              <option value={0}>Manual Refresh Only</option>
            </select>
          </div>
        </div>

        {/* CENTRAL NOTIFICATION HUB LIST COMPONENT */}
        <section data-testid="notification-hub-section">
          <NotificationHubList
            notifications={items}
            onToggleReadStatus={handleToggleReadStatus}
            onMarkAllAsRead={handleMarkAllAsRead}
            onDeleteNotification={handleDeleteNotification}
            onRefresh={loadNotifications}
            onSelectNotification={(item) => setSelectedItem(item)}
            isLoading={isLoading}
            isProcessing={isProcessing}
            error={error}
            successMessage={successMessage}
            defaultCategory={defaultCategory}
            defaultReadStatus={defaultReadStatus}
            autoRefreshIntervalMs={0} // Managed at page level above
          />
        </section>

        {/* SLIDE-OVER QUICK NOTIFICATION DRAWER OVERLAY (FR-8, FR-9) */}
        {isDrawerOpen && (
          <div
            data-testid="notification-drawer-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(27, 28, 25, 0.4)',
              backdropFilter: 'blur(2px)',
              zIndex: 1000,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
            onClick={() => setIsDrawerOpen(false)}
          >
            <div
              data-testid="notification-drawer-panel"
              style={{
                width: '100%',
                maxWidth: '460px',
                height: '100vh',
                backgroundColor: 'var(--color-surface, #fbf9f4)',
                borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                boxShadow: '-4px 0 24px rgba(115, 92, 65, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1001,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* DRAWER HEADER */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                        fontSize: '20px',
                        color: 'var(--color-on-surface, #1b1c19)',
                      }}
                    >
                      Quick Alert Drawer
                    </h3>
                    {summary.unreadCount > 0 && (
                      <span
                        data-testid="drawer-unread-count"
                        style={{
                          backgroundColor: 'var(--color-secondary, #a43b2c)',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                        }}
                      >
                        {summary.unreadCount} Unread
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '12px',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    Immediate in-app notifications overlay (FR-8 / FR-9)
                  </p>
                </div>

                <button
                  data-testid="close-drawer-btn"
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-full, 9999px)',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* DRAWER BODY LIST */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {unreadItems.length === 0 ? (
                  <div
                    data-testid="drawer-empty-state"
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                      All Caught Up!
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>
                      No unread in-app alert notifications in queue.
                    </div>
                  </div>
                ) : (
                  unreadItems.map((item) => {
                    const badge = getCategoryBadgeDetails(item.category);
                    return (
                      <div
                        key={item.id}
                        data-testid={`drawer-item-${item.id}`}
                        style={{
                          padding: '14px',
                          borderRadius: 'var(--radius-md, 0.375rem)',
                          backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                          border: `1px solid ${badge.borderColor}`,
                          borderLeft: `4px solid ${badge.borderColor}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => {
                          setSelectedItem(item);
                          if (!item.is_read) {
                            handleToggleReadStatus(item.id, false);
                          }
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: badge.badgeBg,
                              color: badge.badgeText,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: '600',
                            }}
                          >
                            {badge.icon} {badge.label}
                          </span>
                          <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>
                            {formatNotificationTimestamp(item.created_at)}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'var(--color-on-surface, #1b1c19)',
                          }}
                        >
                          {item.title}
                        </div>

                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            lineHeight: '1.4',
                          }}
                        >
                          {item.message}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginTop: '4px',
                          }}
                        >
                          <button
                            data-testid={`drawer-mark-read-${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReadStatus(item.id, false);
                            }}
                            style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: 'var(--color-primary, #59452b)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            ✓ Mark as Read
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* DRAWER FOOTER */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  data-testid="drawer-mark-all-btn"
                  onClick={() => handleMarkAllAsRead()}
                  disabled={summary.unreadCount === 0}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    cursor: summary.unreadCount > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  Mark All Read
                </button>

                <button
                  data-testid="drawer-close-footer-btn"
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: 'transparent',
                    color: 'var(--color-on-surface, #1b1c19)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    cursor: 'pointer',
                  }}
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATION ITEM DETAIL MODAL */}
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
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
            onClick={() => setSelectedItem(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '540px',
                backgroundColor: 'var(--color-surface, #fbf9f4)',
                borderRadius: 'var(--radius-lg, 0.5rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                boxShadow: '0 10px 30px rgba(115, 92, 65, 0.2)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: getCategoryBadgeDetails(selectedItem.category).badgeBg,
                      color: getCategoryBadgeDetails(selectedItem.category).badgeText,
                    }}
                  >
                    {getCategoryBadgeDetails(selectedItem.category).icon}{' '}
                    {getCategoryBadgeDetails(selectedItem.category).label}
                  </span>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      marginTop: '6px',
                    }}
                  >
                    Created {formatNotificationTimestamp(selectedItem.created_at)} ({selectedItem.created_at})
                  </div>
                </div>

                <button
                  data-testid="close-modal-btn"
                  onClick={() => setSelectedItem(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  ✕
                </button>
              </div>

              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
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
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.6',
                }}
              >
                {selectedItem.message}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '8px',
                }}
              >
                <button
                  data-testid="modal-toggle-read-btn"
                  onClick={() => handleToggleReadStatus(selectedItem.id, selectedItem.is_read)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    cursor: 'pointer',
                  }}
                >
                  {selectedItem.is_read ? 'Mark as Unread' : 'Mark as Read'}
                </button>

                <button
                  data-testid="modal-delete-btn"
                  onClick={() => handleDeleteNotification(selectedItem.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: '#ffdad6',
                    color: '#93000a',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    cursor: 'pointer',
                  }}
                >
                  Delete Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Default export wrapping content in ProtectedRoute guard for session authentication.
 */
export default function NotificationHubPage(props: any = {}) {
  return (
    <ProtectedRoute fetchUser={props?.fetchUser}>
      <_NotificationHubContent {...props} />
    </ProtectedRoute>
  );
}
