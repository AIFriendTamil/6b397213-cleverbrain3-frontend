'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { KBTutorialStep, KBUserProgress, KBProgressUpdate } from '../../services/kb_client';
import { VideoPlayer } from './VideoPlayer';

export interface TutorialStepperProps {
  /**
   * Ordered array of tutorial steps.
   */
  steps?: KBTutorialStep[];

  /**
   * ID of the associated knowledge base resource (for API progress payload).
   */
  resourceId?: string;

  /**
   * Controlled active step index (0-based).
   */
  activeStepIndex?: number;

  /**
   * Initial active step index for uncontrolled mode. Defaults to 0.
   */
  initialStepIndex?: number;

  /**
   * List of step numbers that are marked completed (1-based matching step.step_number).
   */
  completedStepNumbers?: number[];

  /**
   * User progress object from backend API.
   */
  progress?: KBUserProgress | null;

  /**
   * Callback fired when active step changes.
   */
  onStepChange?: (stepIndex: number, step: KBTutorialStep) => void;

  /**
   * Callback fired when a step completion status is toggled.
   */
  onToggleStepCompletion?: (stepNumber: number, isCompleted: boolean) => void;

  /**
   * Callback fired specifically when a step is marked complete.
   */
  onCompleteStep?: (stepNumber: number) => void;

  /**
   * Callback fired when all tutorial steps are marked complete or when finish is triggered.
   */
  onCompleteTutorial?: () => void;

  /**
   * Callback fired for backend API progress update integration.
   */
  onProgressUpdate?: (update: KBProgressUpdate) => void;

  /**
   * Whether clicking step header indicators allows direct jumping. Defaults to true.
   */
  allowJumpToStep?: boolean;

  /**
   * Whether to render embedded VideoPlayer if step contains video_url. Defaults to true.
   */
  showVideoPlayer?: boolean;

  /**
   * Whether the stepper is in read-only mode (disables completion toggles). Defaults to false.
   */
  readOnly?: boolean;

  /**
   * Custom CSS class name for outer container.
   */
  className?: string;

  /**
   * Data-testid attribute for testing. Defaults to 'tutorial-stepper'.
   */
  'data-testid'?: string;
}

/**
 * Get the effective step number for a step item.
 */
export function getStepNumber(step: KBTutorialStep, index: number): number {
  return typeof step.step_number === 'number' && step.step_number > 0
    ? step.step_number
    : index + 1;
}

export const TutorialStepper: React.FC<TutorialStepperProps> = ({
  steps = [],
  resourceId,
  activeStepIndex: controlledStepIndex,
  initialStepIndex = 0,
  completedStepNumbers,
  progress,
  onStepChange,
  onToggleStepCompletion,
  onCompleteStep,
  onCompleteTutorial,
  onProgressUpdate,
  allowJumpToStep = true,
  showVideoPlayer = true,
  readOnly = false,
  className = '',
  'data-testid': testId = 'tutorial-stepper',
}) => {
  // 1. Internal state for active step index
  const [internalStepIndex, setInternalStepIndex] = useState<number>(() => {
    if (typeof controlledStepIndex === 'number') {
      return controlledStepIndex;
    }
    return initialStepIndex;
  });

  const currentIndex = useMemo(() => {
    const rawIndex = typeof controlledStepIndex === 'number' ? controlledStepIndex : internalStepIndex;
    if (steps.length === 0) return 0;
    return Math.max(0, Math.min(rawIndex, steps.length - 1));
  }, [controlledStepIndex, internalStepIndex, steps.length]);

  // Sync internal index when controlled index changes
  useEffect(() => {
    if (typeof controlledStepIndex === 'number') {
      setInternalStepIndex(controlledStepIndex);
    }
  }, [controlledStepIndex]);

  // 2. Internal state for completed step numbers (Set of numbers)
  const initialCompletedSet = useMemo(() => {
    const set = new Set<number>();
    if (Array.isArray(completedStepNumbers)) {
      completedStepNumbers.forEach((num) => set.add(num));
    }
    if (progress?.completed_step_numbers && Array.isArray(progress.completed_step_numbers)) {
      progress.completed_step_numbers.forEach((num) => set.add(num));
    }
    return set;
  }, [completedStepNumbers, progress?.completed_step_numbers]);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(initialCompletedSet);

  useEffect(() => {
    setCompletedSteps(initialCompletedSet);
  }, [initialCompletedSet]);

  // Derived metrics
  const totalSteps = steps.length;
  const currentStep = steps[currentIndex] || null;
  const currentStepNum = currentStep ? getStepNumber(currentStep, currentIndex) : currentIndex + 1;
  const isCurrentCompleted = currentStep ? completedSteps.has(currentStepNum) : false;

  const completedCount = useMemo(() => {
    if (totalSteps === 0) return 0;
    let count = 0;
    steps.forEach((step, idx) => {
      const sNum = getStepNumber(step, idx);
      if (completedSteps.has(sNum)) {
        count++;
      }
    });
    return count;
  }, [steps, completedSteps, totalSteps]);

  const completionPercentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isAllCompleted = totalSteps > 0 && completedCount === totalSteps;

  // Step change handler
  const goToStep = useCallback(
    (newIndex: number) => {
      if (totalSteps === 0) return;
      const targetIndex = Math.max(0, Math.min(newIndex, totalSteps - 1));
      if (typeof controlledStepIndex !== 'number') {
        setInternalStepIndex(targetIndex);
      }
      const targetStep = steps[targetIndex];
      if (targetStep) {
        onStepChange?.(targetIndex, targetStep);
      }
    },
    [controlledStepIndex, steps, totalSteps, onStepChange]
  );

  // Toggle single step completion
  const toggleStepCompletion = useCallback(
    (stepNum: number) => {
      if (readOnly) return;
      const willBeCompleted = !completedSteps.has(stepNum);

      setCompletedSteps((prev) => {
        const next = new Set(prev);
        if (willBeCompleted) {
          next.add(stepNum);
        } else {
          next.delete(stepNum);
        }

        // Check overall completion
        if (totalSteps > 0) {
          let count = 0;
          steps.forEach((s, idx) => {
            const sn = getStepNumber(s, idx);
            if (next.has(sn)) count++;
          });
          if (count === totalSteps) {
            onCompleteTutorial?.();
          }
        }
        return next;
      });

      onToggleStepCompletion?.(stepNum, willBeCompleted);
      if (willBeCompleted) {
        onCompleteStep?.(stepNum);
      }

      onProgressUpdate?.({
        resource_id: resourceId || '',
        step_number: stepNum,
        is_completed: willBeCompleted,
      });
    },
    [
      readOnly,
      completedSteps,
      totalSteps,
      steps,
      resourceId,
      onToggleStepCompletion,
      onCompleteStep,
      onCompleteTutorial,
      onProgressUpdate,
    ]
  );

  // Mark all steps as complete
  const markAllComplete = useCallback(() => {
    if (readOnly || totalSteps === 0) return;
    const newSet = new Set<number>();
    steps.forEach((s, idx) => newSet.add(getStepNumber(s, idx)));
    setCompletedSteps(newSet);

    steps.forEach((s, idx) => {
      const sn = getStepNumber(s, idx);
      onToggleStepCompletion?.(sn, true);
      onCompleteStep?.(sn);
    });

    onCompleteTutorial?.();

    onProgressUpdate?.({
      resource_id: resourceId || '',
      is_completed: true,
    });
  }, [readOnly, totalSteps, steps, resourceId, onToggleStepCompletion, onCompleteStep, onCompleteTutorial, onProgressUpdate]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      goToStep(currentIndex - 1);
    }
  }, [currentIndex, goToStep]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalSteps - 1) {
      goToStep(currentIndex + 1);
    } else {
      // On final step, clicking Next triggers tutorial finish callback
      if (currentStep) {
        toggleStepCompletion(currentStepNum);
      }
      onCompleteTutorial?.();
    }
  }, [currentIndex, totalSteps, goToStep, currentStep, currentStepNum, toggleStepCompletion, onCompleteTutorial]);

  // Keyboard navigation for step tablist
  const handleKeyDownStepList = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (!allowJumpToStep) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToStep((index + 1) % totalSteps);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToStep((index - 1 + totalSteps) % totalSteps);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStep(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToStep(totalSteps - 1);
      }
    },
    [allowJumpToStep, goToStep, totalSteps]
  );

  if (totalSteps === 0) {
    return (
      <div
        className={`tutorial-stepper tutorial-stepper-empty ${className}`}
        data-testid={testId}
        style={{
          padding: '32px 24px',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          color: 'var(--color-on-surface-variant, #4e453d)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <p style={{ margin: 0, fontSize: '16px' }}>No tutorial steps available.</p>
      </div>
    );
  }

  return (
    <div
      className={`tutorial-stepper ${className}`}
      data-testid={testId}
      style={{
        backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(115, 92, 65, 0.05)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-on-surface, #1b1c19)',
      }}
    >
      {/* Overall Progress Header Bar */}
      <div
        className="stepper-progress-header"
        style={{
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Tutorial Progress
          </span>
          <span
            data-testid="completion-percentage-text"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: isAllCompleted
                ? 'var(--color-trend-up, #2e6b38)'
                : 'var(--color-primary, #59452b)',
            }}
          >
            {completedCount} of {totalSteps} steps completed ({completionPercentage}%)
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall tutorial completion progress"
          style={{
            height: '8px',
            width: '100%',
            backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
            borderRadius: 'var(--radius-full, 9999px)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${completionPercentage}%`,
              backgroundColor: isAllCompleted
                ? 'var(--color-trend-up, #2e6b38)'
                : 'var(--color-primary, #59452b)',
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>
      </div>

      {/* Stepper Header List / Timeline Nodes */}
      <nav
        aria-label="Tutorial steps navigation"
        className="stepper-navigation"
        style={{
          marginBottom: '28px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        <ol
          role="tablist"
          style={{
            display: 'flex',
            listStyle: 'none',
            margin: 0,
            padding: 0,
            gap: '12px',
          }}
        >
          {steps.map((step, idx) => {
            const stepNum = getStepNumber(step, idx);
            const isCompleted = completedSteps.has(stepNum);
            const isActive = idx === currentIndex;

            return (
              <li key={step.id || `step-${stepNum}`} style={{ flex: '1 1 0', minWidth: '120px' }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${stepNum}: ${step.title}${isCompleted ? ' (Completed)' : ''}`}
                  disabled={!allowJumpToStep && idx !== currentIndex}
                  onClick={() => allowJumpToStep && goToStep(idx)}
                  onKeyDown={(e) => handleKeyDownStepList(e, idx)}
                  data-testid={`step-nav-item-${idx}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    border: isActive
                      ? '2px solid var(--color-primary, #59452b)'
                      : isCompleted
                      ? '1px solid var(--color-trend-up, #2e6b38)'
                      : '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: isActive
                      ? 'var(--color-surface-container-low, #f5f3ee)'
                      : isCompleted
                      ? 'var(--color-trend-up-bg, #e8f5e9)'
                      : 'var(--color-surface-container-lowest, #ffffff)',
                    cursor: allowJumpToStep ? 'pointer' : 'default',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: isCompleted
                          ? 'var(--color-trend-up, #2e6b38)'
                          : isActive
                          ? 'var(--color-primary, #59452b)'
                          : 'var(--color-surface-container-high, #eae8e3)',
                        color: isCompleted || isActive ? '#ffffff' : 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      {isCompleted ? '✓' : stepNum}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isActive
                          ? 'var(--color-primary, #59452b)'
                          : 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      Step {stepNum}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: 'var(--color-on-surface, #1b1c19)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                  >
                    {step.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Active Step Content Area */}
      {currentStep && (
        <section
          aria-labelledby={`step-heading-${currentIndex}`}
          className="active-step-card"
          data-testid="active-step-content"
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-surface-container-high, #eae8e3)',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          {/* Step Meta & Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-primary, #59452b)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Step {currentStepNum} of {totalSteps}
              </span>
              <h3
                id={`step-heading-${currentIndex}`}
                data-testid="current-step-title"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '22px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              >
                {currentStep.title}
              </h3>
            </div>

            {/* Step Completion Toggle */}
            {!readOnly && (
              <label
                data-testid="step-completion-toggle-label"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  backgroundColor: isCurrentCompleted
                    ? 'var(--color-trend-up-bg, #e8f5e9)'
                    : 'var(--color-surface-container-lowest, #ffffff)',
                  border: isCurrentCompleted
                    ? '1px solid var(--color-trend-up, #2e6b38)'
                    : '1px solid var(--color-outline-variant, #d1c4b9)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isCurrentCompleted
                    ? 'var(--color-trend-up, #2e6b38)'
                    : 'var(--color-on-surface, #1b1c19)',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="checkbox"
                  data-testid="step-completion-checkbox"
                  checked={isCurrentCompleted}
                  onChange={() => toggleStepCompletion(currentStepNum)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-trend-up, #2e6b38)',
                    cursor: 'pointer',
                  }}
                />
                <span>{isCurrentCompleted ? 'Completed' : 'Mark step as completed'}</span>
              </label>
            )}
          </div>

          {/* Embedded Video if present */}
          {showVideoPlayer && currentStep.video_url && (
            <div
              className="step-video-wrapper"
              style={{
                marginBottom: '20px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                overflow: 'hidden',
              }}
            >
              <VideoPlayer
                mediaUrl={currentStep.video_url}
                title={`Video guide for ${currentStep.title}`}
                data-testid="step-video-player"
              />
            </div>
          )}

          {/* Step Body Content */}
          {currentStep.content && (
            <div
              className="step-content-body"
              data-testid="current-step-body"
              style={{
                fontSize: '15px',
                lineHeight: '1.6',
                color: 'var(--color-on-surface, #1b1c19)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {currentStep.content}
            </div>
          )}
        </section>
      )}

      {/* Footer Controls: Previous, Next, Mark All Complete */}
      <footer
        className="stepper-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
        }}
      >
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          data-testid="prev-step-button"
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            color: 'var(--color-on-surface, #1b1c19)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          ← Previous Step
        </button>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!readOnly && !isAllCompleted && (
            <button
              type="button"
              onClick={markAllComplete}
              data-testid="mark-all-complete-button"
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'transparent',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Mark All Complete
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            data-testid="next-step-button"
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-default, 0.25rem)',
              border: 'none',
              backgroundColor:
                currentIndex === totalSteps - 1
                  ? 'var(--color-trend-up, #2e6b38)'
                  : 'var(--color-primary, #59452b)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
            }}
          >
            {currentIndex === totalSteps - 1 ? 'Finish Tutorial ✓' : 'Next Step →'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default TutorialStepper;
