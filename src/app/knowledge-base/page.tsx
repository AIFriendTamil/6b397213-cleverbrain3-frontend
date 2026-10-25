'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import {
  SearchBar,
  SearchState,
  HighlightText,
  getContentTypeBadgeConfig,
  CategoryOption,
} from '../../components/kb/SearchBar';
import { Breadcrumbs } from '../../components/kb/Breadcrumbs';
import { CurrentUserResponse } from '../../services/auth';
import {
  kbService,
  KBCategoryNode,
  KBResourceSummary,
  KBSearchParams,
  PaginatedKBResourcesResponse,
  KBContentType,
} from '../../services/kb_client';

/**
 * Component props for Central Knowledge Base Home Page.
 */
export interface KnowledgeBasePageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
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
  /** Initial selected category ID filter */
  initialCategoryId?: string;
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
 * Recursively flattens category hierarchy nodes into CategoryOption array for SearchBar choices.
 */
function flattenCategoryOptions(nodes: KBCategoryNode[], prefix: string = ''): CategoryOption[] {
  let result: CategoryOption[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      title: prefix ? `${prefix} / ${node.title}` : node.title,
      slug: node.slug,
    });
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenCategoryOptions(node.children, prefix ? `${prefix} / ${node.title}` : node.title));
    }
  }
  return result;
}

/**
 * Inner Knowledge Base Home Page Content component consuming active user session context.
 * Aggregates keyword search controls, content type filters, category navigation cards,
 * and paginated resource listings for FAQs, playbooks, process docs, workflow tutorials, and streaming videos.
 * Styled following the Linen & Logic editorial design system.
 */
function KnowledgeBaseContent({
  user: explicitUser,
  onLogout,
  initialCategories,
  initialResources,
  initialTotal,
  initialQuery = '',
  initialContentType = '',
  initialCategoryId = '',
  initialOnboardingPhase = '',
  userRole,
  subscriptionTier,
  fetchCategories: customFetchCategories,
  fetchResources: customFetchResources,
  onResourceSelect,
  autoFetch = true,
  className = '',
}: KnowledgeBasePageProps): React.ReactElement | null {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Filter state
  const [query, setQuery] = useState<string>(initialQuery);
  const [contentType, setContentType] = useState<string>(initialContentType);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [onboardingPhase, setOnboardingPhase] = useState<string>(initialOnboardingPhase);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Data state
  const [categories, setCategories] = useState<KBCategoryNode[]>(initialCategories || []);
  const [resources, setResources] = useState<KBResourceSummary[]>(initialResources || []);
  const [total, setTotal] = useState<number>(
    initialTotal !== undefined ? initialTotal : initialResources ? initialResources.length : 0
  );

  // Loading & Error states
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(
    autoFetch && !initialCategories
  );
  const [isLoadingResources, setIsLoadingResources] = useState<boolean>(
    autoFetch && !initialResources
  );
  const [error, setError] = useState<string | null>(null);

  // Load category tree
  const loadCategories = useCallback(async () => {
    try {
      setIsLoadingCategories(true);
      const data = customFetchCategories
        ? await customFetchCategories()
        : await kbService.getCategoryTree();
      setCategories(data || []);
    } catch (err: any) {
      // Keep silent or record category load error
      console.error('Failed to load KB category tree:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [customFetchCategories]);

  // Load resources with current search & filter parameters
  const loadResources = useCallback(async () => {
    try {
      setIsLoadingResources(true);
      setError(null);
      const params: KBSearchParams = {
        query: query.trim() || undefined,
        content_type: (contentType as KBContentType) || undefined,
        category_id: categoryId || undefined,
        onboarding_phase: onboardingPhase || undefined,
        user_role: userRole,
        subscription_tier: subscriptionTier,
        page,
        limit,
      };

      const response = customFetchResources
        ? await customFetchResources(params)
        : await kbService.searchResources(params);

      setResources(response.items || []);
      setTotal(response.total_count !== undefined ? response.total_count : (response.items || []).length);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to fetch knowledge base resources. Please try again.';
      setError(errMsg);
      setResources([]);
      setTotal(0);
    } finally {
      setIsLoadingResources(false);
    }
  }, [
    query,
    contentType,
    categoryId,
    onboardingPhase,
    userRole,
    subscriptionTier,
    page,
    limit,
    customFetchResources,
  ]);

  // Synchronize categories on mount if autoFetch is true
  useEffect(() => {
    if (autoFetch && !initialCategories) {
      loadCategories();
    }
  }, [autoFetch, initialCategories, loadCategories]);

  // Synchronize resources when search params or page change if autoFetch is true
  useEffect(() => {
    if (autoFetch) {
      loadResources();
    }
  }, [autoFetch, loadResources]);

  // Flattened categories for SearchBar options
  const categoryOptions = useMemo(() => {
    return flattenCategoryOptions(categories);
  }, [categories]);

  // Handler when search state is updated
  const handleSearchSubmit = useCallback((state: SearchState) => {
    setQuery(state.query);
    setContentType(state.contentType);
    setCategoryId(state.categoryId);
    setOnboardingPhase(state.onboardingPhase);
    setPage(1);
  }, []);

  // Handler to reset all search query and filters
  const handleClearAll = useCallback(() => {
    setQuery('');
    setContentType('');
    setCategoryId('');
    setOnboardingPhase('');
    setPage(1);
  }, []);

  // Handler when clicking category card
  const handleCategoryCardClick = useCallback((catId: string) => {
    setCategoryId((prev) => (prev === catId ? '' : catId));
    setPage(1);
  }, []);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  if (!user) {
    return null;
  }

  return (
    <div
      data-testid="knowledge-base-page"
      className={className}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif)',
      }}
    >
      <NavMenu user={user} onLogout={onLogout} />

      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
        }}
      >
        {/* Breadcrumb Trail */}
        <div style={{ marginBottom: '24px' }}>
          <Breadcrumbs showHome={true} homeLabel="Knowledge Base" data-testid="kb-breadcrumbs" />
        </div>

        {/* Hero & Page Header Section */}
        <header
          data-testid="kb-page-header"
          style={{
            marginBottom: '32px',
            borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
            paddingBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
              color: 'var(--color-primary, #59452b)',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm, 2px)',
              marginBottom: '12px',
            }}
          >
            Self-Service Support & Training
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '36px',
              fontWeight: 400,
              color: 'var(--color-primary, #59452b)',
              margin: '0 0 12px 0',
              lineHeight: 1.2,
            }}
          >
            Knowledge Base
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              margin: 0,
              maxWidth: '720px',
              lineHeight: 1.6,
            }}
          >
            Discover FAQs, playbooks, process documentation, interactive workflow tutorials, and video walkthroughs
            designed to help you navigate and master platform features.
          </p>
        </header>

        {/* Global Search and Filter Section */}
        <section
          data-testid="kb-search-section"
          aria-label="Search and filter resources"
          style={{ marginBottom: '40px' }}
        >
          <SearchBar
            initialQuery={query}
            initialContentType={contentType}
            initialCategoryId={categoryId}
            initialOnboardingPhase={onboardingPhase}
            categories={categoryOptions}
            onSearch={handleSearchSubmit}
            onQueryChange={(q) => setQuery(q)}
            onFilterChange={(filters) => {
              setContentType(filters.contentType);
              setCategoryId(filters.categoryId);
              setOnboardingPhase(filters.onboardingPhase);
              setPage(1);
            }}
            onClearAll={handleClearAll}
            results={resources}
            totalResults={total}
            isLoading={isLoadingResources}
            onResultSelect={(res) => {
              if (onResourceSelect) {
                onResourceSelect(res);
              }
            }}
            data-testid="kb-search-bar"
          />
        </section>

        {/* Resource Categories Section */}
        <section
          data-testid="kb-categories-section"
          aria-label="Resource categories"
          style={{ marginBottom: '48px' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '20px',
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '24px',
                  fontWeight: 400,
                  color: 'var(--color-primary, #59452b)',
                  margin: '0 0 4px 0',
                }}
              >
                Resource Categories
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant, #4e453d)', margin: 0 }}>
                Explore knowledge base content organized by domain function
              </p>
            </div>
            {categoryId && (
              <button
                type="button"
                onClick={() => setCategoryId('')}
                data-testid="clear-category-filter-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Show All Categories
              </button>
            )}
          </div>

          {isLoadingCategories && categories.length === 0 ? (
            <div
              data-testid="categories-loading"
              style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-default, 4px)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '14px',
              }}
            >
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-default, 4px)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '14px',
              }}
            >
              No categories configured.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
              }}
            >
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <div
                    key={cat.id}
                    data-testid={`category-card-${cat.id}`}
                    onClick={() => handleCategoryCardClick(cat.id)}
                    style={{
                      padding: '20px',
                      backgroundColor: isSelected
                        ? 'var(--color-on-primary-container, #f5d6b4)'
                        : 'var(--color-surface-container-low, #f5f3ee)',
                      border: isSelected
                        ? '2px solid var(--color-primary, #59452b)'
                        : '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-lg, 8px)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <h3
                          style={{
                            fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                            fontSize: '18px',
                            fontWeight: 500,
                            color: 'var(--color-primary, #59452b)',
                            margin: 0,
                          }}
                        >
                          {cat.title}
                        </h3>
                        {cat.children && cat.children.length > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                              borderRadius: '10px',
                              color: 'var(--color-on-surface-variant, #4e453d)',
                            }}
                          >
                            {cat.children.length} subcategories
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p
                          style={{
                            fontSize: '13px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            margin: '0 0 16px 0',
                            lineHeight: 1.5,
                          }}
                        >
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--color-primary, #59452b)',
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
                      }}
                    >
                      <span>{isSelected ? '✓ Filtered' : 'Filter by Category'}</span>
                      <Link
                        href={`/knowledge-base/category/${encodeURIComponent(cat.id)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: 'var(--color-primary, #59452b)',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        Browse →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Aggregated Resources Section */}
        <section
          data-testid="kb-resources-section"
          aria-label="Knowledge base resources"
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
              Knowledge Base Resources
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
              data-testid="kb-loading-state"
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
              Loading knowledge base resources...
            </div>
          )}

          {/* Error State */}
          {!isLoadingResources && error && (
            <div
              data-testid="kb-error-state"
              style={{
                padding: '24px',
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
              data-testid="kb-empty-state"
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
                No Knowledge Base Resources Found
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
                We could not find any FAQs, playbooks, process docs, tutorials, or videos matching your search query or filter options.
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
                Clear All Filters
              </button>
            </div>
          )}

          {/* Resource Grid Listing */}
          {!isLoadingResources && !error && resources.length > 0 && (
            <div
              data-testid="resources-grid"
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

                        {resource.category_title && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--color-on-surface-variant, #4e453d)',
                              marginLeft: 'auto',
                            }}
                          >
                            {resource.category_title}
                          </span>
                        )}
                      </div>

                      {/* Resource Title */}
                      <h3
                        style={{
                          fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                          fontSize: '20px',
                          fontWeight: 500,
                          lineHeight: 1.3,
                          margin: '0 0 10px 0',
                        }}
                      >
                        <Link
                          href={
                            isTutorialOrVideo
                              ? `/knowledge-base/tutorial/${encodeURIComponent(resource.id)}`
                              : `/knowledge-base/category/${encodeURIComponent(resource.category_id)}`
                          }
                          data-testid="resource-title-link"
                          style={{
                            color: 'var(--color-primary, #59452b)',
                            textDecoration: 'none',
                          }}
                        >
                          <HighlightText text={resource.title} query={query} data-testid="resource-title" />
                        </Link>
                      </h3>

                      {/* Body Text / Excerpt */}
                      {(resource.body_text || (resource.highlights && resource.highlights.length > 0)) && (
                        <p
                          style={{
                            fontSize: '14px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            lineHeight: 1.5,
                            margin: '0 0 16px 0',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          <HighlightText
                            text={
                              resource.body_text ||
                              (resource.highlights ? resource.highlights.join(' ... ') : '')
                            }
                            query={query}
                            data-testid="resource-excerpt"
                          />
                        </p>
                      )}

                      {/* Tags */}
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
                              data-testid="resource-tag"
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                                color: 'var(--color-on-surface-variant, #4e453d)',
                                borderRadius: 'var(--radius-sm, 2px)',
                                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--color-surface-container, #f0eee9)',
                        marginTop: '12px',
                      }}
                    >
                      <span style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '12px' }}>
                        {resource.content_type === 'VIDEO' ? '📹 Video Guide' : isTutorialOrVideo ? '📖 Tutorial' : '📄 Article'}
                      </span>

                      <Link
                        href={
                          isTutorialOrVideo
                            ? `/knowledge-base/tutorial/${encodeURIComponent(resource.id)}`
                            : `/knowledge-base/category/${encodeURIComponent(resource.category_id)}`
                        }
                        data-testid="view-resource-btn"
                        style={{
                          color: 'var(--color-primary, #59452b)',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        View Resource →
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
              data-testid="kb-pagination"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '40px',
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                data-testid="pagination-prev-btn"
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  color: 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-default, 4px)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
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
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                data-testid="pagination-next-btn"
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  color: 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-default, 4px)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
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
 * Main Self-Service Knowledge Base Home Page component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders central portal interface.
 */
export default function KnowledgeBasePage(props: any = {}): React.ReactElement {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialCategories,
    initialResources,
    initialTotal,
    initialQuery = '',
    initialContentType = '',
    initialCategoryId = '',
    initialOnboardingPhase = '',
    userRole,
    subscriptionTier,
    fetchCategories,
    fetchResources,
    onResourceSelect,
    autoFetch = true,
    className = '',
  } = props || {};
  if (initialUser) {
    return (
      <KnowledgeBaseContent
        user={initialUser}
        onLogout={onLogout}
        initialCategories={initialCategories}
        initialResources={initialResources}
        initialTotal={initialTotal}
        initialQuery={initialQuery}
        initialContentType={initialContentType}
        initialCategoryId={initialCategoryId}
        initialOnboardingPhase={initialOnboardingPhase}
        userRole={userRole}
        subscriptionTier={subscriptionTier}
        fetchCategories={fetchCategories}
        fetchResources={fetchResources}
        onResourceSelect={onResourceSelect}
        autoFetch={autoFetch}
        className={className}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <KnowledgeBaseContent
        onLogout={onLogout}
        initialCategories={initialCategories}
        initialResources={initialResources}
        initialTotal={initialTotal}
        initialQuery={initialQuery}
        initialContentType={initialContentType}
        initialCategoryId={initialCategoryId}
        initialOnboardingPhase={initialOnboardingPhase}
        userRole={userRole}
        subscriptionTier={subscriptionTier}
        fetchCategories={fetchCategories}
        fetchResources={fetchResources}
        onResourceSelect={onResourceSelect}
        autoFetch={autoFetch}
        className={className}
      />
    </ProtectedRoute>
  );
}
