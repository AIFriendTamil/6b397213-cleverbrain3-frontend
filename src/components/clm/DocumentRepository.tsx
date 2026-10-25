'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DocumentVersion,
  listDocuments,
  uploadDocument,
  downloadDocument,
} from '../../services/clm_client';

export interface DocumentRepositoryProps {
  /** Contract ID to load document versions for from backend API */
  contractId?: string;
  /** Initial document versions list */
  initialDocuments?: DocumentVersion[];
  /** Alias for initialDocuments */
  documents?: DocumentVersion[];
  /** Optional user roles override header for RBAC / API requests */
  roles?: string;
  /** Callback triggered when a new document version is uploaded */
  onDocumentUploaded?: (document: DocumentVersion) => void;
  /** Callback triggered when a document version file is downloaded */
  onDocumentDownloaded?: (document: DocumentVersion) => void;
  /** Whether to auto-fetch documents from API when contractId is provided. Defaults to true */
  autoFetch?: boolean;
  /** Read-only mode: hides upload controls. Defaults to false */
  readOnly?: boolean;
  /** Custom container CSS class name */
  className?: string;
  /** Custom data-testid attribute override */
  'data-testid'?: string;
}

/**
 * Formats byte size into human-readable representation (Bytes, KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  if (bytes < 1024) return `${bytes} Bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats ISO timestamp string into human-readable date & time.
 */
export function formatTimestamp(timestampStr: string): string {
  if (!timestampStr) return 'N/A';
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) {
      return timestampStr;
    }
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestampStr;
  }
}

/**
 * Extracts clean filename from file path.
 */
export function extractFileName(filePath: string): string {
  if (!filePath) return 'document.pdf';
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

/**
 * Truncates SHA-256 hash for display with optional expansion.
 */
export function formatHash(hash: string, length = 16): string {
  if (!hash) return 'N/A';
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length)}...`;
}

export const DocumentRepository: React.FC<DocumentRepositoryProps> = ({
  contractId,
  initialDocuments,
  documents,
  roles,
  onDocumentUploaded,
  onDocumentDownloaded,
  autoFetch = true,
  readOnly = false,
  className = '',
  'data-testid': testId = 'document-repository',
}) => {
  // Consolidate initial documents data
  const initialData = useMemo(() => {
    return initialDocuments || documents || [];
  }, [initialDocuments, documents]);

  const [documentList, setDocumentList] = useState<DocumentVersion[]>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search, filter & sort controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // Default latest version first

  // Upload Revision Form state
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expectedHash, setExpectedHash] = useState<string>('');
  const [uploadedByUserId, setUploadedByUserId] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Downloading state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Expanded hash toggles
  const [expandedHashes, setExpandedHashes] = useState<Record<string, boolean>>({});

  // Sync prop changes if initialData changes and autoFetch isn't active
  useEffect(() => {
    if (!contractId || !autoFetch) {
      setDocumentList(initialData);
    }
  }, [initialData, contractId, autoFetch]);

  /**
   * Fetch document versions from backend API.
   */
  const fetchDocuments = useCallback(async () => {
    if (!contractId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await listDocuments(contractId, { roles });
      setDocumentList(data || []);
    } catch (err: any) {
      console.error('Failed to load document versions:', err);
      setError(
        err?.message || 'Failed to fetch document version history. Please verify your connection.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [contractId, roles]);

  useEffect(() => {
    if (contractId && autoFetch) {
      fetchDocuments();
    }
  }, [contractId, autoFetch, fetchDocuments]);

  // Max version calculation
  const latestVersionNumber = useMemo(() => {
    if (!documentList.length) return 0;
    return Math.max(...documentList.map((d) => d.version_number));
  }, [documentList]);

  // Filter and sort document list
  const filteredDocuments = useMemo(() => {
    let result = [...documentList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (doc) =>
          doc.file_path.toLowerCase().includes(q) ||
          extractFileName(doc.file_path).toLowerCase().includes(q) ||
          doc.uploaded_by_user_id.toLowerCase().includes(q) ||
          `v${doc.version_number}`.includes(q) ||
          `version ${doc.version_number}`.includes(q) ||
          doc.file_hash.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.version_number - b.version_number;
      }
      return b.version_number - a.version_number;
    });

    return result;
  }, [documentList, searchQuery, sortOrder]);

  /**
   * Toggle full view of document SHA-256 integrity hash.
   */
  const toggleHashExpand = (docId: string) => {
    setExpandedHashes((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  /**
   * File selection handler for file input element.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  /**
   * Validate file size (25 MB max limit) and set state.
   */
  const validateAndSetFile = (file: File) => {
    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxSizeBytes) {
      setUploadError('File size exceeds maximum allowed limit of 25 MB.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
  };

  /**
   * Drag & Drop event handlers.
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  /**
   * Upload revision form submit handler.
   */
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    if (!contractId) {
      setUploadError('Contract ID is missing. Cannot upload document.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const uploadOpts = {
        expected_hash: expectedHash.trim() || undefined,
        uploaded_by_user_id: uploadedByUserId.trim() || undefined,
        roles,
      };

      const newDoc = await uploadDocument(contractId, selectedFile, uploadOpts);

      // Add new document version to state
      setDocumentList((prev) => [newDoc, ...prev]);

      setUploadSuccess(`Successfully uploaded Version #${newDoc.version_number}`);
      setSelectedFile(null);
      setExpectedHash('');
      setUploadedByUserId('');

      if (onDocumentUploaded) {
        onDocumentUploaded(newDoc);
      }

      // Close upload form after a brief delay
      setTimeout(() => {
        setShowUploadForm(false);
        setUploadSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to upload document revision:', err);
      setUploadError(
        err?.message || 'Failed to upload document version. Please check the file and try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Download a specific document version file.
   */
  const handleDownload = async (doc: DocumentVersion) => {
    setDownloadError(null);
    setDownloadingId(doc.id);

    try {
      let blob: Blob;

      if (contractId) {
        blob = await downloadDocument(contractId, doc.id, { roles });
      } else {
        // Fallback mock blob for preview/testing when contractId is not provided
        blob = new Blob([`Mock document content for version ${doc.version_number}`], {
          type: 'application/pdf',
        });
      }

      // Trigger browser file download
      const fileName = extractFileName(doc.file_path) || `contract_v${doc.version_number}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (onDocumentDownloaded) {
        onDocumentDownloaded(doc);
      }
    } catch (err: any) {
      console.error(`Failed to download version ${doc.version_number}:`, err);
      setDownloadError(
        err?.message || `Failed to download version ${doc.version_number}. Please try again.`
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div
      data-testid={testId}
      className={`document-repository-container ${className}`}
      style={{
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2
              data-testid="document-repository-title"
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '22px',
                fontWeight: 500,
                color: 'var(--color-primary, #59452b)',
                margin: 0,
              }}
            >
              Document Repository
            </h2>

            <span
              data-testid="document-count"
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontWeight: 600,
                color: 'var(--color-on-surface-variant, #4e453d)',
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                letterSpacing: '0.02em',
              }}
            >
              {documentList.length} {documentList.length === 1 ? 'Version' : 'Versions'}
            </span>

            <span
              data-testid="document-versioned-badge"
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                fontWeight: 500,
                color: 'var(--color-trend-up, #2e6b38)',
                backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
                border: '1px solid var(--color-trend-up, #2e6b38)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>🔒</span> Version-Controlled & Hash-Verified
            </span>
          </div>

          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginTop: '4px',
              marginBottom: 0,
            }}
          >
            Access historical revisions, upload agreement updates, and verify document SHA-256 integrity checksums.
          </p>
        </div>

        {/* Action Controls */}
        {!readOnly && (
          <div>
            <button
              type="button"
              data-testid="upload-document-toggle"
              onClick={() => {
                setShowUploadForm(!showUploadForm);
                setUploadError(null);
                setUploadSuccess(null);
              }}
              style={{
                backgroundColor: showUploadForm
                  ? 'var(--color-surface-container-high, #eae8e3)'
                  : 'var(--color-primary, #59452b)',
                color: showUploadForm
                  ? 'var(--color-on-surface, #1b1c19)'
                  : 'var(--color-on-primary, #ffffff)',
                border: showUploadForm
                  ? '1px solid var(--color-outline, #80756b)'
                  : '1px solid var(--color-primary, #59452b)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{showUploadForm ? '✕ Close Upload' : '📤 Upload Revision'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Download Error Banner */}
      {downloadError && (
        <div
          data-testid="download-error"
          style={{
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            border: '1px solid var(--color-error, #ba1a1a)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠️ {downloadError}</span>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-on-error-container, #93000a)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Revision Form Modal / Collapsible Section */}
      {!readOnly && showUploadForm && (
        <div
          data-testid="upload-form"
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--color-primary, #59452b)',
              marginTop: 0,
              marginBottom: '12px',
            }}
          >
            Upload Updated Agreement Revision (Version #{latestVersionNumber + 1})
          </h3>

          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginTop: 0,
              marginBottom: '16px',
            }}
          >
            Uploading a new file automatically increments the document version while preserving complete download access to past revisions. Supported file size up to 25 MB.
          </p>

          {/* Form alert states */}
          {uploadError && (
            <div
              data-testid="upload-error"
              style={{
                backgroundColor: 'var(--color-error-container, #ffdad6)',
                color: 'var(--color-on-error-container, #93000a)',
                border: '1px solid var(--color-error, #ba1a1a)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              ⚠️ {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div
              data-testid="upload-success"
              style={{
                backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
                color: 'var(--color-trend-up, #2e6b38)',
                border: '1px solid var(--color-trend-up, #2e6b38)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              ✅ {uploadSuccess}
            </div>
          )}

          <form onSubmit={handleUploadSubmit}>
            {/* Drag and drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragOver
                  ? '2px dashed var(--color-primary, #59452b)'
                  : '2px dashed var(--color-outline-variant, #d1c4b9)',
                backgroundColor: isDragOver
                  ? 'var(--color-surface-container-high, #eae8e3)'
                  : 'var(--color-surface-container-lowest, #ffffff)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '16px',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="file"
                data-testid="document-file-input"
                id="document-file-input"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
              />
              <label
                htmlFor="document-file-input"
                style={{ cursor: 'pointer', display: 'block', width: '100%' }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                {selectedFile ? (
                  <div>
                    <span
                      data-testid="upload-selected-file-name"
                      style={{
                        fontWeight: 600,
                        color: 'var(--color-primary, #59452b)',
                        fontSize: '14px',
                      }}
                    >
                      {selectedFile.name}
                    </span>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        marginTop: '2px',
                      }}
                    >
                      {formatFileSize(selectedFile.size)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface, #1b1c19)' }}>
                      Drag and drop file here, or <span style={{ color: 'var(--color-primary, #59452b)', textDecoration: 'underline' }}>browse file</span>
                    </span>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        marginTop: '4px',
                      }}
                    >
                      PDF, DOCX, DOC, or TXT up to 25 MB
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Additional input fields */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div>
                <label
                  htmlFor="upload-user-id-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '4px',
                  }}
                >
                  Uploaded By User ID (Optional)
                </label>
                <input
                  type="text"
                  id="upload-user-id-input"
                  data-testid="upload-user-id-input"
                  value={uploadedByUserId}
                  onChange={(e) => setUploadedByUserId(e.target.value)}
                  placeholder="e.g. usr-legal-admin"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    fontSize: '13px',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="upload-expected-hash-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '4px',
                  }}
                >
                  Expected SHA-256 Checksum (Optional)
                </label>
                <input
                  type="text"
                  id="upload-expected-hash-input"
                  data-testid="upload-expected-hash-input"
                  value={expectedHash}
                  onChange={(e) => setExpectedHash(e.target.value)}
                  placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  }}
                />
              </div>
            </div>

            {/* Form Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                data-testid="upload-cancel-btn"
                onClick={() => {
                  setShowUploadForm(false);
                  setSelectedFile(null);
                  setUploadError(null);
                  setUploadSuccess(null);
                }}
                disabled={isUploading}
                style={{
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                data-testid="upload-submit-btn"
                disabled={isUploading || !selectedFile}
                style={{
                  backgroundColor:
                    isUploading || !selectedFile
                      ? 'var(--color-outline-variant, #d1c4b9)'
                      : 'var(--color-primary, #59452b)',
                  color: 'var(--color-on-primary, #ffffff)',
                  border: '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isUploading || !selectedFile ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isUploading ? (
                  <span data-testid="upload-loading">Uploading Revision...</span>
                ) : (
                  <span>Submit Revision</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Search input */}
        <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
          <input
            type="text"
            data-testid="document-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name, version #, user ID, or hash..."
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          />
        </div>

        {/* Sort Order Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label
            htmlFor="document-sort-order"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Sort Versions:
          </label>
          <select
            id="document-sort-order"
            data-testid="document-sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            <option value="desc">Latest Version First (v{latestVersionNumber || 1} → v1)</option>
            <option value="asc">Oldest Version First (v1 → v{latestVersionNumber || 1})</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          data-testid="document-loading-state"
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'var(--color-on-surface-variant, #4e453d)',
          }}
        >
          <div
            style={{
              fontSize: '24px',
              marginBottom: '8px',
              animation: 'pulse 1.5s infinite',
            }}
          >
            ⏳
          </div>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>Loading document version repository...</div>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          data-testid="document-error-state"
          style={{
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            border: '1px solid var(--color-error, #ba1a1a)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--color-on-error-container, #93000a)',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
            Failed to Load Documents
          </div>
          <div style={{ fontSize: '13px', marginBottom: '14px' }}>{error}</div>
          <button
            type="button"
            data-testid="document-retry-btn"
            onClick={fetchDocuments}
            style={{
              backgroundColor: 'var(--color-error, #ba1a1a)',
              color: 'var(--color-on-error, #ffffff)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredDocuments.length === 0 && (
        <div
          data-testid="document-empty-state"
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--color-primary, #59452b)',
              margin: '0 0 6px 0',
            }}
          >
            {searchQuery ? 'No Matching Document Versions' : 'No Document Versions Found'}
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              margin: 0,
            }}
          >
            {searchQuery
              ? `No document versions match "${searchQuery}". Try clearing your search.`
              : 'This contract does not have any document files uploaded yet.'}
          </p>

          {!readOnly && !searchQuery && (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              style={{
                marginTop: '16px',
                backgroundColor: 'var(--color-primary, #59452b)',
                color: 'var(--color-on-primary, #ffffff)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Upload Initial Document Version
            </button>
          )}
        </div>
      )}

      {/* Document Versions List */}
      {!isLoading && !error && filteredDocuments.length > 0 && (
        <div
          data-testid="document-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {filteredDocuments.map((doc) => {
            const isLatest = doc.version_number === latestVersionNumber;
            const fileName = extractFileName(doc.file_path);
            const isHashExpanded = expandedHashes[doc.id] || false;
            const isDownloading = downloadingId === doc.id;

            return (
              <div
                key={doc.id}
                data-testid="document-version-item"
                style={{
                  backgroundColor: isLatest
                    ? 'var(--color-surface-container-lowest, #ffffff)'
                    : 'var(--color-surface-container-low, #f5f3ee)',
                  border: isLatest
                    ? '1.5px solid var(--color-primary-container, #735c41)'
                    : '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Top Row: Version Badge & Filename & Action */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      data-testid="document-version-number"
                      style={{
                        fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: isLatest
                          ? 'var(--color-on-primary, #ffffff)'
                          : 'var(--color-on-surface, #1b1c19)',
                        backgroundColor: isLatest
                          ? 'var(--color-primary-container, #735c41)'
                          : 'var(--color-surface-container-high, #eae8e3)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                      }}
                    >
                      Version #{doc.version_number}
                    </span>

                    {isLatest && (
                      <span
                        data-testid="document-latest-badge"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-trend-up, #2e6b38)',
                          backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full, 9999px)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        Current Active Revision
                      </span>
                    )}

                    <span
                      data-testid="document-file-name"
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: 'var(--color-primary, #59452b)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {fileName}
                    </span>
                  </div>

                  {/* Download Button */}
                  <div>
                    <button
                      type="button"
                      data-testid={`download-document-btn-${doc.id}`}
                      onClick={() => handleDownload(doc)}
                      disabled={isDownloading}
                      title={`Download Version ${doc.version_number} file (${fileName})`}
                      style={{
                        backgroundColor: isLatest
                          ? 'var(--color-primary, #59452b)'
                          : 'var(--color-surface-container-high, #eae8e3)',
                        color: isLatest
                          ? 'var(--color-on-primary, #ffffff)'
                          : 'var(--color-on-surface, #1b1c19)',
                        border: '1px solid var(--color-outline-variant, #d1c4b9)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md, 0.375rem)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: isDownloading ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isDownloading ? (
                        <span data-testid="download-loading">⏳ Downloading...</span>
                      ) : (
                        <>
                          <span>⬇️ Download File</span>
                          <span style={{ opacity: 0.8, fontSize: '11px' }}>
                            ({formatFileSize(doc.file_size_bytes)})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Metadata Row */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '12px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    borderTop: '1px stroke var(--color-outline-variant, #d1c4b9)',
                    paddingTop: '6px',
                  }}
                >
                  <div data-testid="document-uploaded-at">
                    <strong>Uploaded:</strong> {formatTimestamp(doc.uploaded_at)}
                  </div>

                  <div data-testid="document-uploaded-by">
                    <strong>By User:</strong> 👤 {doc.uploaded_by_user_id || 'system'}
                  </div>

                  <div data-testid="document-file-size">
                    <strong>File Size:</strong> {formatFileSize(doc.file_size_bytes)}
                  </div>

                  <div data-testid="document-file-path" style={{ opacity: 0.85 }}>
                    <strong>Path:</strong> <code style={{ fontSize: '11px' }}>{doc.file_path}</code>
                  </div>
                </div>

                {/* SHA-256 Hash Verification Badge */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)' }}>
                      SHA-256 Checksum:
                    </span>
                    <span data-testid="document-file-hash" style={{ color: 'var(--color-primary, #59452b)' }}>
                      {isHashExpanded ? doc.file_hash : formatHash(doc.file_hash)}
                    </span>
                  </div>

                  {doc.file_hash && doc.file_hash.length > 16 && (
                    <button
                      type="button"
                      data-testid={`toggle-hash-btn-${doc.id}`}
                      onClick={() => toggleHashExpand(doc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary, #59452b)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      {isHashExpanded ? 'Hide' : 'Show Full Hash'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentRepository;
