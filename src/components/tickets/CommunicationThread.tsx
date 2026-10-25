'use client';

import React, { useState, useMemo } from 'react';
import { TicketEvent, TicketEventType, ReplyCreate } from '../../services/tickets';

/** Maximum allowed attachment size in bytes (25 MB) */
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

export interface CommunicationThreadProps {
  /** Ticket ID for which the communication thread is rendered */
  ticketId?: string;
  /** Chronological audit events array associated with the ticket */
  events?: TicketEvent[];
  /** Callback fired when submitting a new comment or file attachment */
  onAddReply?: (reply: ReplyCreate) => Promise<TicketEvent | void> | void;
  /** Loading state flag */
  isLoading?: boolean;
  /** Disabled state flag (e.g., ticket resolved or read-only) */
  disabled?: boolean;
  /** Custom CSS class name wrapper */
  className?: string;
  /** Custom data-testid attribute override */
  'data-testid'?: string;
  /** Current active logged-in user ID for author labeling */
  currentUserId?: string;
}

/**
 * Sort ticket events chronologically by created_at timestamp.
 */
export function sortEventsChronologically(
  events: TicketEvent[] = [],
  ascending = true
): TicketEvent[] {
  return [...events].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return ascending ? timeA - timeB : timeB - timeA;
  });
}

/**
 * Format ISO date string into a user-friendly timestamp.
 */
export function formatEventTimestamp(isoString?: string | null): string {
  if (!isoString) return 'Unknown date';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format raw file byte length into human-readable size units (KB, MB).
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate attachment file size against max limit (25MB).
 */
export function validateAttachmentFile(file?: File | null): { valid: boolean; error?: string } {
  if (!file) return { valid: true };
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds maximum allowed attachment size of 25MB (${formatFileSize(file.size)}).`,
    };
  }
  return { valid: true };
}

/**
 * Get display styling and icon metadata for ticket event types.
 */
export function getEventTypeBadge(eventType: TicketEventType | string): {
  label: string;
  bgColor: string;
  textColor: string;
  iconSymbol: string;
} {
  const normType = (eventType || '').toUpperCase();
  switch (normType) {
    case 'TICKET_CREATED':
      return { label: 'Created', bgColor: '#f0eee9', textColor: '#59452b', iconSymbol: '✦' };
    case 'COMMENT':
      return { label: 'Comment', bgColor: '#e8f5e9', textColor: '#1b4332', iconSymbol: '💬' };
    case 'STATUS_CHANGE':
      return { label: 'Status Update', bgColor: '#d0e4ff', textColor: '#071d30', iconSymbol: '🔄' };
    case 'ESCALATION_TRIGGERED':
      return { label: 'Escalated', bgColor: '#ffdad6', textColor: '#93000a', iconSymbol: '🚨' };
    case 'ATTACHMENT_ADDED':
      return { label: 'Attachment', bgColor: '#f5d6b4', textColor: '#281804', iconSymbol: '📎' };
    case 'CSAT_SUBMITTED':
      return { label: 'CSAT Survey', bgColor: '#fdddbb', textColor: '#58432a', iconSymbol: '⭐' };
    default:
      return { label: eventType || 'Event', bgColor: '#e4e2dd', textColor: '#1b1c19', iconSymbol: '📝' };
  }
}

/**
 * Chronological communication feed component.
 * Renders immutable audit log entries, comment stream, file attachments,
 * and a reply form supporting text and attachment uploads.
 */
export function CommunicationThread({
  ticketId,
  events = [],
  onAddReply,
  isLoading = false,
  disabled = false,
  className = '',
  'data-testid': testId = 'communication-thread',
  currentUserId,
}: CommunicationThreadProps) {
  const [sortAscending, setSortAscending] = useState<boolean>(true);
  const [replyContent, setReplyContent] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sort events list chronologically
  const sortedEvents = useMemo(() => {
    return sortEventsChronologically(events, sortAscending);
  }, [events, sortAscending]);

  // Handle file input change & validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSubmitError(null);
    if (file) {
      const validation = validateAttachmentFile(file);
      if (!validation.valid) {
        setFileError(validation.error || 'Invalid attachment file');
        setSelectedFile(null);
      } else {
        setFileError(null);
        setSelectedFile(file);
      }
    } else {
      setSelectedFile(null);
      setFileError(null);
    }
  };

  // Remove selected attachment file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedContent = replyContent.trim();
    if (!trimmedContent && !selectedFile) {
      setSubmitError('Please enter a comment or attach a file before posting.');
      return;
    }

    if (selectedFile) {
      const validation = validateAttachmentFile(selectedFile);
      if (!validation.valid) {
        setFileError(validation.error || 'Invalid attachment file.');
        return;
      }
    }

    if (!onAddReply) {
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: ReplyCreate = {};
      if (trimmedContent) payload.content = trimmedContent;
      if (selectedFile) payload.file = selectedFile;

      await onAddReply(payload);

      // Reset form state on successful submission
      setReplyContent('');
      setSelectedFile(null);
      setFileError(null);
      setSubmitError(null);
    } catch (err: any) {
      const errMsg =
        err?.message || err?.data?.detail || 'Failed to post reply. Please try again.';
      setSubmitError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormEmpty = !replyContent.trim() && !selectedFile;
  const isSubmitDisabled = disabled || isSubmitting || !!fileError || isFormEmpty;

  return (
    <div
      data-testid={testId}
      className={`communication-thread ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        fontFamily: 'var(--font-sans, sans-serif)',
        color: 'var(--color-on-surface, #1b1c19)',
      }}
    >
      {/* Header with Event Count & Sort Order Control */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              fontFamily: 'var(--font-serif, Georgia, serif)',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Communication Feed & Audit Trail
          </h3>
          <span
            data-testid="event-count-badge"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full, 9999px)',
              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {events.length > 1 && (
          <button
            type="button"
            data-testid="sort-toggle-button"
            onClick={() => setSortAscending((prev) => !prev)}
            style={{
              background: 'none',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-on-surface-variant, #4e453d)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>Sort:</span>
            <strong>{sortAscending ? 'Oldest First' : 'Newest First'}</strong>
          </button>
        )}
      </div>

      {/* Events List View */}
      <div
        data-testid="event-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {isLoading ? (
          <div
            data-testid="communication-thread-loading"
            style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              color: 'var(--color-on-surface-variant, #4e453d)',
              fontSize: '14px',
            }}
          >
            Loading activity log...
          </div>
        ) : sortedEvents.length === 0 ? (
          <div
            data-testid="communication-thread-empty"
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px dashed var(--color-outline-variant, #d1c4b9)',
              color: 'var(--color-on-surface-variant, #4e453d)',
              fontSize: '14px',
            }}
          >
            No events recorded yet for this support ticket.
          </div>
        ) : (
          sortedEvents.map((event) => {
            const badge = getEventTypeBadge(event.event_type);
            const isCurrentUser = currentUserId && event.author_id === currentUserId;
            const hasAttachment = Boolean(event.attachment_url || event.attachment_filename);

            return (
              <div
                key={event.id}
                data-testid="event-item"
                data-event-id={event.id}
                data-event-type={event.event_type}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '16px',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                }}
              >
                {/* Event Item Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      data-testid="event-badge"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: badge.bgColor,
                        color: badge.textColor,
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <span>{badge.iconSymbol}</span>
                      <span>{badge.label}</span>
                    </span>

                    <span
                      data-testid="event-author"
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-on-surface, #1b1c19)',
                      }}
                    >
                      {event.author_id}
                      {isCurrentUser ? ' (You)' : ''}
                    </span>
                  </div>

                  <span
                    data-testid="event-timestamp"
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    {formatEventTimestamp(event.created_at)}
                  </span>
                </div>

                {/* Event Content Body */}
                {event.content && (
                  <div
                    data-testid="event-content"
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: 'var(--color-on-surface, #1b1c19)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      paddingTop: '4px',
                    }}
                  >
                    {event.content}
                  </div>
                )}

                {/* Attachment Display Box */}
                {hasAttachment && (
                  <div
                    data-testid="event-attachment"
                    style={{
                      marginTop: '6px',
                      padding: '10px 12px',
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontSize: '16px' }}>📎</span>
                      <span
                        data-testid="attachment-filename"
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--color-on-surface, #1b1c19)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {event.attachment_filename || 'Attached File'}
                      </span>
                    </div>

                    {event.attachment_url && (
                      <a
                        href={event.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={event.attachment_filename || true}
                        data-testid="attachment-download-link"
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-primary, #59452b)',
                          textDecoration: 'none',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          border: '1px solid var(--color-outline-variant, #d1c4b9)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Download ⬇
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Reply & Attachment Form */}
      {disabled ? (
        <div
          data-testid="reply-disabled-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            fontSize: '13px',
            color: 'var(--color-on-surface-variant, #4e453d)',
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          Comments and replies are disabled for this ticket.
        </div>
      ) : (
        <form
          data-testid="reply-form"
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            backgroundColor: 'var(--color-surface-container, #f0eee9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <label
            htmlFor={`reply-content-${ticketId || 'default'}`}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Add Response or Note
          </label>

          <textarea
            id={`reply-content-${ticketId || 'default'}`}
            data-testid="reply-textarea"
            data-testid-alias="reply-content-input"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            disabled={disabled || isSubmitting}
            placeholder="Type your reply, comment, or escalation note..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              border: '1px solid var(--color-outline, #80756b)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-on-surface, #1b1c19)',
              fontFamily: 'inherit',
              fontSize: '14px',
              resize: 'vertical',
            }}
          />

          {/* File Attachment Input Section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                htmlFor={`reply-file-${ticketId || 'default'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  cursor: disabled || isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                <span>📎</span>
                <span>Attach File (Max 25MB)</span>
              </label>

              <input
                id={`reply-file-${ticketId || 'default'}`}
                type="file"
                data-testid="reply-file-input"
                onChange={handleFileChange}
                disabled={disabled || isSubmitting}
                style={{ display: 'none' }}
              />

              {selectedFile && (
                <div
                  data-testid="selected-file-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    fontSize: '12px',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{selectedFile.name}</span>
                  <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>
                    ({formatFileSize(selectedFile.size)})
                  </span>
                  <button
                    type="button"
                    data-testid="remove-file-button"
                    onClick={handleRemoveFile}
                    disabled={disabled || isSubmitting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-error, #ba1a1a)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      padding: '0 2px',
                      fontSize: '14px',
                      lineHeight: 1,
                    }}
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              data-testid="submit-reply-button"
              disabled={isSubmitDisabled}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor: isSubmitDisabled
                  ? 'var(--color-surface-container-high, #eae8e3)'
                  : 'var(--color-primary, #59452b)',
                color: isSubmitDisabled
                  ? 'var(--color-on-surface-variant, #4e453d)'
                  : 'var(--color-on-primary, #ffffff)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              {isSubmitting ? 'Posting Response...' : 'Post Comment'}
            </button>
          </div>

          {/* Validation or Submission Error Alerts */}
          {(fileError || submitError) && (
            <div
              data-testid="reply-error-message"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor: 'var(--color-error-container, #ffdad6)',
                color: 'var(--color-on-error-container, #93000a)',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {fileError || submitError}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default CommunicationThread;
