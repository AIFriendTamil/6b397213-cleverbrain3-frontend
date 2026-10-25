import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import {
  SLATimer,
  getWarningThreshold,
  formatCountdownTime,
  calculateSLAStatus,
  SLATimerProps,
} from '../../src/components/tickets/SLATimer';
import { Ticket } from '../../src/services/tickets';

describe('SLATimer Utilities', () => {
  it('determines warning threshold percentage based on incident severity', () => {
    expect(getWarningThreshold('P1')).toBe(75);
    expect(getWarningThreshold('p1')).toBe(75);
    expect(getWarningThreshold('P2')).toBe(80);
    expect(getWarningThreshold('P3')).toBe(80);
    expect(getWarningThreshold(null)).toBe(80);
    expect(getWarningThreshold(undefined)).toBe(80);
  });

  it('formats positive countdown duration into readable time string', () => {
    const twoHoursMs = (2 * 3600 + 15 * 60 + 30) * 1000;
    expect(formatCountdownTime(twoHoursMs)).toBe('2h 15m 30s');

    const tenMinsMs = (10 * 60 + 5) * 1000;
    expect(formatCountdownTime(tenMinsMs)).toBe('10m 05s');

    const twoDaysMs = (2 * 86400 + 4 * 3600 + 12 * 60) * 1000;
    expect(formatCountdownTime(twoDaysMs)).toBe('2d 4h 12m');
  });

  it('formats negative overdue countdown duration with minus sign', () => {
    const overdueMs = -1 * (15 * 60 + 30) * 1000;
    expect(formatCountdownTime(overdueMs)).toBe('-15m 30s');

    const overdueHoursMs = -1 * (3 * 3600 + 10 * 60 + 5) * 1000;
    expect(formatCountdownTime(overdueHoursMs)).toBe('-3h 10m 05s');
  });

  it('calculates SLA status details correctly for normal, warning, and breached conditions', () => {
    const nowMs = 100000;
    const createdIso = new Date(0).toISOString(); // Created at t=0
    const targetIso = new Date(1000000).toISOString(); // Target at t=1,000,000

    // 100,000 / 1,000,000 = 10% elapsed => Normal
    const normalStatus = calculateSLAStatus(targetIso, createdIso, nowMs, false, false, 80);
    expect(normalStatus.slaState).toBe('normal');
    expect(normalStatus.isWarning).toBe(false);
    expect(normalStatus.isBreached).toBe(false);

    // 850,000 / 1,000,000 = 85% elapsed => Warning (>= 80%)
    const warningStatus = calculateSLAStatus(targetIso, createdIso, 850000, false, false, 80);
    expect(warningStatus.slaState).toBe('warning');
    expect(warningStatus.isWarning).toBe(true);
    expect(warningStatus.isBreached).toBe(false);

    // 1,050,000 / 1,000,000 = 105% elapsed (time expired) => Breached
    const breachedStatus = calculateSLAStatus(targetIso, createdIso, 1050000, false, false, 80);
    expect(breachedStatus.slaState).toBe('breached');
    expect(breachedStatus.isBreached).toBe(true);

    // Resolved ticket before breach => Met
    const metStatus = calculateSLAStatus(targetIso, createdIso, 500000, true, false, 80);
    expect(metStatus.slaState).toBe('met');
    expect(metStatus.isMet).toBe(true);
  });
});

describe('SLATimer Component', () => {
  const baseNow = new Date('2026-10-24T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockNormalTicket: Ticket = {
    id: 'ticket-101',
    title: 'Database connection delay',
    description: 'Intermittent query slowdowns',
    severity: 'P2',
    status: 'IN_PROGRESS',
    escalation_tier: 1,
    organization_id: 'org-acme',
    creator_user_id: 'user-01',
    response_due_at: new Date(baseNow + 4 * 3600 * 1000).toISOString(), // 4h in future
    resolution_due_at: new Date(baseNow + 24 * 3600 * 1000).toISOString(), // 24h in future
    is_sla_breached: false,
    created_at: new Date(baseNow - 1 * 3600 * 1000).toISOString(), // 1h ago
    updated_at: new Date(baseNow - 30 * 60 * 1000).toISOString(),
  };

  it('renders SLA countdown timer on track for normal active ticket', () => {
    render(<SLATimer ticket={mockNormalTicket} targetType="resolution" />);

    const timer = screen.getByTestId('sla-timer');
    expect(timer).toBeInTheDocument();
    expect(timer).toHaveAttribute('data-sla-state', 'normal');
    expect(timer).toHaveAttribute('data-severity', 'P2');

    const display = screen.getByTestId('sla-timer-display');
    expect(display).toHaveTextContent('24h 00m 00s');

    const statusBadge = screen.getByTestId('sla-status-badge');
    expect(statusBadge).toHaveTextContent('On Track');

    const progressBar = screen.getByTestId('sla-progress-bar');
    expect(progressBar).toBeInTheDocument();

    expect(screen.queryByTestId('sla-warning-indicator')).not.toBeInTheDocument();
  });

  it('displays visual breach warning highlights when time crosses warning threshold (P1 75%)', () => {
    // P1 ticket: created 3h ago, target 4h from created => 3/4 = 75% elapsed
    const p1WarningTicket: Ticket = {
      ...mockNormalTicket,
      severity: 'P1',
      status: 'NEW',
      created_at: new Date(baseNow - 3 * 3600 * 1000).toISOString(),
      response_due_at: new Date(baseNow + 1 * 3600 * 1000).toISOString(),
      resolution_due_at: new Date(baseNow + 2 * 3600 * 1000).toISOString(),
    };

    render(<SLATimer ticket={p1WarningTicket} targetType="response" />);

    const timer = screen.getByTestId('sla-timer');
    expect(timer).toHaveAttribute('data-sla-state', 'warning');

    const warningBox = screen.getByTestId('sla-warning-indicator');
    expect(warningBox).toBeInTheDocument();
    expect(warningBox).toHaveTextContent('SLA Breach Warning!');
    expect(warningBox).toHaveTextContent('75%');
  });

  it('displays breached visual state and warning highlight when ticket SLA deadline is expired or breached', () => {
    const breachedTicket: Ticket = {
      ...mockNormalTicket,
      is_sla_breached: true,
      response_due_at: new Date(baseNow - 30 * 60 * 1000).toISOString(), // 30 mins overdue
      resolution_due_at: new Date(baseNow - 10 * 60 * 1000).toISOString(),
    };

    render(<SLATimer ticket={breachedTicket} targetType="response" />);

    const timer = screen.getByTestId('sla-timer');
    expect(timer).toHaveAttribute('data-sla-state', 'breached');

    const statusBadge = screen.getByTestId('sla-status-badge');
    expect(statusBadge).toHaveTextContent('SLA Breached');

    const warningBox = screen.getByTestId('sla-warning-indicator');
    expect(warningBox).toBeInTheDocument();
    expect(warningBox).toHaveTextContent('SLA Breach Triggered!');

    const display = screen.getByTestId('sla-timer-display');
    expect(display).toHaveTextContent('-30m 00s');
  });

  it('renders SLA met state when ticket is resolved', () => {
    const resolvedTicket: Ticket = {
      ...mockNormalTicket,
      status: 'RESOLVED',
      resolved_at: new Date(baseNow - 10 * 60 * 1000).toISOString(),
    };

    render(<SLATimer ticket={resolvedTicket} targetType="resolution" />);

    const timer = screen.getByTestId('sla-timer');
    expect(timer).toHaveAttribute('data-sla-state', 'met');

    const statusBadge = screen.getByTestId('sla-status-badge');
    expect(statusBadge).toHaveTextContent('SLA Met');
  });

  it('renders compact inline layout when compact prop is true', () => {
    render(<SLATimer ticket={mockNormalTicket} compact={true} />);

    const compactTimer = screen.getByTestId('sla-timer');
    expect(compactTimer).toBeInTheDocument();
    expect(screen.getByTestId('sla-timer-display')).toBeInTheDocument();
    expect(screen.queryByTestId('sla-progress-bar')).not.toBeInTheDocument();
  });

  it('renders dual SLA timers when targetType is set to both', () => {
    render(<SLATimer ticket={mockNormalTicket} targetType="both" />);

    expect(screen.getByTestId('sla-timer-response')).toBeInTheDocument();
    expect(screen.getByTestId('sla-timer-resolution')).toBeInTheDocument();
  });

  it('triggers onWarning and onBreach callbacks when timer state updates', () => {
    const onWarning = vi.fn();
    const onBreach = vi.fn();

    // Target due in 10 seconds, created 90s ago -> 90/100 = 90% elapsed -> Warning
    const targetDate = new Date(baseNow + 10000).toISOString();
    const createdDate = new Date(baseNow - 90000).toISOString();

    render(
      <SLATimer
        targetDate={targetDate}
        createdDate={createdDate}
        severity="P2"
        onWarning={onWarning}
        onBreach={onBreach}
        refreshIntervalMs={1000}
      />
    );

    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onBreach).not.toHaveBeenCalled();

    // Advance time by 15 seconds so target expires
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(onBreach).toHaveBeenCalledTimes(1);
  });
});
