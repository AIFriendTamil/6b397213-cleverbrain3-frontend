'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { KBBreadcrumb } from '../../services/kb_client';

export interface BreadcrumbItem {
  /** Unique identifier for category or document */
  id?: string;
  /** Display label/title for the breadcrumb step */
  title: string;
  /** URL slug for constructing path links */
  slug?: string;
  /** Explicit link href path (e.g. '/knowledge-base/category/onboarding') */
  href?: string;
  /** Flag indicating if item represents a category */
  isCategory?: boolean;
  /** Content type if item represents a resource (e.g., 'FAQ', 'TUTORIAL', 'VIDEO') */
  contentType?: string;
  /** Flag indicating if item is current active page */
  isCurrent?: boolean;
  /** Optional icon or node to render alongside title */
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  /**
   * List of breadcrumb items or KBBreadcrumb objects from API.
   */
  items?: (BreadcrumbItem | KBBreadcrumb)[];

  /**
   * Optional current document/resource title to append at the end of the trail
   * if not already present in `items`.
   */
  currentTitle?: string;

  /**
   * Optional current document/resource slug.
   */
  currentSlug?: string;

  /**
   * Optional current document/resource explicit href.
   */
  currentHref?: string;

  /**
   * Base href for root/home breadcrumb. Defaults to '/knowledge-base'.
   */
  homeHref?: string;

  /**
   * Root/Home label text. Defaults to 'Knowledge Base'.
   */
  homeLabel?: string;

  /**
   * Whether to include the root/home item at the start of the trail. Defaults to true.
   */
  showHome?: boolean;

  /**
   * Prefix for category URL routes. Defaults to '/knowledge-base/category'.
   */
  categoryHrefPrefix?: string;

  /**
   * Prefix for resource/document URL routes. Defaults to '/knowledge-base'.
   */
  resourceHrefPrefix?: string;

  /**
   * Custom separator node rendered between items. Defaults to chevron (›).
   */
  separator?: React.ReactNode;

  /**
   * Maximum number of items to display before collapsing intermediate breadcrumbs.
   * If total items exceed maxItems, middle items will be collapsed into an ellipsis button.
   */
  maxItems?: number;

  /**
   * Callback fired when clicking a breadcrumb link/button.
   */
  onNavigate?: (item: BreadcrumbItem, index: number) => void;

  /**
   * Custom CSS class name for outer container.
   */
  className?: string;

  /**
   * Data-testid for testing. Defaults to 'kb-breadcrumbs'.
   */
  'data-testid'?: string;
}

/**
 * Normalizes a KBBreadcrumb or generic BreadcrumbItem into a standardized BreadcrumbItem format.
 */
export function normalizeBreadcrumbItem(
  raw: BreadcrumbItem | KBBreadcrumb,
  isLastItem: boolean = false
): BreadcrumbItem {
  const title = raw.title || '';
  const id = raw.id;
  const slug = raw.slug;
  const href = 'href' in raw ? raw.href : undefined;
  const isCategory = 'isCategory' in raw ? Boolean(raw.isCategory) : true;
  const contentType = 'contentType' in raw ? raw.contentType : undefined;
  const isCurrent = 'isCurrent' in raw ? Boolean(raw.isCurrent) : isLastItem;
  const icon = 'icon' in raw ? raw.icon : undefined;

  return {
    id,
    title,
    slug,
    href,
    isCategory,
    contentType,
    isCurrent,
    icon,
  };
}

/**
 * Builds standard href route for a breadcrumb item based on category or resource rules.
 */
export function buildBreadcrumbHref(
  item: BreadcrumbItem,
  categoryPrefix: string = '/knowledge-base/category',
  resourcePrefix: string = '/knowledge-base'
): string {
  if (item.href) {
    return item.href;
  }
  const identifier = item.slug || item.id || '';
  if (!identifier) {
    return categoryPrefix;
  }

  // If explicit resource / content type, use resource prefix
  if (item.contentType || item.isCategory === false) {
    return `${resourcePrefix}/${encodeURIComponent(identifier)}`;
  }

  // Default category route
  return `${categoryPrefix}/${encodeURIComponent(identifier)}`;
}

/**
 * Default chevron separator component.
 */
export function ChevronSeparator(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        margin: '0 6px',
        color: 'var(--color-outline, #80756b)',
        opacity: 0.7,
        flexShrink: 0,
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Default home icon component.
 */
export function HomeIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: '6px', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

/**
 * Breadcrumbs header navigation component.
 * Provides accessible, responsive hierarchical category and document trail navigation.
 */
export function Breadcrumbs({
  items = [],
  currentTitle,
  currentSlug,
  currentHref,
  homeHref = '/knowledge-base',
  homeLabel = 'Knowledge Base',
  showHome = true,
  categoryHrefPrefix = '/knowledge-base/category',
  resourceHrefPrefix = '/knowledge-base',
  separator,
  maxItems,
  onNavigate,
  className = '',
  'data-testid': testId = 'kb-breadcrumbs',
}: BreadcrumbsProps): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Construct full list of normalized breadcrumb items
  const fullTrail = useMemo(() => {
    const list: BreadcrumbItem[] = [];

    // 1. Root / Home item
    if (showHome) {
      list.push({
        id: 'home',
        title: homeLabel,
        href: homeHref,
        isCategory: true,
        isCurrent: false,
        icon: <HomeIcon />,
      });
    }

    // 2. Intermediate items passed in props
    items.forEach((rawItem) => {
      const normalized = normalizeBreadcrumbItem(rawItem, false);
      list.push(normalized);
    });

    // 3. Append currentTitle as the active terminal item if provided and not redundant
    if (currentTitle) {
      const lastItem = list[list.length - 1];
      const isDuplicate = lastItem && lastItem.title.toLowerCase() === currentTitle.toLowerCase();
      if (!isDuplicate) {
        list.push({
          title: currentTitle,
          slug: currentSlug,
          href: currentHref,
          isCategory: false,
          isCurrent: true,
        });
      } else if (lastItem) {
        lastItem.isCurrent = true;
      }
    }

    // Ensure the final item in trail is marked as current if not explicitly set
    if (list.length > 0) {
      list[list.length - 1] = {
        ...list[list.length - 1],
        isCurrent: true,
      };
    }

    return list;
  }, [items, currentTitle, currentSlug, currentHref, showHome, homeLabel, homeHref]);

  if (fullTrail.length === 0) {
    return null;
  }

  // Determine which items to render considering maxItems & expansion state
  const shouldTruncate = Boolean(
    maxItems && maxItems > 2 && fullTrail.length > maxItems && !isExpanded
  );

  let renderedItems: { item: BreadcrumbItem; originalIndex: number }[] = [];
  let hiddenItems: { item: BreadcrumbItem; originalIndex: number }[] = [];

  if (shouldTruncate && maxItems) {
    const headCount = 1;
    const tailCount = Math.max(1, maxItems - 2);

    const head = fullTrail.slice(0, headCount).map((item, idx) => ({ item, originalIndex: idx }));
    const tail = fullTrail
      .slice(fullTrail.length - tailCount)
      .map((item, idx) => ({ item, originalIndex: fullTrail.length - tailCount + idx }));

    renderedItems = [...head, ...tail];
    hiddenItems = fullTrail
      .slice(headCount, fullTrail.length - tailCount)
      .map((item, idx) => ({ item, originalIndex: headCount + idx }));
  } else {
    renderedItems = fullTrail.map((item, idx) => ({ item, originalIndex: idx }));
  }

  const defaultSeparatorNode = separator || <ChevronSeparator />;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`kb-breadcrumbs ${className}`.trim()}
      data-testid={testId}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        fontSize: '13px',
        fontFamily: 'DM Sans, var(--font-body, sans-serif)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        padding: '8px 0',
        marginBottom: '16px',
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
        data-testid="breadcrumbs-list"
      >
        {renderedItems.map(({ item, originalIndex }, displayIdx) => {
          const isLast = displayIdx === renderedItems.length - 1;
          const href = buildBreadcrumbHref(item, categoryHrefPrefix, resourceHrefPrefix);

          // Render ellipsis button before tail items when truncated
          const showEllipsisBefore = shouldTruncate && displayIdx === 1;

          return (
            <React.Fragment key={`crumb-${item.id || item.slug || item.title}-${originalIndex}`}>
              {showEllipsisBefore && (
                <li
                  style={{ display: 'flex', alignItems: 'center' }}
                  data-testid="breadcrumbs-ellipsis-container"
                >
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    aria-label={`Show ${hiddenItems.length} hidden breadcrumb items`}
                    title="Click to expand breadcrumb trail"
                    data-testid="breadcrumbs-ellipsis-btn"
                    style={{
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      background: 'var(--color-surface-container-low, #f5f3ee)',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    ...
                  </button>
                  <span aria-hidden="true">{defaultSeparatorNode}</span>
                </li>
              )}

              <li
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  maxWidth: '100%',
                }}
                data-testid={`breadcrumb-item-${originalIndex}`}
              >
                {item.isCurrent ? (
                  <span
                    aria-current="page"
                    data-testid={`breadcrumb-current-${originalIndex}`}
                    style={{
                      color: 'var(--color-on-surface, #1b1c19)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px',
                    }}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </span>
                ) : (
                  <Link
                    href={href}
                    onClick={(e) => {
                      if (onNavigate) {
                        onNavigate(item, originalIndex);
                      }
                    }}
                    data-testid={`breadcrumb-link-${originalIndex}`}
                    style={{
                      color: 'var(--color-primary, #59452b)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '220px',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                )}

                {!isLast && (
                  <span aria-hidden="true" data-testid={`breadcrumb-separator-${originalIndex}`}>
                    {defaultSeparatorNode}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
