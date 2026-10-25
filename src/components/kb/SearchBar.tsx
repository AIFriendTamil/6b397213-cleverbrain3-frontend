'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { KBResourceSummary, KBContentType } from '../../services/kb_client';

export interface ContentTypeOption {
  value: string;
  label: string;
}

export interface CategoryOption {
  id: string;
  title: string;
  slug?: string;
}

export interface OnboardingPhaseOption {
  value: string;
  label: string;
}

export interface SearchState {
  query: string;
  contentType: string;
  categoryId: string;
  onboardingPhase: string;
}

export interface HighlightTextProps {
  /** Text string to highlight keywords in */
  text: string;
  /** Search query or space-separated terms to match */
  query?: string;
  /** Optional container class name */
  className?: string;
  /** Optional custom CSS class for highlighted terms */
  highlightClassName?: string;
  /** Optional custom test id */
  'data-testid'?: string;
}

/**
 * Escapes regex special characters in a search term string.
 */
function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Utility component to render text with highlighted search query keywords.
 */
export function HighlightText({
  text,
  query,
  className = '',
  highlightClassName = '',
  'data-testid': testId,
}: HighlightTextProps): React.ReactElement {
  if (!text) {
    return <span data-testid={testId}>{''}</span>;
  }

  const trimmedQuery = (query || '').trim();
  if (!trimmedQuery) {
    return <span data-testid={testId}>{text}</span>;
  }

  // Split multi-word queries into unique non-empty search terms
  const terms = Array.from(
    new Set(
      trimmedQuery
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );

  if (terms.length === 0) {
    return <span data-testid={testId}>{text}</span>;
  }

  // Create case-insensitive matching regex for all search terms
  const pattern = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi');
  const parts = text.split(pattern);

  const defaultHighlightStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-on-primary-container, #f5d6b4)',
    color: 'var(--color-primary, #59452b)',
    fontWeight: 600,
    padding: '0 2px',
    borderRadius: '2px',
  };

  return (
    <span className={className} data-testid={testId}>
      {parts.map((part, idx) => {
        const isMatch = terms.some((t) => t.toLowerCase() === part.toLowerCase());
        if (isMatch) {
          return (
            <mark
              key={idx}
              className={`kb-keyword-highlight ${highlightClassName}`}
              style={highlightClassName ? undefined : defaultHighlightStyle}
              data-testid="highlighted-keyword"
            >
              {part}
            </mark>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
}

/**
 * Helper to get content type badge styling and display label.
 */
export function getContentTypeBadgeConfig(type: KBContentType | string): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  const norm = (type || '').toUpperCase();
  switch (norm) {
    case 'FAQ':
      return {
        label: 'FAQ',
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
    case 'PLAYBOOK':
      return {
        label: 'Playbook',
        bg: 'var(--color-on-primary-container, #f5d6b4)',
        color: 'var(--color-primary, #59452b)',
        border: 'var(--color-primary-container, #735c41)',
      };
    case 'PROCESS_DOC':
      return {
        label: 'Process Doc',
        bg: 'var(--color-tertiary-fixed, #d0e4ff)',
        color: 'var(--color-tertiary, #374a5f)',
        border: 'var(--color-tertiary-container, #4f6278)',
      };
    case 'TUTORIAL':
      return {
        label: 'Tutorial',
        bg: 'var(--color-trend-up-bg, #e8f5e9)',
        color: 'var(--color-trend-up, #2e6b38)',
        border: 'var(--color-trend-up, #2e6b38)',
      };
    case 'VIDEO':
      return {
        label: 'Video',
        bg: 'var(--color-secondary-fixed, #ffdad4)',
        color: 'var(--color-secondary, #a43b2c)',
        border: 'var(--color-secondary-container, #fd7d69)',
      };
    default:
      return {
        label: type || 'Resource',
        bg: 'var(--color-surface-container, #f0eee9)',
        color: 'var(--color-on-surface, #1b1c19)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
  }
}

/**
 * Default Content Type filter options.
 */
export const DEFAULT_CONTENT_TYPES: ContentTypeOption[] = [
  { value: '', label: 'All Types' },
  { value: 'FAQ', label: 'FAQ' },
  { value: 'PLAYBOOK', label: 'Playbook' },
  { value: 'PROCESS_DOC', label: 'Process Doc' },
  { value: 'TUTORIAL', label: 'Tutorial' },
  { value: 'VIDEO', label: 'Video' },
];

/**
 * Default Onboarding Phase filter options.
 */
export const DEFAULT_ONBOARDING_PHASES: OnboardingPhaseOption[] = [
  { value: '', label: 'All Phases' },
  { value: 'phase_1', label: 'Phase 1: Setup' },
  { value: 'phase_2', label: 'Phase 2: Configuration' },
  { value: 'phase_3', label: 'Phase 3: Launch' },
];

export interface SearchBarProps {
  /** Initial query text string */
  initialQuery?: string;
  /** Initial selected content type filter */
  initialContentType?: string;
  /** Initial selected category ID filter */
  initialCategoryId?: string;
  /** Initial selected onboarding phase filter */
  initialOnboardingPhase?: string;
  /** Available category choices for filtering */
  categories?: CategoryOption[];
  /** Available content type filter choices */
  contentTypes?: ContentTypeOption[];
  /** Available onboarding phase choices */
  onboardingPhases?: OnboardingPhaseOption[];
  /** Callback fired when search form is submitted or filter changes */
  onSearch?: (state: SearchState) => void;
  /** Callback fired on real-time text input change */
  onQueryChange?: (query: string) => void;
  /** Callback fired when filter chips are toggled */
  onFilterChange?: (filters: Omit<SearchState, 'query'>) => void;
  /** Callback fired when clearing all query and filter selections */
  onClearAll?: () => void;
  /** Optional callback when search is cleared */
  onClear?: () => void;
  /** Optional flag whether category selector is shown */
  showCategorySelect?: boolean;
  /** Optional search results list to render inline with keyword highlights */
  results?: KBResourceSummary[];
  /** Total results count indicator */
  totalResults?: number;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Callback fired when user clicks a search result card */
  onResultSelect?: (resource: KBResourceSummary) => void;
  /** Custom input placeholder text */
  placeholder?: string;
  /** Custom container class name */
  className?: string;
  /** Custom test identifier attribute */
  'data-testid'?: string;
}

/**
 * SearchBar component for Knowledge Base search and filtering.
 * Supports keyword search input, content type chips, category chips,
 * onboarding phase chips, and keyword-highlighted search results.
 */
export function SearchBar({
  initialQuery = '',
  initialContentType = '',
  initialCategoryId = '',
  initialOnboardingPhase = '',
  categories = [],
  contentTypes = DEFAULT_CONTENT_TYPES,
  onboardingPhases = DEFAULT_ONBOARDING_PHASES,
  onSearch,
  onQueryChange,
  onFilterChange,
  onClearAll,
  results,
  totalResults,
  isLoading = false,
  onResultSelect,
  placeholder = 'Search knowledge base articles, tutorials, playbooks, videos...',
  className = '',
  'data-testid': testId = 'kb-search-bar',
}: SearchBarProps): React.ReactElement {
  const [query, setQuery] = useState<string>(initialQuery);
  const [contentType, setContentType] = useState<string>(initialContentType);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [onboardingPhase, setOnboardingPhase] = useState<string>(initialOnboardingPhase);

  // Synchronize internal state with external props if changed externally
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setContentType(initialContentType);
  }, [initialContentType]);

  useEffect(() => {
    setCategoryId(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    setOnboardingPhase(initialOnboardingPhase);
  }, [initialOnboardingPhase]);

  // Combined current search state
  const currentState: SearchState = useMemo(
    () => ({
      query,
      contentType,
      categoryId,
      onboardingPhase,
    }),
    [query, contentType, categoryId, onboardingPhase]
  );

  // Check if any filters or search query are active
  const hasActiveFilters = useMemo(
    () => Boolean(query.trim() || contentType || categoryId || onboardingPhase),
    [query, contentType, categoryId, onboardingPhase]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (contentType) count++;
    if (categoryId) count++;
    if (onboardingPhase) count++;
    return count;
  }, [contentType, categoryId, onboardingPhase]);

  // Handle text input change
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (onQueryChange) {
      onQueryChange(val);
    }
  };

  // Handle query input clear button
  const handleClearQuery = () => {
    setQuery('');
    if (onQueryChange) {
      onQueryChange('');
    }
    const newState = { ...currentState, query: '' };
    if (onSearch) {
      onSearch(newState);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(currentState);
    }
  };

  // Handle content type chip toggle
  const handleContentTypeSelect = (val: string) => {
    const nextVal = contentType === val ? '' : val;
    setContentType(nextVal);
    const newFilters = { contentType: nextVal, categoryId, onboardingPhase };
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
    if (onSearch) {
      onSearch({ query, ...newFilters });
    }
  };

  // Handle category chip toggle
  const handleCategorySelect = (catId: string) => {
    const nextCat = categoryId === catId ? '' : catId;
    setCategoryId(nextCat);
    const newFilters = { contentType, categoryId: nextCat, onboardingPhase };
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
    if (onSearch) {
      onSearch({ query, ...newFilters });
    }
  };

  // Handle onboarding phase chip toggle
  const handleOnboardingPhaseSelect = (phaseVal: string) => {
    const nextPhase = onboardingPhase === phaseVal ? '' : phaseVal;
    setOnboardingPhase(nextPhase);
    const newFilters = { contentType, categoryId, onboardingPhase: nextPhase };
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
    if (onSearch) {
      onSearch({ query, ...newFilters });
    }
  };

  // Reset all query and filter parameters
  const handleResetAll = () => {
    setQuery('');
    setContentType('');
    setCategoryId('');
    setOnboardingPhase('');
    if (onClearAll) {
      onClearAll();
    }
    if (onSearch) {
      onSearch({ query: '', contentType: '', categoryId: '', onboardingPhase: '' });
    }
  };

  // Category choices options (including "All Categories")
  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const allOpt: CategoryOption = { id: '', title: 'All Categories' };
    return [allOpt, ...categories];
  }, [categories]);

  return (
    <div
      className={`kb-search-bar-container ${className}`}
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Search Input Form */}
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Knowledge base resource search"
        data-testid="kb-search-form"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Search Icon */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '14px',
              color: 'var(--color-outline, #80756b)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>

          {/* Search Input */}
          <input
            id="kb-search-input"
            type="search"
            value={query}
            onChange={handleQueryChange}
            placeholder={placeholder}
            aria-label="Search knowledge base"
            data-testid="search-input"
            style={{
              width: '100%',
              padding: '12px 40px 12px 42px',
              fontSize: '16px',
              fontFamily: 'var(--font-sans)',
              color: 'var(--color-on-surface, #1b1c19)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          />

          {/* Clear query button */}
          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search query"
              data-testid="clear-query-button"
              style={{
                position: 'absolute',
                right: '12px',
                background: 'none',
                border: 'none',
                color: 'var(--color-outline, #80756b)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Submit Button */}
        <button
          type="submit"
          data-testid="search-submit-button"
          aria-label="Submit search"
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            backgroundColor: 'var(--color-primary, #59452b)',
            color: 'var(--color-on-primary, #ffffff)',
            border: 'none',
            borderRadius: 'var(--radius-md, 0.375rem)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'opacity 0.2s ease',
          }}
        >

          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Filter Section: Content Types, Categories, Onboarding Phases */}
      <div
        className="kb-filters-wrapper"
        data-testid="kb-filters-wrapper"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          padding: '16px',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        {/* Filter Row 1: Content Type Filter Chips (FR-3, FR-4) */}
        <div
          data-testid="content-type-filter-group"
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Content Type:
          </span>
          <div
            data-testid="content-type-chips"
            role="group"
            aria-label="Filter by content type"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
          >
            {contentTypes.map((ct) => {
              const isSelected = contentType === ct.value;
              const badgeCfg = ct.value ? getContentTypeBadgeConfig(ct.value) : null;
              return (
                <button
                  key={ct.value || 'all-content-types'}
                  type="button"
                  onClick={() => handleContentTypeSelect(ct.value)}
                  aria-pressed={isSelected}
                  data-testid={`content-type-chip-${ct.value || 'all'}`}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: isSelected ? 600 : 400,
                    borderRadius: 'var(--radius-full, 9999px)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isSelected
                      ? `1.5px solid ${badgeCfg ? badgeCfg.border : 'var(--color-primary, #59452b)'}`
                      : '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: isSelected
                      ? badgeCfg
                        ? badgeCfg.bg
                        : 'var(--color-primary, #59452b)'
                      : 'var(--color-surface-container-lowest, #ffffff)',
                    color: isSelected
                      ? badgeCfg
                        ? badgeCfg.color
                        : 'var(--color-on-primary, #ffffff)'
                      : 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  {ct.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Row 2: Category Filter Chips (FR-4) */}
        {categoryOptions.length > 1 && (
          <div
            data-testid="category-filter-group"
            style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Category:
            </span>
            <div
              data-testid="category-chips"
              role="group"
              aria-label="Filter by category"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
            >
              {categoryOptions.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id || 'all-categories'}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    aria-pressed={isSelected}
                    data-testid={`category-chip-${cat.id || 'all'}`}
                    style={{
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: isSelected ? 600 : 400,
                      borderRadius: 'var(--radius-full, 9999px)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelected
                        ? '1.5px solid var(--color-primary, #59452b)'
                        : '1px solid var(--color-outline-variant, #d1c4b9)',
                      backgroundColor: isSelected
                        ? 'var(--color-primary-container, #735c41)'
                        : 'var(--color-surface-container-lowest, #ffffff)',
                      color: isSelected
                        ? 'var(--color-on-primary-container, #f5d6b4)'
                        : 'var(--color-on-surface, #1b1c19)',
                    }}
                  >
                    {cat.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Row 3: Onboarding Phase Filter Chips (FR-4) */}
        {onboardingPhases.length > 0 && (
          <div
            data-testid="onboarding-phase-filter-group"
            style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Onboarding Phase:
            </span>
            <div
              data-testid="onboarding-phase-chips"
              role="group"
              aria-label="Filter by onboarding phase"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
            >
              {onboardingPhases.map((phase) => {
                const isSelected = onboardingPhase === phase.value;
                return (
                  <button
                    key={phase.value || 'all-phases'}
                    type="button"
                    onClick={() => handleOnboardingPhaseSelect(phase.value)}
                    aria-pressed={isSelected}
                    data-testid={`onboarding-phase-chip-${phase.value || 'all'}`}
                    style={{
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: isSelected ? 600 : 400,
                      borderRadius: 'var(--radius-full, 9999px)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelected
                        ? '1.5px solid var(--color-tertiary-container, #4f6278)'
                        : '1px solid var(--color-outline-variant, #d1c4b9)',
                      backgroundColor: isSelected
                        ? 'var(--color-tertiary, #374a5f)'
                        : 'var(--color-surface-container-lowest, #ffffff)',
                      color: isSelected
                        ? 'var(--color-on-tertiary, #ffffff)'
                        : 'var(--color-on-surface, #1b1c19)',
                    }}
                  >
                    {phase.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Filters Summary & Reset Button */}
        {hasActiveFilters && (
          <div
            data-testid="active-filters-summary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
              marginTop: '4px',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Active Filters ({activeFilterCount + (query ? 1 : 0)})
            </div>
            <button
              type="button"
              onClick={handleResetAll}
              data-testid="clear-all-filters-button"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-secondary, #a43b2c)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Results List Preview with Keyword Highlighting (FR-2, FR-3, FR-4) */}
      {results && (
        <div
          className="kb-search-results-container"
          data-testid="search-results-container"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}
        >
          {/* Total Results Counter Header */}
          <div
            data-testid="search-results-count"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            {isLoading
              ? 'Searching resources...'
              : `${totalResults !== undefined ? totalResults : results.length} resource${
                  (totalResults !== undefined ? totalResults : results.length) === 1 ? '' : 's'
                } found`}
          </div>

          {/* Results List */}
          {results.length === 0 ? (
            <div
              data-testid="no-search-results"
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px dashed var(--color-outline-variant, #d1c4b9)',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              <p style={{ margin: 0, fontSize: '15px' }}>No matching knowledge base resources found.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-outline, #80756b)' }}>
                Try adjusting your keyword terms or content filter choices.
              </p>
            </div>
          ) : (
            <div
              data-testid="search-results-list"
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {results.map((resource) => {
                const badgeCfg = getContentTypeBadgeConfig(resource.content_type);
                return (
                  <div
                    key={resource.id}
                    data-testid={`search-result-card-${resource.id}`}
                    onClick={() => onResultSelect && onResultSelect(resource)}
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-md, 0.375rem)',
                      cursor: onResultSelect ? 'pointer' : 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    }}
                  >
                    {/* Header: Title + Content Type Tag Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '18px',
                          fontFamily: 'var(--font-serif)',
                          color: 'var(--color-primary, #59452b)',
                        }}
                      >
                        <HighlightText text={resource.title} query={query} />
                      </h3>

                      {/* Content Type Tag Badge (FR-3) */}
                      <span
                        data-testid="result-content-type-tag"
                        style={{
                          padding: '3px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          borderRadius: 'var(--radius-full, 9999px)',
                          backgroundColor: badgeCfg.bg,
                          color: badgeCfg.color,
                          border: `1px solid ${badgeCfg.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badgeCfg.label}
                      </span>
                    </div>

                    {/* Metadata Row: Category & Onboarding Phase */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '12px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      {resource.category_title && (
                        <span data-testid="result-category-badge">
                          <strong>Category:</strong> {resource.category_title}
                        </span>
                      )}
                      {resource.onboarding_phase && (
                        <span data-testid="result-onboarding-tag">
                          <strong>Phase:</strong> {resource.onboarding_phase}
                        </span>
                      )}
                    </div>

                    {/* Snippet / Body Text / Highlights with Keyword Highlighting (FR-2) */}
                    {(resource.highlights && resource.highlights.length > 0) ? (
                      <div
                        data-testid="result-highlights"
                        style={{
                          fontSize: '14px',
                          color: 'var(--color-on-surface, #1b1c19)',
                          lineHeight: '1.5',
                        }}
                      >
                        {resource.highlights.map((h, hIdx) => (
                          <div key={hIdx} style={{ marginBottom: '4px' }}>
                            ... <HighlightText text={h} query={query} /> ...
                          </div>
                        ))}
                      </div>
                    ) : resource.body_text ? (
                      <p
                        data-testid="result-body-text"
                        style={{
                          margin: 0,
                          fontSize: '14px',
                          color: 'var(--color-on-surface, #1b1c19)',
                          lineHeight: '1.5',
                        }}
                      >
                        <HighlightText
                          text={
                            resource.body_text.length > 200
                              ? `${resource.body_text.substring(0, 200)}...`
                              : resource.body_text
                          }
                          query={query}
                        />
                      </p>
                    ) : null}

                    {/* Tags */}
                    {resource.tags && resource.tags.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginTop: '4px',
                        }}
                      >
                        {resource.tags.map((tag) => (
                          <span
                            key={tag}
                            data-testid={`result-tag-${tag}`}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              borderRadius: 'var(--radius-sm, 0.125rem)',
                              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                              color: 'var(--color-on-surface-variant, #4e453d)',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
