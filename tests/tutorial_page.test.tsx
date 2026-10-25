import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InteractiveTutorialPage, {
  TutorialContent,
} from '../src/app/knowledge-base/tutorial/[id]/page';
import { KBResourceDetail, KBUserProgress, KBBookmark } from '../src/services/kb_client';
import { CurrentUserResponse } from '../src/services/auth';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/knowledge-base/tutorial/res-tut-1',
}));

describe('InteractiveTutorialPage Component', () => {
  const mockUser: CurrentUserResponse = {
    id: 'user-123',
    email: 'testuser@example.com',
    full_name: 'Test User',
    tenant_id: 'tenant-456',
  };

  const mockProgress: KBUserProgress = {
    resource_id: 'res-tut-1',
    user_id: 'user-123',
    is_completed: false,
    completed_step_numbers: [1],
    total_steps: 3,
    completion_percentage: 33,
    last_accessed_on: '2026-03-30T10:00:00Z',
  };

  const mockResourceDetail: KBResourceDetail = {
    id: 'res-tut-1',
    category_id: 'cat-onboarding',
    category_title: 'Platform Onboarding',
    title: 'Interactive Account Setup Walkthrough',
    slug: 'account-setup-walkthrough',
    content_type: 'TUTORIAL',
    body_text: 'Complete overview text for setting up your enterprise account and configuring initial user roles.',
    media_url: 'https://example.com/videos/setup-walkthrough.mp4',
    media_embed: {
      original_input: 'https://example.com/videos/setup-walkthrough.mp4',
      provider: 'direct',
      video_id: 'setup-walkthrough',
      embed_url: 'https://example.com/videos/setup-walkthrough.mp4',
      has_controls: true,
      allow_fullscreen: true,
      aspect_ratio: '16:9',
      sanitized_iframe: '<iframe src="https://example.com/videos/setup-walkthrough.mp4"></iframe>',
      title: 'Interactive Account Setup Walkthrough',
    },
    tags: ['onboarding', 'tutorial', 'setup'],
    onboarding_phase: 'phase_1',
    required_role: null,
    min_subscription_tier: null,
    published_on: '2026-03-30T10:00:00Z',
    highlights: [],
    breadcrumbs: [
      { id: 'cat-onboarding', title: 'Platform Onboarding', slug: 'platform-onboarding' },
    ],
    tutorial_steps: [
      {
        id: 'step-1',
        resource_id: 'res-tut-1',
        step_number: 1,
        title: 'Step 1: Invite Workspace Administrators',
        content: 'Navigate to Admin -> Team settings and invite your core leadership team.',
        video_url: null,
      },
      {
        id: 'step-2',
        resource_id: 'res-tut-1',
        step_number: 2,
        title: 'Step 2: Configure Single Sign-On (SSO)',
        content: 'Enter SAML 2.0 metadata URL and configure identity provider mapping.',
        video_url: null,
      },
      {
        id: 'step-3',
        resource_id: 'res-tut-1',
        step_number: 3,
        title: 'Step 3: Verify Security & Audit Policies',
        content: 'Set password expiration policies and review administrative action logs.',
        video_url: null,
      },
    ],
    is_bookmarked: false,
    progress: mockProgress,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TutorialContent Component Rendering', () => {
    it('renders tutorial title, content type badge, breadcrumbs, progress bar, and stepper [FR-5, FR-6, FR-9]', () => {
      render(
        <TutorialContent
          id="res-tut-1"
          user={mockUser}
          initialResource={mockResourceDetail}
          autoFetch={false}
        />
      );

      // Main container
      expect(screen.getByTestId('kb-tutorial-page')).toBeInTheDocument();

      // Title & Badges
      expect(screen.getByText('Interactive Account Setup Walkthrough')).toBeInTheDocument();
      expect(screen.getByText('TUTORIAL')).toBeInTheDocument();
      expect(screen.getByText('Platform Onboarding')).toBeInTheDocument();

      // Breadcrumb Trail
      expect(screen.getByTestId('kb-breadcrumbs')).toBeInTheDocument();

      // Progress Tracker Overview [FR-9]
      expect(screen.getByTestId('tutorial-progress')).toBeInTheDocument();
      expect(screen.getByText('33% Complete')).toBeInTheDocument();

      // Video Player Section [FR-6]
      expect(screen.getByTestId('kb-video-player')).toBeInTheDocument();

      // Tutorial Stepper Navigation [FR-5]
      expect(screen.getByTestId('tutorial-stepper')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Invite Workspace Administrators')).toBeInTheDocument();
    });

    it('renders bookmark button with correct initial unbookmarked state [FR-8]', () => {
      render(
        <TutorialContent
          id="res-tut-1"
          user={mockUser}
          initialResource={mockResourceDetail}
          autoFetch={false}
        />
      );

      const bookmarkBtn = screen.getByTestId('bookmark-button');
      expect(bookmarkBtn).toBeInTheDocument();
      expect(bookmarkBtn).toHaveTextContent('Add Bookmark');
      expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders bookmarked state when resource is initialised as bookmarked [FR-8]', () => {
      const bookmarkedResource = {
        ...mockResourceDetail,
        is_bookmarked: true,
      };

      render(
        <TutorialContent
          id="res-tut-1"
          user={mockUser}
          initialResource={bookmarkedResource}
          autoFetch={false}
        />
      );

      const bookmarkBtn = screen.getByTestId('bookmark-button');
      expect(bookmarkBtn).toHaveTextContent('Bookmarked');
      expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('User Interactivity & API Callbacks', () => {
    it('toggles bookmark state when clicking bookmark button [FR-8]', async () => {
      const mockCreateBookmark = vi.fn().mockResolvedValue({
        id: 'bm-1',
        user_id: 'user-123',
        resource_id: 'res-tut-1',
      } as KBBookmark);

      const mockDeleteBookmark = vi.fn().mockResolvedValue(undefined);
      const onBookmarkToggle = vi.fn();

      render(
        <TutorialContent
          id="res-tut-1"
          user={mockUser}
          initialResource={mockResourceDetail}
          createBookmark={mockCreateBookmark}
          deleteBookmark={mockDeleteBookmark}
          onBookmarkToggle={onBookmarkToggle}
          autoFetch={false}
        />
      );

      const bookmarkBtn = screen.getByTestId('bookmark-button');
      expect(bookmarkBtn).toHaveTextContent('Add Bookmark');

      // Click to add bookmark
      fireEvent.click(bookmarkBtn);

      await waitFor(() => {
        expect(mockCreateBookmark).toHaveBeenCalledWith(
          { resource_id: 'res-tut-1' },
          { user_role: undefined, subscription_tier: undefined }
        );
        expect(bookmarkBtn).toHaveTextContent('Bookmarked');
        expect(onBookmarkToggle).toHaveBeenCalledWith(true);
      });

      // Click again to remove bookmark
      fireEvent.click(bookmarkBtn);

      await waitFor(() => {
        expect(mockDeleteBookmark).toHaveBeenCalledWith('res-tut-1');
        expect(bookmarkBtn).toHaveTextContent('Add Bookmark');
        expect(onBookmarkToggle).toHaveBeenCalledWith(false);
      });
    });

    it('tracks progress when step completion or step navigation occurs [FR-5, FR-9]', async () => {
      const mockTrackProgress = vi.fn().mockResolvedValue({
        resource_id: 'res-tut-1',
        user_id: 'user-123',
        is_completed: false,
        completed_step_numbers: [1, 2],
        total_steps: 3,
        completion_percentage: 67,
      } as KBUserProgress);

      const onProgressUpdate = vi.fn();

      render(
        <TutorialContent
          id="res-tut-1"
          user={mockUser}
          initialResource={mockResourceDetail}
          trackProgress={mockTrackProgress}
          onProgressUpdate={onProgressUpdate}
          autoFetch={false}
        />
      );

      // Find the Next step button inside tutorial stepper
      const nextBtn = screen.getByTestId('stepper-btn-next');
      expect(nextBtn).toBeInTheDocument();

      fireEvent.click(nextBtn);

      // Stepper changes step to Step 2
      await waitFor(() => {
        expect(screen.getByText('Step 2: Configure Single Sign-On (SSO)')).toBeInTheDocument();
      });
    });

    it('displays loading spinner when fetching resource detail', () => {
      render(
        <TutorialContent
          id="res-tut-1"
          user={mockUser}
          initialResource={null}
          autoFetch={true}
          fetchResourceDetail={() => new Promise(() => {})} // never resolves
        />
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading tutorial content...')).toBeInTheDocument();
    });

    it('renders error message box when fetch fails', async () => {
      const mockFetchFail = vi.fn().mockRejectedValue(new Error('Resource not found or unauthorized access'));

      render(
        <TutorialContent
          id="res-tut-1"
          user={mockUser}
          initialResource={null}
          autoFetch={true}
          fetchResourceDetail={mockFetchFail}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText('Resource not found or unauthorized access')).toBeInTheDocument();
      });
    });
  });

  describe('Default Export InteractiveTutorialPage', () => {
    it('renders root page wrapped with ProtectedRoute', () => {
      render(
        <InteractiveTutorialPage
          id="res-tut-1"
          user={mockUser}
          initialResource={mockResourceDetail}
          autoFetch={false}
        />
      );

      expect(screen.getByTestId('kb-tutorial-page')).toBeInTheDocument();
    });
  });
});
