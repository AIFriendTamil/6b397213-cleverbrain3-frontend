import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  TutorialStepper,
  getStepNumber,
} from '../../src/components/kb/TutorialStepper';
import { KBTutorialStep, KBUserProgress } from '../../src/services/kb_client';

describe('getStepNumber Utility', () => {
  it('returns step_number when step.step_number is valid > 0', () => {
    const step: KBTutorialStep = {
      id: 'step-1',
      resource_id: 'res-1',
      step_number: 5,
      title: 'Advanced Settings',
    };
    expect(getStepNumber(step, 0)).toBe(5);
  });

  it('falls back to index + 1 when step_number is zero or missing', () => {
    const stepMissing: KBTutorialStep = {
      id: 'step-2',
      resource_id: 'res-1',
      step_number: 0,
      title: 'Fallback Step',
    };
    expect(getStepNumber(stepMissing, 2)).toBe(3);
  });
});

describe('TutorialStepper Component', () => {
  const sampleSteps: KBTutorialStep[] = [
    {
      id: 'step-1',
      resource_id: 'res-101',
      step_number: 1,
      title: 'Welcome & Account Overview',
      content: 'Learn how to navigate your main onboarding dashboard.',
    },
    {
      id: 'step-2',
      resource_id: 'res-101',
      step_number: 2,
      title: 'Configuring Team Roles',
      content: 'Assign permissions and roles to team members.',
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    {
      id: 'step-3',
      resource_id: 'res-101',
      step_number: 3,
      title: 'Launching First Campaign',
      content: 'Create and publish your initial workflow campaign.',
    },
  ];

  it('renders empty state when steps array is empty', () => {
    render(<TutorialStepper steps={[]} data-testid="empty-stepper" />);

    const container = screen.getByTestId('empty-stepper');
    expect(container).toBeDefined();
    expect(screen.getByText('No tutorial steps available.')).toBeDefined();
  });

  it('renders progress header and active step 1 by default', () => {
    render(
      <TutorialStepper
        steps={sampleSteps}
        resourceId="res-101"
        data-testid="tutorial-stepper"
      />
    );

    expect(screen.getByTestId('tutorial-stepper')).toBeDefined();
    expect(screen.getByText(/0 of 3 steps completed \(0%\)/)).toBeDefined();

    expect(screen.getByTestId('current-step-title').textContent).toBe(
      'Welcome & Account Overview'
    );
    expect(screen.getByTestId('current-step-body').textContent).toBe(
      'Learn how to navigate your main onboarding dashboard.'
    );

    const prevBtn = screen.getByTestId('prev-step-button') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);

    const nextBtn = screen.getByTestId('next-step-button');
    expect(nextBtn.textContent).toBe('Next Step →');
  });

  it('navigates sequentially using Next and Previous buttons', () => {
    const handleStepChange = vi.fn();

    render(
      <TutorialStepper
        steps={sampleSteps}
        onStepChange={handleStepChange}
      />
    );

    const nextBtn = screen.getByTestId('next-step-button');
    const prevBtn = screen.getByTestId('prev-step-button') as HTMLButtonElement;

    // Click Next -> Step 2
    fireEvent.click(nextBtn);
    expect(handleStepChange).toHaveBeenCalledWith(1, sampleSteps[1]);
    expect(screen.getByTestId('current-step-title').textContent).toBe(
      'Configuring Team Roles'
    );
    expect(prevBtn.disabled).toBe(false);

    // Click Next -> Step 3 (Final step)
    fireEvent.click(nextBtn);
    expect(handleStepChange).toHaveBeenCalledWith(2, sampleSteps[2]);
    expect(screen.getByTestId('current-step-title').textContent).toBe(
      'Launching First Campaign'
    );
    expect(nextBtn.textContent).toBe('Finish Tutorial ✓');

    // Click Previous -> Step 2
    fireEvent.click(prevBtn);
    expect(handleStepChange).toHaveBeenCalledWith(1, sampleSteps[1]);
    expect(screen.getByTestId('current-step-title').textContent).toBe(
      'Configuring Team Roles'
    );
  });

  it('allows direct step jumping when allowJumpToStep is true', () => {
    const handleStepChange = vi.fn();

    render(
      <TutorialStepper
        steps={sampleSteps}
        allowJumpToStep={true}
        onStepChange={handleStepChange}
      />
    );

    const step3NavItem = screen.getByTestId('step-nav-item-2');
    fireEvent.click(step3NavItem);

    expect(handleStepChange).toHaveBeenCalledWith(2, sampleSteps[2]);
    expect(screen.getByTestId('current-step-title').textContent).toBe(
      'Launching First Campaign'
    );
  });

  it('prevents direct step jumping when allowJumpToStep is false', () => {
    const handleStepChange = vi.fn();

    render(
      <TutorialStepper
        steps={sampleSteps}
        allowJumpToStep={false}
        onStepChange={handleStepChange}
      />
    );

    const step3NavItem = screen.getByTestId('step-nav-item-2');
    fireEvent.click(step3NavItem);

    expect(handleStepChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('current-step-title').textContent).toBe(
      'Welcome & Account Overview'
    );
  });

  it('toggles step completion state and triggers callbacks', () => {
    const handleToggle = vi.fn();
    const handleCompleteStep = vi.fn();
    const handleProgressUpdate = vi.fn();

    render(
      <TutorialStepper
        steps={sampleSteps}
        resourceId="res-101"
        onToggleStepCompletion={handleToggle}
        onCompleteStep={handleCompleteStep}
        onProgressUpdate={handleProgressUpdate}
      />
    );

    const checkbox = screen.getByTestId('step-completion-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Mark step 1 completed
    fireEvent.click(checkbox);

    expect(handleToggle).toHaveBeenCalledWith(1, true);
    expect(handleCompleteStep).toHaveBeenCalledWith(1);
    expect(handleProgressUpdate).toHaveBeenCalledWith({
      resource_id: 'res-101',
      step_number: 1,
      is_completed: true,
    });

    expect(screen.getByText(/1 of 3 steps completed \(33%\)/)).toBeDefined();

    // Toggle back to incomplete
    fireEvent.click(checkbox);
    expect(handleToggle).toHaveBeenCalledWith(1, false);
    expect(screen.getByText(/0 of 3 steps completed \(0%\)/)).toBeDefined();
  });

  it('initializes with pre-completed steps from completedStepNumbers prop', () => {
    render(
      <TutorialStepper
        steps={sampleSteps}
        completedStepNumbers={[1, 2]}
      />
    );

    expect(screen.getByText(/2 of 3 steps completed \(67%\)/)).toBeDefined();
    const checkbox = screen.getByTestId('step-completion-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('initializes with pre-completed steps from progress object prop', () => {
    const initialProgress: KBUserProgress = {
      resource_id: 'res-101',
      user_id: 'user-77',
      is_completed: false,
      completed_step_numbers: [1],
      total_steps: 3,
      completion_percentage: 33,
    };

    render(
      <TutorialStepper
        steps={sampleSteps}
        progress={initialProgress}
      />
    );

    expect(screen.getByText(/1 of 3 steps completed \(33%\)/)).toBeDefined();
  });

  it('marks all steps complete when Mark All Complete button is clicked', () => {
    const handleCompleteTutorial = vi.fn();

    render(
      <TutorialStepper
        steps={sampleSteps}
        onCompleteTutorial={handleCompleteTutorial}
      />
    );

    const markAllBtn = screen.getByTestId('mark-all-complete-button');
    fireEvent.click(markAllBtn);

    expect(screen.getByText(/3 of 3 steps completed \(100%\)/)).toBeDefined();
    expect(handleCompleteTutorial).toHaveBeenCalled();
  });

  it('triggers onCompleteTutorial when finishing final step', () => {
    const handleCompleteTutorial = vi.fn();

    render(
      <TutorialStepper
        steps={sampleSteps}
        initialStepIndex={2}
        onCompleteTutorial={handleCompleteTutorial}
      />
    );

    const finishBtn = screen.getByTestId('next-step-button');
    expect(finishBtn.textContent).toBe('Finish Tutorial ✓');

    fireEvent.click(finishBtn);
    expect(handleCompleteTutorial).toHaveBeenCalled();
  });

  it('renders VideoPlayer on steps containing video_url when showVideoPlayer is true', () => {
    render(
      <TutorialStepper
        steps={sampleSteps}
        initialStepIndex={1}
        showVideoPlayer={true}
      />
    );

    expect(screen.getByTestId('step-video-player')).toBeDefined();
  });

  it('hides VideoPlayer when showVideoPlayer is false', () => {
    render(
      <TutorialStepper
        steps={sampleSteps}
        initialStepIndex={1}
        showVideoPlayer={false}
      />
    );

    expect(screen.queryByTestId('step-video-player')).toBeNull();
  });

  it('hides completion toggles and Mark All Complete in readOnly mode', () => {
    render(
      <TutorialStepper
        steps={sampleSteps}
        readOnly={true}
      />
    );

    expect(screen.queryByTestId('step-completion-checkbox')).toBeNull();
    expect(screen.queryByTestId('mark-all-complete-button')).toBeNull();
  });
});
