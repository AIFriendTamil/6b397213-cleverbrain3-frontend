'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute, useAuth } from '../../../../components/protected_route';
import { NavMenu } from '../../../../components/nav_menu';
import {
  SearchBar,
  SearchState,
  HighlightText,
  getContentTypeBadgeConfig,
} from '../../../../components/kb/SearchBar';
import { Breadcrumbs, BreadcrumbItem } from '../../../../components/kb/Breadcrumbs';
import { CurrentUserResponse } from '../../../../services/auth';
import {
  kbService,
  KBCategoryNode,
  KBResourceSummary,
  KBSearchParams,
  PaginatedKBResourcesResponse,
  KBContentType,
} from '../../../../services/kb_client';

/**
 * Interface representing a category node and its ancestor chain for breadcrumbs.
 */
export interface CategoryWithAncestors {
  category: KBCategoryNode;
  ancestors: KBCategoryNode[];
}

/**
 * Recursively searches a category tree to find a node by ID or slug along with its ancestor path.
 */
function findCategoryInTree(
  nodes: KBCategoryNode[],
  targetIdOrSlug: string,
  currentAncestors: KBCategoryNode[] = []
): CategoryWithAncestors | null {
  if (!targetIdOrSlug || !nodes || nodes.length === 0) return null;

  for (const node of nodes) {
    if (
      node.id === targetIdOrSlug ||
      node.slug === targetIdOrSlug ||
      node.id.toLowerCase() === targetIdOrSlug.toLowerCase() ||
      (node.slug && node.slug.toLowerCase() === targetIdOrSlug.toLowerCase())
    ) {
      return { category: node, ancestors: currentAncestors };
    }

    if (node.children && node.children.length > 0) {
      const match = findCategoryInTree(node.children, targetIdOrSlug, [...currentAncestors, node]);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

/**
 * Component properties for Knowledge Base Category Browsing Page.
 */
export interface CategoryPageProps {
  /** Next.js App Router route params object or promise containing category id */
  params?: { id: string } | Promise<{ id: string }>;
  /** Explicit category ID or slug override */
  categoryId?: string;
  /** Explicit ID property alternative */
  id?: string;
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded category node for SSR or test injection */
  initialCategory?: KBCategoryNode | null;
  /** Preloaded category tree nodes for SSR or test injection */
  initialCategories?: KBCategoryNode[];
  /** Preloaded resource summaries for SSR or test injection */
  initialResources?: KBResourceSummary[];
  /** Preloaded total resource count */
  initialTotal?: number;
  /** Initial search query string */
  initialQuery?: string;
  /** Initial selected content type filter ('FAQ', 'PLAYBOOK', 'PROCESS_DOC', 'TUTORIAL', 'VIDEO', or '') */
  initialContentType?: string;
  /** Initial selected onboarding phase filter ('phase_1', 'phase_2', 'phase_3', or '') */
  initialOnboardingPhase?: string;
  /** User role override header for RBAC filtering */
  userRole?: string;
  /** Subscription tier override header for RBAC filtering */
  subscriptionTier?: string;
  /** Custom category tree fetcher function for test injection */
  fetchCategories?: () => Promise<KBCategoryNode[]>;
  /** Custom resource search fetcher function for test injection */
  fetchResources?: (params?: KBSearchParams) => Promise<PaginatedKBResourcesResponse>;
  /** Custom resource click handler */
  onResourceSelect?: (resource: KBResourceSummary) => void;
  /** Whether component auto-fetches on mount/filter change (default: true) */
  autoFetch?: boolean;
  /** Optional custom container CSS class name */
  className?: string;
}

/**
 * Inner Category Browsing Content component consuming active user session context.
 * Renders hierarchical category breadcrumbs, category details, subcategories,
 * content filtering (content type, onboarding phase, search query), and resource summary cards.
 * Styled per Linen & Logic editorial design system.
 */
function _CategoryContent({
  params,
  categoryId: explicitCategoryId,
  id: explicitId,
  user: explicitUser,
  onLogout,
  initialCategory,
  initialCategories,
  initialResources,
  initialTotal,
  initialQuery = '',
  initialContentType = '',
  initialOnboardingPhase = '',
  userRole,
  subscriptionTier,
  fetchCategories: customFetchCategories,
  fetchResources: customFetchResources,
  onResourceSelect,
  autoFetch = true,
  className = '',
}: CategoryPageProps): React.ReactElement | null {
  const router = useRouter();
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // 1. Target category ID/slug resolution
  const [resolvedTargetId, setResolvedTargetId] = useState<string>(() => {
    if (explicitCategoryId) return explicitCategoryId;
    if (explicitId) return explicitId;
    if (params && 'id' in params && typeof (params as any).id === 'string') {
      return (params as any).id;
    }
    return '';
  });

  useEffect(() => {
    if (explicitCategoryId) {
      setResolvedTargetId(explicitCategoryId);
    } else if (explicitId) {
      setResolvedTargetId(explicitId);
    } else if (params) {
      if (typeof (params as any).then === 'function') {
        (params as Promise<{ id: string }>).then((res) => {
          if (res?.id) setResolvedTargetId(res.id);
        });
      } else if ('id' in params && typeof (params as any).id === 'string') {
        setResolvedTargetId((params as any).id);
      }
    }
  }, [params, explicitCategoryId, explicitId]);

  // 2. Data states
  const [categories, setCategories] = useState<KBCategoryNode[]>(initialCategories || []);
  const [currentCategoryNode, setCurrentCategoryNode] = useState<KBCategoryNode | null>(
    initialCategory || null
  );
  const [ancestorNodes, setAncestorNodes] = useState<KBCategoryNode[]>([]);
  const [resources, setResources] = useState<KBResourceSummary[]>(initialResources || []);
  const [total, setTotal] = useState<number>(
    initialTotal !== undefined ? initialTotal : initialResources ? initialResources.length : 0
  );

  // 3. Filter and search state
  const [query, setQuery] = useState<string>(initialQuery);
  const [contentType, setContentType] = useState<string>(initialContentType);
  const [onboardingPhase, setOnboardingPhase] = useState<string>(initialOnboardingPhase);

  // 4. Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // 5. Loading and Error states
  const [isLoadingCategory, setIsLoadingCategory] = useState<boolean>(
    autoFetch && !initialCategory && !initialCategories
  );
  const [isLoadingResources, setIsLoadingResources] = useState<boolean>(
    autoFetch && !initialResources
  );
  const [error, setError] = useState<string | null>(null);

  // 6. Load category tree and locate active category
  const loadCategories = useCallback(async () => {
    try {
      setIsLoadingCategory(true);
      const data = customFetchCategories
        ? await customFetchCategories()
        : await kbService.getCategoryTree();
      
      const tree = data || [];
      setCategories(tree);

      if (resolvedTargetId) {
        const found = findCategoryInTree(tree, resolvedTargetId);
        if (found) {
          setCurrentCategoryNode(found.category);
          setAncestorNodes(found.ancestors);
        } else if (initialCategory) {
          setCurrentCategoryNode(initialCategory);
          setAncestorNodes([]);
        } else {
          setCurrentCategoryNode(null);
          setAncestorNodes([]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load category tree:', err);
    } finally {
      setIsLoadingCategory(false);
    }
  }, [customFetchCategories, resolvedTargetId, initialCategory]);

  // Update category node if tree or targetId changes
  useEffect(() => {
    if (categories.length > 0 && resolvedTargetId) {
      const found = findCategoryInTree(categories, resolvedTargetId);
      if (found) {
        setCurrentCategoryNode(found.category);
        setAncestorNodes(found.ancestors);
      }
    }
  }, [categories, resolvedTargetId]);

  // 7. Load resources for the resolved category with active filters
  const loadResources = useCallback(async () => {
    try {
      setIsLoadingResources(true);
      setError(null);

      const targetCatId = currentCategoryNode?.id || resolvedTargetId || undefined;

      const searchParams: KBSearchParams = {
        category_id: targetCatId,
        query: query.trim() || undefined,
        content_type: (contentType as KBContentType) || undefined,
        onboarding_phase: onboardingPhase || undefined,
        user_role: userRole,
        subscription_tier: subscriptionTier,
        page,
        limit,
      };

      const response = customFetchResources
        ? await customFetchResources(searchParams)
        : await kbService.searchResources(searchParams);

      setResources(response.items || []);
      setTotal(response.total_count !== undefined ? response.total_count : (response.items || []).length);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to fetch category resources. Please try again.';
      setError(errMsg);
      setResources([]);
      setTotal(0);
    } finally {
      setIsLoadingResources(false);
    }
  }, [
    currentCategoryNode,
    resolvedTargetId,
    query,
    contentType,
    onboardingPhase,
    userRole,
    subscriptionTier,
    page,
    limit,
    customFetchResources,
  ]);

  // Sync category tree on mount or when resolvedTargetId changes
  useEffect(() => {
    if (autoFetch && (!initialCategory || !initialCategories)) {
      loadCategories();
    }
  }, [autoFetch, resolvedTargetId, initialCategory, initialCategories, loadCategories]);

  // Sync resources when category or search filters change
  useEffect(() => {
    if (autoFetch) {
      loadResources();
    }
  }, [autoFetch, loadResources]);

  // Construct breadcrumbs list items [FR-10]
  const breadcrumbsList = useMemo(() => {
    const list: BreadcrumbItem[] = [];

    // Ancestor categories
    ancestorNodes.forEach((anc) => {
      list.push({
        id: anc.id,
        title: anc.title,
        slug: anc.slug,
        href: `/knowledge-base/category/${anc.id}`,
        isCategory: true,
      });
    });

    return list;
  }, [ancestorNodes]);

  // Handle search bar submit
  const handleSearchSubmit = useCallback((state: SearchState) => {
    setQuery(state.query);
    setContentType(state.contentType);
    setOnboardingPhase(state.onboardingPhase);
    setPage(1);
  }, []);

  // Handle clearing all search & content type filters
  const handleClearAll = useCallback(() => {
    setQuery('');
    setContentType('');
    setOnboardingPhase('');
    setPage(1);
  }, []);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  if (!user) {
    return null;
  }

  const categoryTitle = currentCategoryNode?.title || (isLoadingCategory ? 'Loading Category...' : 'Category');
  const categoryDescription = currentCategoryNode?.description || '';
  const childCategories = currentCategoryNode?.children || [];

  return (
    <div
      data-testid="category-browsing-page"
      className={className}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans, "DM Sans", -apple-system, sans-serif)',
      }}
    >
      {/* Top Header Navigation */}
      <NavMenu
        user={user}
        onLogout={onLogout}
        activeItem="knowledge-base"
        data-testid="category-nav-menu"
      />

      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
        }}
      >
        {/* Breadcrumb Navigation Trail [FR-10] */}
        <section
          aria-label="Breadcrumb Trail"
          style={{ marginBottom: '24px' }}
        >
          <Breadcrumbs
            items={breadcrumbsList}
            currentTitle={categoryTitle}
            homeHref="/knowledge-base"
            homeLabel="Knowledge Base"
            showHome={true}
            categoryHrefPrefix="/knowledge-base/category"
            resourceHrefPrefix="/knowledge-base"
            data-testid="kb-breadcrumbs"
          />
        </section>

        {/* Category Header Hero Section */}
        <header
          data-testid="category-header"
          style={{
            marginBottom: '32px',
            padding: '32px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-lg, 8px)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-primary, #59452b)',
                backgroundColor: 'var(--color-on-primary-container, #f5d6b4)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm, 2px)',
              }}
            >
              Category
            </span>
            <Link
              href="/knowledge-base"
              style={{
                fontSize: '13px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                textDecoration: 'none',
              }}
            >
              ← All Categories
            </Link>
          </div>

          <h1
            data-testid="category-title"
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '36px',
              fontWeight: 400,
              color: 'var(--color-primary, #59452b)',
              margin: '0 0 12px 0',
              lineHeight: 1.2,
            }}
          >
            {categoryTitle}
          </h1>

          {categoryDescription && (
            <p
              data-testid="category-description"
              style={{
                fontSize: '16px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                margin: 0,
                maxWidth: '720px',
                lineHeight: 1.6,
              }}
            >
              {categoryDescription}
            </p>
          )}

          {/* Subcategories (if available) */}
          {childCategories.length > 0 && (
            <div
              data-testid="subcategories-section"
              style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <h2
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  margin: '0 0 12px 0',
                }}
              >
                Subcategories ({childCategories.length})
              </h2>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {childCategories.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/knowledge-base/category/${encodeURIComponent(sub.id)}`}
                    data-testid={`subcategory-chip-${sub.id}`}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-default, 4px)',
                      color: 'var(--color-primary, #59452b)',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{sub.title}</span>
                    <span style={{ color: 'var(--color-outline, #80756b)' }}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Content Filtering Controls [FR-4] */}
        <section
          data-testid="category-search-filters"
          aria-label="Category search and resource filters"
          style={{ marginBottom: '36px' }}
        >
          <SearchBar
            initialQuery={query}
            initialContentType={contentType}
            initialCategoryId=""
            initialOnboardingPhase={onboardingPhase}
            categories={[]}
            showCategorySelect={false}
            onSearch={handleSearchSubmit}
            onClear={handleClearAll}
            placeholder={`Search within ${categoryTitle}...`}
            data-testid="category-search-bar"
          />
        </section>

        {/* Resources Listing Section */}
        <section
          data-testid="category-resources-section"
          aria-label="Categorized resource listings"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '20px',
              borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
              paddingBottom: '12px',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                fontSize: '24px',
                fontWeight: 400,
                color: 'var(--color-primary, #59452b)',
                margin: 0,
              }}
            >
              Resources in {categoryTitle}
            </h2>
            <span
              style={{
                fontSize: '14px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Showing {resources.length} of {total} items
            </span>
          </div>

          {/* Loading State */}
          {isLoadingResources && (
            <div
              data-testid="category-loading-state"
              style={{
                padding: '40px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-default, 4px)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '15px',
                margin: '20px 0',
              }}
            >
              Loading category resources...
            </div>
          )}

          {/* Error State */}
          {!isLoadingResources && error && (
            <div
              data-testid="category-error-state"
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--color-error-container, #ffdad6)',
                color: 'var(--color-on-error-container, #93000a)',
                borderRadius: 'var(--radius-default, 4px)',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={loadResources}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--color-error, #ba1a1a)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm, 2px)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingResources && !error && resources.length === 0 && (
            <div
              data-testid="category-empty-state"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-lg, 8px)',
                border: '1px dashed var(--color-outline-variant, #d1c4b9)',
                margin: '20px 0',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '20px',
                  color: 'var(--color-primary, #59452b)',
                  margin: '0 0 8px 0',
                }}
              >
                No Matching Resources in This Category
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  margin: '0 0 20px 0',
                  maxWidth: '480px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                There are no resources under {categoryTitle} matching your current search term or filter selection.
              </p>
              <button
                type="button"
                onClick={handleClearAll}
                data-testid="empty-clear-filters-btn"
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-primary, #59452b)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-default, 4px)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Resource Grid Listing */}
          {!isLoadingResources && !error && resources.length > 0 && (
            <div
              data-testid="category-resources-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '24px',
              }}
            >
              {resources.map((resource) => {
                const badgeCfg = getContentTypeBadgeConfig(resource.content_type);
                const isTutorialOrVideo =
                  resource.content_type === 'TUTORIAL' || resource.content_type === 'VIDEO';

                const targetHref = isTutorialOrVideo
                  ? `/knowledge-base/tutorial/${encodeURIComponent(resource.id)}`
                  : `/knowledge-base/${encodeURIComponent(resource.id)}`;

                return (
                  <article
                    key={resource.id}
                    data-testid={`resource-card-${resource.id}`}
                    style={{
                      padding: '24px',
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-lg, 8px)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
                    }}
                  >
                    <div>
                      {/* Badge and Metadata Header Row */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px',
                        }}
                      >
                        <span
                          data-testid="content-type-badge"
                          style={{
                            padding: '3px 10px',
                            backgroundColor: badgeCfg.bg,
                            color: badgeCfg.color,
                            border: `1px solid ${badgeCfg.border}`,
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            borderRadius: 'var(--radius-sm, 2px)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {badgeCfg.label}
                        </span>

                        {resource.onboarding_phase && (
                          <span
                            style={{
                              padding: '3px 8px',
                              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                              color: 'var(--color-on-surface-variant, #4e453d)',
                              fontSize: '11px',
                              borderRadius: 'var(--radius-sm, 2px)',
                            }}
                          >
                            {resource.onboarding_phase.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        style={{
                          fontSize: '18px',
                          fontWeight: 500,
                          margin: '0 0 10px 0',
                          lineHeight: 1.4,
                        }}
                      >
                        <Link
                          href={targetHref}
                          onClick={() => onResourceSelect && onResourceSelect(resource)}
                          data-testid={`resource-link-${resource.id}`}
                          style={{
                            color: 'var(--color-primary, #59452b)',
                            textDecoration: 'none',
                          }}
                        >
                          <HighlightText text={resource.title} query={query} />
                        </Link>
                      </h3>

                      {/* Description / Snippet */}
                      {resource.body_text && (
                        <p
                          style={{
                            fontSize: '14px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            margin: '0 0 16px 0',
                            lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          <HighlightText text={resource.body_text} query={query} />
                        </p>
                      )}

                      {/* Tags List */}
                      {resource.tags && resource.tags.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginBottom: '16px',
                          }}
                        >
                          {resource.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '11px',
                                color: 'var(--color-on-surface-variant, #4e453d)',
                                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                                padding: '2px 6px',
                                borderRadius: '2px',
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Action Link */}
                    <div
                      style={{
                        paddingTop: '16px',
                        borderTop: '1px solid var(--color-surface-container, #f0eee9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Link
                        href={targetHref}
                        onClick={() => onResourceSelect && onResourceSelect(resource)}
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--color-primary, #59452b)',
                          textDecoration: 'none',
                        }}
                      >
                        Read Resource →
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoadingResources && !error && totalPages > 1 && (
            <div
              data-testid="category-pagination"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
                marginTop: '40px',
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="pagination-prev"
                style={{
                  padding: '8px 16px',
                  backgroundColor:
                    page <= 1
                      ? 'var(--color-surface-container-high, #eae8e3)'
                      : 'var(--color-surface-container-lowest, #ffffff)',
                  color:
                    page <= 1
                      ? 'var(--color-outline, #80756b)'
                      : 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-default, 4px)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                ← Previous
              </button>

              <span
                style={{
                  fontSize: '14px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                }}
              >
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                data-testid="pagination-next"
                style={{
                  padding: '8px 16px',
                  backgroundColor:
                    page >= totalPages
                      ? 'var(--color-surface-container-high, #eae8e3)'
                      : 'var(--color-surface-container-lowest, #ffffff)',
                  color:
                    page >= totalPages
                      ? 'var(--color-outline, #80756b)'
                      : 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-default, 4px)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * Knowledge Base Category Browsing Page Component wrapped with session route guard.
 */
export default function CategoryBrowsingPage(props: any = {}) {
  return (
    <ProtectedRoute fetchUser={props?.fetchUser}>
      <_CategoryContent {...props} />
    </ProtectedRoute>
  );
}
