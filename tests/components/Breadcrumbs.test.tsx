import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Breadcrumbs,
  normalizeBreadcrumbItem,
  buildBreadcrumbHref,
  BreadcrumbItem,
} from '../../src/components/kb/Breadcrumbs';
import { KBBreadcrumb } from '../../src/services/kb_client';

describe('normalizeBreadcrumbItem Utility', () => {
  it('normalizes a KBBreadcrumb object correctly', () => {
    const raw: KBBreadcrumb = {
      id: 'cat-123',
      title: 'Getting Started',
      slug: 'getting-started',
    };
    const normalized = normalizeBreadcrumbItem(raw, true);

    expect(normalized.id).toBe('cat-123');
    expect(normalized.title).toBe('Getting Started');
    expect(normalized.slug).toBe('getting-started');
    expect(normalized.isCategory).toBe(true);
    expect(normalized.isCurrent).toBe(true);
  });

  it('preserves custom BreadcrumbItem properties', () => {
    const custom: BreadcrumbItem = {
      title: 'API Reference',
      href: '/docs/api',
      isCategory: false,
      contentType: 'TUTORIAL',
      isCurrent: false,
    };
    const normalized = normalizeBreadcrumbItem(custom, false);

    expect(normalized.title).toBe('API Reference');
    expect(normalized.href).toBe('/docs/api');
    expect(normalized.isCategory).toBe(false);
    expect(normalized.contentType).toBe('TUTORIAL');
    expect(normalized.isCurrent).toBe(false);
  });
});

describe('buildBreadcrumbHref Utility', () => {
  it('uses explicit href if provided', () => {
    const item: BreadcrumbItem = { title: 'Custom', href: '/custom/link' };
    expect(buildBreadcrumbHref(item)).toBe('/custom/link');
  });

  it('builds category route using slug when available', () => {
    const item: BreadcrumbItem = { title: 'Onboarding', slug: 'onboarding', isCategory: true };
    expect(buildBreadcrumbHref(item)).toBe('/knowledge-base/category/onboarding');
  });

  it('builds resource route when item represents a resource/contentType', () => {
    const item: BreadcrumbItem = { title: 'Setup Video', slug: 'setup-video', contentType: 'VIDEO' };
    expect(buildBreadcrumbHref(item)).toBe('/knowledge-base/setup-video');
  });

  it('respects custom category and resource href prefixes', () => {
    const item: BreadcrumbItem = { title: 'Billing', slug: 'billing', isCategory: true };
    expect(buildBreadcrumbHref(item, '/kb/cat', '/kb/doc')).toBe('/kb/cat/billing');
  });
});

describe('Breadcrumbs Component', () => {
  const sampleItems: KBBreadcrumb[] = [
    { id: 'cat-1', title: 'User Guides', slug: 'user-guides' },
    { id: 'cat-2', title: 'Account Setup', slug: 'account-setup' },
  ];

  it('renders root home link and category trail by default', () => {
    render(
      <Breadcrumbs
        items={sampleItems}
        currentTitle="Configuring 2FA Security"
        data-testid="breadcrumbs-test"
      />
    );

    const nav = screen.getByTestId('breadcrumbs-test');
    expect(nav).toBeDefined();

    const homeLink = screen.getByText('Knowledge Base');
    expect(homeLink).toBeDefined();

    const cat1 = screen.getByText('User Guides');
    expect(cat1).toBeDefined();

    const cat2 = screen.getByText('Account Setup');
    expect(cat2).toBeDefined();

    const currentDoc = screen.getByText('Configuring 2FA Security');
    expect(currentDoc).toBeDefined();
    expect(currentDoc.closest('span')?.getAttribute('aria-current')).toBe('page');
  });

  it('hides root home link when showHome is false', () => {
    render(
      <Breadcrumbs
        items={sampleItems}
        showHome={false}
        currentTitle="Current Page"
        data-testid="no-home-breadcrumbs"
      />
    );

    expect(screen.queryByText('Knowledge Base')).toBeNull();
    expect(screen.getByText('User Guides')).toBeDefined();
    expect(screen.getByText('Current Page')).toBeDefined();
  });

  it('triggers onNavigate callback when link is clicked', () => {
    const onNavigateSpy = vi.fn();
    render(
      <Breadcrumbs
        items={sampleItems}
        onNavigate={onNavigateSpy}
        currentTitle="Active Document"
      />
    );

    const link = screen.getByText('User Guides');
    fireEvent.click(link);

    expect(onNavigateSpy).toHaveBeenCalledTimes(1);
    expect(onNavigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'User Guides', slug: 'user-guides' }),
      1 // index 1 because home is index 0
    );
  });

  it('collapses items into an ellipsis button when total items exceed maxItems', () => {
    const longTrail: KBBreadcrumb[] = [
      { id: '1', title: 'Level 1', slug: 'level-1' },
      { id: '2', title: 'Level 2', slug: 'level-2' },
      { id: '3', title: 'Level 3', slug: 'level-3' },
      { id: '4', title: 'Level 4', slug: 'level-4' },
    ];

    render(
      <Breadcrumbs
        items={longTrail}
        maxItems={3}
        currentTitle="Deep Article"
        data-testid="truncated-breadcrumbs"
      />
    );

    // Should show home, ellipsis button, and final items
    const ellipsisBtn = screen.getByTestId('breadcrumbs-ellipsis-btn');
    expect(ellipsisBtn).toBeDefined();

    // Intermediate items should be hidden before expanding
    expect(screen.queryByText('Level 2')).toBeNull();

    // Clicking ellipsis button expands full trail
    fireEvent.click(ellipsisBtn);
    expect(screen.getByText('Level 2')).toBeDefined();
  });

  it('renders custom separator when provided', () => {
    render(
      <Breadcrumbs
        items={[{ id: 'c1', title: 'Category One', slug: 'cat-one' }]}
        separator={<span data-testid="custom-sep">~</span>}
        currentTitle="Doc Title"
      />
    );

    const customSeps = screen.getAllByTestId('custom-sep');
    expect(customSeps.length).toBeGreaterThan(0);
    expect(customSeps[0].textContent).toBe('~');
  });

  it('prevents duplicate current title if items array already includes it as last item', () => {
    render(
      <Breadcrumbs
        items={[
          { id: 'c1', title: 'Parent Category', slug: 'parent' },
          { id: 'd1', title: 'Duplicate Doc', slug: 'dup-doc' },
        ]}
        currentTitle="Duplicate Doc"
      />
    );

    const matches = screen.getAllByText('Duplicate Doc');
    expect(matches.length).toBe(1);
  });

  it('returns null when full trail is empty and showHome is false', () => {
    const { container } = render(
      <Breadcrumbs items={[]} showHome={false} currentTitle="" />
    );
    expect(container.firstChild).toBeNull();
  });
});
