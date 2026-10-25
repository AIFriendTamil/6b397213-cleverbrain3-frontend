'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Ticket, TicketSeverity } from '../../services/tickets';

/**
 * SLA State classification enum values.
 */
export type SLAState = 'normal' | 'warning' | 'breached' | 'met' | 'breached-resolved';

export interface SLATimerProps {
  /** The ticket object to monitor SLA for */
  ticket?: Ticket | null;
  /** Target SLA type: 'response', 'resolution', 'both', or 'auto' (default: 'auto') */
  targetType?: 'response' | 'resolution' | 'both' | 'auto';
  /** Explicit deadline ISO string or Date override */
  targetDate?: string | Date | null;
  /** Explicit creation/start ISO string or Date override */
  createdDate?: string | Date | null;
  /** Ticket severity override ('P1', 'P2', 'P3') */
  severity?: TicketSeverity | null;
  /** Backend breach flag override */
  isBreached?: boolean;
  /** Custom warning threshold percentage (0-100) */
  warningThresholdPercent?: number;
  /** Ticket status override */
  status?: string;
  /** Optional callback fired when SLA timer enters warning state */
  onWarning?: () => void;
  /** Optional callback fired when SLA timer breaches */
  onBreach?: () => void;
  /** Custom CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
  /** Timer update interval in milliseconds (default: 1000) */
  refreshIntervalMs?: number;
  /** Compact rendering mode for inline list/table display */
  compact?: boolean;
}

/**
 * Determine default SLA breach warning threshold percentage based on incident severity.
 * P1 incidents trigger breach warning highlights at 75% elapsed duration;
 * P2 / P3 incidents trigger warning highlights at 80% elapsed duration.
 */
export function getWarningThreshold(severity?: TicketSeverity | string | null): number {
  const normSeverity = (severity || '').toUpperCase();
  if (normSeverity === 'P1') {
    return 75;
  }
  return 80;
}

/**
 * Format remaining or overdue millisecond duration into a human-readable countdown string.
 */
export function formatCountdownTime(diffMs: number): string {
  const absMs = Math.abs(diffMs);
  const totalSeconds = Math.floor(absMs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  if (diffMs <= 0) {
    if (days > 0) return `-${days}d ${hours}h ${pad(minutes)}m`;
    if (hours > 0) return `-${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    return `-${pad(minutes)}m ${pad(seconds)}s`;
  }

  if (days > 0) {
    return `${days}d ${hours}h ${pad(minutes)}m`;
  }
  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(minutes)}m ${pad(seconds)}s`;
}

export interface SLAStatusDetails {
  targetDate: Date | null;
  createdDate: Date | null;
  timeRemainingMs: number;
  totalDurationMs: number;
  elapsedMs: number;
  percentElapsed: number;
  warningThresholdPercent: number;
  slaState: SLAState;
  isWarning: boolean;
  isBreached: boolean;
  isMet: boolean;
  formattedTimeRemaining: string;
  displayStatusText: string;
}

/**
 * Calculate detailed SLA time remaining, elapsed percentage, and state classification.
 */
export function calculateSLAStatus(
  targetInput: string | Date | null | undefined,
  createdInput: string | Date | null | undefined,
  nowMs: number,
  isResolvedOrClosed: boolean,
  isBackendBreached: boolean,
  warningThresholdPercent: number
): SLAStatusDetails {
  const targetDate = targetInput ? new Date(targetInput) : null;
  const validTarget = targetDate && !isNaN(targetDate.getTime());

  if (!validTarget) {
    return {
      targetDate: null,
      createdDate: null,
      timeRemainingMs: 0,
      totalDurationMs: 0,
      elapsedMs: 0,
      percentElapsed: 0,
      warningThresholdPercent,
      slaState: 'normal',
      isWarning: false,
      isBreached: false,
      isMet: isResolvedOrClosed,
      formattedTimeRemaining: 'N/A',
      displayStatusText: isResolvedOrClosed ? 'SLA Met' : 'No Target',
    };
  }

  const targetMs = targetDate.getTime();
  let createdMs: number;

  if (createdInput) {
    const cd = new Date(createdInput);
    createdMs = !isNaN(cd.getTime()) ? cd.getTime() : targetMs - 14400000;
  } else {
    createdMs = targetMs - 14400000;
  }

  const timeRemainingMs = targetMs - nowMs;
  const totalDurationMs = Math.max(targetMs - createdMs, 1);
  const elapsedMs = nowMs - createdMs;
  const percentElapsed = Math.min(Math.max((elapsedMs / totalDurationMs) * 100, 0), 100);

  const isTimeBreached = timeRemainingMs <= 0;
  const isBreached = isBackendBreached || isTimeBreached;

  let slaState: SLAState = 'normal';
  let isWarning = false;
  let isMet = false;
  let displayStatusText = 'On Track';

  if (isResolvedOrClosed) {
    if (isBreached) {
      slaState = 'breached-resolved';
      displayStatusText = 'Breached (Resolved)';
    } else {
      slaState = 'met';
      isMet = true;
      displayStatusText = 'SLA Met';
    }
  } else if (isBreached) {
    slaState = 'breached';
    displayStatusText = 'SLA Breached';
  } else if (percentElapsed >= warningThresholdPercent) {
    slaState = 'warning';
    isWarning = true;
    displayStatusText = `Warning (${Math.round(percentElapsed)}% elapsed)`;
  } else {
    slaState = 'normal';
    displayStatusText = 'On Track';
  }

  const formattedTimeRemaining = isResolvedOrClosed
    ? (isBreached ? 'Breached' : 'Fulfilled')
    : formatCountdownTime(timeRemainingMs);

  return {
    targetDate,
    createdDate: new Date(createdMs),
    timeRemainingMs,
    totalDurationMs,
    elapsedMs,
    percentElapsed,
    warningThresholdPercent,
    slaState,
    isWarning,
    isBreached: !isResolvedOrClosed && isBreached,
    isMet,
    formattedTimeRemaining,
    displayStatusText,
  };
}

/**
 * Format severity badge label.
 */
function getSeverityBadge(severity?: string | null): { label: string; bg: string; color: string } {
  const norm = (severity || 'P2').toUpperCase();
  switch (norm) {
    case 'P1':
      return { label: 'P1 Critical', bg: '#ba1a1a', color: '#ffffff' };
    case 'P2':
      return { label: 'P2 High', bg: '#735c41', color: '#ffffff' };
    case 'P3':
      return { label: 'P3 Standard', bg: '#4f6278', color: '#ffffff' };
    default:
      return { label: norm, bg: '#80756b', color: '#ffffff' };
  }
}

/**
 * Sub-component for rendering a single SLA countdown target block.
 */
function SLATimerBlock({
  label,
  details,
  severity,
  escalationTier,
  compact = false,
  testId = 'sla-timer',
}: {
  label: string;
  details: SLAStatusDetails;
  severity: string;
  escalationTier?: number;
  compact?: boolean;
  testId?: string;
}) {
  const severityBadge = getSeverityBadge(severity);

  if (compact) {
    let dotColor = '#2e6b38';
    let bgColor = 'var(--color-surface-container-low, #f5f3ee)';
    let textColor = 'var(--color-on-surface, #1b1c19)';

    if (details.slaState === 'warning') {
      dotColor = '#a43b2c';
      bgColor = '#fdf0ed';
      textColor = '#842417';
    } else if (details.slaState === 'breached' || details.slaState === 'breached-resolved') {
      dotColor = '#ba1a1a';
      bgColor = '#ffdad6';
      textColor = '#93000a';
    } else if (details.slaState === 'met') {
      dotColor = '#2e6b38';
      bgColor = '#e8f5e9';
      textColor = '#1b4332';
    }

    return (
      <div
        data-testid={testId}
        data-sla-state={details.slaState}
        data-severity={severity}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full, 9999px)',
          backgroundColor: bgColor,
          color: textColor,
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'var(--font-sans, sans-serif)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            display: 'inline-block',
          }}
        />
        <span>{label}:</span>
        <span data-testid="sla-timer-display" style={{ fontWeight: 600 }}>
          {details.formattedTimeRemaining}
        </span>
        <span
          data-testid="sla-status-badge"
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: 0.85,
          }}
        >
          ({details.displayStatusText})
        </span>
      </div>
    );
  }

  // Full Card View
  let progressFillColor = 'var(--color-primary, #59452b)';
  let statusBadgeBg = '#e8f5e9';
  let statusBadgeColor = '#1b4332';
  let timerTextColor = 'var(--color-on-surface, #1b1c19)';

  if (details.slaState === 'warning') {
    progressFillColor = 'var(--color-secondary, #a43b2c)';
    statusBadgeBg = '#fdf0ed';
    statusBadgeColor = '#842417';
    timerTextColor = 'var(--color-secondary, #a43b2c)';
  } else if (details.slaState === 'breached' || details.slaState === 'breached-resolved') {
    progressFillColor = 'var(--color-error, #ba1a1a)';
    statusBadgeBg = '#ffdad6';
    statusBadgeColor = '#93000a';
    timerTextColor = 'var(--color-error, #ba1a1a)';
  } else if (details.slaState === 'met') {
    progressFillColor = '#2e6b38';
    statusBadgeBg = '#e8f5e9';
    statusBadgeColor = '#1b4332';
    timerTextColor = '#2e6b38';
  }

  return (
    <div
      data-testid={testId}
      data-sla-state={details.slaState}
      data-severity={severity}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        borderRadius: 'var(--radius-md, 0.375rem)',
        backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        fontFamily: 'var(--font-sans, sans-serif)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: severityBadge.bg,
              color: severityBadge.color,
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {severityBadge.label}
          </span>
          {escalationTier !== undefined && escalationTier > 1 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor: '#fd7d69',
                color: '#71160b',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Tier {escalationTier} Escalated
            </span>
          )}
        </div>

        <span
          data-testid="sla-status-badge"
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full, 9999px)',
            backgroundColor: statusBadgeBg,
            color: statusBadgeColor,
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {details.displayStatusText}
        </span>
      </div>

      {/* Main Countdown Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div
          data-testid="sla-timer-display"
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: timerTextColor,
            fontFamily: 'var(--font-serif, Georgia, serif)',
            lineHeight: 1.2,
          }}
        >
          {details.formattedTimeRemaining}
        </div>
        {details.targetDate && (
          <div style={{ fontSize: '12px', color: 'var(--color-outline, #80756b)' }}>
            Target Deadline: {details.targetDate.toLocaleString()}
          </div>
        )}
      </div>

      {/* Progress Bar Track */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          data-testid="sla-progress-bar"
          style={{
            height: '8px',
            width: '100%',
            backgroundColor: 'var(--color-surface-container-highest, #e4e2dd)',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            data-testid="sla-progress-fill"
            style={{
              height: '100%',
              width: `${details.percentElapsed}%`,
              backgroundColor: progressFillColor,
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--color-outline, #80756b)',
          }}
        >
          <span>Elapsed: {Math.round(details.percentElapsed)}%</span>
          <span>Warning Threshold: {details.warningThresholdPercent}%</span>
        </div>
      </div>

      {/* Breach Warning Highlight Box */}
      {(details.isWarning || details.isBreached) && (
        <div
          data-testid="sla-warning-indicator"
          style={{
            marginTop: '4px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-default, 0.25rem)',
            backgroundColor: details.isBreached ? '#ffdad6' : '#fdf0ed',
            color: details.isBreached ? '#93000a' : '#842417',
            border: `1px solid ${details.isBreached ? '#ba1a1a' : '#a43b2c'}`,
            fontSize: '13px',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>
            {details.isBreached ? '🚨' : '⚠️'}
          </span>
          <div>
            <strong style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>
              {details.isBreached ? 'SLA Breach Triggered!' : 'SLA Breach Warning!'}
            </strong>
            {details.isBreached
              ? 'Target response or resolution time has expired. Escalation pathway engaged.'
              : `Ticket elapsed duration has crossed the ${details.warningThresholdPercent}% SLA warning threshold. Immediate action recommended.`}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Visual SLA Countdown Timer component with breach warning highlights.
 * Tracks live target deadline counting down to zero, displaying warning cues when
 * crossing configured SLA thresholds, and handling breached / met states.
 */
export function SLATimer(props: SLATimerProps): React.JSX.Element {
  const {
    ticket,
    targetType = 'auto',
    targetDate: propTargetDate,
    createdDate: propCreatedDate,
    severity: propSeverity,
    isBreached: propIsBreached,
    warningThresholdPercent: propWarning,
    status: propStatus,
    onWarning,
    onBreach,
    className,
    'data-testid': customTestId,
    refreshIntervalMs = 1000,
    compact = false,
  } = props;

  // Track live current time
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Track fired callbacks to prevent duplicate triggers
  const warningTriggeredRef = useRef<boolean>(false);
  const breachTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, refreshIntervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [refreshIntervalMs]);

  // Extract common metadata
  const status = ticket?.status || propStatus || 'NEW';
  const severity = ticket?.severity || propSeverity || 'P2';
  const isResolvedOrClosed = status === 'RESOLVED' || status === 'CLOSED';
  const isBackendBreached = ticket?.is_sla_breached ?? propIsBreached ?? false;
  const warningThresholdPercent = propWarning ?? getWarningThreshold(severity);

  // Dual mode handling
  const isDualMode = targetType === 'both' && !!ticket;

  // Calculate SLA status for primary or dual targets
  const responseDetails = useMemo(() => {
    if (isDualMode && ticket) {
      return calculateSLAStatus(
        ticket.response_due_at,
        ticket.created_at,
        nowMs,
        isResolvedOrClosed,
        isBackendBreached,
        warningThresholdPercent
      );
    }
    return null;
  }, [isDualMode, ticket, nowMs, isResolvedOrClosed, isBackendBreached, warningThresholdPercent]);

  const resolutionDetails = useMemo(() => {
    if (isDualMode && ticket) {
      return calculateSLAStatus(
        ticket.resolution_due_at,
        ticket.created_at,
        nowMs,
        isResolvedOrClosed,
        isBackendBreached,
        warningThresholdPercent
      );
    }
    return null;
  }, [isDualMode, ticket, nowMs, isResolvedOrClosed, isBackendBreached, warningThresholdPercent]);

  const singleTargetDetails = useMemo(() => {
    if (isDualMode) return null;

    let targetIso: string | Date | null = null;
    let label = 'Resolution SLA';

    if (propTargetDate) {
      targetIso = propTargetDate;
      label = targetType === 'response' ? 'Response SLA' : 'Resolution SLA';
    } else if (ticket) {
      if (targetType === 'response') {
        targetIso = ticket.response_due_at;
        label = 'Response SLA';
      } else if (targetType === 'resolution') {
        targetIso = ticket.resolution_due_at;
        label = 'Resolution SLA';
      } else {
        // 'auto'
        if (status === 'NEW' && ticket.response_due_at) {
          targetIso = ticket.response_due_at;
          label = 'Response SLA';
        } else {
          targetIso = ticket.resolution_due_at || ticket.response_due_at;
          label = 'Resolution SLA';
        }
      }
    }

    const createdIso = ticket?.created_at || propCreatedDate || null;

    return {
      label,
      details: calculateSLAStatus(
        targetIso,
        createdIso,
        nowMs,
        isResolvedOrClosed,
        isBackendBreached,
        warningThresholdPercent
      ),
    };
  }, [
    isDualMode,
    propTargetDate,
    targetType,
    ticket,
    status,
    propCreatedDate,
    nowMs,
    isResolvedOrClosed,
    isBackendBreached,
    warningThresholdPercent,
  ]);

  // Handle callback triggers for warning/breach
  useEffect(() => {
    const activeDetails = singleTargetDetails?.details || responseDetails || resolutionDetails;
    if (!activeDetails) return;

    if (activeDetails.isWarning && !warningTriggeredRef.current) {
      warningTriggeredRef.current = true;
      if (onWarning) onWarning();
    }

    if (activeDetails.isBreached && !breachTriggeredRef.current) {
      breachTriggeredRef.current = true;
      if (onBreach) onBreach();
    }
  }, [singleTargetDetails, responseDetails, resolutionDetails, onWarning, onBreach]);

  const baseTestId = customTestId || 'sla-timer';

  if (isDualMode && responseDetails && resolutionDetails) {
    return (
      <div
        data-testid={baseTestId}
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <SLATimerBlock
          label="Response SLA"
          details={responseDetails}
          severity={severity}
          escalationTier={ticket?.escalation_tier}
          compact={compact}
          testId="sla-timer-response"
        />
        <SLATimerBlock
          label="Resolution SLA"
          details={resolutionDetails}
          severity={severity}
          escalationTier={ticket?.escalation_tier}
          compact={compact}
          testId="sla-timer-resolution"
        />
      </div>
    );
  }

  if (!singleTargetDetails) {
    return (
      <div data-testid={baseTestId} className={className}>
        No SLA information available
      </div>
    );
  }

  return (
    <div className={className}>
      <SLATimerBlock
        label={singleTargetDetails.label}
        details={singleTargetDetails.details}
        severity={severity}
        escalationTier={ticket?.escalation_tier}
        compact={compact}
        testId={baseTestId}
      />
    </div>
  );
}

export default SLATimer;
