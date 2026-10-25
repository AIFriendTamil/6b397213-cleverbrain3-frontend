import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CLMService,
  clmService,
  searchContracts,
  listContracts,
  createContract,
  getContract,
  getContractDetail,
  deleteContract,
  getAmendments,
  recordAmendment,
  listDocuments,
  uploadDocument,
  downloadDocument,
  listESignatureRequests,
  createESignatureRequest,
  postESignatureWebhook,
  ContractCreate,
  ContractDetail,
  AmendmentCreate,
  AmendmentAuditLog,
  DocumentVersion,
  ESignatureRequestCreate,
  ESignatureRequest,
  WebhookAck,
} from '../src/services/clm_client';
import { ApiClient } from '../src/lib/api_client';

describe('CLMService', () => {
  let mockClient: ApiClient;
  let service: CLMService;

  beforeEach(() => {
    mockClient = new ApiClient('http://localhost:8000');
    service = new CLMService(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchContracts / listContracts', () => {
    it('should fetch contract list with query parameters and role headers', async () => {
      const mockResponse: ContractDetail[] = [
        {
          id: 'cnt-1',
          contract_number: 'CNT-2026-001',
          title: 'Master Services Agreement',
          counterparty: 'Acme Corp',
          status: 'ACTIVE',
          effective_on: '2026-01-01',
          expires_on: '2026-12-31',
          auto_renew: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          clauses: [],
          sla_commitments: [],
        },
      ];

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.searchContracts({
        status: 'ACTIVE',
        counterparty: 'Acme',
        keyword: 'Master',
        renewal_days: 90,
        roles: 'legal_manager',
        x_user_roles: 'legal_manager',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/contracts',
        expect.objectContaining({
          params: {
            status: 'ACTIVE',
            counterparty: 'Acme',
            keyword: 'Master',
            renewal_days: 90,
            roles: 'legal_manager',
          },
          headers: expect.objectContaining({
            'X-User-Roles': 'legal_manager',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should support listContracts alias', async () => {
      vi.spyOn(mockClient, 'get').mockResolvedValueOnce([]);
      const result = await service.listContracts();
      expect(result).toEqual([]);
    });
  });

  describe('createContract', () => {
    it('should POST new contract record', async () => {
      const payload: ContractCreate = {
        contract_number: 'CNT-2026-002',
        title: 'Vendor SLA',
        counterparty: 'Globex Corp',
        effective_on: '2026-02-01',
        expires_on: '2027-02-01',
      };
      const mockResponse: ContractDetail = {
        id: 'cnt-2',
        ...payload,
        status: 'DRAFT',
        auto_renew: false,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        clauses: [],
        sla_commitments: [],
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockResponse);

      const result = await service.createContract(payload);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/contracts',
        payload,
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getContract / getContractDetail', () => {
    it('should GET detailed contract record by ID', async () => {
      const mockResponse: ContractDetail = {
        id: 'cnt-1',
        contract_number: 'CNT-2026-001',
        title: 'Master Services Agreement',
        counterparty: 'Acme Corp',
        status: 'ACTIVE',
        effective_on: '2026-01-01',
        expires_on: '2026-12-31',
        auto_renew: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        clauses: [
          {
            id: 'cls-1',
            contract_id: 'cnt-1',
            title: 'Termination Clause',
            clause_type: 'TERMINATION',
            content: '30 days notice',
          },
        ],
        sla_commitments: [
          {
            id: 'sla-1',
            contract_id: 'cnt-1',
            metric_name: 'Uptime',
            target_value: '99.9%',
          },
        ],
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.getContract('cnt-1');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/contracts/cnt-1',
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should support getContractDetail alias', async () => {
      vi.spyOn(mockClient, 'get').mockResolvedValueOnce({ id: 'cnt-1' } as any);
      const result = await service.getContractDetail('cnt-1');
      expect(result.id).toBe('cnt-1');
    });
  });

  describe('deleteContract', () => {
    it('should DELETE contract record returning void', async () => {
      vi.spyOn(mockClient, 'delete').mockResolvedValueOnce(null);

      await service.deleteContract('cnt-1');

      expect(mockClient.delete).toHaveBeenCalledWith(
        '/api/v1/contracts/cnt-1',
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
    });
  });

  describe('getAmendments & recordAmendment', () => {
    it('should GET contract amendment audit trail history', async () => {
      const mockResponse: AmendmentAuditLog[] = [
        {
          id: 'amd-1',
          contract_id: 'cnt-1',
          amendment_number: 1,
          summary: 'Extended term by 12 months',
          user_id: 'usr-1',
          timestamp: '2026-03-01T10:00:00Z',
          integrity_hash: 'abc123hash',
        },
      ];

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.getAmendments('cnt-1');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/contracts/cnt-1/amendments',
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should POST new contract amendment entry', async () => {
      const payload: AmendmentCreate = {
        summary: 'Updated fee structure',
      };
      const mockResponse: AmendmentAuditLog = {
        id: 'amd-2',
        contract_id: 'cnt-1',
        amendment_number: 2,
        summary: payload.summary,
        user_id: 'usr-1',
        timestamp: '2026-03-02T10:00:00Z',
        integrity_hash: 'def456hash',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockResponse);

      const result = await service.recordAmendment('cnt-1', payload);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/contracts/cnt-1/amendments',
        payload,
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listDocuments, uploadDocument, downloadDocument', () => {
    it('should GET document version list for contract', async () => {
      const mockResponse: DocumentVersion[] = [
        {
          id: 'doc-1',
          contract_id: 'cnt-1',
          version_number: 1,
          file_path: '/storage/doc1.pdf',
          file_hash: 'sha256hash',
          file_size_bytes: 1024,
          uploaded_by_user_id: 'usr-1',
          uploaded_at: '2026-01-01T00:00:00Z',
        },
      ];

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.listDocuments('cnt-1');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/contracts/cnt-1/documents',
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should POST document upload with FormData', async () => {
      const mockResponse: DocumentVersion = {
        id: 'doc-2',
        contract_id: 'cnt-1',
        version_number: 2,
        file_path: '/storage/doc2.pdf',
        file_hash: 'sha256hash2',
        file_size_bytes: 2048,
        uploaded_by_user_id: 'usr-1',
        uploaded_at: '2026-02-01T00:00:00Z',
      };

      vi.spyOn(mockClient, 'request').mockResolvedValueOnce(mockResponse);

      const dummyBlob = new Blob(['pdf content'], { type: 'application/pdf' });
      const result = await service.uploadDocument('cnt-1', dummyBlob, {
        expected_hash: 'sha256hash2',
        uploaded_by_user_id: 'usr-1',
      });

      expect(mockClient.request).toHaveBeenCalledWith(
        '/api/v1/contracts/cnt-1/documents',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should download document version blob via fetch', async () => {
      const mockBlob = new Blob(['binary data'], { type: 'application/pdf' });
      const globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => mockBlob,
      } as any);

      const blobResult = await service.downloadDocument('cnt-1', 'doc-1');

      expect(globalFetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contracts/cnt-1/documents/doc-1/download'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(blobResult).toBe(mockBlob);
    });
  });

  describe('listESignatureRequests, createESignatureRequest, postESignatureWebhook', () => {
    it('should GET e-signature tracking requests', async () => {
      const mockResponse: ESignatureRequest[] = [
        {
          id: 'esig-1',
          contract_id: 'cnt-1',
          execution_status: 'PENDING',
          recipient_email: 'signer@example.com',
          recipient_name: 'John Signer',
          status_updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.listESignatureRequests({
        status: 'PENDING',
        contract_id: 'cnt-1',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/esignature/requests',
        expect.objectContaining({
          params: {
            status: 'PENDING',
            contract_id: 'cnt-1',
          },
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should POST new e-signature request', async () => {
      const payload: ESignatureRequestCreate = {
        contract_id: 'cnt-1',
        recipient_email: 'signer@example.com',
        recipient_name: 'John Signer',
      };
      const mockResponse: ESignatureRequest = {
        id: 'esig-2',
        ...payload,
        execution_status: 'PENDING',
        status_updated_at: '2026-01-01T00:00:00Z',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockResponse);

      const result = await service.createESignatureRequest(payload);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/esignature/requests',
        payload,
        expect.objectContaining({})
      );
      expect(result).toEqual(mockResponse);
    });

    it('should POST incoming e-signature webhook event', async () => {
      const mockAck: WebhookAck = {
        status: 'success',
        execution_status: 'SIGNED',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockAck);

      const result = await service.postESignatureWebhook('docusign', { event: 'signed' }, {
        signatureHeader: 'sig_123',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/esignature/webhooks/docusign',
        { event: 'signed' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Signature': 'sig_123',
          }),
        })
      );
      expect(result).toEqual(mockAck);
    });
  });

  describe('standalone exported functions', () => {
    it('should route standalone helper functions to clmService default instance', async () => {
      vi.spyOn(clmService, 'searchContracts').mockResolvedValueOnce([]);
      await searchContracts();
      expect(clmService.searchContracts).toHaveBeenCalled();

      vi.spyOn(clmService, 'getContract').mockResolvedValueOnce({ id: 'cnt-1' } as any);
      await getContract('cnt-1');
      expect(clmService.getContract).toHaveBeenCalledWith('cnt-1', undefined, undefined);

      vi.spyOn(clmService, 'getAmendments').mockResolvedValueOnce([]);
      await getAmendments('cnt-1');
      expect(clmService.getAmendments).toHaveBeenCalledWith('cnt-1', undefined, undefined);

      vi.spyOn(clmService, 'listDocuments').mockResolvedValueOnce([]);
      await listDocuments('cnt-1');
      expect(clmService.listDocuments).toHaveBeenCalledWith('cnt-1', undefined, undefined);

      vi.spyOn(clmService, 'listESignatureRequests').mockResolvedValueOnce([]);
      await listESignatureRequests();
      expect(clmService.listESignatureRequests).toHaveBeenCalled();
    });
  });
});
