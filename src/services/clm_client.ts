/**
 * Contract Lifecycle Management (CLM) API client service wrapper for frontend components.
 * Provides typed methods for contract CRUD, amendments, document storage, and e-signatures.
 */

import { apiClient, ApiClient, ApiClientOptions, ApiError } from '../lib/api_client';

/**
 * Clause highlight creation payload.
 */
export interface ClauseHighlightCreate {
  title: string;
  clause_type?: 'CONFIDENTIALITY' | 'TERMINATION' | 'INDEMNIFICATION' | 'GOVERNING_LAW' | 'SPECIAL_TERM' | string;
  content: string;
}

/**
 * Clause highlight details schema.
 */
export interface ClauseHighlight {
  id: string;
  contract_id: string;
  title: string;
  clause_type: string;
  content: string;
  created_at?: string | null;
}

/**
 * SLA commitment creation payload.
 */
export interface SLACommitmentCreate {
  metric_name: string;
  target_value: string;
  penalty_terms?: string | null;
}

/**
 * SLA commitment details schema.
 */
export interface SLACommitment {
  id: string;
  contract_id: string;
  metric_name: string;
  target_value: string;
  penalty_terms?: string | null;
  created_at?: string | null;
}

/**
 * Contract creation payload.
 */
export interface ContractCreate {
  contract_number: string;
  title: string;
  counterparty: string;
  status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | string;
  effective_on: string; // YYYY-MM-DD
  expires_on: string;   // YYYY-MM-DD
  auto_renew?: boolean;
  clauses?: ClauseHighlightCreate[];
  sla_commitments?: SLACommitmentCreate[];
}

/**
 * Contract summary representation.
 */
export interface ContractSummary {
  id: string;
  contract_number: string;
  title: string;
  counterparty: string;
  status: string;
  effective_on: string;
  expires_on: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Detailed contract schema with clause highlights and SLA commitments.
 */
export interface ContractDetail extends ContractSummary {
  clauses: ClauseHighlight[];
  sla_commitments: SLACommitment[];
}

/**
 * Amendment creation payload.
 */
export interface AmendmentCreate {
  summary: string;
  user_id?: string;
  timestamp?: string;
}

/**
 * Immutable amendment audit log entry.
 */
export interface AmendmentAuditLog {
  id: string;
  contract_id: string;
  amendment_number: number;
  summary: string;
  user_id: string;
  timestamp: string;
  integrity_hash: string;
}

/**
 * Document version schema.
 */
export interface DocumentVersion {
  id: string;
  contract_id: string;
  version_number: number;
  file_path: string;
  file_hash: string;
  file_size_bytes: number;
  uploaded_by_user_id: string;
  uploaded_at: string;
}

/**
 * Request options for document upload.
 */
export interface UploadDocumentOptions {
  expected_hash?: string;
  uploaded_by_user_id?: string;
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

/**
 * E-signature request creation payload.
 */
export interface ESignatureRequestCreate {
  contract_id: string;
  recipient_email: string;
  recipient_name: string;
  subject?: string;
}

/**
 * E-signature request details representation.
 */
export interface ESignatureRequest {
  id: string;
  contract_id: string;
  provider_ref_id?: string | null;
  execution_status: 'PENDING' | 'SIGNED' | 'DECLINED' | 'VOIDED' | string;
  recipient_email: string;
  recipient_name: string;
  status_updated_at: string;
  created_at?: string | null;
}

/**
 * Webhook acknowledgment response schema.
 */
export interface WebhookAck {
  status: string;
  provider_ref_id?: string | null;
  execution_status?: string | null;
  status_updated_at?: string | null;
  reason?: string | null;
}

/**
 * Search contracts query parameters.
 */
export interface SearchContractsParams {
  status?: string;
  counterparty?: string;
  keyword?: string;
  renewal_days?: number;
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

/**
 * Request options containing user role overrides.
 */
export interface RequestRoleParams {
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

/**
 * List e-signature requests query parameters.
 */
export interface ListESignatureRequestsParams {
  status?: string;
  execution_status?: string;
  contract_id?: string;
  recipient_email?: string;
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

export class CLMService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Build header dictionary including role overrides.
   */
  private buildHeaders(
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Record<string, string> {
    const customHeaders: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (params?.x_user_roles) {
      customHeaders['X-User-Roles'] = params.x_user_roles;
    }
    if (params?.x_user_role) {
      customHeaders['X-User-Role'] = params.x_user_role;
    }
    return customHeaders;
  }

  /**
   * Search and filter contract repository records.
   * [FR-1, FR-7]
   */
  public async searchContracts(
    params?: SearchContractsParams,
    options?: ApiClientOptions
  ): Promise<ContractDetail[]> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.status !== undefined) queryParams.status = params.status;
    if (params?.counterparty !== undefined) queryParams.counterparty = params.counterparty;
    if (params?.keyword !== undefined) queryParams.keyword = params.keyword;
    if (params?.renewal_days !== undefined) queryParams.renewal_days = params.renewal_days;
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.get<ContractDetail[]>('/api/v1/contracts', {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Alias for searchContracts.
   */
  public async listContracts(
    params?: SearchContractsParams,
    options?: ApiClientOptions
  ): Promise<ContractDetail[]> {
    return this.searchContracts(params, options);
  }

  /**
   * Create a new contract record with initial clauses and SLA commitments.
   * [FR-1]
   */
  public async createContract(
    payload: ContractCreate,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<ContractDetail> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.post<ContractDetail>('/api/v1/contracts', payload, {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Retrieve contract detail including clause highlights and SLA commitments.
   * [FR-1]
   */
  public async getContract(
    id: string,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<ContractDetail> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.get<ContractDetail>(`/api/v1/contracts/${encodeURIComponent(id)}`, {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Alias for getContract.
   */
  public async getContractDetail(
    id: string,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<ContractDetail> {
    return this.getContract(id, params, options);
  }

  /**
   * Delete a contract record. (HTTP 204 No Content)
   */
  public async deleteContract(
    id: string,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<void> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    await this.client.delete<null>(`/api/v1/contracts/${encodeURIComponent(id)}`, {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Fetch immutable amendment audit trail history for a contract.
   * [FR-6]
   */
  public async getAmendments(
    id: string,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<AmendmentAuditLog[]> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.get<AmendmentAuditLog[]>(
      `/api/v1/contracts/${encodeURIComponent(id)}/amendments`,
      {
        ...options,
        params: {
          ...queryParams,
          ...(options?.params || {}),
        },
        headers,
      }
    );
  }

  /**
   * Record a new amendment entry in the contract audit trail.
   * [FR-6]
   */
  public async recordAmendment(
    id: string,
    payload: AmendmentCreate,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<AmendmentAuditLog> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.post<AmendmentAuditLog>(
      `/api/v1/contracts/${encodeURIComponent(id)}/amendments`,
      payload,
      {
        ...options,
        params: {
          ...queryParams,
          ...(options?.params || {}),
        },
        headers,
      }
    );
  }

  /**
   * Fetch document versions list for a contract.
   * [FR-2]
   */
  public async listDocuments(
    id: string,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<DocumentVersion[]> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.get<DocumentVersion[]>(
      `/api/v1/contracts/${encodeURIComponent(id)}/documents`,
      {
        ...options,
        params: {
          ...queryParams,
          ...(options?.params || {}),
        },
        headers,
      }
    );
  }

  /**
   * Upload a new document revision version for a contract.
   * [FR-2]
   */
  public async uploadDocument(
    id: string,
    file: File | Blob,
    options?: UploadDocumentOptions,
    apiOptions?: ApiClientOptions
  ): Promise<DocumentVersion> {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file, file.name);
    } else {
      formData.append('file', file, 'document.pdf');
    }

    if (options?.expected_hash) {
      formData.append('expected_hash', options.expected_hash);
    }
    if (options?.uploaded_by_user_id) {
      formData.append('uploaded_by_user_id', options.uploaded_by_user_id);
    }

    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (options?.roles !== undefined) queryParams.roles = options.roles;

    const headers = this.buildHeaders(options, apiOptions);

    return this.client.request<DocumentVersion>(
      `/api/v1/contracts/${encodeURIComponent(id)}/documents`,
      {
        ...apiOptions,
        method: 'POST',
        body: formData,
        params: {
          ...queryParams,
          ...(apiOptions?.params || {}),
        },
        headers,
      }
    );
  }

  /**
   * Download a specific document version file.
   * [FR-2]
   */
  public async downloadDocument(
    id: string,
    versionId: string,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<Blob> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    const baseUrl =
      options?.baseUrl ||
      (this.client as any).baseUrl ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8000';
    const base = baseUrl.replace(/\/$/, '');
    const endpoint = `/api/v1/contracts/${encodeURIComponent(id)}/documents/${encodeURIComponent(versionId)}/download`;

    const searchParams = new URLSearchParams();
    if (queryParams.roles) searchParams.append('roles', String(queryParams.roles));
    const searchStr = searchParams.toString();
    const url = `${base}${endpoint}${searchStr ? '?' + searchStr : ''}`;

    const activeToken = options?.token ?? this.client.getSessionToken();
    if (activeToken) {
      headers['X-Session-ID'] = activeToken;
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: options?.credentials || 'include',
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Fallback
      }
      throw new ApiError(errorMessage, response.status, 'DOWNLOAD_ERROR');
    }

    return response.blob();
  }

  /**
   * Fetch e-signature request records for tracking hub.
   * [FR-5]
   */
  public async listESignatureRequests(
    params?: ListESignatureRequestsParams,
    options?: ApiClientOptions
  ): Promise<ESignatureRequest[]> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    const statusVal = params?.status || params?.execution_status;
    if (statusVal !== undefined) queryParams.status = statusVal;
    if (params?.contract_id !== undefined) queryParams.contract_id = params.contract_id;
    if (params?.recipient_email !== undefined) queryParams.recipient_email = params.recipient_email;
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.get<ESignatureRequest[]>('/api/v1/esignature/requests', {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Create and dispatch a new e-signature request.
   * [FR-5]
   */
  public async createESignatureRequest(
    payload: ESignatureRequestCreate,
    params?: RequestRoleParams,
    options?: ApiClientOptions
  ): Promise<ESignatureRequest> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) queryParams.roles = params.roles;

    const headers = this.buildHeaders(params, options);

    return this.client.post<ESignatureRequest>('/api/v1/esignature/requests', payload, {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Process an incoming e-signature provider webhook notification.
   * [FR-5]
   */
  public async postESignatureWebhook(
    provider: string,
    payload: unknown,
    options?: ApiClientOptions & { signatureHeader?: string }
  ): Promise<WebhookAck> {
    const customHeaders: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (options?.signatureHeader) {
      customHeaders['X-Signature'] = options.signatureHeader;
    }

    return this.client.post<WebhookAck>(
      `/api/v1/esignature/webhooks/${encodeURIComponent(provider)}`,
      payload,
      {
        ...options,
        headers: customHeaders,
      }
    );
  }
}

// Export class alias
export { CLMService as CLMClient };

// Singleton instances
export const clmService = new CLMService();
export const clmClient = clmService;

// Standalone exported functions
export const searchContracts = (
  params?: SearchContractsParams,
  options?: ApiClientOptions
): Promise<ContractDetail[]> => clmService.searchContracts(params, options);

export const listContracts = (
  params?: SearchContractsParams,
  options?: ApiClientOptions
): Promise<ContractDetail[]> => clmService.listContracts(params, options);

export const createContract = (
  payload: ContractCreate,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<ContractDetail> => clmService.createContract(payload, params, options);

export const getContract = (
  id: string,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<ContractDetail> => clmService.getContract(id, params, options);

export const getContractDetail = (
  id: string,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<ContractDetail> => clmService.getContractDetail(id, params, options);

export const deleteContract = (
  id: string,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<void> => clmService.deleteContract(id, params, options);

export const getAmendments = (
  id: string,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<AmendmentAuditLog[]> => clmService.getAmendments(id, params, options);

export const recordAmendment = (
  id: string,
  payload: AmendmentCreate,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<AmendmentAuditLog> => clmService.recordAmendment(id, payload, params, options);

export const listDocuments = (
  id: string,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<DocumentVersion[]> => clmService.listDocuments(id, params, options);

export const uploadDocument = (
  id: string,
  file: File | Blob,
  options?: UploadDocumentOptions,
  apiOptions?: ApiClientOptions
): Promise<DocumentVersion> => clmService.uploadDocument(id, file, options, apiOptions);

export const downloadDocument = (
  id: string,
  versionId: string,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<Blob> => clmService.downloadDocument(id, versionId, params, options);

export const listESignatureRequests = (
  params?: ListESignatureRequestsParams,
  options?: ApiClientOptions
): Promise<ESignatureRequest[]> => clmService.listESignatureRequests(params, options);

export const createESignatureRequest = (
  payload: ESignatureRequestCreate,
  params?: RequestRoleParams,
  options?: ApiClientOptions
): Promise<ESignatureRequest> => clmService.createESignatureRequest(payload, params, options);

export const postESignatureWebhook = (
  provider: string,
  payload: unknown,
  options?: ApiClientOptions & { signatureHeader?: string }
): Promise<WebhookAck> => clmService.postESignatureWebhook(provider, payload, options);
