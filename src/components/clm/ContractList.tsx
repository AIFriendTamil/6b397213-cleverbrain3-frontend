'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ContractDetail,
  ClauseHighlight,
  SLACommitment,
  searchContracts,
  SearchContractsParams,
} from '../../services/clm_client';

export interface ContractListProps {
  /** Initial array of contract records (used before or instead of API auto-fetch) */
  initialContracts?: ContractDetail[];
  /** Initial status filter value (e.g. "ACTIVE", "DRAFT", "EXPIRED", "TERMINATED", or "") */
  initialStatus?: string;
  /** Initial counterparty filter query */
  initialCounterparty?: string;
  /** Initial keyword search query */
  initialKeyword?: string;
  /** Initial renewal timeframe in days (30, 60, or 90) */
  initialRenewalDays?: number | null;
  /** Selection handler invoked when a contract is clicked or chosen */
  onContractSelect?: (contract: ContractDetail) => void;
  /** Optional user roles override header value for RBAC filtering */
  roles?: string;
  /** Whether to auto-fetch contracts from backend API on mount/filter change. Defaults to true unless initialContracts is supplied without filter changes */
  autoFetch?: boolean;
  /** Optional custom container CSS class name */
  className?: string;
  /** Optional custom data-testid attribute for testing selector override */
  'data-testid'?: string;
}

/**
 * Helper to get status badge style and label.
 */
function getStatusBadgeConfig(status: string): { bg: string; color: string; border: string; label: string } {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'ACTIVE':
      return {
        bg: 'var(--color-trend-up-bg, #e8f5e9)',
        color: 'var(--color-trend-up, #2e6b38)',
        border: 'var(--color-trend-up, #2e6b38)',
        label: 'Active',
      };
    case 'DRAFT':
      return {
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: 'var(--color-outline-variant, #d1c4b9)',
        label: 'Draft',
      };
    case 'EXPIRED':
      return {
        bg: 'var(--color-trend-down-bg, #fdf0ed)',
        color: 'var(--color-trend-down, #a43b2c)',
        border: 'var(--color-trend-down, #a43b2c)',
        label: 'Expired',
      };
    case 'TERMINATED':
      return {
        bg: 'var(--color-surface-dim, #dbdad5)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: 'var(--color-outline, #80756b)',
        label: 'Terminated',
      };
    default:
      return {
        bg: 'var(--color-surface-container, #f0eee9)',
        color: 'var(--color-on-surface, #1b1c19)',
        border: 'var(--color-outline-variant, #d1c4b9)',
        label: status || 'Unknown',
      };
  }
}

/**
 * Helper to get clause type badge label and style.
 */
function getClauseTypeBadge(clauseType: string): { label: string; isSpecial: boolean } {
  const norm = (clauseType || '').toUpperCase();
  switch (norm) {
    case 'SPECIAL_TERM':
      return { label: 'Special Term', isSpecial: true };
    case 'CONFIDENTIALITY':
      return { label: 'Confidentiality', isSpecial: false };
    case 'TERMINATION':
      return { label: 'Termination', isSpecial: false };
    case 'INDEMNIFICATION':
      return { label: 'Indemnification', isSpecial: false };
    case 'GOVERNING_LAW':
      return { label: 'Governing Law', isSpecial: false };
    default:
      return { label: clauseType, isSpecial: false };
  }
}

/**
 * Contract repository list component with keyword search, status filtering,
 * and renewal timeframe filters conforming to Linen & Logic design system tokens.
 *
 * Requirements: [FR-1, FR-7, Story 1]
 */
export const ContractList: React.FC<ContractListProps> = ({
  initialContracts,
  initialStatus = '',
  initialCounterparty = '',
  initialKeyword = '',
  initialRenewalDays = null,
  onContractSelect,
  roles,
  autoFetch = true,
  className = '',
  'data-testid': testId = 'contract-list',
}) => {
  const [keyword, setKeyword] = useState<string>(initialKeyword);
  const [status, setStatus] = useState<string>(initialStatus);
  const [counterparty, setCounterparty] = useState<string>(initialCounterparty);
  const [renewalDays, setRenewalDays] = useState<number | null>(initialRenewalDays);

  const [contracts, setContracts] = useState<ContractDetail[]>(initialContracts || []);
  const [loading, setLoading] = useState<boolean>(autoFetch && !initialContracts);
  const [error, setError] = useState<string | null>(null);

  // Fetch contracts from backend API
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: SearchContractsParams = {
        keyword: keyword.trim() || undefined,
        status: status.trim() || undefined,
        counterparty: counterparty.trim() || undefined,
        renewal_days: renewalDays !== null ? renewalDays : undefined,
        roles: roles || undefined,
      };

      const result = await searchContracts(params);
      setContracts(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load contract repository records.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [keyword, status, counterparty, renewalDays, roles]);

  useEffect(() => {
    if (autoFetch) {
      fetchContracts();
    }
  }, [fetchContracts, autoFetch]);

  // Client-side filtering fallback for offline or custom initialContracts list
  const filteredContracts = useMemo(() => {
    if (autoFetch && !initialContracts) {
      return contracts;
    }

    let items = initialContracts || contracts;

    if (keyword.trim()) {
      const kw = keyword.toLowerCase().trim();
      items = items.filter((c) => {
        const matchesTitle = c.title?.toLowerCase().includes(kw);
        const matchesNum = c.contract_number?.toLowerCase().includes(kw);
        const matchesParty = c.counterparty?.toLowerCase().includes(kw);
        const matchesClauses = c.clauses?.some(
          (cl) => cl.title?.toLowerCase().includes(kw) || cl.content?.toLowerCase().includes(kw)
        );
        const matchesSla = c.sla_commitments?.some(
          (s) => s.metric_name?.toLowerCase().includes(kw) || s.target_value?.toLowerCase().includes(kw)
        );
        return matchesTitle || matchesNum || matchesParty || matchesClauses || matchesSla;
      });
    }

    if (status.trim()) {
      items = items.filter((c) => c.status?.toUpperCase() === status.toUpperCase());
    }

    if (counterparty.trim()) {
      const cp = counterparty.toLowerCase().trim();
      items = items.filter((c) => c.counterparty?.toLowerCase().includes(cp));
    }

    if (renewalDays !== null && renewalDays !== undefined) {
      const today = new Date();
      items = items.filter((c) => {
        if (!c.expires_on) return false;
        const expDate = new Date(c.expires_on);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        return diffDays >= 0 && diffDays <= renewalDays;
      });
    }

    return items;
  }, [autoFetch, initialContracts, contracts, keyword, status, counterparty, renewalDays]);

  const handleClearFilters = () => {
    setKeyword('');
    setStatus('');
    setCounterparty('');
    setRenewalDays(null);
  };

  const hasActiveFilters = Boolean(keyword || status || counterparty || renewalDays !== null);

  return (
    <div
      data-testid={testId}
      className={`contract-list-container ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Search and Filters Header Section */}
      <div
        data-testid="filter-controls"
        style={{
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '24px',
                fontWeight: '400',
                color: 'var(--color-primary, #59452b)',
                margin: 0,
              }}
            >
              Contract Repository
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '14px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                margin: '4px 0 0 0',
              }}
            >
              Search, filter, and inspect legal agreements, SLA commitments, and key clause highlights.
            </p>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              data-testid="clear-filters"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--color-outline, #80756b)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '6px 14px',
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--color-primary, #59452b)',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Search Inputs and Dropdowns Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            alignItems: 'end',
          }}
        >
          {/* Keyword Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="contract-search-keyword"
              style={{
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Keyword Search
            </label>
            <input
              id="contract-search-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Title, clause, or term..."
              data-testid="search-input"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Counterparty Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="contract-search-counterparty"
              style={{
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Counterparty
            </label>
            <input
              id="contract-search-counterparty"
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Vendor or partner name..."
              data-testid="counterparty-filter"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="contract-status-filter"
              style={{
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Status Filter
            </label>
            <select
              id="contract-status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              data-testid="status-filter"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="EXPIRED">Expired</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>

          {/* Renewal Timeframe Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="contract-renewal-filter"
              style={{
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Renewal Timeframe
            </label>
            <select
              id="contract-renewal-filter"
              value={renewalDays === null ? '' : String(renewalDays)}
              onChange={(e) => setRenewalDays(e.target.value ? Number(e.target.value) : null)}
              data-testid="renewal-filter"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All Expiration Dates</option>
              <option value="30">Expiring within 30 Days</option>
              <option value="60">Expiring within 60 Days</option>
              <option value="90">Expiring within 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header Summary Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--color-on-surface-variant, #4e453d)',
          }}
          data-testid="results-count"
        >
          {loading
            ? 'Searching records...'
            : `Showing ${filteredContracts.length} agreement${filteredContracts.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Loading Indicator State */}
      {loading && (
        <div
          data-testid="loading-indicator"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            color: 'var(--color-primary, #59452b)',
            fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
            fontSize: '15px',
          }}
        >
          Loading contract repository...
        </div>
      )}

      {/* Error Alert State */}
      {!loading && error && (
        <div
          data-testid="error-message"
          style={{
            padding: '20px 24px',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            border: '1px solid var(--color-error, #ba1a1a)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            color: 'var(--color-on-error-container, #93000a)',
            fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchContracts}
            style={{
              backgroundColor: 'var(--color-error, #ba1a1a)',
              color: 'var(--color-on-error, #ffffff)',
              border: 'none',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredContracts.length === 0 && (
        <div
          data-testid="empty-state"
          style={{
            padding: '64px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            border: '1px dashed var(--color-outline, #80756b)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '20px',
              color: 'var(--color-primary, #59452b)',
              margin: 0,
            }}
          >
            No active contracts found
          </p>
          <p
            style={{
              fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              margin: 0,
              maxWidth: '480px',
            }}
          >
            No legal agreements match your current search criteria or renewal window filter.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                marginTop: '8px',
                backgroundColor: 'var(--color-primary, #59452b)',
                color: 'var(--color-on-primary, #ffffff)',
                border: 'none',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '8px 18px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Reset Search Filters
            </button>
          )}
        </div>
      )}

      {/* Contracts List / Cards */}
      {!loading && !error && filteredContracts.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {filteredContracts.map((contract) => {
            const statusConfig = getStatusBadgeConfig(contract.status);

            return (
              <div
                key={contract.id}
                data-testid={`contract-card-${contract.id}`}
                onClick={() => onContractSelect && onContractSelect(contract)}
                style={{
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-lg, 0.5rem)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 2px 10px rgba(115, 92, 65, 0.05)',
                  cursor: onContractSelect ? 'pointer' : 'default',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Card Top Row: Title, Contract Number, Status & Auto-Renew Badges */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3
                        style={{
                          fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                          fontSize: '20px',
                          fontWeight: '400',
                          color: 'var(--color-on-surface, #1b1c19)',
                          margin: 0,
                        }}
                      >
                        {contract.title}
                      </h3>
                      <span
                        style={{
                          fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: 'var(--color-surface-container, #f0eee9)',
                          color: 'var(--color-primary, #59452b)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          border: '1px solid var(--color-outline-variant, #d1c4b9)',
                        }}
                      >
                        {contract.contract_number}
                      </span>
                    </div>

                    <div
                      style={{
                        fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                        fontSize: '14px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        flexWrap: 'wrap',
                        marginTop: '4px',
                      }}
                    >
                      <span>
                        <strong>Counterparty:</strong> {contract.counterparty}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Effective:</strong> {contract.effective_on}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Expires:</strong> {contract.expires_on}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {contract.auto_renew && (
                      <span
                        style={{
                          fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          color: 'var(--color-primary, #59452b)',
                          border: '1px solid var(--color-outline-variant, #d1c4b9)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full, 9999px)',
                        }}
                        title="Contract automatically renews on expiration date"
                      >
                        Auto-Renew
                      </span>
                    )}

                    <span
                      data-testid={`status-badge-${contract.id}`}
                      style={{
                        fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                        fontSize: '12px',
                        fontWeight: '600',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        backgroundColor: statusConfig.bg,
                        color: statusConfig.color,
                        border: `1px solid ${statusConfig.border}`,
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-full, 9999px)',
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* Key Clause Highlights & Special Terms Section [FR-1] */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '14px 16px',
                    border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                      fontSize: '12px',
                      fontWeight: '700',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--color-primary, #59452b)',
                    }}
                  >
                    Key Clause Highlights &amp; Special Terms
                  </span>

                  {contract.clauses && contract.clauses.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {contract.clauses.map((clause: ClauseHighlight) => {
                        const badge = getClauseTypeBadge(clause.clause_type);
                        return (
                          <div
                            key={clause.id || `${clause.title}-${clause.clause_type}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              paddingBottom: '6px',
                              borderBottom: '1px dashed var(--color-outline-variant, #d1c4b9)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-sm, 0.125rem)',
                                  backgroundColor: badge.isSpecial
                                    ? 'var(--color-secondary-container, #fd7d69)'
                                    : 'var(--color-surface-container-high, #eae8e3)',
                                  color: badge.isSpecial
                                    ? 'var(--color-on-secondary-container, #71160b)'
                                    : 'var(--color-on-surface-variant, #4e453d)',
                                }}
                              >
                                {badge.label}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: 'var(--color-on-surface, #1b1c19)',
                                }}
                              >
                                {clause.title}
                              </span>
                            </div>
                            <p
                              style={{
                                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                                fontSize: '13px',
                                color: 'var(--color-on-surface-variant, #4e453d)',
                                margin: 0,
                                lineHeight: '1.4',
                              }}
                            >
                              {clause.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                        fontSize: '13px',
                        fontStyle: 'italic',
                        color: 'var(--color-outline, #80756b)',
                      }}
                    >
                      No clause highlights or special terms recorded for this agreement.
                    </span>
                  )}
                </div>

                {/* SLA Commitments Section [FR-1] */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '14px 16px',
                    border: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                      fontSize: '12px',
                      fontWeight: '700',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--color-primary, #59452b)',
                    }}
                  >
                    SLA Commitments
                  </span>

                  {contract.sla_commitments && contract.sla_commitments.length > 0 ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      {contract.sla_commitments.map((sla: SLACommitment) => (
                        <div
                          key={sla.id || `${sla.metric_name}-${sla.target_value}`}
                          style={{
                            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            padding: '8px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: 'var(--color-on-surface, #1b1c19)',
                            }}
                          >
                            {sla.metric_name}
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: 'var(--color-primary, #59452b)',
                            }}
                          >
                            Target: {sla.target_value}
                          </span>
                          {sla.penalty_terms && (
                            <span
                              style={{
                                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                                fontSize: '11px',
                                color: 'var(--color-secondary, #a43b2c)',
                              }}
                            >
                              Penalty: {sla.penalty_terms}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                        fontSize: '13px',
                        fontStyle: 'italic',
                        color: 'var(--color-outline, #80756b)',
                      }}
                    >
                      No active SLA commitments defined for this agreement.
                    </span>
                  )}
                </div>

                {/* Footer Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingTop: '4px',
                  }}
                >
                  <Link
                    href={`/contracts/${contract.id}`}
                    style={{
                      fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'var(--color-primary, #59452b)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    View Contract Details &amp; Documents &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContractList;
