import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentRepository, formatFileSize, formatTimestamp, extractFileName } from '../src/components/clm/DocumentRepository';
import { DocumentVersion } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

const sampleDocuments: DocumentVersion[] = [
  {
    id: 'doc-v1',
    contract_id: 'cnt-100',
    version_number: 1,
    file_path: '/storage/contracts/cnt-100/v1_master_agreement.pdf',
    file_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    file_size_bytes: 1048576, // 1.00 MB
    uploaded_by_user_id: 'usr-legal-admin',
    uploaded_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'doc-v2',
    contract_id: 'cnt-100',
    version_number: 2,
    file_path: '/storage/contracts/cnt-100/v2_master_agreement_amended.docx',
    file_hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    file_size_bytes: 2621440, // 2.50 MB
    uploaded_by_user_id: 'usr-ops-lead',
    uploaded_at: '2026-02-20T14:30:00Z',
  },
];

describe('DocumentRepository Helpers', () => {
  it('formatFileSize converts byte values into human readable string', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(500)).toBe('500 Bytes');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.00 MB');
    expect(formatFileSize(2621440)).toBe('2.50 MB');
  });

  it('extractFileName parses filename from path string', () => {
    expect(extractFileName('/storage/contracts/file.pdf')).toBe('file.pdf');
    expect(extractFileName('C:\\Users\\docs\\agreement.docx')).toBe('agreement.docx');
    expect(extractFileName('simple_file.txt')).toBe('simple_file.txt');
  });
});

describe('DocumentRepository Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders repository title, version count badge, and document version items when initialDocuments is supplied', () => {
    render(<DocumentRepository initialDocuments={sampleDocuments} />);

    expect(screen.getByTestId('document-repository-title')).toHaveTextContent('Document Repository');
    expect(screen.getByTestId('document-count')).toHaveTextContent('2 Versions');
    expect(screen.getByTestId('document-versioned-badge')).toHaveTextContent('Version-Controlled & Hash-Verified');

    const items = screen.getAllByTestId('document-version-item');
    expect(items).toHaveLength(2);

    const versionNumbers = screen.getAllByTestId('document-version-number');
    expect(versionNumbers[0]).toHaveTextContent('Version #2'); // Sorted latest first by default
    expect(versionNumbers[1]).toHaveTextContent('Version #1');

    expect(screen.getByTestId('document-latest-badge')).toHaveTextContent('Current Active Revision');

    const filenames = screen.getAllByTestId('document-file-name');
    expect(filenames[0]).toHaveTextContent('v2_master_agreement_amended.docx');
    expect(filenames[1]).toHaveTextContent('v1_master_agreement.pdf');

    const uploadedByList = screen.getAllByTestId('document-uploaded-by');
    expect(uploadedByList[0]).toHaveTextContent('usr-ops-lead');
    expect(uploadedByList[1]).toHaveTextContent('usr-legal-admin');
  });

  it('renders empty state when no documents exist and allows opening upload revision form', () => {
    render(<DocumentRepository initialDocuments={[]} />);

    expect(screen.getByTestId('document-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Document Versions Found')).toBeInTheDocument();

    const uploadToggle = screen.getByTestId('upload-document-toggle');
    expect(uploadToggle).toBeInTheDocument();

    fireEvent.click(uploadToggle);
    expect(screen.getByTestId('upload-form')).toBeInTheDocument();
  });

  it('filters document list when typing in search input', () => {
    render(<DocumentRepository initialDocuments={sampleDocuments} />);

    const searchInput = screen.getByTestId('document-search-input');
    fireEvent.change(searchInput, { target: { value: 'amended' } });

    const items = screen.getAllByTestId('document-version-item');
    expect(items).toHaveLength(1);
    expect(screen.getByTestId('document-file-name')).toHaveTextContent('v2_master_agreement_amended.docx');
  });

  it('sorts document list ascending when sort order selection is changed', () => {
    render(<DocumentRepository initialDocuments={sampleDocuments} />);

    const sortSelect = screen.getByTestId('document-sort-order');
    fireEvent.change(sortSelect, { target: { value: 'asc' } });

    const versionNumbers = screen.getAllByTestId('document-version-number');
    expect(versionNumbers[0]).toHaveTextContent('Version #1');
    expect(versionNumbers[1]).toHaveTextContent('Version #2');
  });

  it('fetches document versions from API automatically when contractId is supplied', async () => {
    const listDocsSpy = vi
      .spyOn(clmClientModule, 'listDocuments')
      .mockResolvedValueOnce(sampleDocuments);

    render(<DocumentRepository contractId="cnt-100" autoFetch={true} roles="LEGAL" />);

    expect(screen.getByTestId('document-loading-state')).toBeInTheDocument();

    await waitFor(() => {
      expect(listDocsSpy).toHaveBeenCalledWith('cnt-100', { roles: 'LEGAL' });
      expect(screen.queryByTestId('document-loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getAllByTestId('document-version-item')).toHaveLength(2);
  });

  it('renders error state on API failure and retries fetching', async () => {
    const listDocsSpy = vi
      .spyOn(clmClientModule, 'listDocuments')
      .mockRejectedValueOnce(new Error('Network error loading versions'))
      .mockResolvedValueOnce(sampleDocuments);

    render(<DocumentRepository contractId="cnt-100" autoFetch={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('document-error-state')).toBeInTheDocument();
      expect(screen.getByText('Network error loading versions')).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId('document-retry-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(listDocsSpy).toHaveBeenCalledTimes(2);
      expect(screen.getAllByTestId('document-version-item')).toHaveLength(2);
    });
  });

  it('validates file size limit and triggers upload callback on form submission', async () => {
    const newDoc: DocumentVersion = {
      id: 'doc-v3',
      contract_id: 'cnt-100',
      version_number: 3,
      file_path: '/storage/contracts/cnt-100/v3_revision.pdf',
      file_hash: '3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef012',
      file_size_bytes: 512000,
      uploaded_by_user_id: 'usr-admin',
      uploaded_at: '2026-03-01T10:00:00Z',
    };

    const uploadDocSpy = vi
      .spyOn(clmClientModule, 'uploadDocument')
      .mockResolvedValueOnce(newDoc);

    const onUploadedMock = vi.fn();

    render(
      <DocumentRepository
        contractId="cnt-100"
        initialDocuments={sampleDocuments}
        onDocumentUploaded={onUploadedMock}
      />
    );

    // Open upload form
    fireEvent.click(screen.getByTestId('upload-document-toggle'));
    expect(screen.getByTestId('upload-form')).toBeInTheDocument();

    // Select an oversized file (>25 MB)
    const fileInput = screen.getByTestId('document-file-input');
    const oversizedFile = new File(['a'.repeat(100)], 'huge_file.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 30 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    expect(screen.getByTestId('upload-error')).toHaveTextContent('File size exceeds maximum allowed limit of 25 MB');

    // Select valid file
    const validFile = new File(['valid content'], 'v3_revision.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Fill user ID
    const userIdInput = screen.getByTestId('upload-user-id-input');
    fireEvent.change(userIdInput, { target: { value: 'usr-admin' } });

    // Submit form
    const submitBtn = screen.getByTestId('upload-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(uploadDocSpy).toHaveBeenCalledWith(
        'cnt-100',
        validFile,
        expect.objectContaining({
          uploaded_by_user_id: 'usr-admin',
        })
      );
      expect(onUploadedMock).toHaveBeenCalledWith(newDoc);
    });
  });

  it('triggers download when clicking download button on a document version item', async () => {
    const downloadDocSpy = vi
      .spyOn(clmClientModule, 'downloadDocument')
      .mockResolvedValueOnce(new Blob(['test pdf content'], { type: 'application/pdf' }));

    const onDownloadedMock = vi.fn();

    // Mock URL object creation
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-id');
    window.URL.revokeObjectURL = vi.fn();

    render(
      <DocumentRepository
        contractId="cnt-100"
        initialDocuments={sampleDocuments}
        onDocumentDownloaded={onDownloadedMock}
      />
    );

    const downloadBtn = screen.getByTestId('download-document-btn-doc-v2');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(downloadDocSpy).toHaveBeenCalledWith('cnt-100', 'doc-v2', { roles: undefined });
      expect(onDownloadedMock).toHaveBeenCalledWith(sampleDocuments[1]);
    });
  });

  it('expands full SHA-256 hash when clicking toggle hash button', () => {
    render(<DocumentRepository initialDocuments={sampleDocuments} />);

    const toggleBtn = screen.getByTestId('toggle-hash-btn-doc-v1');
    expect(toggleBtn).toBeInTheDocument();

    const hashes = screen.getAllByTestId('document-file-hash');
    expect(hashes[1]).toHaveTextContent('e3b0c44298fc1c14...');

    fireEvent.click(toggleBtn);
    expect(hashes[1]).toHaveTextContent('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
