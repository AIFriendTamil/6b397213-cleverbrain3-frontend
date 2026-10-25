'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MeetingEvent,
  MeetingBrief,
  MeetingFilterParams,
  MeetingCreate,
  getScheduledMeetings,
  getMeetingBrief,
  createScheduledMeeting,
} from '../../services/api_client';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarViewProps {
  /** Array of meeting events. If omitted/null, component fetches via API */
  events?: MeetingEvent[] | null;
  /** Initial filter parameters */
  initialFilters?: MeetingFilterParams;
  /** Currently selected meeting ID for prep brief drawer */
  selectedMeetingId?: string | null;
  /** Callback fired when a meeting is clicked or selected */
  onMeetingSelect?: (meeting: MeetingEvent | null) => void;
  /** Callback fired when filter parameters change */
  onFilterChange?: (filters: MeetingFilterParams) => void;
  /** Callback fired when a new meeting is successfully scheduled */
  onScheduleMeeting?: (meeting: MeetingEvent) => void;
  /** Callback fired when a brief is refreshed or fetched */
  onBriefRefresh?: (brief: MeetingBrief) => void;
  /** Override loading state for meeting events */
  isLoading?: boolean;
  /** Override error message string */
  error?: string | null;
  /** Manual data refresh callback */
  onRefresh?: () => void;
  /** Custom CSS class wrapper */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
  /** Available leads list for filter dropdown and scheduling form */
  availableLeads?: Array<{ lead_id: string; title_text?: string; name?: string; quality_score?: number }>;
  /** Initial view mode ('month' | 'week' | 'day' | 'agenda') */
  initialViewMode?: CalendarViewMode;
}

/**
 * Format a Date object or ISO string into a friendly date display (e.g., "Oct 24, 2026").
 */
export function formatDateDisplay(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return '';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Format a Date object or ISO string into a time display (e.g., "9:30 AM").
 */
export function formatTimeDisplay(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return '';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format start and end timestamps into a combined range string.
 */
export function formatDateTimeRange(startStr: string, endStr: string): string {
  const startDate = formatDateDisplay(startStr);
  const startTime = formatTimeDisplay(startStr);
  const endTime = formatTimeDisplay(endStr);
  if (!startDate) return '';
  if (startTime && endTime) {
    return `${startDate} • ${startTime} – ${endTime}`;
  }
  return startDate;
}

/**
 * Get Quality Score tier details (label, colors) based on score (0 to 100).
 */
export function getQualityScoreTier(score: number): {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
} {
  if (score >= 75) {
    return {
      label: 'High Quality',
      textColor: '#15803d',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
    };
  }
  if (score >= 50) {
    return {
      label: 'Medium Quality',
      textColor: '#b45309',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
    };
  }
  return {
    label: 'Needs Nurturing',
    textColor: '#b84a39',
    bgColor: '#fdf0ed',
    borderColor: '#fca5a5',
  };
}

/**
 * Get days array for rendering a month calendar grid (includes padding days).
 */
export function getDaysForMonthGrid(yearNum: number, monthIndex: number): Date[] {
  const firstDayOfMonth = new Date(yearNum, monthIndex, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
  const days: Date[] = [];

  // Previous month padding days
  for (let i = startDayOfWeek; i > 0; i--) {
    const padDate = new Date(yearNum, monthIndex, 1 - i);
    days.push(padDate);
  }

  // Days of current month
  const lastDayOfMonth = new Date(yearNum, monthIndex + 1, 0);
  const totalDays = lastDayOfMonth.getDate();
  for (let d = 1; d <= totalDays; d++) {
    days.push(new Date(yearNum, monthIndex, d));
  }

  // Next month padding days to complete 35 or 42 grid cells
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    days.push(new Date(yearNum, monthIndex + 1, i));
  }

  return days;
}

/**
 * Get 7 days array for rendering a week calendar grid.
 */
export function getDaysForWeekGrid(anchorDate: Date): Date[] {
  const startOfWeek = new Date(anchorDate);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }
  return weekDays;
}

/**
 * Helper to check if two dates fall on the same calendar day.
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Helper to check if a date string/Date falls within a given day.
 */
export function isMeetingOnDay(meetingStartIso: string, targetDay: Date): boolean {
  const meetingDate = new Date(meetingStartIso);
  if (isNaN(meetingDate.getTime())) return false;
  return isSameDay(meetingDate, targetDay);
}

export function CalendarView({
  events: eventsProp,
  initialFilters = {},
  selectedMeetingId = null,
  onMeetingSelect,
  onFilterChange,
  onScheduleMeeting,
  onBriefRefresh,
  isLoading: isLoadingProp,
  error: errorProp,
  onRefresh,
  className = '',
  'data-testid': testId = 'calendar-view',
  availableLeads = [],
  initialViewMode = 'month',
}: CalendarViewProps) {
  // Calendar Navigation State
  const [viewMode, setViewMode] = useState<CalendarViewMode>(initialViewMode);
  const [currentDateObj, setCurrentDateObj] = useState<Date>(new Date('2026-10-24T00:00:00'));

  // Data & API States
  const [eventsData, setEventsData] = useState<MeetingEvent[]>(eventsProp || []);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<MeetingFilterParams>(initialFilters);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Meeting & Brief Drawer State
  const [activeMeeting, setActiveMeeting] = useState<MeetingEvent | null>(null);
  const [isBriefOpen, setIsBriefOpen] = useState<boolean>(false);
  const [briefData, setBriefData] = useState<MeetingBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState<boolean>(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [scheduleForm, setScheduleForm] = useState<{
    title: string;
    start_timestamp: string;
    end_timestamp: string;
    lead_id: string;
    location: string;
    description: string;
  }>({
    title: '',
    start_timestamp: '2026-10-25T10:00',
    end_timestamp: '2026-10-25T11:00',
    lead_id: '',
    location: '',
    description: '',
  });
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Sync prop events if passed
  useEffect(() => {
    if (eventsProp !== undefined && eventsProp !== null) {
      setEventsData(eventsProp);
    }
  }, [eventsProp]);

  // Fetch scheduled meetings from API if prop events not provided
  const fetchMeetings = useCallback(async () => {
    if (eventsProp !== undefined && eventsProp !== null) {
      return; // Managed externally
    }
    setInternalLoading(true);
    setInternalError(null);
    try {
      const data = await getScheduledMeetings(filters);
      setEventsData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load scheduled meetings.';
      setInternalError(msg);
    } finally {
      setInternalLoading(false);
    }
  }, [eventsProp, filters]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Handle auto-opening brief drawer if selectedMeetingId prop is provided
  useEffect(() => {
    if (selectedMeetingId && eventsData.length > 0) {
      const found = eventsData.find(
        (m) => m.meeting_id === selectedMeetingId || m.event_id === selectedMeetingId
      );
      if (found) {
        setActiveMeeting(found);
        setIsBriefOpen(true);
      }
    }
  }, [selectedMeetingId, eventsData]);

  // Fetch Brief details when active meeting changes or drawer opens
  const fetchBrief = useCallback(async (meetingId: string, forceRefresh = false) => {
    setBriefLoading(true);
    setBriefError(null);
    try {
      const options = forceRefresh ? { params: { force_refresh: true } } : undefined;
      const briefRes = await getMeetingBrief(meetingId, options);
      setBriefData(briefRes);
      if (onBriefRefresh) {
        onBriefRefresh(briefRes);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load meeting preparation brief.';
      setBriefError(msg);
    } finally {
      setBriefLoading(false);
    }
  }, [onBriefRefresh]);

  useEffect(() => {
    if (isBriefOpen && activeMeeting) {
      const targetId = activeMeeting.meeting_id || activeMeeting.event_id;
      if (targetId) {
        fetchBrief(targetId);
      }
    }
  }, [isBriefOpen, activeMeeting, fetchBrief]);

  // Filter change handlers
  const handleFilterChangeInternal = (newParams: Partial<MeetingFilterParams>) => {
    const updated = { ...filters, ...newParams };
    setFilters(updated);
    if (onFilterChange) {
      onFilterChange(updated);
    }
  };

  // Open Brief Drawer for a meeting
  const handleMeetingClick = (meeting: MeetingEvent) => {
    setActiveMeeting(meeting);
    setIsBriefOpen(true);
    if (onMeetingSelect) {
      onMeetingSelect(meeting);
    }
  };

  // Close Brief Drawer
  const handleCloseBrief = () => {
    setIsBriefOpen(false);
    setActiveMeeting(null);
    setBriefData(null);
    setBriefError(null);
    if (onMeetingSelect) {
      onMeetingSelect(null);
    }
  };

  // Handle Refresh Brief CTA
  const handleRefreshBriefClick = () => {
    if (activeMeeting) {
      const targetId = activeMeeting.meeting_id || activeMeeting.event_id;
      if (targetId) {
        fetchBrief(targetId, true);
      }
    }
  };

  // Schedule Meeting Form Submission
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.title.trim()) {
      setScheduleError('Meeting title is required.');
      return;
    }
    if (!scheduleForm.start_timestamp || !scheduleForm.end_timestamp) {
      setScheduleError('Start and end timestamps are required.');
      return;
    }

    const startMs = new Date(scheduleForm.start_timestamp).getTime();
    const endMs = new Date(scheduleForm.end_timestamp).getTime();
    if (endMs <= startMs) {
      setScheduleError('End timestamp must be later than start timestamp.');
      return;
    }

    setScheduleLoading(true);
    setScheduleError(null);

    const payload: MeetingCreate = {
      title: scheduleForm.title.trim(),
      start_timestamp: new Date(scheduleForm.start_timestamp).toISOString(),
      end_timestamp: new Date(scheduleForm.end_timestamp).toISOString(),
      lead_id: scheduleForm.lead_id.trim() || undefined,
      location: scheduleForm.location.trim() || undefined,
      description: scheduleForm.description.trim() || undefined,
    };

    try {
      const newMeeting = await createScheduledMeeting(payload);
      setEventsData((prev) => [newMeeting, ...prev]);
      if (onScheduleMeeting) {
        onScheduleMeeting(newMeeting);
      }
      setIsScheduleModalOpen(false);
      setScheduleForm({
        title: '',
        start_timestamp: '2026-10-25T10:00',
        end_timestamp: '2026-10-25T11:00',
        lead_id: '',
        location: '',
        description: '',
      });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule meeting.';
      setScheduleError(msg);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Navigation handlers
  const handlePrevDate = () => {
    const nextD = new Date(currentDateObj);
    if (viewMode === 'month') {
      nextD.setMonth(nextD.getMonth() - 1);
    } else if (viewMode === 'week') {
      nextD.setDate(nextD.getDate() - 7);
    } else if (viewMode === 'day') {
      nextD.setDate(nextD.getDate() - 1);
    }
    setCurrentDateObj(nextD);
  };

  const handleNextDate = () => {
    const nextD = new Date(currentDateObj);
    if (viewMode === 'month') {
      nextD.setMonth(nextD.getMonth() + 1);
    } else if (viewMode === 'week') {
      nextD.setDate(nextD.getDate() + 7);
    } else if (viewMode === 'day') {
      nextD.setDate(nextD.getDate() + 1);
    }
    setCurrentDateObj(nextD);
  };

  const handleToday = () => {
    setCurrentDateObj(new Date('2026-10-24T00:00:00'));
  };

  // Filter meetings in memory based on search term, status filter, and lead ID
  const filteredEvents = useMemo(() => {
    return eventsData.filter((ev) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CONFIRMED' && ev.status !== 'CONFIRMED') return false;
        if (statusFilter === 'CANCELLED' && ev.status !== 'CANCELLED') return false;
        if (statusFilter === 'EXTERNAL' && !ev.is_external) return false;
        if (statusFilter === 'FALLBACK' && !ev.is_fallback) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const titleMatch = ev.title.toLowerCase().includes(query);
        const locMatch = ev.location ? ev.location.toLowerCase().includes(query) : false;
        const descMatch = ev.description ? ev.description.toLowerCase().includes(query) : false;
        const leadMatch = ev.lead_id ? ev.lead_id.toLowerCase().includes(query) : false;
        if (!titleMatch && !locMatch && !descMatch && !leadMatch) {
          return false;
        }
      }

      // Lead ID filter
      if (filters.lead_id && ev.lead_id !== filters.lead_id) {
        return false;
      }

      return true;
    });
  }, [eventsData, statusFilter, searchTerm, filters.lead_id]);

  // Combined Loading and Error states
  const loading = isLoadingProp || internalLoading;
  const displayError = errorProp || internalError;

  // Header Title String based on view mode
  const headerTitleStr = useMemo(() => {
    if (viewMode === 'month') {
      return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDateObj);
    }
    if (viewMode === 'week') {
      const weekDays = getDaysForWeekGrid(currentDateObj);
      const startStr = formatDateDisplay(weekDays[0]);
      const endStr = formatDateDisplay(weekDays[6]);
      return `${startStr} – ${endStr}`;
    }
    if (viewMode === 'day') {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(currentDateObj);
    }
    return 'Scheduled Meetings List';
  }, [viewMode, currentDateObj]);

  return (
    <div
      className={`calendar-view-container ${className}`}
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        padding: '24px',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      {/* HEADER SECTION: Title & Primary Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          borderBottom: '1px solid var(--color-surface-container-highest, #e4e2dd)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, serif)',
              fontSize: '24px',
              fontWeight: 400,
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Sales Meeting Calendar
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Schedule and prepare for upcoming lead conversations with automated background briefs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            data-testid="schedule-btn"
            onClick={() => setIsScheduleModalOpen(true)}
            style={{
              backgroundColor: 'var(--color-primary, #59452b)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Schedule Meeting
          </button>
        </div>
      </div>

      {/* FILTER & NAVIGATION BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
        }}
      >
        {/* Date Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            data-testid="prev-date"
            onClick={handlePrevDate}
            aria-label="Previous Period"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              padding: '6px 12px',
              fontSize: '14px',
              cursor: 'pointer',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            &larr;
          </button>
          <button
            type="button"
            data-testid="today-btn"
            onClick={handleToday}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Today
          </button>
          <button
            type="button"
            data-testid="next-date"
            onClick={handleNextDate}
            aria-label="Next Period"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              padding: '6px 12px',
              fontSize: '14px',
              cursor: 'pointer',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            &rarr;
          </button>
          <span
            data-testid="calendar-header-title"
            style={{
              fontFamily: 'var(--font-serif, serif)',
              fontSize: '16px',
              fontWeight: 600,
              marginLeft: '8px',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            {headerTitleStr}
          </span>
        </div>

        {/* Search & Select Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Search Input */}
          <input
            type="text"
            data-testid="search-input"
            placeholder="Search title, notes, lead..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: '#ffffff',
              width: '180px',
            }}
          />

          {/* Lead Filter */}
          {availableLeads.length > 0 && (
            <select
              data-testid="lead-filter"
              value={filters.lead_id || ''}
              onChange={(e) => handleFilterChangeInternal({ lead_id: e.target.value || undefined })}
              style={{
                padding: '6px 10px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Leads</option>
              {availableLeads.map((l) => (
                <option key={l.lead_id} value={l.lead_id}>
                  {l.name || l.title_text || l.lead_id}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            data-testid="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXTERNAL">External Sync</option>
            <option value="FALLBACK">Local Fallback</option>
          </select>

          {/* View Mode Switcher */}
          <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm, 0.125rem)', border: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
            {(['month', 'week', 'day', 'agenda'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                data-testid={`view-${mode}`}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: viewMode === mode ? 600 : 400,
                  textTransform: 'capitalize',
                  backgroundColor: viewMode === mode ? 'var(--color-primary, #59452b)' : '#ffffff',
                  color: viewMode === mode ? '#ffffff' : 'var(--color-on-surface, #1b1c19)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ERROR & LOADING STATES */}
      {displayError && (
        <div
          data-testid="error-banner"
          style={{
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{displayError}</span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--color-on-error-container, #93000a)',
                color: 'var(--color-on-error-container, #93000a)',
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {loading && (
        <div data-testid="loading-indicator" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-on-surface-variant, #4e453d)' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>Loading scheduled sales meetings...</p>
        </div>
      )}

      {/* MAIN CALENDAR VIEW GRID CONTENT */}
      {!loading && (
        <div>
          {/* 1. MONTH VIEW */}
          {viewMode === 'month' && (
            <div
              data-testid="month-view-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '1px',
                backgroundColor: 'var(--color-surface-container-highest, #e4e2dd)',
                border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                overflow: 'hidden',
              }}
            >
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dHeader) => (
                <div
                  key={dHeader}
                  style={{
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                  }}
                >
                  {dHeader}
                </div>
              ))}

              {/* Month Day Cells */}
              {getDaysForMonthGrid(currentDateObj.getFullYear(), currentDateObj.getMonth()).map((gridDay, idx) => {
                const isCurrentMonth = gridDay.getMonth() === currentDateObj.getMonth();
                const isTodayCell = isSameDay(gridDay, new Date('2026-10-24T00:00:00'));
                const dayMeetings = filteredEvents.filter((ev) => isMeetingOnDay(ev.start_timestamp, gridDay));

                return (
                  <div
                    key={idx}
                    data-testid={`month-cell-${gridDay.toISOString().split('T')[0]}`}
                    style={{
                      backgroundColor: isTodayCell ? '#fefce8' : isCurrentMonth ? '#ffffff' : 'var(--color-surface-container-lowest, #fbf9f4)',
                      minHeight: '100px',
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      opacity: isCurrentMonth ? 1 : 0.4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isTodayCell ? 700 : 500,
                          color: isTodayCell ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface, #1b1c19)',
                        }}
                      >
                        {gridDay.getDate()}
                      </span>
                      {dayMeetings.length > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--color-outline, #80756b)' }}>
                          {dayMeetings.length} mtg
                        </span>
                      )}
                    </div>

                    {/* Day Meetings List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                      {dayMeetings.slice(0, 3).map((m) => (
                        <div
                          key={m.event_id}
                          data-testid={`meeting-card-${m.event_id}`}
                          onClick={() => handleMeetingClick(m)}
                          style={{
                            backgroundColor: m.status === 'CANCELLED' ? '#fee2e2' : 'var(--color-surface-container-low, #f5f3ee)',
                            borderLeft: `3px solid ${m.status === 'CANCELLED' ? '#ba1a1a' : 'var(--color-primary, #59452b)'}`,
                            padding: '4px 6px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`${m.title} (${formatTimeDisplay(m.start_timestamp)})`}
                        >
                          <span style={{ fontWeight: 600, marginRight: '4px' }}>{formatTimeDisplay(m.start_timestamp)}</span>
                          <span>{m.title}</span>
                        </div>
                      ))}
                      {dayMeetings.length > 3 && (
                        <div style={{ fontSize: '10px', color: 'var(--color-primary, #59452b)', fontWeight: 500, textAlign: 'center' }}>
                          +{dayMeetings.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. WEEK VIEW */}
          {viewMode === 'week' && (
            <div
              data-testid="week-view-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '1px',
                backgroundColor: 'var(--color-surface-container-highest, #e4e2dd)',
                border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                overflow: 'hidden',
              }}
            >
              {getDaysForWeekGrid(currentDateObj).map((wDay, idx) => {
                const dayMeetings = filteredEvents.filter((ev) => isMeetingOnDay(ev.start_timestamp, wDay));
                const isTodayCell = isSameDay(wDay, new Date('2026-10-24T00:00:00'));

                return (
                  <div key={idx} style={{ backgroundColor: '#ffffff', minHeight: '300px', padding: '8px' }}>
                    <div
                      style={{
                        textAlign: 'center',
                        paddingBottom: '8px',
                        borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-outline, #80756b)' }}>
                        {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(wDay)}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: isTodayCell ? 700 : 500, color: isTodayCell ? 'var(--color-secondary, #a43b2c)' : 'inherit' }}>
                        {wDay.getDate()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {dayMeetings.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--color-outline, #80756b)', textAlign: 'center', padding: '12px 0' }}>
                          No meetings
                        </div>
                      ) : (
                        dayMeetings.map((m) => (
                          <div
                            key={m.event_id}
                            data-testid={`meeting-card-${m.event_id}`}
                            onClick={() => handleMeetingClick(m)}
                            style={{
                              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                              borderLeft: '3px solid var(--color-primary, #59452b)',
                              padding: '6px',
                              borderRadius: 'var(--radius-sm, 0.125rem)',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{formatTimeDisplay(m.start_timestamp)}</div>
                            <div style={{ color: 'var(--color-on-surface, #1b1c19)', marginTop: '2px' }}>{m.title}</div>
                            {m.location && <div style={{ fontSize: '10px', color: 'var(--color-outline, #80756b)', marginTop: '2px' }}>📍 {m.location}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. DAY VIEW */}
          {viewMode === 'day' && (
            <div
              data-testid="day-view-container"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '16px',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif, serif)', fontSize: '18px', color: 'var(--color-primary, #59452b)' }}>
                Meetings on {headerTitleStr}
              </h3>
              {(() => {
                const dayMeetings = filteredEvents.filter((ev) => isMeetingOnDay(ev.start_timestamp, currentDateObj));
                if (dayMeetings.length === 0) {
                  return (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                      No scheduled meetings for this day.
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {dayMeetings.map((m) => (
                      <div
                        key={m.event_id}
                        data-testid={`meeting-card-${m.event_id}`}
                        onClick={() => handleMeetingClick(m)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          borderRadius: 'var(--radius-md, 0.375rem)',
                          borderLeft: '4px solid var(--color-primary, #59452b)',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-on-surface, #1b1c19)' }}>{m.title}</div>
                          <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', marginTop: '4px' }}>
                            {formatTimeDisplay(m.start_timestamp)} – {formatTimeDisplay(m.end_timestamp)}
                            {m.location && ` • 📍 ${m.location}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMeetingClick(m);
                          }}
                          style={{
                            backgroundColor: 'var(--color-primary, #59452b)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            padding: '6px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          View Prep Brief
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 4. AGENDA VIEW */}
          {viewMode === 'agenda' && (
            <div
              data-testid="agenda-view-container"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {filteredEvents.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '32px',
                    textAlign: 'center',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                  }}
                >
                  No scheduled sales meetings match the current filter criteria.
                </div>
              ) : (
                filteredEvents.map((m) => (
                  <div
                    key={m.event_id}
                    data-testid={`meeting-card-${m.event_id}`}
                    onClick={() => handleMeetingClick(m)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                      borderRadius: 'var(--radius-md, 0.375rem)',
                      padding: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      borderLeft: '4px solid var(--color-primary, #59452b)',
                    }}
                  >
                    <div style={{ flex: '1 1 300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-primary, #59452b)' }}>
                          {m.title}
                        </span>
                        {m.is_external && (
                          <span
                            style={{
                              fontSize: '10px',
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-full, 9999px)',
                            }}
                          >
                            External Sync
                          </span>
                        )}
                        {m.is_fallback && (
                          <span
                            style={{
                              fontSize: '10px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-full, 9999px)',
                            }}
                          >
                            Local Fallback
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            backgroundColor: m.status === 'CONFIRMED' ? '#dcfce7' : '#fee2e2',
                            color: m.status === 'CONFIRMED' ? '#15803d' : '#b84a39',
                          }}
                        >
                          {m.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', marginTop: '6px' }}>
                        📅 {formatDateTimeRange(m.start_timestamp, m.end_timestamp)}
                        {m.location && ` • 📍 ${m.location}`}
                        {m.lead_id && ` • Lead ID: ${m.lead_id}`}
                      </div>

                      {m.description && (
                        <div style={{ fontSize: '12px', color: 'var(--color-outline, #80756b)', marginTop: '6px' }}>
                          {m.description}
                        </div>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMeetingClick(m);
                        }}
                        style={{
                          backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                          color: 'var(--color-primary, #59452b)',
                          border: '1px solid var(--color-outline-variant, #d1c4b9)',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          padding: '8px 14px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        View Preparation Brief &rarr;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* PREPARATION BRIEF DRAWER (FR-7)                          */}
      {/* ======================================================= */}
      {isBriefOpen && (
        <div
          data-testid="brief-drawer-backdrop"
          onClick={handleCloseBrief}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(27, 28, 25, 0.4)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            data-testid="brief-drawer"
            role="dialog"
            aria-label="Meeting Preparation Brief"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '-4px 0 20px rgba(115, 92, 65, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '24px',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-secondary, #a43b2c)',
                  }}
                >
                  Automated Brief
                </span>
                <h3
                  style={{
                    margin: '4px 0 0 0',
                    fontFamily: 'var(--font-serif, serif)',
                    fontSize: '20px',
                    color: 'var(--color-primary, #59452b)',
                  }}
                >
                  {activeMeeting ? activeMeeting.title : 'Meeting Preparation Brief'}
                </h3>
              </div>
              <button
                type="button"
                data-testid="close-brief-btn"
                onClick={handleCloseBrief}
                aria-label="Close Brief"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--color-outline, #80756b)',
                }}
              >
                &times;
              </button>
            </div>

            {/* Active Meeting Info Card */}
            {activeMeeting && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div>
                  <strong>Scheduled:</strong> {formatDateTimeRange(activeMeeting.start_timestamp, activeMeeting.end_timestamp)}
                </div>
                {activeMeeting.location && (
                  <div>
                    <strong>Location/Link:</strong> {activeMeeting.location}
                  </div>
                )}
                {activeMeeting.lead_id && (
                  <div>
                    <strong>Lead ID:</strong> {activeMeeting.lead_id}
                  </div>
                )}
              </div>
            )}

            {/* Brief Content or Loading/Error States */}
            {briefLoading ? (
              <div data-testid="brief-loading" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                Synthesizing lead background and interaction history...
              </div>
            ) : briefError ? (
              <div
                data-testid="brief-error"
                style={{
                  backgroundColor: 'var(--color-error-container, #ffdad6)',
                  color: 'var(--color-on-error-container, #93000a)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  fontSize: '14px',
                }}
              >
                <p style={{ margin: '0 0 12px 0' }}>{briefError}</p>
                <button
                  type="button"
                  onClick={handleRefreshBriefClick}
                  style={{
                    backgroundColor: 'var(--color-on-error-container, #93000a)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Retry Brief Generation
                </button>
              </div>
            ) : briefData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Lead Quality Score Badge */}
                {(() => {
                  const scoreTier = getQualityScoreTier(briefData.quality_score);
                  return (
                    <div
                      data-testid="quality-score-badge"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: scoreTier.bgColor,
                        border: `1px solid ${scoreTier.borderColor}`,
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md, 0.375rem)',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: scoreTier.textColor, textTransform: 'uppercase' }}>
                          Lead Quality Index
                        </span>
                        <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', marginTop: '2px' }}>
                          {scoreTier.label}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 700,
                          color: scoreTier.textColor,
                          fontFamily: 'var(--font-serif, serif)',
                        }}
                      >
                        {briefData.quality_score} / 100
                      </div>
                    </div>
                  );
                })()}

                {/* Executive Summary Card */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #fbf9f4)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '16px',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-primary, #59452b)',
                    }}
                  >
                    Executive Summary
                  </h4>
                  <p
                    data-testid="brief-summary-text"
                    style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--color-on-surface, #1b1c19)' }}
                  >
                    {briefData.brief_summary_text}
                  </p>
                </div>

                {/* Interaction History & Lead Background (FR-7) */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '16px',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-primary, #59452b)',
                    }}
                  >
                    Lead Background & Interaction History
                  </h4>
                  <p
                    data-testid="interaction-history"
                    style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--color-on-surface-variant, #4e453d)' }}
                  >
                    {briefData.interaction_history_summary}
                  </p>
                </div>

                {/* Key Discussion Topics & Recommended Agenda */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '16px',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-primary, #59452b)',
                    }}
                  >
                    Recommended Agenda & Discussion Topics
                  </h4>
                  <p
                    data-testid="discussion-notes"
                    style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--color-on-surface-variant, #4e453d)' }}
                  >
                    {briefData.key_discussion_notes}
                  </p>
                </div>

                {/* Footer Controls: Refresh Brief */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--color-outline, #80756b)' }}>
                    Generated: {formatDateDisplay(briefData.created_timestamp)}
                  </span>
                  <button
                    type="button"
                    data-testid="refresh-brief-btn"
                    onClick={handleRefreshBriefClick}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-primary, #59452b)',
                      color: 'var(--color-primary, #59452b)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Re-synthesize Brief
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* SCHEDULE MEETING MODAL                                  */}
      {/* ======================================================= */}
      {isScheduleModalOpen && (
        <div
          data-testid="schedule-modal-backdrop"
          onClick={() => setIsScheduleModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(27, 28, 25, 0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            data-testid="schedule-modal"
            role="dialog"
            aria-label="Schedule Sales Meeting"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              padding: '24px',
              boxShadow: '0 10px 25px rgba(115, 92, 65, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif, serif)', fontSize: '20px', color: 'var(--color-primary, #59452b)' }}>
                Schedule Sales Meeting
              </h3>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                style={{ backgroundColor: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {scheduleError && (
              <div
                style={{
                  backgroundColor: 'var(--color-error-container, #ffdad6)',
                  color: 'var(--color-on-error-container, #93000a)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                {scheduleError}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Meeting Title *
                </label>
                <input
                  type="text"
                  data-testid="schedule-title-input"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  placeholder="e.g. Executive Demo & Product Alignment"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Start Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    data-testid="schedule-start-input"
                    value={scheduleForm.start_timestamp}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, start_timestamp: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    End Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    data-testid="schedule-end-input"
                    value={scheduleForm.end_timestamp}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, end_timestamp: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Associated Lead
                </label>
                {availableLeads.length > 0 ? (
                  <select
                    data-testid="schedule-lead-select"
                    value={scheduleForm.lead_id}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, lead_id: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    }}
                  >
                    <option value="">Select a Lead (Optional)</option>
                    {availableLeads.map((l) => (
                      <option key={l.lead_id} value={l.lead_id}>
                        {l.name || l.title_text || l.lead_id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    data-testid="schedule-lead-input"
                    value={scheduleForm.lead_id}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, lead_id: e.target.value })}
                    placeholder="Enter Lead UUID (Optional)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Location / Video Link
                </label>
                <input
                  type="text"
                  data-testid="schedule-location-input"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                  placeholder="e.g. https://meet.example.com/demo"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Description / Agenda Notes
                </label>
                <textarea
                  data-testid="schedule-description-input"
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  rows={3}
                  placeholder="Initial notes or topics for the sales call..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-schedule-btn"
                  disabled={scheduleLoading}
                  style={{
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    cursor: scheduleLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {scheduleLoading ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarView;
