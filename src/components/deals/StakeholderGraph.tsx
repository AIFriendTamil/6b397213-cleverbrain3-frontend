'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StakeholderNode,
  StakeholderEdge,
  StakeholderGraphResponse,
  StakeholderCreate,
  getStakeholders,
  createStakeholder,
} from '../../services/api_client';

export interface StakeholderGraphProps {
  /** Stakeholder graph response data object */
  graphData?: StakeholderGraphResponse | null;
  /** Deal ID associated with the stakeholder network */
  dealId?: string;
  /** Currently selected stakeholder node ID */
  selectedNodeId?: string | null;
  /** Callback fired when a stakeholder node is selected or clicked */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Alias callback fired when a node is clicked */
  onNodeClick?: (node: StakeholderNode) => void;
  /** Callback fired when user submits creation of a new stakeholder */
  onCreateStakeholder?: (payload: StakeholderCreate) => Promise<void> | void;
  /** Callback fired to request data refresh */
  onRefresh?: () => void;
  /** Indicates whether data is loading */
  isLoading?: boolean;
  /** Error message string to render if fetch failed */
  error?: string | null;
  /** Custom CSS class name override */
  className?: string;
  /** Test identifier attribute override */
  'data-testid'?: string;
}

export interface PositionedNode extends StakeholderNode {
  x: number;
  y: number;
  level: number;
}

export interface RoleBadgeStyle {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  avatarBg: string;
}

/**
 * Determine visual styling parameters for a stakeholder role.
 */
export function getRoleBadgeStyle(role?: string | null): RoleBadgeStyle {
  const normRole = (role || '').toLowerCase();

  if (
    normRole.includes('ceo') ||
    normRole.includes('cfo') ||
    normRole.includes('cto') ||
    normRole.includes('cro') ||
    normRole.includes('executive') ||
    normRole.includes('c-suite') ||
    normRole.includes('president')
  ) {
    return {
      label: 'Executive / C-Suite',
      badgeBg: '#735c41',
      badgeText: '#ffffff',
      badgeBorder: '#59452b',
      avatarBg: '#59452b',
    };
  }

  if (
    normRole.includes('vp') ||
    normRole.includes('vice president') ||
    normRole.includes('head') ||
    normRole.includes('director')
  ) {
    return {
      label: 'Director / Leadership',
      badgeBg: '#374a5f',
      badgeText: '#ffffff',
      badgeBorder: '#4f6278',
      avatarBg: '#374a5f',
    };
  }

  if (normRole.includes('manager') || normRole.includes('lead') || normRole.includes('supervisor')) {
    return {
      label: 'Manager / Lead',
      badgeBg: '#4f6278',
      badgeText: '#ffffff',
      badgeBorder: '#80756b',
      avatarBg: '#4f6278',
    };
  }

  if (
    normRole.includes('legal') ||
    normRole.includes('counsel') ||
    normRole.includes('procurement') ||
    normRole.includes('security')
  ) {
    return {
      label: 'Specialist / Evaluator',
      badgeBg: '#a43b2c',
      badgeText: '#ffffff',
      badgeBorder: '#71160b',
      avatarBg: '#a43b2c',
    };
  }

  return {
    label: 'Stakeholder / Member',
    badgeBg: '#e4e2dd',
    badgeText: '#1b1c19',
    badgeBorder: '#80756b',
    avatarBg: '#80756b',
  };
}

/**
 * Extract up to 2 initial letters from a stakeholder name for avatar display.
 */
export function formatStakeholderInitials(name?: string | null): string {
  if (!name || !name.trim()) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Filter stakeholder nodes by search term (name, role, email) and role group filter.
 */
export function filterStakeholderNodes(
  nodes: StakeholderNode[],
  searchTerm: string,
  roleFilter: string
): StakeholderNode[] {
  return nodes.filter((node) => {
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = !term || node.name.toLowerCase().includes(term);
    const roleMatch = !term || node.org_role.toLowerCase().includes(term);
    const emailMatch =
      !term ||
      node.contact_email.toLowerCase().includes(term) ||
      (node.email && node.email.toLowerCase().includes(term));

    const matchesSearch = nameMatch || roleMatch || emailMatch;

    if (!matchesSearch) return false;
    if (roleFilter === 'all') return true;

    const style = getRoleBadgeStyle(node.org_role);
    if (roleFilter === 'executive' && style.label.includes('Executive')) return true;
    if (roleFilter === 'director' && style.label.includes('Director')) return true;
    if (roleFilter === 'manager' && style.label.includes('Manager')) return true;
    if (roleFilter === 'specialist' && style.label.includes('Specialist')) return true;
    if (roleFilter === 'member' && style.label.includes('Stakeholder')) return true;

    return false;
  });
}

/**
 * Compute 2D node coordinates and hierarchical depth levels for graph layout.
 */
export function calculateGraphLayout(
  nodes: StakeholderNode[],
  edges: StakeholderEdge[],
  rootIds: string[] = [],
  canvasWidth: number = 800,
  canvasHeight: number = 500
): Map<string, PositionedNode> {
  const result = new Map<string, PositionedNode>();
  if (!nodes || nodes.length === 0) return result;

  const nodeMap = new Map<string, StakeholderNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const parentToChildren = new Map<string, string[]>();
  const childToParent = new Map<string, string>();

  edges.forEach((e) => {
    if (!parentToChildren.has(e.source_id)) {
      parentToChildren.set(e.source_id, []);
    }
    parentToChildren.get(e.source_id)!.push(e.target_id);
    childToParent.set(e.target_id, e.source_id);
  });

  // Identify roots: nodes explicitly listed in rootIds or without parent
  const identifiedRoots: string[] = [];
  rootIds.forEach((id) => {
    if (nodeMap.has(id)) identifiedRoots.push(id);
  });

  if (identifiedRoots.length === 0) {
    nodes.forEach((n) => {
      if (!n.parent_stakeholder_id || !nodeMap.has(n.parent_stakeholder_id)) {
        identifiedRoots.push(n.id);
      }
    });
  }

  if (identifiedRoots.length === 0 && nodes.length > 0) {
    identifiedRoots.push(nodes[0].id);
  }

  // BFS to assign level
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  const queue: { id: string; level: number }[] = [];

  identifiedRoots.forEach((rId) => {
    queue.push({ id: rId, level: 0 });
    visited.add(rId);
  });

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    levels.set(id, level);

    const node = nodeMap.get(id);
    const children = node?.subordinate_ids || parentToChildren.get(id) || [];

    children.forEach((childId) => {
      if (nodeMap.has(childId) && !visited.has(childId)) {
        visited.add(childId);
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }

  // Any unvisited nodes (cycle isolated or orphans)
  let maxLevel = 0;
  levels.forEach((lvl) => {
    if (lvl > maxLevel) maxLevel = lvl;
  });

  nodes.forEach((n) => {
    if (!levels.has(n.id)) {
      levels.set(n.id, maxLevel + 1);
    }
  });

  // Recalculate maxLevel
  maxLevel = 0;
  levels.forEach((lvl) => {
    if (lvl > maxLevel) maxLevel = lvl;
  });

  // Group by level
  const levelGroups = new Map<number, string[]>();
  levels.forEach((lvl, id) => {
    if (!levelGroups.has(lvl)) {
      levelGroups.set(lvl, []);
    }
    levelGroups.get(lvl)!.push(id);
  });

  const totalLevels = maxLevel + 1;
  const rowHeight = Math.max(90, Math.min(130, (canvasHeight - 100) / Math.max(1, totalLevels)));

  levelGroups.forEach((nodeIds, lvl) => {
    const count = nodeIds.length;
    const colWidth = canvasWidth / (count + 1);
    const y = 60 + lvl * rowHeight;

    nodeIds.forEach((id, idx) => {
      const node = nodeMap.get(id)!;
      const x = (idx + 1) * colWidth;
      result.set(id, {
        ...node,
        x,
        y,
        level: lvl,
      });
    });
  });

  return result;
}

/**
 * Interactive stakeholder contact network graph visualization component.
 */
export const StakeholderGraph: React.FC<StakeholderGraphProps> = ({
  graphData: externalGraphData,
  dealId,
  selectedNodeId: externalSelectedNodeId,
  onNodeSelect,
  onNodeClick,
  onCreateStakeholder,
  onRefresh,
  isLoading: externalIsLoading = false,
  error: externalError = null,
  className = '',
  'data-testid': testId = 'stakeholder-graph',
}) => {
  const [internalData, setInternalData] = useState<StakeholderGraphResponse | null>(
    externalGraphData || null
  );
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    externalSelectedNodeId || null
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'graph' | 'tree' | 'table'>('graph');
  const [useDagView, setUseDagView] = useState<boolean>(false);

  // Modal State for adding stakeholder
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newForm, setNewForm] = useState<StakeholderCreate>({
    name: '',
    org_role: '',
    contact_email: '',
    parent_stakeholder_id: null,
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync external props with internal state
  useEffect(() => {
    if (externalGraphData !== undefined) {
      setInternalData(externalGraphData);
    }
  }, [externalGraphData]);

  useEffect(() => {
    if (externalSelectedNodeId !== undefined) {
      setSelectedNodeId(externalSelectedNodeId);
    }
  }, [externalSelectedNodeId]);

  // Fetch data if dealId is provided and externalGraphData is omitted
  const fetchGraphData = useCallback(async () => {
    if (!dealId || externalGraphData !== undefined) return;
    setInternalLoading(true);
    setInternalError(null);
    try {
      const data = await getStakeholders(dealId);
      setInternalData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch stakeholder graph data';
      setInternalError(msg);
    } finally {
      setInternalLoading(false);
    }
  }, [dealId, externalGraphData]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const activeData = externalGraphData !== undefined ? externalGraphData : internalData;
  const isLoading = externalIsLoading || internalLoading;
  const error = externalError || internalError;

  const handleNodeClick = (node: StakeholderNode) => {
    const newId = selectedNodeId === node.id ? null : node.id;
    setSelectedNodeId(newId);
    if (onNodeSelect) onNodeSelect(newId);
    if (onNodeClick) onNodeClick(node);
  };

  const handleSelectNodeById = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (onNodeSelect) onNodeSelect(nodeId);
    if (nodeId && activeData?.nodes) {
      const match = activeData.nodes.find((n) => n.id === nodeId);
      if (match && onNodeClick) onNodeClick(match);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    fetchGraphData();
  };

  // Filter nodes
  const filteredNodes = useMemo(() => {
    if (!activeData || !activeData.nodes) return [];
    return filterStakeholderNodes(activeData.nodes, searchTerm, roleFilter);
  }, [activeData, searchTerm, roleFilter]);

  const filteredNodeIds = useMemo(() => {
    return new Set(filteredNodes.map((n) => n.id));
  }, [filteredNodes]);

  // Select edges to render (Full vs DAG)
  const activeEdges = useMemo(() => {
    if (!activeData) return [];
    return useDagView ? activeData.dag_edges || [] : activeData.edges || [];
  }, [activeData, useDagView]);

  // Compute graph layout coordinates
  const canvasWidth = 800;
  const canvasHeight = 480;

  const positionedNodeMap = useMemo(() => {
    if (!activeData || !activeData.nodes) return new Map<string, PositionedNode>();
    return calculateGraphLayout(
      activeData.nodes,
      activeEdges,
      activeData.root_stakeholder_ids,
      canvasWidth,
      canvasHeight
    );
  }, [activeData, activeEdges]);

  // Currently selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !activeData?.nodes) return null;
    return activeData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, activeData]);

  // Add stakeholder form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newForm.name.trim()) {
      setModalError('Stakeholder name is required.');
      return;
    }
    if (!newForm.org_role.trim()) {
      setModalError('Organizational role is required.');
      return;
    }
    if (!newForm.contact_email.trim() || !newForm.contact_email.includes('@')) {
      setModalError('A valid contact email address is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onCreateStakeholder) {
        await onCreateStakeholder(newForm);
      } else if (dealId) {
        await createStakeholder(dealId, newForm);
        fetchGraphData();
      }
      setShowAddModal(false);
      setNewForm({ name: '', org_role: '', contact_email: '', parent_stakeholder_id: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create stakeholder contact.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`stakeholder-graph-loading-container ${className}`}
        style={{
          padding: '2rem',
          backgroundColor: '#fbf9f4',
          border: '1px solid #d1c4b9',
          borderRadius: '0.5rem',
          textAlign: 'center',
        }}
        data-testid="stakeholder-graph-loading"
        aria-busy="true"
      >
        <div style={{ fontSize: '1.25rem', color: '#59452b', fontWeight: 500, marginBottom: '0.5rem' }}>
          Loading Stakeholder Contact Network...
        </div>
        <div style={{ color: '#80756b', fontSize: '0.875rem' }}>
          Mapping organizational roles, reporting relationships, and contact hierarchy.
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`stakeholder-graph-error-container ${className}`}
        style={{
          padding: '2rem',
          backgroundColor: '#fdf0ed',
          border: '1px solid #f5c2c7',
          borderRadius: '0.5rem',
          color: '#842417',
        }}
        data-testid="stakeholder-graph-error"
        role="alert"
      >
        <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          Unable to Load Stakeholder Graph
        </div>
        <div style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>
        <button
          type="button"
          onClick={handleRefresh}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#a43b2c',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Retry Load
        </button>
      </div>
    );
  }

  // Empty state
  const hasNoNodes = !activeData || !activeData.nodes || activeData.nodes.length === 0;

  return (
    <div
      className={`stakeholder-graph-wrapper ${className}`}
      style={{
        backgroundColor: '#fbf9f4',
        border: '1px solid #d1c4b9',
        borderRadius: '0.5rem',
        padding: '1.25rem',
        fontFamily: "'DM Sans', sans-serif",
        color: '#1b1c19',
        boxShadow: '0 2px 8px rgba(115, 92, 65, 0.06)',
      }}
      data-testid={testId}
      role="region"
      aria-label="Stakeholder Contact Network Graph"
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1rem',
          borderBottom: '1px solid #e4e2dd',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.35rem',
              fontFamily: "'Libre Caslon Text', Georgia, serif",
              color: '#59452b',
              fontWeight: 400,
            }}
          >
            Stakeholder Contact Network
          </h3>
          <div style={{ fontSize: '0.8rem', color: '#80756b', marginTop: '0.2rem' }}>
            {activeData ? `${activeData.nodes.length} mapped contacts` : '0 mapped contacts'}
          </div>
        </div>

        {/* View Mode & Add Button Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#e4e2dd',
              borderRadius: '0.25rem',
              padding: '0.15rem',
            }}
            role="tablist"
            aria-label="View Mode Switcher"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'graph'}
              onClick={() => setViewMode('graph')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: viewMode === 'graph' ? 600 : 400,
                backgroundColor: viewMode === 'graph' ? '#59452b' : 'transparent',
                color: viewMode === 'graph' ? '#ffffff' : '#1b1c19',
                border: 'none',
                borderRadius: '0.2rem',
                cursor: 'pointer',
              }}
              data-testid="view-mode-graph"
            >
              📊 Graph
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'tree'}
              onClick={() => setViewMode('tree')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: viewMode === 'tree' ? 600 : 400,
                backgroundColor: viewMode === 'tree' ? '#59452b' : 'transparent',
                color: viewMode === 'tree' ? '#ffffff' : '#1b1c19',
                border: 'none',
                borderRadius: '0.2rem',
                cursor: 'pointer',
              }}
              data-testid="view-mode-tree"
            >
              🌲 Tree
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: viewMode === 'table' ? 600 : 400,
                backgroundColor: viewMode === 'table' ? '#59452b' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : '#1b1c19',
                border: 'none',
                borderRadius: '0.2rem',
                cursor: 'pointer',
              }}
              data-testid="view-mode-table"
            >
              📋 Directory
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.45rem 0.9rem',
              backgroundColor: '#59452b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.25rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            data-testid="add-stakeholder-btn"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* Cycle Warning Banner */}
      {activeData?.has_cycles && (
        <div
          style={{
            backgroundColor: '#fdf0ed',
            border: '1px solid #f5c2c7',
            borderRadius: '0.375rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            color: '#842417',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
          data-testid="cycle-warning-banner"
        >
          <div>
            <strong>⚠️ Circular Relationship Detected:</strong> Organizational cycle exists in stakeholder
            hierarchy. Toggle DAG View to clean cycle-inducing loops.
          </div>
          <button
            type="button"
            onClick={() => setUseDagView(!useDagView)}
            style={{
              padding: '0.25rem 0.65rem',
              backgroundColor: useDagView ? '#374a5f' : '#a43b2c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.2rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            data-testid="toggle-dag-btn"
          >
            {useDagView ? 'Show Full Graph' : 'Enable DAG View'}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          marginBottom: '1rem',
          backgroundColor: '#f5f3ee',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.375rem',
          border: '1px solid #e4e2dd',
        }}
      >
        <div style={{ flex: '1 1 200px' }}>
          <input
            type="text"
            placeholder="Search by name, role, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              border: '1px solid #80756b',
              borderRadius: '0.25rem',
              backgroundColor: '#ffffff',
              color: '#1b1c19',
            }}
            data-testid="stakeholder-search-input"
            aria-label="Search stakeholders"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.85rem',
              border: '1px solid #80756b',
              borderRadius: '0.25rem',
              backgroundColor: '#ffffff',
              color: '#1b1c19',
            }}
            data-testid="role-filter-select"
            aria-label="Filter stakeholders by role"
          >
            <option value="all">All Role Types</option>
            <option value="executive">Executive / C-Suite</option>
            <option value="director">Director / Leadership</option>
            <option value="manager">Manager / Lead</option>
            <option value="specialist">Specialist / Evaluator</option>
            <option value="member">Other Stakeholders</option>
          </select>
        </div>

        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#a43b2c',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Empty State */}
      {hasNoNodes ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            border: '1px dashed #80756b',
            borderRadius: '0.375rem',
            margin: '1rem 0',
          }}
          data-testid="stakeholder-graph-empty"
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
          <div
            style={{
              fontSize: '1.1rem',
              fontFamily: "'Libre Caslon Text', serif",
              color: '#59452b',
              marginBottom: '0.5rem',
            }}
          >
            No Stakeholder Contacts Mapped
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: '#80756b',
              maxWidth: '420px',
              margin: '0 auto 1.25rem auto',
            }}
          >
            Build your deal contact network by adding key decision makers, executive sponsors,
            evaluators, and reporting hierarchies.
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.5rem 1.2rem',
              backgroundColor: '#59452b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            data-testid="add-first-stakeholder-btn"
          >
            + Add First Stakeholder
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Main Visual View Container */}
          <div style={{ flex: '1 1 500px', minWidth: '300px' }}>
            {viewMode === 'graph' && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1c4b9',
                  borderRadius: '0.375rem',
                  overflow: 'auto',
                  position: 'relative',
                  minHeight: '420px',
                }}
                data-testid="stakeholder-svg-canvas"
              >
                <svg
                  width="100%"
                  height={canvasHeight}
                  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                  style={{ display: 'block' }}
                >
                  <defs>
                    {/* Arrowhead marker for standard relationship edges */}
                    <marker
                      id="arrowhead"
                      markerWidth="8"
                      markerHeight="8"
                      refX="18"
                      refY="4"
                      orient="auto"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 z" fill="#80756b" />
                    </marker>

                    {/* Arrowhead marker for active edge */}
                    <marker
                      id="arrowhead-active"
                      markerWidth="8"
                      markerHeight="8"
                      refX="18"
                      refY="4"
                      orient="auto"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 z" fill="#59452b" />
                    </marker>

                    {/* Arrowhead marker for cycle edge */}
                    <marker
                      id="arrowhead-cycle"
                      markerWidth="8"
                      markerHeight="8"
                      refX="18"
                      refY="4"
                      orient="auto"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 z" fill="#a43b2c" />
                    </marker>
                  </defs>

                  {/* Canvas Grid Background */}
                  <pattern
                    id="canvas-grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="#f5f3ee"
                      strokeWidth="1"
                    />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#canvas-grid)" />

                  {/* Render Relationship Edges */}
                  {activeEdges.map((edge, idx) => {
                    const sourcePos = positionedNodeMap.get(edge.source_id);
                    const targetPos = positionedNodeMap.get(edge.target_id);
                    if (!sourcePos || !targetPos) return null;

                    const isConnectedToSelected =
                      selectedNodeId === edge.source_id || selectedNodeId === edge.target_id;
                    const isCycle = edge.is_cycle_edge;

                    const cardHalfWidth = 85;
                    const cardHalfHeight = 28;

                    const x1 = sourcePos.x;
                    const y1 = sourcePos.y + cardHalfHeight;
                    const x2 = targetPos.x;
                    const y2 = targetPos.y - cardHalfHeight;

                    // Curve path
                    const dy = Math.abs(y2 - y1);
                    const controlY1 = y1 + Math.max(20, dy / 2);
                    const controlY2 = y2 - Math.max(20, dy / 2);

                    const pathD = `M ${x1} ${y1} C ${x1} ${controlY1}, ${x2} ${controlY2}, ${x2} ${y2}`;

                    let strokeColor = '#80756b';
                    let marker = 'url(#arrowhead)';
                    let strokeWidth = 2;
                    let dashArray = undefined;

                    if (isCycle) {
                      strokeColor = '#a43b2c';
                      marker = 'url(#arrowhead-cycle)';
                      strokeWidth = 2.5;
                      dashArray = '5 5';
                    } else if (isConnectedToSelected) {
                      strokeColor = '#59452b';
                      marker = 'url(#arrowhead-active)';
                      strokeWidth = 3;
                    }

                    return (
                      <g key={`edge-${edge.source_id}-${edge.target_id}-${idx}`}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={dashArray}
                          markerEnd={marker}
                          opacity={
                            filteredNodeIds.has(edge.source_id) && filteredNodeIds.has(edge.target_id)
                              ? 1
                              : 0.25
                          }
                        />
                      </g>
                    );
                  })}

                  {/* Render Stakeholder Nodes */}
                  {Array.from(positionedNodeMap.values()).map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const matchesFilter = filteredNodeIds.has(node.id);
                    const roleStyle = getRoleBadgeStyle(node.org_role);
                    const initials = formatStakeholderInitials(node.name);

                    const cardW = 170;
                    const cardH = 56;
                    const rectX = node.x - cardW / 2;
                    const rectY = node.y - cardH / 2;

                    return (
                      <g
                        key={`node-${node.id}`}
                        onClick={() => handleNodeClick(node)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleNodeClick(node);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Stakeholder ${node.name}, ${node.org_role}`}
                        aria-selected={isSelected}
                        style={{ cursor: 'pointer', outline: 'none' }}
                        data-testid={`stakeholder-node-${node.id}`}
                        opacity={matchesFilter ? 1 : 0.3}
                      >
                        {/* Card Shadow / Glow when selected */}
                        {isSelected && (
                          <rect
                            x={rectX - 3}
                            y={rectY - 3}
                            width={cardW + 6}
                            height={cardH + 6}
                            rx={8}
                            ry={8}
                            fill="none"
                            stroke="#59452b"
                            strokeWidth="2.5"
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Card Body */}
                        <rect
                          x={rectX}
                          y={rectY}
                          width={cardW}
                          height={cardH}
                          rx={6}
                          ry={6}
                          fill={isSelected ? '#f0eee9' : '#ffffff'}
                          stroke={isSelected ? '#59452b' : '#d1c4b9'}
                          strokeWidth={isSelected ? 2 : 1}
                        />

                        {/* Avatar Circle */}
                        <circle
                          cx={rectX + 22}
                          cy={node.y}
                          r={15}
                          fill={roleStyle.avatarBg}
                        />
                        <text
                          x={rectX + 22}
                          y={node.y + 4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="600"
                          fontFamily="sans-serif"
                        >
                          {initials}
                        </text>

                        {/* Name Text */}
                        <text
                          x={rectX + 44}
                          y={node.y - 6}
                          fill="#1b1c19"
                          fontSize="12"
                          fontWeight="600"
                          fontFamily="sans-serif"
                        >
                          {node.name.length > 16 ? `${node.name.substring(0, 14)}...` : node.name}
                        </text>

                        {/* Role Text */}
                        <text
                          x={rectX + 44}
                          y={node.y + 10}
                          fill="#80756b"
                          fontSize="10"
                          fontFamily="sans-serif"
                        >
                          {node.org_role.length > 20
                            ? `${node.org_role.substring(0, 18)}...`
                            : node.org_role}
                        </text>

                        {/* Subordinate Count Badge */}
                        {node.subordinate_ids && node.subordinate_ids.length > 0 && (
                          <g>
                            <circle
                              cx={rectX + cardW - 12}
                              cy={rectY + 12}
                              r={8}
                              fill="#374a5f"
                            />
                            <text
                              x={rectX + cardW - 12}
                              y={rectY + 15}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="9"
                              fontWeight="600"
                            >
                              {node.subordinate_ids.length}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* Tree View Mode */}
            {viewMode === 'tree' && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1c4b9',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                  minHeight: '350px',
                }}
                data-testid="stakeholder-tree-view"
              >
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: '#80756b',
                    marginBottom: '0.75rem',
                    fontWeight: 500,
                  }}
                >
                  Reporting Tree Hierarchy
                </div>
                {filteredNodes.map((node) => {
                  const roleStyle = getRoleBadgeStyle(node.org_role);
                  const isSelected = selectedNodeId === node.id;
                  const indentLevel = node.parent_stakeholder_id ? 24 : 0;

                  return (
                    <div
                      key={`tree-item-${node.id}`}
                      onClick={() => handleNodeClick(node)}
                      style={{
                        marginLeft: `${indentLevel}px`,
                        padding: '0.6rem 0.8rem',
                        marginBottom: '0.4rem',
                        backgroundColor: isSelected ? '#f0eee9' : '#f5f3ee',
                        borderLeft: `4px solid ${roleStyle.avatarBg}`,
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      data-testid={`tree-node-${node.id}`}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1b1c19' }}>
                          {node.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#80756b' }}>
                          {node.org_role} • {node.contact_email}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.45rem',
                          backgroundColor: roleStyle.badgeBg,
                          color: roleStyle.badgeText,
                          borderRadius: '0.2rem',
                          fontWeight: 500,
                        }}
                      >
                        {roleStyle.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Directory / Table View Mode */}
            {viewMode === 'table' && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1c4b9',
                  borderRadius: '0.375rem',
                  overflowX: 'auto',
                }}
                data-testid="stakeholder-table-view"
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f3ee', borderBottom: '1px solid #d1c4b9' }}>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: '#59452b' }}>
                        Name
                      </th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: '#59452b' }}>
                        Organizational Role
                      </th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: '#59452b' }}>
                        Contact Email
                      </th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#59452b' }}>
                        Direct Reports
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNodes.map((node) => {
                      const isSelected = selectedNodeId === node.id;
                      return (
                        <tr
                          key={`table-row-${node.id}`}
                          onClick={() => handleNodeClick(node)}
                          style={{
                            borderBottom: '1px solid #e4e2dd',
                            backgroundColor: isSelected ? '#f0eee9' : 'transparent',
                            cursor: 'pointer',
                          }}
                          data-testid={`table-node-${node.id}`}
                        >
                          <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>{node.name}</td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#80756b' }}>
                            {node.org_role}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#374a5f' }}>
                            {node.contact_email}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                            {node.subordinate_ids ? node.subordinate_ids.length : 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Stakeholder Details Drawer Panel */}
          {selectedNode && (
            <div
              style={{
                flex: '0 0 280px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1c4b9',
                borderRadius: '0.375rem',
                padding: '1rem',
                alignSelf: 'flex-start',
              }}
              data-testid="stakeholder-detail-panel"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.75rem',
                  borderBottom: '1px solid #e4e2dd',
                  paddingBottom: '0.5rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#59452b',
                  }}
                >
                  Contact Profile
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectNodeById(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#80756b',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                  aria-label="Close stakeholder detail panel"
                  data-testid="close-detail-panel-btn"
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: getRoleBadgeStyle(selectedNode.org_role).avatarBg,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  {formatStakeholderInitials(selectedNode.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1b1c19' }}>
                    {selectedNode.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#80756b' }}>{selectedNode.org_role}</div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', marginBottom: '0.75rem', color: '#374a5f' }}>
                ✉️{' '}
                <a
                  href={`mailto:${selectedNode.contact_email}`}
                  style={{ color: '#374a5f', textDecoration: 'underline' }}
                >
                  {selectedNode.contact_email}
                </a>
              </div>

              {/* Reporting Parent */}
              <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ color: '#80756b', fontWeight: 500, marginBottom: '0.2rem' }}>
                  Reports To:
                </div>
                {selectedNode.parent_stakeholder_id ? (
                  (() => {
                    const parent = activeData?.nodes.find((n) => n.id === selectedNode.parent_stakeholder_id);
                    return parent ? (
                      <button
                        type="button"
                        onClick={() => handleSelectNodeById(parent.id)}
                        style={{
                          background: '#f5f3ee',
                          border: '1px solid #d1c4b9',
                          borderRadius: '0.2rem',
                          padding: '0.3rem 0.5rem',
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: '#59452b',
                          fontWeight: 500,
                        }}
                      >
                        👤 {parent.name} ({parent.org_role})
                      </button>
                    ) : (
                      <span style={{ color: '#80756b', fontStyle: 'italic' }}>
                        {selectedNode.parent_stakeholder_id}
                      </span>
                    );
                  })()
                ) : (
                  <span style={{ color: '#80756b', fontStyle: 'italic' }}>
                    Top Level / Root Executive
                  </span>
                )}
              </div>

              {/* Subordinates List */}
              <div style={{ fontSize: '0.8rem' }}>
                <div style={{ color: '#80756b', fontWeight: 500, marginBottom: '0.25rem' }}>
                  Direct Reports ({selectedNode.subordinate_ids ? selectedNode.subordinate_ids.length : 0}):
                </div>
                {selectedNode.subordinate_ids && selectedNode.subordinate_ids.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {selectedNode.subordinate_ids.map((childId) => {
                      const child = activeData?.nodes.find((n) => n.id === childId);
                      return child ? (
                        <button
                          key={`child-${child.id}`}
                          type="button"
                          onClick={() => handleSelectNodeById(child.id)}
                          style={{
                            background: '#f5f3ee',
                            border: '1px solid #d1c4b9',
                            borderRadius: '0.2rem',
                            padding: '0.25rem 0.5rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            color: '#1b1c19',
                          }}
                        >
                          ↳ {child.name} ({child.org_role})
                        </button>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div style={{ color: '#80756b', fontStyle: 'italic' }}>No direct reports assigned.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Stakeholder Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(27, 28, 25, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          data-testid="add-stakeholder-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-stakeholder-modal-title"
        >
          <div
            style={{
              backgroundColor: '#fbf9f4',
              border: '1px solid #d1c4b9',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 4px 20px rgba(115, 92, 65, 0.15)',
            }}
          >
            <h3
              id="add-stakeholder-modal-title"
              style={{
                marginTop: 0,
                marginBottom: '1rem',
                fontFamily: "'Libre Caslon Text', serif",
                color: '#59452b',
                fontSize: '1.25rem',
              }}
            >
              Add Stakeholder Contact
            </h3>

            {modalError && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#fdf0ed',
                  border: '1px solid #f5c2c7',
                  borderRadius: '0.25rem',
                  color: '#842417',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                }}
                role="alert"
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#59452b',
                    marginBottom: '0.25rem',
                  }}
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.name}
                  onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.85rem',
                    border: '1px solid #80756b',
                    borderRadius: '0.25rem',
                  }}
                  data-testid="input-stakeholder-name"
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#59452b',
                    marginBottom: '0.25rem',
                  }}
                >
                  Organizational Role *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.org_role}
                  onChange={(e) => setNewForm({ ...newForm, org_role: e.target.value })}
                  placeholder="e.g. VP of Technology / Procurement Lead"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.85rem',
                    border: '1px solid #80756b',
                    borderRadius: '0.25rem',
                  }}
                  data-testid="input-stakeholder-role"
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#59452b',
                    marginBottom: '0.25rem',
                  }}
                >
                  Contact Email *
                </label>
                <input
                  type="email"
                  required
                  value={newForm.contact_email}
                  onChange={(e) => setNewForm({ ...newForm, contact_email: e.target.value })}
                  placeholder="e.g. jane.doe@acme.com"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.85rem',
                    border: '1px solid #80756b',
                    borderRadius: '0.25rem',
                  }}
                  data-testid="input-stakeholder-email"
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#59452b',
                    marginBottom: '0.25rem',
                  }}
                >
                  Reports To (Parent Stakeholder)
                </label>
                <select
                  value={newForm.parent_stakeholder_id || ''}
                  onChange={(e) =>
                    setNewForm({
                      ...newForm,
                      parent_stakeholder_id: e.target.value ? e.target.value : null,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.85rem',
                    border: '1px solid #80756b',
                    borderRadius: '0.25rem',
                  }}
                  data-testid="select-parent-stakeholder"
                >
                  <option value="">None (Top Level / Executive)</option>
                  {activeData?.nodes.map((n) => (
                    <option key={`opt-${n.id}`} value={n.id}>
                      {n.name} ({n.org_role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    backgroundColor: '#e4e2dd',
                    color: '#1b1c19',
                    border: 'none',
                    borderRadius: '0.25rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                  data-testid="cancel-modal-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.45rem 1rem',
                    backgroundColor: '#59452b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: isSubmitting ? 'wait' : 'pointer',
                  }}
                  data-testid="submit-stakeholder-btn"
                >
                  {isSubmitting ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
