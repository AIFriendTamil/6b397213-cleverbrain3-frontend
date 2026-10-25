'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute, useAuth } from '../../../../components/protected_route';
import { NavMenu } from '../../../../components/nav_menu';
import { Breadcrumbs, BreadcrumbItem } from '../../../../components/kb/Breadcrumbs';
import { TutorialStepper } from '../../../../components/kb/TutorialStepper';
import { VideoPlayer } from '../../../../components/kb/VideoPlayer';
import { getContentTypeBadgeConfig } from '../../../../components/kb/SearchBar';
import { CurrentUserResponse } from '../../../../services/auth';
import {
  kbService,
  KBResourceDetail,
  KBUserProgress,
  KBProgressUpdate,
  KBBookmarkCreate,
  KBRequestRoleOptions,
  KBBookmark,
} from '../../../../services/kb_client';

/**
 * Component properties for Interactive Tutorial Page.
 */
export interface TutorialPageProps {
  /** Next.js App Router dynamic route params object or promise containing tutorial id */
  params?: { id: string } | Promise<{ id: string }>;
  /** Explicit tutorial / resource ID override */
  id?: string;
  /** Explicit tutorial ID alias */
  tutorialId?: string;
  /** Explicit resource ID alias */
  resourceId?: string;
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded resource detail payload for SSR or test injection */
  initialResource?: KBResourceDetail | null;
  /** User role override header for RBAC filtering */
  userRole?: string;
  /** Subscription tier override header for RBAC filtering */
  subscriptionTier?: string;
  /** Custom resource detail fetcher function for test injection */
  fetchResourceDetail?: (
    id: string,
    params?: KBRequestRoleOptions
  ) => Promise<KBResourceDetail>;
  /** Custom bookmark creation handler for test injection */
  createBookmark?: (
    payload: KBBookmarkCreate | string,
    params?: KBRequestRoleOptions
  ) => Promise<KBBookmark>;
  /** Custom bookmark deletion handler for test injection */
  deleteBookmark?: (resourceId: string) => Promise<void>;
  /** Custom progress tracking handler for test injection */
  trackProgress?: (
    payload: KBProgressUpdate,
    params?: KBRequestRoleOptions
  ) => Promise<KBUserProgress>;
  /** Callback fired when bookmark state is toggled */
  onBookmarkToggle?: (isBookmarked: boolean) => void;
  /** Callback fired when user progress is updated */
  onProgressUpdate?: (update: KBProgressUpdate) => void;
  /** Whether component auto-fetches resource detail on mount (default: true) */
  autoFetch?: boolean;
  /** Custom CSS class name for outer container */
  className?: string;
  /** Data-testid attribute for testing (default: 'kb-tutorial-page') */
  'data-testid'?: string;
}

/**
 * Helper to format ISO date string into human-readable editorial date format.
 */
function formatDate(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) return isoString;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Inner Interactive Tutorial Content component consuming active user session context.
 * Renders workflow tutorials with step-by-step stepper navigation (FR-5),
 * embedded inline video player controls (FR-6), resource bookmarking toggles (FR-8),
 * and persistent per-user progress tracking (FR-9).
 * Styled following the Linen & Logic editorial design system.
 */
function _TutorialContent({
  params,
  id: explicitId,
  tutorialId: explicitTutorialId,
  resourceId: explicitResourceId,
  user: explicitUser,
  onLogout,
  initialResource = null,
  userRole,
  subscriptionTier,
  fetchResourceDetail: customFetchResourceDetail,
  createBookmark: customCreateBookmark,
  deleteBookmark: customDeleteBookmark,
  trackProgress: customTrackProgress,
  onBookmarkToggle,
  onProgressUpdate,
  autoFetch = true,
  className = '',
  'data-testid': testId = 'kb-tutorial-page',
}: TutorialPageProps): React.ReactElement | null {
  const router = useRouter();
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth?.user;

  // 1. Target resource ID resolution
  const [resolvedId, setResolvedId] = useState<string>(() => {
    if (explicitId) return explicitId;
    if (explicitTutorialId) return explicitTutorialId;
    if (explicitResourceId) return explicitResourceId;
    if (params && 'id' in params && typeof (params as any).id === 'string') {
      return (params as any).id;
    }
    return '';
  });

  useEffect(() => {
    if (explicitId) {
      setResolvedId(explicitId);
    } else if (explicitTutorialId) {
      setResolvedId(explicitTutorialId);
    } else if (explicitResourceId) {
      setResolvedId(explicitResourceId);
    } else if (params) {
      if (typeof (params as any).then === 'function') {
        (params as Promise<{ id: string }>).then((res) => {
          if (res?.id) setResolvedId(res.id);
        });
      } else if ('id' in params && typeof (params as any).id === 'string') {
        setResolvedId((params as any).id);
      }
    }
  }, [explicitId, explicitTutorialId, explicitResourceId, params]);

  // 2. Resource detail & UI State
  const [resource, setResource] = useState<KBResourceDetail | null>(initialResource);
  const [isLoading, setIsLoading] = useState<boolean>(!initialResource && autoFetch);
  const [error, setError] = useState<string | null>(null);

  // 3. Bookmark State [FR-8]
  const [isBookmarked, setIsBookmarked] = useState<boolean>(initialResource?.is_bookmarked ?? false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState<boolean>(false);

  // 4. Progress State [FR-9]
  const [progress, setProgress] = useState<KBUserProgress | null>(initialResource?.progress || null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Sync state if initialResource changes
  useEffect(() => {
    if (initialResource) {
      setResource(initialResource);
      setIsBookmarked(!!initialResource.is_bookmarked);
      setProgress(initialResource.progress || null);
      setIsLoading(false);
    }
  }, [initialResource]);

  // 5. Load Tutorial Resource Details
  const loadResourceDetail = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setIsLoading(true);
      setError(null);

      const requestRoleOpts: KBRequestRoleOptions = {
        user_role: userRole,
        subscription_tier: subscriptionTier,
      };

      const data = customFetchResourceDetail
        ? await customFetchResourceDetail(resolvedId, requestRoleOpts)
        : await kbService.getResourceDetail(resolvedId, requestRoleOpts);

      setResource(data);
      setIsBookmarked(!!data.is_bookmarked);
      setProgress(data.progress || null);
    } catch (err: any) {
      console.error('Failed to load tutorial resource detail:', err);
      const errMsg =
        err?.message ||
        'Failed to load tutorial resource details. Please try again.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedId, userRole, subscriptionTier, customFetchResourceDetail]);

  useEffect(() => {
    if (autoFetch && resolvedId && !initialResource) {
      loadResourceDetail();
    }
  }, [autoFetch, resolvedId, initialResource, loadResourceDetail]);

  // 6. Toggle Bookmark Handler [FR-8]
  const handleToggleBookmark = useCallback(async () => {
    const targetId = resource?.id || resolvedId;
    if (!targetId || isBookmarkLoading) return;

    try {
      setIsBookmarkLoading(true);
      const nextState = !isBookmarked;

      const requestRoleOpts: KBRequestRoleOptions = {
        user_role: userRole,
        subscription_tier: subscriptionTier,
      };

      if (nextState) {
        if (customCreateBookmark) {
          await customCreateBookmark({ resource_id: targetId }, requestRoleOpts);
        } else {
          await kbService.createBookmark({ resource_id: targetId }, requestRoleOpts);
        }
      } else {
        if (customDeleteBookmark) {
          await customDeleteBookmark(targetId);
        } else {
          await kbService.deleteBookmark(targetId);
        }
      }

      setIsBookmarked(nextState);
      if (resource) {
        setResource({ ...resource, is_bookmarked: nextState });
      }
      onBookmarkToggle?.(nextState);
    } catch (err: any) {
      console.error('Failed to toggle bookmark:', err);
    } finally {
      setIsBookmarkLoading(false);
    }
  }, [
    resource,
    resolvedId,
    isBookmarked,
    isBookmarkLoading,
    userRole,
    subscriptionTier,
    customCreateBookmark,
    customDeleteBookmark,
    onBookmarkToggle,
  ]);

  // 7. Track User Progress Handler [FR-9]
  const handleProgressUpdate = useCallback(
    async (update: KBProgressUpdate) => {
      const targetId = update.resource_id || resource?.id || resolvedId;
      if (!targetId) return;

      const payload: KBProgressUpdate = {
        ...update,
        resource_id: targetId,
      };

      try {
        const requestRoleOpts: KBRequestRoleOptions = {
          user_role: userRole,
          subscription_tier: subscriptionTier,
        };

        const updatedProgress = customTrackProgress
          ? await customTrackProgress(payload, requestRoleOpts)
          : await kbService.trackProgress(payload, requestRoleOpts);

        setProgress(updatedProgress);
        if (resource) {
          setResource((prev) => (prev ? { ...prev, progress: updatedProgress } : null));
        }
        onProgressUpdate?.(payload);
      } catch (err: any) {
        console.error('Failed to track progress:', err);
      }
    },
    [resource, resolvedId, userRole, subscriptionTier, customTrackProgress, onProgressUpdate]
  );

  // 8. Complete Tutorial Handler [FR-5, FR-9]
  const handleCompleteTutorial = useCallback(() => {
    const targetId = resource?.id || resolvedId;
    if (!targetId) return;

    handleProgressUpdate({
      resource_id: targetId,
      is_completed: true,
    });
  }, [resource, resolvedId, handleProgressUpdate]);

  // Derived content type badge styling
  const contentTypeBadge = useMemo(() => {
    return getContentTypeBadgeConfig(resource?.content_type || 'TUTORIAL');
  }, [resource?.content_type]);

  // Derived current video source URL or embed
  const currentStep = useMemo(() => {
    if (!resource?.tutorial_steps || resource.tutorial_steps.length === 0) return null;
    return resource.tutorial_steps[activeStepIndex] || resource.tutorial_steps[0] || null;
  }, [resource?.tutorial_steps, activeStepIndex]);

  const activeVideoUrl = currentStep?.video_url || resource?.media_url || resource?.body_text || undefined;
  const activeVideoEmbed = resource?.media_embed || null;
  const hasVideoContent = !!(activeVideoEmbed || activeVideoUrl || resource?.content_type === 'VIDEO');

  // Breadcrumbs list items
  const breadcrumbsList = useMemo(() => {
    if (resource?.breadcrumbs && resource.breadcrumbs.length > 0) {
      return resource.breadcrumbs;
    }
    const items: BreadcrumbItem[] = [];
    if (resource?.category_title && resource?.category_id) {
      items.push({
        id: resource.category_id,
        title: resource.category_title,
        href: `/knowledge-base/category/${resource.category_id}`,
        isCategory: true,
      });
    }
    return items;
  }, [resource?.breadcrumbs, resource?.category_title, resource?.category_id]);

  return (
    <div
      className={`tutorial-page-container ${className}`}
      data-testid={testId}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top Header Navigation */}
      <NavMenu activePath="/knowledge-base" user={user} onLogout={onLogout} />

      {/* Main Content Viewport */}
      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px 20px 64px 20px',
        }}
      >
        {/* Breadcrumb Navigation Trail [FR-010] */}
        <div style={{ marginBottom: '24px' }}>
          <Breadcrumbs
            items={breadcrumbsList}
            currentTitle={resource?.title || 'Tutorial'}
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            data-testid="loading-spinner"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 24px',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              margin: '24px 0',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--color-surface-container-high, #eae8e3)',
                borderTopColor: 'var(--color-primary, #59452b)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p
              style={{
                marginTop: '16px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '15px',
              }}
            >
              Loading tutorial content...
            </p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Error Fallback Box */}
        {error && !isLoading && (
          <div
            data-testid="error-message"
            style={{
              padding: '24px',
              backgroundColor: 'var(--color-error-container, #ffdad6)',
              color: 'var(--color-on-error-container, #93000a)',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              border: '1px solid var(--color-error, #ba1a1a)',
              marginBottom: '32px',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '20px',
                marginTop: 0,
                marginBottom: '8px',
              }}
            >
              Unable to load tutorial
            </h2>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5' }}>{error}</p>
            <button
              onClick={loadResourceDetail}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: 'var(--color-secondary, #a43b2c)',
                color: 'var(--color-on-secondary, #ffffff)',
                border: 'none',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              Retry Loading
            </button>
          </div>
        )}

        {/* Loaded Resource Content View */}
        {!isLoading && !error && resource && (
          <div>
            {/* Header Resource Meta Card */}
            <div
              className="tutorial-header-card"
              style={{
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                borderRadius: 'var(--radius-lg, 0.5rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                padding: '32px 28px',
                marginBottom: '32px',
                boxShadow: '0 4px 20px rgba(115, 92, 65, 0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                {/* Content Type & Category Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      fontSize: '12px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      backgroundColor: contentTypeBadge.bg,
                      color: contentTypeBadge.color,
                    }}
                  >
                    {resource.content_type}
                  </span>

                  {resource.category_title && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        fontSize: '12px',
                        fontWeight: 500,
                        backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      }}
                    >
                      {resource.category_title}
                    </span>
                  )}

                  {resource.onboarding_phase && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        fontSize: '12px',
                        fontWeight: 500,
                        backgroundColor: 'var(--color-tertiary-fixed-dim, #b4c8e2)',
                        color: 'var(--color-on-tertiary-fixed, #071d30)',
                      }}
                    >
                      {resource.onboarding_phase.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Bookmark Toggle Control [FR-8] */}
                <button
                  type="button"
                  data-testid="bookmark-button"
                  onClick={handleToggleBookmark}
                  disabled={isBookmarkLoading}
                  aria-pressed={isBookmarked}
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    backgroundColor: isBookmarked
                      ? 'var(--color-primary-container, #735c41)'
                      : 'var(--color-surface-container-low, #f5f3ee)',
                    color: isBookmarked
                      ? 'var(--color-on-primary, #ffffff)'
                      : 'var(--color-primary, #59452b)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    cursor: isBookmarkLoading ? 'wait' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={isBookmarked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{isBookmarked ? 'Bookmarked' : 'Add Bookmark'}</span>
                </button>
              </div>

              {/* Title Header */}
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  lineHeight: '1.2',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-on-surface, #1b1c19)',
                  marginTop: 0,
                  marginBottom: '12px',
                }}
              >
                {resource.title}
              </h1>

              {/* Published Date & Author Meta */}
              {resource.published_on && (
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    margin: 0,
                    marginBottom: '20px',
                  }}
                >
                  Published on {formatDate(resource.published_on)}
                </p>
              )}

              {/* Resource User Progress Overview Bar [FR-9] */}
              <div
                data-testid="tutorial-progress"
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      marginBottom: '6px',
                    }}
                  >
                    <span>Your Learning Progress</span>
                    <span>{progress?.completion_percentage || 0}% Complete</span>
                  </div>
                  {/* Visual Progress Bar */}
                  <div
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
                        width: `${progress?.completion_percentage || 0}%`,
                        backgroundColor: progress?.is_completed
                          ? 'var(--color-trend-up, #2e6b38)'
                          : 'var(--color-primary, #59452b)',
                        borderRadius: 'var(--radius-full, 9999px)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Completion Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {progress?.is_completed ? (
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
                        color: 'var(--color-trend-up, #2e6b38)',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Completed
                    </span>
                  ) : (progress?.completed_step_numbers?.length || 0) > 0 ? (
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: 'var(--color-on-primary-container, #f5d6b4)',
                        color: 'var(--color-primary, #59452b)',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      In Progress ({progress?.completed_step_numbers?.length || 0} /{' '}
                      {progress?.total_steps || resource.tutorial_steps?.length || 1} steps)
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      Not Started
                    </span>
                  )}
                </div>
              </div>

              {/* Tag Chips */}
              {resource.tags && resource.tags.length > 0 && (
                <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {resource.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Embedded Inline Video Streaming Section [FR-6] */}
            {hasVideoContent && (
              <div
                className="tutorial-video-section"
                style={{
                  marginBottom: '32px',
                }}
              >
                <VideoPlayer
                  videoEmbed={activeVideoEmbed}
                  mediaUrl={activeVideoUrl}
                  src={activeVideoUrl}
                  title={resource.title}
                  onStepComplete={() => {
                    handleProgressUpdate({
                      resource_id: resource.id,
                      is_completed: true,
                    });
                  }}
                  onEnded={() => {
                    handleProgressUpdate({
                      resource_id: resource.id,
                      is_completed: true,
                    });
                  }}
                />
              </div>
            )}

            {/* Interactive Step-by-Step Tutorial Stepper Section [FR-5, FR-9] */}
            <div
              className="tutorial-stepper-section"
              style={{
                marginBottom: '32px',
              }}
            >
              <TutorialStepper
                steps={resource.tutorial_steps || []}
                resourceId={resource.id}
                activeStepIndex={activeStepIndex}
                progress={progress}
                completedStepNumbers={progress?.completed_step_numbers}
                onStepChange={(stepIndex) => setActiveStepIndex(stepIndex)}
                onProgressUpdate={handleProgressUpdate}
                onCompleteTutorial={handleCompleteTutorial}
                showVideoPlayer={!hasVideoContent}
              />
            </div>

            {/* Resource Overview / Additional Documentation Section */}
            {resource.body_text && (
              <div
                className="tutorial-body-card"
                style={{
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  borderRadius: 'var(--radius-lg, 0.5rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '32px',
                  boxShadow: '0 4px 20px rgba(115, 92, 65, 0.05)',
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '22px',
                    fontWeight: 400,
                    marginTop: 0,
                    marginBottom: '16px',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  Overview & Additional Guidance
                </h2>
                <div
                  style={{
                    color: 'var(--color-on-surface, #1b1c19)',
                    fontSize: '16px',
                    lineHeight: '1.7',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {resource.body_text}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Interactive Tutorial Page root component wrapped with session protection.
 */
export default function InteractiveTutorialPage(props: any = {}): React.ReactElement {
  return (
    <ProtectedRoute fetchUser={props?.fetchUser}>
      <_TutorialContent {...props} />
    </ProtectedRoute>
  );
}
