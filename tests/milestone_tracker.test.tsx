import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MilestoneTracker,
  formatDate,
  getMilestoneColorInfo,
  calculateMilestoneProgress,
} from '../src/components/deals/MilestoneTracker';
import { Milestone } from '../src/services/api_client';

describe('MilestoneTracker Component', () => {
  const mockMilestones: Milestone[] = [
    {
      id: 'ms-1',
      deal_id: 'deal-101',
      title: 'Initial Security Audit & Assessment',
      target_date: '2026-11-15T00:00:00Z',
      completed_date: '2026-11-10T00:00:00Z',
      status: 'COMPLETED',
      color_code: 'green',
      critical_tasks: [
        {
          id: 'task-101',
          milestone_id: 'ms-1',
          title: 'Review SOC2 Compliance Certification',
          due_date: '2026-11-05T00:00:00Z',
          is_critical: true,
          is_overdue: false,
          escalated_to_supervisor: false,
        },
      ],
    },
    {
      id: 'ms-2',
      deal_id: 'deal-101',
      title: 'Contract Legal Redlining',
      target_date: '2026-11-20T00:00:00Z',
      status: 'IN_PROGRESS',
      color_code: 'blue',
      critical_tasks: [
        {
          id: 'task-201',
          milestone_id: 'ms-2',
          title: 'Finalize Indemnification Clause Terms',
          due_date: '2026-11-18T00:00:00Z',
          is_critical: true,
          is_overdue: false,
          escalated_to_supervisor: false,
        },
      ],
    },
    {
      id: 'ms-3',
      deal_id: 'deal-101',
      title: 'Executive Board Approval Signoff',
      target_date: '2026-10-15T00:00:00Z',
      status: 'DELAYED',
      color_code: 'red',
      critical_tasks: [
        {
          id: 'task-301',
          milestone_id: 'ms-3',
          title: 'Obtain VP Finance Signature',
          due_date: '2026-10-10T00:00:00Z',
          is_critical: true,
          is_overdue: true,
          escalated_to_supervisor: true,
          escalated_at: '2026-10-12T14:30:00Z',
        },
      ],
    },
  ];

  describe('Formatter & Utility Helpers', () => {
    it('formats ISO dates correctly', () => {
      expect(formatDate('2026-11-15T00:00:00Z')).toBe('Nov 15, 2026');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate('')).toBe('N/A');
    });

    it('resolves correct color info for status values', () => {
      const completedInfo = getMilestoneColorInfo('COMPLETED', 'green');
      expect(completedInfo.label).toBe('Completed');
      expect(completedInfo.progressColor).toBe('#2e7d32');

      const delayedInfo = getMilestoneColorInfo('DELAYED', 'red');
      expect(delayedInfo.label).toBe('Delayed');
      expect(delayedInfo.progressColor).toBe('#a43b2c');

      const inProgressInfo = getMilestoneColorInfo('IN_PROGRESS', 'blue');
      expect(inProgressInfo.label).toBe('In Progress');

      const pendingInfo = getMilestoneColorInfo('PENDING', 'gray');
      expect(pendingInfo.label).toBe('Pending');
    });

    it('calculates milestone progress correctly', () => {
      expect(calculateMilestoneProgress(mockMilestones[0])).toBe(100);
      expect(calculateMilestoneProgress({ ...mockMilestones[0], status: 'PENDING' })).toBe(0);
      expect(calculateMilestoneProgress(mockMilestones[1])).toBeGreaterThan(0);
    });
  });

  describe('Component Rendering & Summary KPIs', () => {
    it('renders the main milestone tracker container and summary header', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      expect(screen.getByTestId('milestone-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-tracker-header')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-tracker-title')).toHaveTextContent(
        'Milestone Progress & Escalations'
      );

      // Summary KPIs
      expect(screen.getByTestId('summary-total-milestones')).toHaveTextContent('3');
      expect(screen.getByTestId('summary-completed-milestones')).toHaveTextContent('1 (33%)');
      expect(screen.getByTestId('summary-delayed-milestones')).toHaveTextContent('1');
      expect(screen.getByTestId('summary-critical-tasks')).toHaveTextContent('3');
      expect(screen.getByTestId('summary-escalated-tasks')).toHaveTextContent('1');
    });

    it('renders escalation warning banner when escalated tasks exist', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      expect(screen.getByTestId('escalation-warning-banner')).toBeInTheDocument();
      expect(screen.getByTestId('escalation-warning-banner')).toHaveTextContent(
        'Supervisor Escalation Alert'
      );
    });

    it('renders milestone list items with status badges and progress bars', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      expect(screen.getByTestId('milestone-item-ms-1')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-title-ms-1')).toHaveTextContent(
        'Initial Security Audit & Assessment'
      );
      expect(screen.getByTestId('milestone-status-badge-ms-1')).toHaveTextContent('Completed');
      expect(screen.getByTestId('milestone-progress-value-ms-1')).toHaveTextContent('100%');

      expect(screen.getByTestId('milestone-item-ms-3')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-status-badge-ms-3')).toHaveTextContent('Delayed');
    });
  });

  describe('Task Escalation Indicators', () => {
    it('renders critical task details and escalation indicators when expanded', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      // Expand delayed milestone ms-3
      const expandBtn = screen.getByTestId('milestone-expand-btn-ms-3');
      fireEvent.click(expandBtn);

      expect(screen.getByTestId('milestone-tasks-section-ms-3')).toBeInTheDocument();
      expect(screen.getByTestId('task-item-task-301')).toBeInTheDocument();
      expect(screen.getByTestId('task-title-task-301')).toHaveTextContent(
        'Obtain VP Finance Signature'
      );
      expect(screen.getByTestId('task-critical-badge-task-301')).toHaveTextContent('CRITICAL');
      expect(screen.getByTestId('task-overdue-badge-task-301')).toHaveTextContent('Overdue');
      expect(screen.getByTestId('task-escalation-badge-task-301')).toHaveTextContent(
        'Escalated to Supervisor'
      );
    });
  });

  describe('Filtering and Interaction Controls', () => {
    it('filters milestones by search query', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      const searchInput = screen.getByTestId('milestone-search-input');
      fireEvent.change(searchInput, { target: { value: 'Security Audit' } });

      expect(screen.getByTestId('milestone-item-ms-1')).toBeInTheDocument();
      expect(screen.queryByTestId('milestone-item-ms-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('milestone-item-ms-3')).not.toBeInTheDocument();
    });

    it('filters milestones by status filter tab', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      const delayedFilterBtn = screen.getByTestId('filter-btn-delayed');
      fireEvent.click(delayedFilterBtn);

      expect(screen.getByTestId('milestone-item-ms-3')).toBeInTheDocument();
      expect(screen.queryByTestId('milestone-item-ms-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('milestone-item-ms-2')).not.toBeInTheDocument();
    });

    it('filters to escalated milestones via escalated filter tab', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      const escalatedFilterBtn = screen.getByTestId('filter-btn-escalated');
      fireEvent.click(escalatedFilterBtn);

      expect(screen.getByTestId('milestone-item-ms-3')).toBeInTheDocument();
      expect(screen.queryByTestId('milestone-item-ms-1')).not.toBeInTheDocument();
    });

    it('expands and collapses all milestone task sections', () => {
      render(<MilestoneTracker milestones={mockMilestones} />);

      const expandAllBtn = screen.getByTestId('expand-all-btn');
      fireEvent.click(expandAllBtn);

      expect(screen.getByTestId('milestone-tasks-section-ms-1')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-tasks-section-ms-2')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-tasks-section-ms-3')).toBeInTheDocument();

      const collapseAllBtn = screen.getByTestId('collapse-all-btn');
      fireEvent.click(collapseAllBtn);

      expect(screen.queryByTestId('milestone-tasks-section-ms-1')).not.toBeInTheDocument();
    });

    it('triggers callbacks on user interaction', () => {
      const handleSelect = vi.fn();
      const handleClick = vi.fn();
      const handleStatusChange = vi.fn();
      const handleCreateMilestone = vi.fn();

      render(
        <MilestoneTracker
          milestones={mockMilestones}
          onMilestoneSelect={handleSelect}
          onMilestoneClick={handleClick}
          onStatusChange={handleStatusChange}
          onCreateMilestone={handleCreateMilestone}
        />
      );

      // Add Milestone Click
      const addBtn = screen.getByTestId('add-milestone-btn');
      fireEvent.click(addBtn);
      expect(handleCreateMilestone).toHaveBeenCalledTimes(1);

      // Item Click
      const milestoneItem = screen.getByTestId('milestone-item-ms-1');
      fireEvent.click(milestoneItem);
      expect(handleSelect).toHaveBeenCalledWith('ms-1');
      expect(handleClick).toHaveBeenCalledWith(mockMilestones[0]);

      // Status Change
      const statusSelect = screen.getByTestId('milestone-status-select-ms-1');
      fireEvent.change(statusSelect, { target: { value: 'IN_PROGRESS' } });
      expect(handleStatusChange).toHaveBeenCalledWith('ms-1', 'IN_PROGRESS');
    });
  });

  describe('Loading, Error, and Empty States', () => {
    it('renders loading state indicator', () => {
      render(<MilestoneTracker isLoading={true} />);
      expect(screen.getByTestId('milestone-tracker-loading')).toBeInTheDocument();
    });

    it('renders error state indicator', () => {
      render(<MilestoneTracker error="Failed to fetch deal milestones from server" />);
      expect(screen.getByTestId('milestone-tracker-error')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-tracker-error')).toHaveTextContent(
        'Failed to fetch deal milestones'
      );
    });

    it('renders empty state when milestone list is empty', () => {
      render(<MilestoneTracker milestones={[]} />);
      expect(screen.getByTestId('milestone-tracker-empty')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-tracker-empty')).toHaveTextContent(
        'No milestones found.'
      );
    });
  });
});
