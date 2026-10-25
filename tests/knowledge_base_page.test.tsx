import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KnowledgeBasePage, {
  KnowledgeBaseContent,
} from '../src/app/knowledge-base/page';
import { KBCategoryNode, KBResourceSummary } from '../src/services/kb_client';
import { CurrentUserResponse } from '../src/services/auth';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/knowledge-base',
}));

describe('KnowledgeBasePage Component', () => {
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
      children: [],
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
    {
      id: 'res-tutorial-1',
      category_id: 'cat-api',
      category_title: 'API & Developer Tools',
      title: 'Configuring Webhook Event Listeners Tutorial',
      slug: 'configuring-webhooks-tutorial',
      content_type: 'TUTORIAL',
      body_text: 'Step-by-step interactive tutorial for configuring real-time webhook endpoints.',
      media_url: 'https://example.com/video.mp4',
      tags: ['api', 'webhooks', 'tutorial'],
      onboarding_phase: 'phase_2',
      published_on: '2026-03-30T10:00:00Z',
      highlights: [],
    },
    {
      id: 'res-video-1',
      category_id: 'cat-api',
      category_title: 'API & Developer Tools',
      title: 'OAuth2 Authentication Flow Video Walkthrough',
      slug: 'oauth2-auth-video',
      content_type: 'VIDEO',
      body_text: 'Watch this 5-minute streaming video guide explaining authorization grant types.',
      media_url: 'https://youtube.com/watch?v=12345',
      tags: ['auth', 'video', 'security'],
      onboarding_phase: 'phase_2',
      published_on: '2026-03-30T10:00:00Z',
      highlights: [],
    },
  ];

  it('renders Knowledge Base home page aggregating header, search bar, categories, and resources', () => {
    render(
      <KnowledgeBaseContent
        user={mockUser}
        initialCategories={mockCategories}
        initialResources={mockResources}
        autoFetch={false}
      />
    );

    // Verify main page elements
    expect(screen.getByTestId('knowledge-base-page')).toBeInTheDocument();
    expect(screen.getByTestId('kb-page-header')).toBeInTheDocument();
    expect(screen.getByTestId('kb-search-section')).toBeInTheDocument();
    expect(screen.getByTestId('kb-categories-section')).toBeInTheDocument();
    expect(screen.getByTestId('kb-resources-section')).toBeInTheDocument();

    // Verify header title
    expect(screen.getByRole('heading', { level: 1, name: /Knowledge Base/i })).toBeInTheDocument();

    // Verify categories rendered
    expect(screen.getByTestId('category-card-cat-onboarding')).toBeInTheDocument();
    expect(screen.getByTestId('category-card-cat-api')).toBeInTheDocument();

    // Verify resource cards rendered for all content types
    expect(screen.getByTestId('resource-card-res-faq-1')).toBeInTheDocument();
    expect(screen.getByTestId('resource-card-res-playbook-1')).toBeInTheDocument();
    expect(screen.getByTestId('resource-card-res-tutorial-1')).toBeInTheDocument();
    expect(screen.getByTestId('resource-card-res-video-1')).toBeInTheDocument();
  });

  it('filters resources by content type when filter chip is selected', async () => {
    const customFetchResources = vi.fn().mockImplementation((params) => {
      if (params?.content_type === 'FAQ') {
        return Promise.resolve({
          items: [mockResources[0]],
          total_count: 1,
          page: 1,
          limit: 10,
        });
      }
      return Promise.resolve({
        items: mockResources,
        total_count: mockResources.length,
        page: 1,
        limit: 10,
      });
    });

    render(
      <KnowledgeBaseContent
        user={mockUser}
        initialCategories={mockCategories}
        initialResources={mockResources}
        fetchResources={customFetchResources}
        autoFetch={true}
      />
    );

    // Click FAQ filter chip in search bar
    const faqChip = screen.getByTestId('content-type-chip-FAQ');
    fireEvent.click(faqChip);

    await waitFor(() => {
      expect(customFetchResources).toHaveBeenCalledWith(
        expect.objectContaining({ content_type: 'FAQ' })
      );
    });
  });

  it('filters resources when category card is clicked', async () => {
    const customFetchResources = vi.fn().mockResolvedValue({
      items: [mockResources[2], mockResources[3]],
      total_count: 2,
      page: 1,
      limit: 10,
    });

    render(
      <KnowledgeBaseContent
        user={mockUser}
        initialCategories={mockCategories}
        initialResources={mockResources}
        fetchResources={customFetchResources}
        autoFetch={true}
      />
    );

    const apiCategoryCard = screen.getByTestId('category-card-cat-api');
    fireEvent.click(apiCategoryCard);

    await waitFor(() => {
      expect(customFetchResources).toHaveBeenCalledWith(
        expect.objectContaining({ category_id: 'cat-api' })
      );
    });
  });

  it('displays empty state when search returns no matching resources', () => {
    render(
      <KnowledgeBaseContent
        user={mockUser}
        initialCategories={mockCategories}
        initialResources={[]}
        initialTotal={0}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('kb-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/No Knowledge Base Resources Found/i)).toBeInTheDocument();
  });

  it('renders default page wrapped in ProtectedRoute when user is provided', () => {
    render(
      <KnowledgeBasePage
        user={mockUser}
        initialCategories={mockCategories}
        initialResources={mockResources}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('knowledge-base-page')).toBeInTheDocument();
  });
});
