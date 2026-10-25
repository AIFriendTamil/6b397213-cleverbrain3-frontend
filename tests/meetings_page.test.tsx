import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MeetingsPage, { MeetingsPageContent } from '../src/app/meetings/page';
import { CurrentUserResponse } from '../src/services/auth';
import { MeetingEvent, MeetingBrief } from '../src/services/api_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/meetings',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock API client services
vi.mock('../src/services/api_client', async () => {
  const actual = await vi.importActual<typeof import('../src/services/api_client')>('../src/services/api_client');
  return {
    ...actual,
    getScheduledMeetings: vi.fn(),
    getMeetingBrief: vi.fn(),
    createScheduledMeeting: vi.fn(),
    getFunnelStageLeads: vi.fn(),
  };
});

import { getScheduledMeetings, getMeetingBrief, getFunnelStageLeads } from '../src/services/api_client';

const mockUser: CurrentUserResponse = {
  user_id: 'usr-mtg-888',
  email: 'sales.lead@example.com',
  full_name: 'Sales Manager',
  tenant_id: 'tnt-sales-101',
};

const mockMeetings: MeetingEvent[] = [
  {
    event_id: 'evt-101',
    meeting_id: 'mtg-101',
    lead_id: 'lead-001',
    title: 'Enterprise Technical Alignment',
    start_timestamp: '2026-10-24T10:00:00Z',
    end_timestamp: '2026-10-24T11:00:00Z',
    description: 'Review custom architecture and data residency requirements',
    location: 'Online Meeting Room',
    status: 'CONFIRMED',
    is_external: true,
    is_fallback: false,
  },
  {
    event_id: 'evt-102',
    meeting_id: 'mtg-102',
    lead_id: 'lead-002',
    title: 'SLA & Pricing Review',
    start_timestamp: '2026-10-25T14:00:00Z',
    end_timestamp: '2026-10-25T15:00:00Z',
    description: 'Negotiate tier-1 support levels and contract terms',
    location: 'Headquarters Room 4B',
    status: 'CONFIRMED',
    is_external: false,
    is_fallback: true,
  },
];

const mockBrief: MeetingBrief = {
  brief_id: 'brief-101',
  meeting_id: 'mtg-101',
  lead_id: 'lead-001',
  quality_score: 88,
  interaction_history_summary: 'Requested enterprise whitepaper and attended Q3 Product Webinar.',
  key_discussion_notes: 'Key stakeholders focus on security, compliance, and custom SLA tiers.',
  brief_summary_text: 'High-intent lead preparing for executive presentation.',
  created_timestamp: '2026-10-24T08:00:00Z',
};

describe('MeetingsPage Route Component (Feature 005 - T027)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getScheduledMeetings).mockResolvedValue(mockMeetings);
    vi.mocked(getMeetingBrief).mockResolvedValue(mockBrief);
    vi.mocked(getFunnelStageLeads).mockResolvedValue({
      stage_id: 'stage-mql',
      stage_name: 'MQL',
      total_leads: 1,
      page: 1,
      limit: 10,
      leads: [
        {
          lead_id: 'lead-001',
          source_id: 'src-1',
          quality_score: 88,
          status_stage: 'stage-mql',
          region_name: 'North America',
          deal_value: 50000,
          created_timestamp: '2026-10-01T00:00:00Z',
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders session loading state initially when session is resolving', async () => {
    const mockFetchUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockUser), 50)
        )
    );

    render(
      <MeetingsPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialEvents={mockMeetings}
      />
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('meetings-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<MeetingsPage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders MeetingsPageContent directly when initialUser is provided', () => {
    render(
      <MeetingsPage
        user={mockUser}
        initialEvents={mockMeetings}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('meetings-page')).toBeInTheDocument();
    expect(screen.getByTestId('meetings-header')).toBeInTheDocument();
    expect(screen.getByTestId('meetings-eyebrow')).toHaveTextContent('Sales Meeting Management');
    expect(screen.getByTestId('meetings-title')).toHaveTextContent('Sales Meetings & Prep Briefs');
    expect(screen.getByTestId('meetings-description')).toBeInTheDocument();

    // Check quick action links
    expect(screen.getByTestId('acquisition-dashboard-link')).toHaveAttribute('href', '/acquisition');
    expect(screen.getByTestId('funnel-analytics-link')).toHaveAttribute('href', '/funnel');
    expect(screen.getByTestId('territory-heatmap-link')).toHaveAttribute('href', '/territory');
    expect(screen.getByTestId('campaign-matrix-link')).toHaveAttribute('href', '/campaigns');

    // Check CalendarView container section
    expect(screen.getByTestId('calendar-view-section')).toBeInTheDocument();
  });

  it('renders scheduled meetings list inside CalendarView component', async () => {
    render(
      <MeetingsPageContent
        user={mockUser}
        initialEvents={mockMeetings}
        autoFetch={false}
      />
    );

    expect(screen.getByText('Enterprise Technical Alignment')).toBeInTheDocument();
    expect(screen.getByText('SLA & Pricing Review')).toBeInTheDocument();
  });

  it('supports selecting a meeting and triggering callback handlers', async () => {
    const handleSelect = vi.fn();
    const handleFilterChange = vi.fn();

    render(
      <MeetingsPageContent
        user={mockUser}
        initialEvents={mockMeetings}
        onMeetingSelect={handleSelect}
        onFilterChange={handleFilterChange}
        autoFetch={false}
      />
    );

    const meetingCard = screen.getByText('Enterprise Technical Alignment');
    fireEvent.click(meetingCard);

    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({
      event_id: 'evt-101',
      title: 'Enterprise Technical Alignment',
    }));

    // Drawer should open displaying prep brief
    await waitFor(() => {
      expect(screen.getByText('Preparation Brief')).toBeInTheDocument();
    });
  });

  it('allows opening the Schedule Meeting modal', async () => {
    render(
      <MeetingsPageContent
        user={mockUser}
        initialEvents={mockMeetings}
        autoFetch={false}
      />
    );

    const scheduleBtn = screen.getByTestId('schedule-meeting-btn');
    fireEvent.click(scheduleBtn);

    expect(screen.getByTestId('schedule-modal-title')).toHaveTextContent('Schedule Sales Meeting');
    expect(screen.getByTestId('input-meeting-title')).toBeInTheDocument();
  });
});
