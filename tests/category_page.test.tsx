import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoryBrowsingPage, {
  CategoryContent,
  findCategoryInTree,
} from '../src/app/knowledge-base/category/[id]/page';
import { KBCategoryNode, KBResourceSummary } from '../src/services/kb_client';
import { CurrentUserResponse } from '../src/services/auth';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/knowledge-base/category/cat-onboarding',
}));

describe('CategoryBrowsingPage Component', () => {
  const mockUser: CurrentUserResponse = {
    id: 'user-123',
    email: 'testuser@example.com',
    full_name: 'Test User',
    tenant_id: 'tenant-456',
  };

  const mockCategories: KBCategoryNode[] = [
    {
      id: 'cat-onboarding',
      title: 'Platform Onboarding',
      slug: 'platform-onboarding',
      description: 'Getting started guides and setup checklists for new users',
      display_order: 1,
      children: [
        {
          id: 'cat-onboarding-sub1',
          title: 'Account Setup Subcategory',
          slug: 'account-setup-sub',
          description: 'Subcategory for initial account setup',
          display_order: 1,
          parent_id: 'cat-onboarding',
          children: [],
        },
      ],
    },
    {
      id: 'cat-api',
      title: 'API & Developer Tools',
      slug: 'api-developer-tools',
      description: 'REST API documentation, webhooks, and SDK integration guides',
      display_order: 2,
      children: [],
    },
  ];

  const mockResources: KBResourceSummary[] = [
    {
      id: 'res-faq-1',
      category_id: 'cat-onboarding',
      category_title: 'Platform Onboarding',
      title: 'How do I invite team members to my workspace?',
      slug: 'invite-team-members-faq',
      content_type: 'FAQ',
      body_text: 'Navigate to Workspace Settings -> Team Members and enter recipient email address.',
      media_url: null,
      tags: ['team', 'workspace', 'setup'],
      onboarding_phase: 'phase_1',
      published_on: '2026-03-30T10:00:00Z',
      highlights: [],
    },
    {
      id: 'res-playbook-1',
      category_id: 'cat-onboarding',
      category_title: 'Platform Onboarding',
      title: 'Executive Onboarding Playbook',
      slug: 'executive-onboarding-playbook',
      content_type: 'PLAYBOOK',
      body_text: 'Comprehensive walkthrough covering administrative controls, security settings, and reporting.',
      media_url: null,
      tags: ['executive', 'security', 'playbook'],
      onboarding_phase: 'phase_1',
      published_on: '2026-03-30T10:00:00Z',
      highlights: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findCategoryInTree helper', () => {
    it('locates target category node and computes ancestor path correctly', () => {
      const match = findCategoryInTree(mockCategories, 'cat-onboarding-sub1');
      expect(match).not.toBeNull();
      expect(match?.category.id).toBe('cat-onboarding-sub1');
      expect(match?.ancestors).toHaveLength(1);
      expect(match?.ancestors[0].id).toBe('cat-onboarding');
    });

    it('returns null if target ID is not found in tree', () => {
      const match = findCategoryInTree(mockCategories, 'non-existent-cat');
      expect(match).toBeNull();
    });
  });

  describe('CategoryContent component rendering and interactions', () => {
    it('renders category title, description, subcategories, and breadcrumbs [FR-10]', async () => {
      render(
        <CategoryContent
          categoryId="cat-onboarding"
          user={mockUser}
          initialCategories={mockCategories}
          initialResources={mockResources}
          initialTotal={2}
          autoFetch={false}
        />
      );

      // Category Header Title & Description
      expect(screen.getByTestId('category-title')).toHaveTextContent('Platform Onboarding');
      expect(screen.getByTestId('category-description')).toHaveTextContent(
        'Getting started guides and setup checklists for new users'
      );

      // Subcategories section
      expect(screen.getByTestId('subcategories-section')).toBeInTheDocument();
      expect(screen.getByTestId('subcategory-chip-cat-onboarding-sub1')).toHaveTextContent(
        'Account Setup Subcategory'
      );

      // Breadcrumb Navigation [FR-10]
      expect(screen.getByTestId('kb-breadcrumbs')).toBeInTheDocument();
      expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
    });

    it('renders resource cards with content type badges and tags', () => {
      render(
        <CategoryContent
          categoryId="cat-onboarding"
          user={mockUser}
          initialCategories={mockCategories}
          initialResources={mockResources}
          initialTotal={2}
          autoFetch={false}
        />
      );

      expect(screen.getByTestId('resource-card-res-faq-1')).toBeInTheDocument();
      expect(screen.getByTestId('resource-card-res-playbook-1')).toBeInTheDocument();
      expect(
        screen.getByText('How do I invite team members to my workspace?')
      ).toBeInTheDocument();
      expect(screen.getByText('Executive Onboarding Playbook')).toBeInTheDocument();
    });

    it('filters resources when search query is submitted [FR-4]', async () => {
      const customFetchResources = vi.fn().mockResolvedValue({
        items: [mockResources[0]],
        total_count: 1,
        page: 1,
        limit: 10,
      });

      render(
        <CategoryContent
          categoryId="cat-onboarding"
          user={mockUser}
          initialCategories={mockCategories}
          fetchResources={customFetchResources}
          autoFetch={true}
        />
      );

      await waitFor(() => {
        expect(customFetchResources).toHaveBeenCalled();
      });

      // Submit search query
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'invite' } });

      const searchForm = screen.getByTestId('search-form');
      fireEvent.submit(searchForm);

      await waitFor(() => {
        expect(customFetchResources).toHaveBeenLastCalledWith(
          expect.objectContaining({
            query: 'invite',
            category_id: 'cat-onboarding',
          })
        );
      });
    });

    it('renders empty state when no resources match filters', () => {
      render(
        <CategoryContent
          categoryId="cat-onboarding"
          user={mockUser}
          initialCategories={mockCategories}
          initialResources={[]}
          initialTotal={0}
          autoFetch={false}
        />
      );

      expect(screen.getByTestId('category-empty-state')).toBeInTheDocument();
      expect(
        screen.getByText('No Matching Resources in This Category')
      ).toBeInTheDocument();
    });

    it('handles clear filters button in empty state', async () => {
      const customFetchResources = vi.fn().mockResolvedValue({
        items: mockResources,
        total_count: 2,
        page: 1,
        limit: 10,
      });

      render(
        <CategoryContent
          categoryId="cat-onboarding"
          user={mockUser}
          initialCategories={mockCategories}
          initialResources={[]}
          initialTotal={0}
          fetchResources={customFetchResources}
          autoFetch={true}
        />
      );

      const clearBtn = screen.getByTestId('empty-clear-filters-btn');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(customFetchResources).toHaveBeenCalled();
      });
    });
  });
});
