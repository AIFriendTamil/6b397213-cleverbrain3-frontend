import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SearchBar,
  HighlightText,
  getContentTypeBadgeConfig,
  DEFAULT_CONTENT_TYPES,
  DEFAULT_ONBOARDING_PHASES,
  CategoryOption,
} from '../../src/components/kb/SearchBar';
import { KBResourceSummary } from '../../src/services/kb_client';

describe('getContentTypeBadgeConfig Utility', () => {
  it('returns badge configuration for standard content types', () => {
    const faqCfg = getContentTypeBadgeConfig('FAQ');
    expect(faqCfg.label).toBe('FAQ');
    expect(faqCfg.bg).toBeDefined();

    const playbookCfg = getContentTypeBadgeConfig('PLAYBOOK');
    expect(playbookCfg.label).toBe('Playbook');

    const videoCfg = getContentTypeBadgeConfig('VIDEO');
    expect(videoCfg.label).toBe('Video');

    const unknownCfg = getContentTypeBadgeConfig('CUSTOM_TYPE');
    expect(unknownCfg.label).toBe('CUSTOM_TYPE');
  });
});

describe('HighlightText Component', () => {
  it('renders unhighlighted text when search query is empty', () => {
    render(<HighlightText text="Welcome to Onboarding Guide" query="" data-testid="test-highlight" />);
    const span = screen.getByTestId('test-highlight');
    expect(span.textContent).toBe('Welcome to Onboarding Guide');
    expect(screen.queryByTestId('highlighted-keyword')).toBeNull();
  });

  it('highlights matching single keyword query case-insensitively', () => {
    render(
      <HighlightText
        text="Learn how to configure your account settings."
        query="configure"
        data-testid="test-highlight"
      />
    );
    const marks = screen.getAllByTestId('highlighted-keyword');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('configure');
  });

  it('highlights multi-word search query terms', () => {
    render(
      <HighlightText
        text="Setup your workspace and invite team members to join."
        query="setup invite"
        data-testid="test-highlight"
      />
    );
    const marks = screen.getAllByTestId('highlighted-keyword');
    expect(marks.length).toBe(2);
    expect(marks.map((m) => m.textContent)).toEqual(['Setup', 'invite']);
  });
});

describe('SearchBar Component', () => {
  const mockCategories: CategoryOption[] = [
    { id: 'cat-1', title: 'Getting Started', slug: 'getting-started' },
    { id: 'cat-2', title: 'Configuration', slug: 'configuration' },
  ];

  const mockResults: KBResourceSummary[] = [
    {
      id: 'res-1',
      category_id: 'cat-1',
      category_title: 'Getting Started',
      title: 'Welcome to Platform Onboarding',
      slug: 'welcome-onboarding',
      content_type: 'PLAYBOOK',
      body_text: 'This playbook covers initial setup steps and workspace configuration.',
      media_url: null,
      tags: ['onboarding', 'setup'],
      onboarding_phase: 'phase_1',
      published_on: '2026-03-30T10:00:00Z',
      highlights: ['initial setup steps'],
    },
    {
      id: 'res-2',
      category_id: 'cat-2',
      category_title: 'Configuration',
      title: 'Advanced API Integration Tutorial',
      slug: 'api-integration-tutorial',
      content_type: 'TUTORIAL',
      body_text: 'Learn step by step how to connect external webhooks and services.',
      media_url: 'https://example.com/video.mp4',
      tags: ['api', 'integration'],
      onboarding_phase: 'phase_2',
      published_on: '2026-03-30T10:00:00Z',
      highlights: [],
    },
  ];

  let onSearchMock: ReturnType<typeof vi.fn>;
  let onQueryChangeMock: ReturnType<typeof vi.fn>;
  let onFilterChangeMock: ReturnType<typeof vi.fn>;
  let onClearAllMock: ReturnType<typeof vi.fn>;
  let onResultSelectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSearchMock = vi.fn();
    onQueryChangeMock = vi.fn();
    onFilterChangeMock = vi.fn();
    onClearAllMock = vi.fn();
    onResultSelectMock = vi.fn();
  });

  it('renders search input field and submit button', () => {
    render(<SearchBar placeholder="Test placeholder..." />);

    const input = screen.getByTestId('search-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.placeholder).toBe('Test placeholder...');

    const submitBtn = screen.getByTestId('search-submit-button');
    expect(submitBtn).toBeInTheDocument();
  });

  it('triggers onQueryChange when user types in search input', () => {
    render(<SearchBar onQueryChange={onQueryChangeMock} />);

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'onboarding' } });

    expect(onQueryChangeMock).toHaveBeenCalledWith('onboarding');
  });

  it('shows clear query button when input has text and clears on click', () => {
    render(<SearchBar initialQuery="setup" onQueryChange={onQueryChangeMock} onSearch={onSearchMock} />);

    const clearBtn = screen.getByTestId('clear-query-button');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    const input = screen.getByTestId('search-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(onQueryChangeMock).toHaveBeenCalledWith('');
    expect(onSearchMock).toHaveBeenCalledWith({
      query: '',
      contentType: '',
      categoryId: '',
      onboardingPhase: '',
    });
  });

  it('submits search form on submit button click', () => {
    render(
      <SearchBar
        initialQuery="tutorials"
        initialContentType="TUTORIAL"
        onSearch={onSearchMock}
      />
    );

    const submitBtn = screen.getByTestId('search-submit-button');
    fireEvent.click(submitBtn);

    expect(onSearchMock).toHaveBeenCalledWith({
      query: 'tutorials',
      contentType: 'TUTORIAL',
      categoryId: '',
      onboardingPhase: '',
    });
  });

  it('renders content type filter chips and toggles selection', () => {
    render(
      <SearchBar
        categories={mockCategories}
        onFilterChange={onFilterChangeMock}
        onSearch={onSearchMock}
      />
    );

    // Check content type chips exist
    const playbookChip = screen.getByTestId('content-type-chip-PLAYBOOK');
    expect(playbookChip).toBeInTheDocument();
    expect(playbookChip.getAttribute('aria-pressed')).toBe('false');

    // Click Playbook filter chip
    fireEvent.click(playbookChip);

    expect(onFilterChangeMock).toHaveBeenCalledWith({
      contentType: 'PLAYBOOK',
      categoryId: '',
      onboardingPhase: '',
    });
    expect(onSearchMock).toHaveBeenCalledWith({
      query: '',
      contentType: 'PLAYBOOK',
      categoryId: '',
      onboardingPhase: '',
    });
  });

  it('renders category filter chips when categories are provided', () => {
    render(
      <SearchBar
        categories={mockCategories}
        onFilterChange={onFilterChangeMock}
      />
    );

    const catChip = screen.getByTestId('category-chip-cat-1');
    expect(catChip).toBeInTheDocument();
    expect(catChip.textContent).toBe('Getting Started');

    fireEvent.click(catChip);

    expect(onFilterChangeMock).toHaveBeenCalledWith({
      contentType: '',
      categoryId: 'cat-1',
      onboardingPhase: '',
    });
  });

  it('renders onboarding phase filter chips and toggles selection', () => {
    render(
      <SearchBar
        onFilterChange={onFilterChangeMock}
      />
    );

    const phaseChip = screen.getByTestId('onboarding-phase-chip-phase_1');
    expect(phaseChip).toBeInTheDocument();

    fireEvent.click(phaseChip);

    expect(onFilterChangeMock).toHaveBeenCalledWith({
      contentType: '',
      categoryId: '',
      onboardingPhase: 'phase_1',
    });
  });

  it('renders active filters summary and resets all filters on Clear All click', () => {
    render(
      <SearchBar
        initialQuery="setup"
        initialContentType="PLAYBOOK"
        initialCategoryId="cat-1"
        categories={mockCategories}
        onClearAll={onClearAllMock}
        onSearch={onSearchMock}
      />
    );

    // Summary bar should be visible
    expect(screen.getByTestId('active-filters-summary')).toBeInTheDocument();

    const clearAllBtn = screen.getByTestId('clear-all-filters-button');
    fireEvent.click(clearAllBtn);

    expect(onClearAllMock).toHaveBeenCalled();
    expect(onSearchMock).toHaveBeenCalledWith({
      query: '',
      contentType: '',
      categoryId: '',
      onboardingPhase: '',
    });
  });

  it('renders search results list with content type tag badges and keyword highlighting', () => {
    render(
      <SearchBar
        initialQuery="setup"
        results={mockResults}
        totalResults={2}
        onResultSelect={onResultSelectMock}
      />
    );

    // Results container and count
    expect(screen.getByTestId('search-results-count')).toHaveTextContent('2 resources found');

    // Result cards
    const card1 = screen.getByTestId('search-result-card-res-1');
    const card2 = screen.getByTestId('search-result-card-res-2');
    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();

    // Check Content Type tags
    const tags = screen.getAllByTestId('result-content-type-tag');
    expect(tags[0].textContent).toBe('Playbook');
    expect(tags[1].textContent).toBe('Tutorial');

    // Keyword highlighting inside title or body
    const highlights = screen.getAllByTestId('highlighted-keyword');
    expect(highlights.length).toBeGreaterThan(0);

    // Click card
    fireEvent.click(card1);
    expect(onResultSelectMock).toHaveBeenCalledWith(mockResults[0]);
  });

  it('renders no results message when results array is empty', () => {
    render(<SearchBar results={[]} totalResults={0} />);

    expect(screen.getByTestId('no-search-results')).toHaveTextContent(
      'No matching knowledge base resources found.'
    );
  });
});
