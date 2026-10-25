import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CalendarView,
  formatDateDisplay,
  formatTimeDisplay,
  formatDateTimeRange,
  getQualityScoreTier,
  getDaysForMonthGrid,
  getDaysForWeekGrid,
  isSameDay,
  isMeetingOnDay,
} from '../src/components/meetings/CalendarView';
import { MeetingEvent, MeetingBrief } from '../src/services/api_client';

// Mock API client services
vi.mock('../src/services/api_client', async () => {
  const actual = await vi.importActual<typeof import('../src/services/api_client')>('../src/services/api_client');
  return {
    ...actual,
    getScheduledMeetings: vi.fn(),
    getMeetingBrief: vi.fn(),
    createScheduledMeeting: vi.fn(),
  };
});

import { getScheduledMeetings, getMeetingBrief, createScheduledMeeting } from '../src/services/api_client';

describe('CalendarView Component (Feature 005 - T026)', () => {
  const mockMeetings: MeetingEvent[] = [
    {
      event_id: 'evt-001',
      meeting_id: 'mtg-101',
      lead_id: 'lead-901',
      title: 'Executive Sales Demo',
      start_timestamp: '2026-10-24T10:00:00Z',
      end_timestamp: '2026-10-24T11:00:00Z',
      description: 'Initial product showcase and scope alignment',
      location: 'https://meet.example.com/demo',
      status: 'CONFIRMED',
      is_external: true,
      is_fallback: false,
    },
    {
      event_id: 'evt-002',
      meeting_id: 'mtg-102',
      lead_id: 'lead-902',
      title: 'Contract Renewal Discussion',
      start_timestamp: '2026-10-25T14:00:00Z',
      end_timestamp: '2026-10-25T15:00:00Z',
      description: 'Review SLA parameters and annual pricing tier',
      location: 'Conference Room B',
      status: 'CONFIRMED',
      is_external: false,
      is_fallback: true,
    },
    {
      event_id: 'evt-003',
      meeting_id: 'mtg-103',
      lead_id: 'lead-903',
      title: 'Cancelled Technical Check',
      start_timestamp: '2026-10-26T09:00:00Z',
      end_timestamp: '2026-10-26T09:30:00Z',
      description: 'Technical architecture review',
      location: 'Online',
      status: 'CANCELLED',
      is_external: false,
      is_fallback: false,
    },
  ];

  const mockBrief: MeetingBrief = {
    brief_id: 'brief-001',
    meeting_id: 'mtg-101',
    lead_id: 'lead-901',
    quality_score: 85,
    interaction_history_summary: 'Lead engaged via Q3 Webinar. Previously requested pricing guide and custom ROI assessment.',
    key_discussion_notes: 'Focus on Enterprise security compliance, multi-tenant isolation, and deployment options.',
    brief_summary_text: 'High-value prospect ready for executive demo. Decision maker in attendance.',
    created_timestamp: '2026-10-24T08:00:00Z',
  };

  const mockLeads = [
    { lead_id: 'lead-901', title_text: 'Acme Corp Lead', name: 'John Doe', quality_score: 85 },
    { lead_id: 'lead-902', title_text: 'Globex Corp Lead', name: 'Jane Smith', quality_score: 70 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getScheduledMeetings).mockResolvedValue(mockMeetings);
    vi.mocked(getMeetingBrief).mockResolvedValue(mockBrief);
    vi.mocked(createScheduledMeeting).mockResolvedValue({
      event_id: 'evt-new',
      meeting_id: 'mtg-new',
      lead_id: 'lead-901',
      title: 'Newly Scheduled Call',
      start_timestamp: '2026-10-25T10:00:00Z',
      end_timestamp: '2026-10-25T11:00:00Z',
      description: 'Newly scheduled meeting',
      location: 'Online',
      status: 'CONFIRMED',
      is_external: false,
      is_fallback: false,
    });
  });

  describe('Formatter and Date Utility Helpers', () => {
    it('formats display date correctly', () => {
      expect(formatDateDisplay('2026-10-24T10:00:00Z')).toContain('Oct 24, 2026');
      expect(formatDateDisplay(null)).toBe('');
      expect(formatDateDisplay(undefined)).toBe('');
    });

    it('formats display time correctly', () => {
      const timeFormatted = formatTimeDisplay('2026-10-24T10:00:00Z');
      expect(timeFormatted).toMatch(/10:00|10:00 AM/i);
      expect(formatTimeDisplay(null)).toBe('');
    });

    it('formats date time range string', () => {
      const rangeStr = formatDateTimeRange('2026-10-24T10:00:00Z', '2026-10-24T11:00:00Z');
      expect(rangeStr).toContain('Oct 24, 2026');
    });

    it('returns quality score tier metadata', () => {
      const highTier = getQualityScoreTier(85);
      expect(highTier.label).toBe('High Quality');

      const medTier = getQualityScoreTier(60);
      expect(medTier.label).toBe('Medium Quality');

      const lowTier = getQualityScoreTier(30);
      expect(lowTier.label).toBe('Needs Nurturing');
    });

    it('generates month grid and week grid days', () => {
      const monthDays = getDaysForMonthGrid(2026, 9); // Oct 2026
      expect(monthDays.length).toBeGreaterThanOrEqual(35);

      const weekDays = getDaysForWeekGrid(new Date('2026-10-24T00:00:00'));
      expect(weekDays.length).toBe(7);
    });

    it('checks date equality correctly', () => {
      const d1 = new Date('2026-10-24T10:00:00');
      const d2 = new Date('2026-10-24T18:00:00');
      const d3 = new Date('2026-10-25T10:00:00');
      expect(isSameDay(d1, d2)).toBe(true);
      expect(isSameDay(d1, d3)).toBe(false);
      expect(isMeetingOnDay('2026-10-24T10:00:00Z', d1)).toBe(true);
    });
  });

  describe('CalendarView UI Component Rendering', () => {
    it('renders main calendar header and schedule button', () => {
      render(<CalendarView events={mockMeetings} availableLeads={mockLeads} />);

      expect(screen.getByText('Sales Meeting Calendar')).toBeInTheDocument();
      expect(screen.getByTestId('schedule-btn')).toBeInTheDocument();
      expect(screen.getByTestId('calendar-header-title')).toBeInTheDocument();
    });

    it('renders meetings in month view grid', () => {
      render(<CalendarView events={mockMeetings} availableLeads={mockLeads} initialViewMode="month" />);

      expect(screen.getByTestId('month-view-grid')).toBeInTheDocument();
      expect(screen.getAllByTestId(/meeting-card-evt-/).length).toBeGreaterThan(0);
    });

    it('switches between view modes (Month, Week, Day, Agenda)', () => {
      render(<CalendarView events={mockMeetings} availableLeads={mockLeads} initialViewMode="month" />);

      // Switch to Agenda
      fireEvent.click(screen.getByTestId('view-agenda'));
      expect(screen.getByTestId('agenda-view-container')).toBeInTheDocument();
      expect(screen.getByText('Executive Sales Demo')).toBeInTheDocument();

      // Switch to Day
      fireEvent.click(screen.getByTestId('view-day'));
      expect(screen.getByTestId('day-view-container')).toBeInTheDocument();

      // Switch to Week
      fireEvent.click(screen.getByTestId('view-week'));
      expect(screen.getByTestId('week-view-grid')).toBeInTheDocument();
    });

    it('navigates previous and next dates', () => {
      render(<CalendarView events={mockMeetings} initialViewMode="month" />);

      const titleBefore = screen.getByTestId('calendar-header-title').textContent;
      fireEvent.click(screen.getByTestId('next-date'));
      const titleAfterNext = screen.getByTestId('calendar-header-title').textContent;

      expect(titleBefore).not.toBe(titleAfterNext);

      fireEvent.click(screen.getByTestId('today-btn'));
      expect(screen.getByTestId('calendar-header-title')).toHaveTextContent(/October 2026/i);
    });

    it('filters meetings list by search input', () => {
      render(<CalendarView events={mockMeetings} initialViewMode="agenda" />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'Contract Renewal' } });

      expect(screen.getByText('Contract Renewal Discussion')).toBeInTheDocument();
      expect(screen.queryByText('Executive Sales Demo')).not.toBeInTheDocument();
    });

    it('filters meetings list by status dropdown', () => {
      render(<CalendarView events={mockMeetings} initialViewMode="agenda" />);

      const statusFilter = screen.getByTestId('status-filter');
      fireEvent.change(statusFilter, { target: { value: 'CANCELLED' } });

      expect(screen.getByText('Cancelled Technical Check')).toBeInTheDocument();
      expect(screen.queryByText('Executive Sales Demo')).not.toBeInTheDocument();
    });
  });

  describe('Preparation Brief Drawer (FR-7)', () => {
    it('opens Brief Drawer when clicking a meeting card and fetches synthesized brief', async () => {
      render(<CalendarView events={mockMeetings} initialViewMode="agenda" />);

      const meetingCard = screen.getByTestId('meeting-card-evt-001');
      fireEvent.click(meetingCard);

      expect(screen.getByTestId('brief-drawer')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('quality-score-badge')).toBeInTheDocument();
        expect(screen.getByTestId('brief-summary-text')).toHaveTextContent(
          'High-value prospect ready for executive demo'
        );
        expect(screen.getByTestId('interaction-history')).toHaveTextContent(
          'Lead engaged via Q3 Webinar'
        );
        expect(screen.getByTestId('discussion-notes')).toHaveTextContent(
          'Focus on Enterprise security compliance'
        );
      });
    });

    it('refreshes preparation brief when clicking re-synthesize button', async () => {
      render(<CalendarView events={mockMeetings} initialViewMode="agenda" />);

      fireEvent.click(screen.getByTestId('meeting-card-evt-001'));

      await waitFor(() => {
        expect(screen.getByTestId('refresh-brief-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-brief-btn'));

      await waitFor(() => {
        expect(getMeetingBrief).toHaveBeenCalledWith(
          'mtg-101',
          expect.objectContaining({ params: { force_refresh: true } })
        );
      });
    });

    it('closes Brief Drawer when close button is clicked', async () => {
      render(<CalendarView events={mockMeetings} initialViewMode="agenda" />);

      fireEvent.click(screen.getByTestId('meeting-card-evt-001'));

      await waitFor(() => {
        expect(screen.getByTestId('close-brief-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('close-brief-btn'));
      expect(screen.queryByTestId('brief-drawer')).not.toBeInTheDocument();
    });
  });

  describe('Schedule Meeting Modal', () => {
    it('opens modal, inputs data, and submits a new scheduled meeting', async () => {
      const handleScheduleCb = vi.fn();
      render(
        <CalendarView
          events={mockMeetings}
          availableLeads={mockLeads}
          onScheduleMeeting={handleScheduleCb}
        />
      );

      fireEvent.click(screen.getByTestId('schedule-btn'));
      expect(screen.getByTestId('schedule-modal')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('schedule-title-input'), {
        target: { value: 'Newly Scheduled Call' },
      });
      fireEvent.change(screen.getByTestId('schedule-start-input'), {
        target: { value: '2026-10-25T10:00' },
      });
      fireEvent.change(screen.getByTestId('schedule-end-input'), {
        target: { value: '2026-10-25T11:00' },
      });

      fireEvent.click(screen.getByTestId('submit-schedule-btn'));

      await waitFor(() => {
        expect(createScheduledMeeting).toHaveBeenCalled();
        expect(handleScheduleCb).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Newly Scheduled Call' })
        );
      });
    });
  });
});
