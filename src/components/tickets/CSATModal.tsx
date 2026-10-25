'use client';

import React, { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import {
  Ticket,
  CSATResponse,
  TicketsService,
  ticketsService as defaultTicketsService,
} from '../../services/tickets';

/**
 * Human-readable descriptor label for a 1-5 CSAT rating value.
 */
export function getRatingLabel(rating: number): string {
  switch (rating) {
    case 1:
      return 'Very Dissatisfied';
    case 2:
      return 'Dissatisfied';
    case 3:
      return 'Neutral';
    case 4:
      return 'Satisfied';
    case 5:
      return 'Very Satisfied';
    default:
      return 'Select a rating';
  }
}

export interface CSATModalProps {
  /** Target ticket ID for CSAT feedback submission */
  ticketId?: string;
  /** Optional ticket summary object for header context */
  ticket?: Ticket | null;
  /** Whether the CSAT modal is currently open and visible */
  isOpen?: boolean;
  /** Callback fired when closing, cancelling, or skipping the modal */
  onClose?: () => void;
  /** Custom submit handler callback override */
  onSubmit?: (rating: number, feedbackText?: string) => Promise<CSATResponse | void> | void;
  /** Callback fired after CSAT rating is successfully recorded */
  onSuccess?: (response?: CSATResponse) => void;
  /** Initial selected rating score (1-5) */
  initialRating?: number;
  /** Initial feedback text comment */
  initialFeedback?: string;
  /** Optional custom TicketsService instance override */
  ticketsService?: TicketsService;
  /** Read-only or disabled state flag */
  disabled?: boolean;
  /** Custom CSS class name wrapper */
  className?: string;
  /** Custom data-testid attribute override */
  'data-testid'?: string;
}

/**
 * CSAT Feedback Survey Modal Component.
 * Enables end users to submit post-resolution satisfaction ratings (1-5 stars)
 * and optional feedback text comments for resolved support tickets.
 * [FR-08, US-05]
 */
export const CSATModal: React.FC<CSATModalProps> = ({
  ticketId: propTicketId,
  ticket,
  isOpen = false,
  onClose,
  onSubmit,
  onSuccess,
  initialRating = 0,
  initialFeedback = '',
  ticketsService = defaultTicketsService,
  disabled = false,
  className = '',
  'data-testid': testId = 'csat-modal',
}) => {
  const activeTicketId = propTicketId || ticket?.id || '';
  const ticketTitle = ticket?.title;

  const [rating, setRating] = useState<number>(initialRating);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>(initialFeedback);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Sync initial prop overrides when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(initialRating);
      setHoverRating(0);
      setFeedbackText(initialFeedback);
      setError(null);
      setIsSubmitting(false);
      setIsSubmitted(false);
    }
  }, [isOpen, initialRating, initialFeedback]);

  // Handle ESC key press to close modal
  const handleKeyDown = useCallback(
    (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting && onClose) {
        onClose();
      }
    },
    [isOpen, isSubmitting, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const handleRatingSelect = (selectedScore: number) => {
    if (disabled || isSubmitting) return;
    setRating(selectedScore);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || isSubmitting) return;

    if (!rating || rating < 1 || rating > 5) {

      setError('Please select a rating between 1 and 5 stars before submitting.');
      return;
    }

    if (!activeTicketId && !onSubmit) {
      setError('Missing ticket ID for CSAT submission.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let res: CSATResponse | void;
      if (onSubmit) {
        res = await onSubmit(rating, feedbackText.trim() || undefined);
      } else {
        res = await ticketsService.submitCSAT(activeTicketId, {
          rating,
          feedback_text: feedbackText.trim() || undefined,
        });
      }

      setIsSubmitted(true);
      if (onSuccess) {
        onSuccess(res || undefined);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit CSAT survey feedback. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting && onClose) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity ${className}`}
      onClick={handleBackdropClick}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby="csat-modal-title"
    >
      <div
        className="relative w-full max-w-lg rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] p-6 shadow-xl transition-all"
        style={{
          backgroundColor: '#fbf9f4',
          borderColor: '#d1c4b9',
          color: '#1b1c19',
        }}
      >
        {/* Modal Close / Skip Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute right-4 top-4 rounded p-1 text-[#80756b] hover:bg-[#eae8e3] hover:text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41] disabled:opacity-50"
            aria-label="Close modal"
            data-testid="csat-close-button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {isSubmitted ? (
          /* Thank You / Success State */
          <div className="py-6 text-center" data-testid="csat-success-state">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5d6b4] text-[#735c41]">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3
              id="csat-modal-title"
              className="mb-2 text-2xl font-serif font-normal text-[#1b1c19]"
              style={{ fontFamily: 'Libre Caslon Text, serif' }}
            >
              Thank You for Your Feedback!
            </h3>
            <p className="text-sm text-[#4e453d]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Your rating has been recorded. We appreciate your input to help improve our support services.
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded px-5 py-2.5 text-sm font-medium text-[#ffffff] bg-[#735c41] hover:bg-[#59452b] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                data-testid="csat-success-close-button"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Survey Form State */
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#735c41]">
                Customer Satisfaction Survey
              </span>
              <h2
                id="csat-modal-title"
                className="mt-1 text-2xl font-serif text-[#1b1c19]"
                style={{ fontFamily: 'Libre Caslon Text, serif' }}
              >
                How was your support experience?
              </h2>
              {ticketTitle && (
                <p className="mt-1 text-sm text-[#4e453d]" data-testid="csat-ticket-title">
                  Ticket: <span className="font-medium text-[#1b1c19]">{ticketTitle}</span>
                </p>
              )}
              {activeTicketId && !ticketTitle && (
                <p className="mt-1 text-xs text-[#80756b]" data-testid="csat-ticket-id">
                  Ticket ID: #{activeTicketId}
                </p>
              )}
            </div>

            {/* Error Message Alert */}
            {error && (
              <div
                className="mb-4 rounded border border-[#ba1a1a] bg-[#ffdad6] p-3 text-sm text-[#93000a]"
                role="alert"
                data-testid="csat-error-alert"
              >
                {error}
              </div>
            )}

            {/* Rating Stars Section */}
            <div className="my-6 text-center">
              <label className="mb-2 block text-sm font-medium text-[#1b1c19]">
                Overall Rating <span className="text-[#ba1a1a]">*</span>
              </label>

              <div
                className="flex items-center justify-center gap-2"
                onMouseLeave={() => setHoverRating(0)}
                data-testid="csat-rating-stars-container"
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const activeScore = hoverRating > 0 ? hoverRating : rating;
                  const isFilled = star <= activeScore;

                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={disabled || isSubmitting}
                      onClick={() => handleRatingSelect(star)}
                      onMouseEnter={() => !disabled && !isSubmitting && setHoverRating(star)}
                      className={`group p-1.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#735c41] rounded disabled:opacity-50 disabled:hover:scale-100 ${
                        isFilled ? 'text-[#735c41]' : 'text-[#d1c4b9]'
                      }`}
                      aria-label={`${star} star${star > 1 ? 's' : ''} - ${getRatingLabel(star)}`}
                      data-testid={`csat-rating-star-${star}`}
                    >
                      <svg
                        className="h-9 w-9 transition-colors"
                        fill={isFilled ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth={isFilled ? '0' : '1.5'}
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>

              {/* Rating Descriptor Label */}
              <div
                className="mt-2 text-sm font-medium h-5 transition-all text-[#735c41]"
                data-testid="csat-rating-label"
              >
                {getRatingLabel(hoverRating || rating)}
              </div>
            </div>

            {/* Optional Feedback Text Area */}
            <div className="mb-6">
              <label
                htmlFor="csat-feedback-input"
                className="mb-1 block text-sm font-medium text-[#1b1c19]"
              >
                Additional Feedback <span className="text-xs font-normal text-[#80756b]">(Optional)</span>
              </label>
              <textarea
                id="csat-feedback-input"
                disabled={disabled || isSubmitting}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Tell us what went well or how we could improve our resolution process..."
                className="w-full rounded border border-[#d1c4b9] bg-[#ffffff] p-3 text-sm text-[#1b1c19] placeholder-[#80756b] focus:border-[#735c41] focus:outline-none focus:ring-1 focus:ring-[#735c41] disabled:bg-[#f0eee9]"
                data-testid="csat-feedback-input"
              />
              <div className="mt-1 text-right text-xs text-[#80756b]">
                {feedbackText.length}/1000 characters
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#d1c4b9]">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded px-4 py-2 text-sm font-medium text-[#4e453d] hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] disabled:opacity-50"
                  data-testid="csat-cancel-button"
                >
                  Skip for now
                </button>
              )}
              <button
                type="submit"
                disabled={disabled || isSubmitting}
                className="inline-flex items-center justify-center rounded px-5 py-2 text-sm font-medium text-[#ffffff] bg-[#735c41] hover:bg-[#59452b] focus:outline-none focus:ring-2 focus:ring-[#735c41] disabled:opacity-50"
                data-testid="csat-submit-button"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CSATModal;
