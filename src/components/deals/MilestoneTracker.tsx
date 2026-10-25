'use client';

import React, { useState, useMemo } from 'react';
import { Milestone, CriticalTask, MilestoneStatus } from '../../services/api_client';

export interface MilestoneTrackerProps {
  /** List of milestones for a deal */
  milestones?: Milestone[] | null;
  /** Associated deal identifier */
  dealId?: string;
  /** Callback fired when a milestone row/card is selected */
  onMilestoneSelect?: (milestoneId: string) => void;
  /** Callback fired when a milestone object is clicked */
  onMilestoneClick?: (milestone: Milestone) => void;
  /** Callback fired when a milestone status update is requested */
  onStatusChange?: (milestoneId: string, newStatus: MilestoneStatus) => void;
  /** Callback fired when creating a new milestone */
  onCreateMilestone?: () => void;
  /** Callback fired when adding a critical task to a milestone */
  onCreateTask?: (milestoneId: string) => void;
  /** Indicates whether milestone data is loading */
  isLoading?: boolean;
  /** Error message to render if data fetching failed */
  error?: string | null;
  /** Custom CSS class name override */
  className?: string;
  /** Test identifier attribute override */
  'data-testid'?: string;
}

/**
 * Helper to format ISO date strings into a localized, human-readable format.
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Color info definition for milestone visual status badges.
 */
export interface MilestoneColorInfo {
  statusKey: string;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  progressColor: string;
  iconSymbol: string;
}

/**
 * Determine visual styling parameters for a milestone based on status and color_code.
 */
export function getMilestoneColorInfo(
  status?: MilestoneStatus | string | null,
  colorCode?: string | null
): MilestoneColorInfo {
  const normStatus = (status || '').toUpperCase();
  const normColor = (colorCode || '').toLowerCase();

  if (normStatus === 'COMPLETED' || normColor === 'green') {
    return {
      statusKey: 'COMPLETED',
      label: 'Completed',
      badgeBg: '#e8f5e9',
      badgeText: '#1b4332',
      badgeBorder: '#a3cfbb',
      progressColor: '#2e7d32',
      iconSymbol: '✓',
    };
  }

  if (normStatus === 'DELAYED' || normColor === 'red') {
    return {
      statusKey: 'DELAYED',
      label: 'Delayed',
      badgeBg: '#fdf0ed',
      badgeText: '#842417',
      badgeBorder: '#f5c2c7',
      progressColor: '#a43b2c',
      iconSymbol: '⚠',
    };
  }

  if (normStatus === 'IN_PROGRESS' || normColor === 'blue') {
    return {
      statusKey: 'IN_PROGRESS',
      label: 'In Progress',
      badgeBg: '#e7f1ff',
      badgeText: '#071d30',
      badgeBorder: '#b6d4fe',
      progressColor: '#374a5f',
      iconSymbol: '⏳',
    };
  }

  // Default: PENDING / gray
  return {
    statusKey: 'PENDING',
    label: 'Pending',
    badgeBg: '#f0eee9',
    badgeText: '#4e453d',
    badgeBorder: '#d1c4b9',
    progressColor: '#80756b',
    iconSymbol: '○',
  };
}

/**
 * Calculate completion progress percentage (0 - 100) for a milestone.
 */
export function calculateMilestoneProgress(milestone: Milestone): number {
  if (milestone.status === 'COMPLETED') {
    return 100;
  }
  if (milestone.status === 'PENDING') {
    return 0;
  }

  const tasks = milestone.critical_tasks || [];
  if (tasks.length > 0) {
    const onTrackCount = tasks.filter((t) => !t.is_overdue && !t.escalated_to_supervisor).length;
    const ratio = Math.round((onTrackCount / tasks.length) * 100);
    if (milestone.status === 'IN_PROGRESS') {
      return Math.max(25, ratio);
    }
    return ratio;
  }

  if (milestone.status === 'IN_PROGRESS') {
    return 50;
  }
  if (milestone.status === 'DELAYED') {
    return 25;
  }

  return 0;
}

/**
 * Color-coded milestone progress list component with task escalation indicators.
 */
export const MilestoneTracker: React.FC<MilestoneTrackerProps> = ({
  milestones = [],
  dealId,
  onMilestoneSelect,
  onMilestoneClick,
  onStatusChange,
  onCreateMilestone,
  onCreateTask,
  isLoading = false,
  error = null,
  className = '',
  'data-testid': testId = 'milestone-tracker',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});

  const list = useMemo(() => milestones || [], [milestones]);

  // Compute summary metrics
  const summary = useMemo(() => {
    const total = list.length;
    let completed = 0;
    let inProgress = 0;
    let delayed = 0;
    let pending = 0;
    let totalTasks = 0;
    let escalatedTasks = 0;
    let overdueTasks = 0;

    list.forEach((ms) => {
      if (ms.status === 'COMPLETED') completed++;
      else if (ms.status === 'IN_PROGRESS') inProgress++;
      else if (ms.status === 'DELAYED') delayed++;
      else pending++;

      (ms.critical_tasks || []).forEach((t) => {
        totalTasks++;
        if (t.escalated_to_supervisor) escalatedTasks++;
        if (t.is_overdue) overdueTasks++;
      });
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      delayed,
      pending,
      completionRate,
      totalTasks,
      escalatedTasks,
      overdueTasks,
    };
  }, [list]);

  // Toggle milestone expand/collapse
  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedMilestones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Expand or collapse all
  const toggleAllExpanded = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    list.forEach((ms) => {
      nextState[ms.id] = expand;
    });
    setExpandedMilestones(nextState);
  };

  // Filtered milestone list
  const filteredMilestones = useMemo(() => {
    return list.filter((ms) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ESCALATED') {
          const hasEscalated = (ms.critical_tasks || []).some(
            (t) => t.escalated_to_supervisor || t.is_overdue
          );
          if (!hasEscalated) return false;
        } else if (ms.status !== statusFilter) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ms.title.toLowerCase().includes(q);
        const matchesTask = (ms.critical_tasks || []).some((t) =>
          t.title.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesTask) return false;
      }

      return true;
    });
  }, [list, statusFilter, searchQuery]);

  // Handle milestone selection
  const handleMilestoneClick = (ms: Milestone) => {
    if (onMilestoneSelect) {
      onMilestoneSelect(ms.id);
    }
    if (onMilestoneClick) {
      onMilestoneClick(ms);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`milestone-tracker-container ${className}`}
        data-testid={testId}
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-surface, #fbf9f4)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-surface-container-high, #eae8e3)',
        }}
      >
        <div
          data-testid="milestone-tracker-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 16px',
            color: 'var(--color-on-surface-variant, #4e453d)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--color-surface-container-high, #eae8e3)',
              borderTopColor: 'var(--color-primary, #59452b)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px',
            }}
          />
          <span>Loading milestone progress and critical tasks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`milestone-tracker-container ${className}`}
        data-testid={testId}
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-surface, #fbf9f4)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-error-container, #ffdad6)',
        }}
      >
        <div
          data-testid="milestone-tracker-error"
          style={{
            padding: '16px',
            backgroundColor: '#fdf0ed',
            color: 'var(--color-error, #ba1a1a)',
            borderRadius: 'var(--radius-sm, 0.125rem)',
            border: '1px solid #f5c2c7',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <strong>Error loading milestones:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`milestone-tracker-container ${className}`}
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        padding: '24px',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        border: '1px solid var(--color-surface-container-high, #eae8e3)',
        boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
      }}
    >
      {/* Header section with title and action buttons */}
      <div
        data-testid="milestone-tracker-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h2
            data-testid="milestone-tracker-title"
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '24px',
              fontWeight: 400,
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            Milestone Progress & Escalations
          </h2>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Track deal progress, completion targets, and supervisor escalations.
          </p>
        </div>

        {onCreateMilestone && (
          <button
            type="button"
            data-testid="add-milestone-btn"
            onClick={onCreateMilestone}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-primary, #59452b)',
              color: 'var(--color-on-primary, #ffffff)',
              border: 'none',
              borderRadius: 'var(--radius-default, 0.25rem)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s ease',
            }}
          >
            <span>+</span> Add Milestone
          </button>
        )}
      </div>

      {/* Summary KPI Bar */}
      <div
        data-testid="milestone-tracker-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          padding: '16px',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-surface-container-high, #eae8e3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Total Milestones
          </span>
          <span
            data-testid="summary-total-milestones"
            style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)' }}
          >
            {summary.total}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Completed
          </span>
          <span
            data-testid="summary-completed-milestones"
            style={{ fontSize: '20px', fontWeight: 600, color: '#2e7d32' }}
          >
            {summary.completed} ({summary.completionRate}%)
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Delayed
          </span>
          <span
            data-testid="summary-delayed-milestones"
            style={{ fontSize: '20px', fontWeight: 600, color: '#a43b2c' }}
          >
            {summary.delayed}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Critical Tasks
          </span>
          <span
            data-testid="summary-critical-tasks"
            style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)' }}
          >
            {summary.totalTasks}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: summary.escalatedTasks > 0 ? '#ba1a1a' : 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Escalated Tasks
          </span>
          <span
            data-testid="summary-escalated-tasks"
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: summary.escalatedTasks > 0 ? '#ba1a1a' : 'var(--color-on-surface, #1b1c19)',
            }}
          >
            {summary.escalatedTasks}
          </span>
        </div>
      </div>

      {/* Global Escalation Warning Banner if any tasks are escalated */}
      {summary.escalatedTasks > 0 && (
        <div
          data-testid="escalation-warning-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#fdf0ed',
            border: '1px solid #f5c2c7',
            borderRadius: 'var(--radius-md, 0.375rem)',
            color: '#842417',
            fontSize: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🚨</span>
            <div>
              <strong>Supervisor Escalation Alert:</strong> {summary.escalatedTasks} task(s) have been escalated to supervisor review due to overdue completion targets.
            </div>
          </div>
          <button
            type="button"
            data-testid="filter-escalated-banner-btn"
            onClick={() => setStatusFilter('ESCALATED')}
            style={{
              padding: '4px 10px',
              backgroundColor: '#a43b2c',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            View Escalated
          </button>
        </div>
      )}

      {/* Controls Bar: Search, Filters, Expand/Collapse */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingTop: '8px',
        }}
      >
        {/* Search Input */}
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <input
            type="text"
            data-testid="milestone-search-input"
            placeholder="Search milestones or tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: 'var(--radius-default, 0.25rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-on-surface, #1b1c19)',
              outline: 'none',
            }}
          />
        </div>

        {/* Status Filter Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {[
            { id: 'ALL', label: 'All' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'DELAYED', label: 'Delayed' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'ESCALATED', label: '🚨 Escalated' },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`filter-btn-${tab.id.toLowerCase()}`}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  border: `1px solid ${
                    isActive ? 'var(--color-primary, #59452b)' : 'var(--color-outline-variant, #d1c4b9)'
                  }`,
                  backgroundColor: isActive
                    ? 'var(--color-primary, #59452b)'
                    : 'var(--color-surface-container-low, #f5f3ee)',
                  color: isActive
                    ? 'var(--color-on-primary, #ffffff)'
                    : 'var(--color-on-surface-variant, #4e453d)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Expand / Collapse All Controls */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            data-testid="expand-all-btn"
            onClick={() => toggleAllExpanded(true)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'transparent',
              color: 'var(--color-on-surface-variant, #4e453d)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              cursor: 'pointer',
            }}
          >
            Expand All
          </button>
          <button
            type="button"
            data-testid="collapse-all-btn"
            onClick={() => toggleAllExpanded(false)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'transparent',
              color: 'var(--color-on-surface-variant, #4e453d)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              cursor: 'pointer',
            }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Milestone List */}
      <div
        data-testid="milestone-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {filteredMilestones.length === 0 ? (
          <div
            data-testid="milestone-tracker-empty"
            style={{
              textAlign: 'center',
              padding: '36px 16px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px dashed var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>
              No milestones found.
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search query or status filter.'
                : 'Click "Add Milestone" to create the first milestone.'}
            </p>
          </div>
        ) : (
          filteredMilestones.map((ms) => {
            const colorInfo = getMilestoneColorInfo(ms.status, ms.color_code);
            const progress = calculateMilestoneProgress(ms);
            const tasks = ms.critical_tasks || [];
            const isExpanded = expandedMilestones[ms.id] ?? false;
            const hasEscalations = tasks.some(
              (t) => t.escalated_to_supervisor || t.is_overdue
            );

            return (
              <div
                key={ms.id}
                data-testid={`milestone-item-${ms.id}`}
                onClick={() => handleMilestoneClick(ms)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: `1px solid ${
                    hasEscalations ? '#f5c2c7' : 'var(--color-surface-container-high, #eae8e3)'
                  }`,
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                  boxShadow: hasEscalations
                    ? '0 2px 8px rgba(164, 59, 44, 0.08)'
                    : '0 1px 3px rgba(0, 0, 0, 0.02)',
                  cursor: 'pointer',
                }}
              >
                {/* Milestone Top Bar / Header */}
                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    {/* Left: Title & Dates */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        data-testid={`milestone-expand-btn-${ms.id}`}
                        onClick={(e) => toggleExpand(ms.id, e)}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '14px',
                          cursor: 'pointer',
                          color: 'var(--color-on-surface-variant, #4e453d)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                        }}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>

                      <div>
                        <h3
                          data-testid={`milestone-title-${ms.id}`}
                          style={{
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--color-on-surface, #1b1c19)',
                          }}
                        >
                          {ms.title}
                        </h3>
                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            fontSize: '12px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            marginTop: '2px',
                          }}
                        >
                          <span data-testid={`milestone-target-date-${ms.id}`}>
                            Target: {formatDate(ms.target_date)}
                          </span>
                          {ms.completed_date && (
                            <span data-testid={`milestone-completed-date-${ms.id}`}>
                              Completed: {formatDate(ms.completed_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status badge & Status Change Controls */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      {/* Status Badge */}
                      <span
                        data-testid={`milestone-status-badge-${ms.id}`}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full, 9999px)',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: colorInfo.badgeBg,
                          color: colorInfo.badgeText,
                          border: `1px solid ${colorInfo.badgeBorder}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{colorInfo.iconSymbol}</span>
                        <span>{colorInfo.label}</span>
                      </span>

                      {/* Status Selector Dropdown if onStatusChange provided */}
                      {onStatusChange && (
                        <select
                          data-testid={`milestone-status-select-${ms.id}`}
                          value={ms.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onStatusChange(ms.id, e.target.value as MilestoneStatus);
                          }}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                            color: 'var(--color-on-surface, #1b1c19)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="DELAYED">DELAYED</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      <span>Progress</span>
                      <span data-testid={`milestone-progress-value-${ms.id}`}>
                        {progress}%
                      </span>
                    </div>

                    <div
                      data-testid={`milestone-progress-bar-container-${ms.id}`}
                      style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                        borderRadius: 'var(--radius-full, 9999px)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        data-testid={`milestone-progress-bar-${ms.id}`}
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          backgroundColor: colorInfo.progressColor,
                          borderRadius: 'var(--radius-full, 9999px)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Tasks Section */}
                {isExpanded && (
                  <div
                    data-testid={`milestone-tasks-section-${ms.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
                      backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--color-on-surface-variant, #4e453d)',
                        }}
                      >
                        Critical Tasks ({tasks.length})
                      </span>

                      {onCreateTask && (
                        <button
                          type="button"
                          data-testid={`add-task-btn-${ms.id}`}
                          onClick={() => onCreateTask(ms.id)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: 'transparent',
                            color: 'var(--color-primary, #59452b)',
                            border: '1px solid var(--color-primary, #59452b)',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            cursor: 'pointer',
                          }}
                        >
                          + Add Task
                        </button>
                      )}
                    </div>

                    {tasks.length === 0 ? (
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--color-on-surface-variant, #4e453d)',
                          fontStyle: 'italic',
                          padding: '8px 0',
                        }}
                      >
                        No critical tasks assigned to this milestone.
                      </div>
                    ) : (
                      <div
                        data-testid={`milestone-tasks-list-${ms.id}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {tasks.map((task) => {
                          const isEscalated = task.escalated_to_supervisor;
                          const isOverdue = task.is_overdue;

                          return (
                            <div
                              key={task.id}
                              data-testid={`task-item-${task.id}`}
                              style={{
                                padding: '12px',
                                backgroundColor: isEscalated || isOverdue ? '#fff8f7' : '#ffffff',
                                border: `1px solid ${
                                  isEscalated || isOverdue
                                    ? '#f5c2c7'
                                    : 'var(--color-surface-container-high, #eae8e3)'
                                }`,
                                borderRadius: 'var(--radius-sm, 0.125rem)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {task.is_critical && (
                                    <span
                                      data-testid={`task-critical-badge-${task.id}`}
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        backgroundColor: '#735c41',
                                        color: '#ffffff',
                                        borderRadius: 'var(--radius-sm, 0.125rem)',
                                      }}
                                    >
                                      Critical
                                    </span>
                                  )}

                                  <span
                                    data-testid={`task-title-${task.id}`}
                                    style={{
                                      fontSize: '14px',
                                      fontWeight: 500,
                                      color: 'var(--color-on-surface, #1b1c19)',
                                    }}
                                  >
                                    {task.title}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {isOverdue && (
                                    <span
                                      data-testid={`task-overdue-badge-${task.id}`}
                                      style={{
                                        padding: '2px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: '#fdf0ed',
                                        color: '#a43b2c',
                                        border: '1px solid #f5c2c7',
                                        borderRadius: 'var(--radius-sm, 0.125rem)',
                                      }}
                                    >
                                      Overdue
                                    </span>
                                  )}

                                  {isEscalated && (
                                    <span
                                      data-testid={`task-escalation-badge-${task.id}`}
                                      style={{
                                        padding: '2px 8px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        backgroundColor: '#a43b2c',
                                        color: '#ffffff',
                                        borderRadius: 'var(--radius-sm, 0.125rem)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <span>🚨</span>
                                      <span>Escalated to Supervisor</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Task metadata details */}
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '12px',
                                  fontSize: '12px',
                                  color: 'var(--color-on-surface-variant, #4e453d)',
                                }}
                              >
                                <span data-testid={`task-due-date-${task.id}`}>
                                  Due: {formatDate(task.due_date)}
                                </span>

                                {task.escalated_at && (
                                  <span
                                    data-testid={`task-escalated-at-${task.id}`}
                                    style={{ color: '#842417', fontWeight: 500 }}
                                  >
                                    Escalated At: {formatDate(task.escalated_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MilestoneTracker;
