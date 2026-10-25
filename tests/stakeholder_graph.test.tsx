import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  StakeholderGraph,
  getRoleBadgeStyle,
  formatStakeholderInitials,
  filterStakeholderNodes,
  calculateGraphLayout,
} from '../src/components/deals/StakeholderGraph';
import { StakeholderGraphResponse, StakeholderNode } from '../src/services/api_client';

// Mock the API client function for auto-fetching test
vi.mock('../src/services/api_client', async () => {
  const actual = await vi.importActual('../src/services/api_client');
  return {
    ...actual,
    getStakeholders: vi.fn(),
    createStakeholder: vi.fn(),
  };
});

import { getStakeholders } from '../src/services/api_client';

describe('StakeholderGraph Component', () => {
  const mockNodes: StakeholderNode[] = [
    {
      id: 'node-1',
      name: 'Sarah Connor',
      org_role: 'Chief Technology Officer',
      contact_email: 'sarah.c@acme.com',
      deal_id: 'deal-101',
      parent_stakeholder_id: null,
      subordinate_ids: ['node-2', 'node-3'],
    },
    {
      id: 'node-2',
      name: 'John Miller',
      org_role: 'VP of Procurement',
      contact_email: 'john.m@acme.com',
      deal_id: 'deal-101',
      parent_stakeholder_id: 'node-1',
      subordinate_ids: ['node-4'],
    },
    {
      id: 'node-3',
      name: 'Alice Vance',
      org_role: 'Security Audit Lead',
      contact_email: 'alice.v@acme.com',
      deal_id: 'deal-101',
      parent_stakeholder_id: 'node-1',
      subordinate_ids: [],
    },
    {
      id: 'node-4',
      name: 'Bob Ross',
      org_role: 'Legal Counsel',
      contact_email: 'bob.r@acme.com',
      deal_id: 'deal-101',
      parent_stakeholder_id: 'node-2',
      subordinate_ids: [],
    },
  ];

  const mockGraphData: StakeholderGraphResponse = {
    deal_id: 'deal-101',
    nodes: mockNodes,
    edges: [
      { source_id: 'node-1', target_id: 'node-2', relationship_type: 'reports_to', is_cycle_edge: false },
      { source_id: 'node-1', target_id: 'node-3', relationship_type: 'reports_to', is_cycle_edge: false },
      { source_id: 'node-2', target_id: 'node-4', relationship_type: 'reports_to', is_cycle_edge: false },
    ],
    dag_edges: [
      { source_id: 'node-1', target_id: 'node-2', relationship_type: 'reports_to', is_cycle_edge: false },
      { source_id: 'node-1', target_id: 'node-3', relationship_type: 'reports_to', is_cycle_edge: false },
      { source_id: 'node-2', target_id: 'node-4', relationship_type: 'reports_to', is_cycle_edge: false },
    ],
    has_cycles: false,
    detected_cycles: [],
    root_stakeholder_ids: ['node-1'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Utility & Helper Functions', () => {
    it('resolves role badge styles correctly', () => {
      const exec = getRoleBadgeStyle('Chief Executive Officer');
      expect(exec.label).toBe('Executive / C-Suite');

      const director = getRoleBadgeStyle('VP of Engineering');
      expect(director.label).toBe('Director / Leadership');

      const mgr = getRoleBadgeStyle('Engineering Manager');
      expect(mgr.label).toBe('Manager / Lead');

      const specialist = getRoleBadgeStyle('Legal Counsel');
      expect(specialist.label).toBe('Specialist / Evaluator');

      const defaultStyle = getRoleBadgeStyle('External Contributor');
      expect(defaultStyle.label).toBe('Stakeholder / Member');
    });

    it('formats stakeholder initials correctly', () => {
      expect(formatStakeholderInitials('Sarah Connor')).toBe('SC');
      expect(formatStakeholderInitials('Cher')).toBe('CH');
      expect(formatStakeholderInitials('John Paul Jones')).toBe('JJ');
      expect(formatStakeholderInitials('')).toBe('??');
      expect(formatStakeholderInitials(null)).toBe('??');
    });

    it('filters stakeholder nodes by search term and role filter', () => {
      const searchResult = filterStakeholderNodes(mockNodes, 'miller', 'all');
      expect(searchResult).toHaveLength(1);
      expect(searchResult[0].name).toBe('John Miller');

      const roleResult = filterStakeholderNodes(mockNodes, '', 'executive');
      expect(roleResult).toHaveLength(1);
      expect(roleResult[0].name).toBe('Sarah Connor');
    });

    it('calculates 2D coordinates for graph layout', () => {
      const layout = calculateGraphLayout(
        mockNodes,
        mockGraphData.edges,
        mockGraphData.root_stakeholder_ids,
        800,
        500
      );

      expect(layout.size).toBe(4);
      expect(layout.has('node-1')).toBe(true);

      const rootPos = layout.get('node-1')!;
      const childPos = layout.get('node-2')!;

      expect(rootPos.level).toBe(0);
      expect(childPos.level).toBe(1);
      expect(childPos.y).toBeGreaterThan(rootPos.y);
    });
  });

  describe('Component Rendering States', () => {
    it('renders loading state when isLoading is true', () => {
      render(<StakeholderGraph isLoading={true} />);
      expect(screen.getByTestId('stakeholder-graph-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading Stakeholder Contact Network...')).toBeInTheDocument();
    });

    it('renders error state when error prop is provided', () => {
      render(<StakeholderGraph error="Database connection failed" />);
      expect(screen.getByTestId('stakeholder-graph-error')).toBeInTheDocument();
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });

    it('renders empty state when graphData is empty', () => {
      render(<StakeholderGraph graphData={{ deal_id: 'd1', nodes: [], edges: [], dag_edges: [], has_cycles: false, detected_cycles: [], root_stakeholder_ids: [] }} />);
      expect(screen.getByTestId('stakeholder-graph-empty')).toBeInTheDocument();
      expect(screen.getByText('No Stakeholder Contacts Mapped')).toBeInTheDocument();
    });

    it('renders graph nodes and header correctly with valid graphData', () => {
      render(<StakeholderGraph graphData={mockGraphData} />);

      expect(screen.getByText('Stakeholder Contact Network')).toBeInTheDocument();
      expect(screen.getByText('4 mapped contacts')).toBeInTheDocument();
      expect(screen.getByTestId('stakeholder-svg-canvas')).toBeInTheDocument();

      expect(screen.getByTestId('stakeholder-node-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('stakeholder-node-node-2')).toBeInTheDocument();
    });
  });

  describe('User Interactions & Views', () => {
    it('filters nodes via search input', () => {
      render(<StakeholderGraph graphData={mockGraphData} />);

      const searchInput = screen.getByTestId('stakeholder-search-input');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      const aliceNode = screen.getByTestId('stakeholder-node-node-3');
      expect(aliceNode).toHaveAttribute('opacity', '1');

      const sarahNode = screen.getByTestId('stakeholder-node-node-1');
      expect(sarahNode).toHaveAttribute('opacity', '0.3');
    });

    it('switches view modes to Tree and Directory Table', () => {
      render(<StakeholderGraph graphData={mockGraphData} />);

      // Switch to Tree view
      const treeBtn = screen.getByTestId('view-mode-tree');
      fireEvent.click(treeBtn);

      expect(screen.getByTestId('stakeholder-tree-view')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-node-1')).toBeInTheDocument();

      // Switch to Table view
      const tableBtn = screen.getByTestId('view-mode-table');
      fireEvent.click(tableBtn);

      expect(screen.getByTestId('stakeholder-table-view')).toBeInTheDocument();
      expect(screen.getByTestId('table-node-node-1')).toBeInTheDocument();
    });

    it('selects a node when clicked and opens contact detail panel', () => {
      const onNodeSelect = vi.fn();
      const onNodeClick = vi.fn();

      render(
        <StakeholderGraph
          graphData={mockGraphData}
          onNodeSelect={onNodeSelect}
          onNodeClick={onNodeClick}
        />
      );

      const node1 = screen.getByTestId('stakeholder-node-node-1');
      fireEvent.click(node1);

      expect(onNodeSelect).toHaveBeenCalledWith('node-1');
      expect(onNodeClick).toHaveBeenCalled();

      expect(screen.getByTestId('stakeholder-detail-panel')).toBeInTheDocument();
      expect(screen.getByText('Chief Technology Officer')).toBeInTheDocument();
    });

    it('renders cycle warning banner when has_cycles is true', () => {
      const cycleGraphData: StakeholderGraphResponse = {
        ...mockGraphData,
        has_cycles: true,
        detected_cycles: [['node-1', 'node-2', 'node-1']],
      };

      render(<StakeholderGraph graphData={cycleGraphData} />);

      expect(screen.getByTestId('cycle-warning-banner')).toBeInTheDocument();
      expect(screen.getByText(/Circular Relationship Detected/)).toBeInTheDocument();

      const dagBtn = screen.getByTestId('toggle-dag-btn');
      fireEvent.click(dagBtn);
      expect(dagBtn).toHaveTextContent('Show Full Graph');
    });

    it('opens add stakeholder modal and submits form payload', async () => {
      const onCreateStakeholder = vi.fn().mockResolvedValue(undefined);

      render(
        <StakeholderGraph
          graphData={mockGraphData}
          onCreateStakeholder={onCreateStakeholder}
        />
      );

      const addBtn = screen.getByTestId('add-stakeholder-btn');
      fireEvent.click(addBtn);

      expect(screen.getByTestId('add-stakeholder-modal')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('input-stakeholder-name'), {
        target: { value: 'David Kim' },
      });
      fireEvent.change(screen.getByTestId('input-stakeholder-role'), {
        target: { value: 'VP of Operations' },
      });
      fireEvent.change(screen.getByTestId('input-stakeholder-email'), {
        target: { value: 'david.k@acme.com' },
      });

      const submitBtn = screen.getByTestId('submit-stakeholder-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onCreateStakeholder).toHaveBeenCalledWith({
          name: 'David Kim',
          org_role: 'VP of Operations',
          contact_email: 'david.k@acme.com',
          parent_stakeholder_id: null,
        });
      });
    });

    it('fetches graph data automatically if dealId is provided without graphData', async () => {
      vi.mocked(getStakeholders).mockResolvedValue(mockGraphData);

      render(<StakeholderGraph dealId="deal-999" />);

      await waitFor(() => {
        expect(getStakeholders).toHaveBeenCalledWith('deal-999');
        expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
      });
    });
  });
});
