import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  FileSpreadsheet,
  FileCode,
  FileJson,
  File,
  Sparkles,
  Search,
  Eye,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { DocumentItem, DocumentUploadResult } from '../types';
import { documentApi } from '../api/client';

interface DocumentManagerProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  onToggleDocSelection: (docId: string) => void;
  onSelectAllDocs: () => void;
  onClearDocSelection: () => void;
  onRefreshDocs: () => Promise<void>;
  loading: boolean;
}

interface ChunkItem {
  id: string;
  chunk_index: number;
  content: string;
  metadata: {
    page?: number;
    sheet?: string;
    section?: string;
    row_range?: string;
    filename?: string;
  };
}

const SUPPORTED_EXTS = [
  { ext: '.pdf', label: 'PDF (Page Chunks)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { ext: '.docx', label: 'DOCX / DOC', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { ext: '.xlsx', label: 'Excel / CSV / TSV', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { ext: '.md', label: 'Markdown', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { ext: '.json', label: 'JSON / JSONL', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { ext: '.xml', label: 'XML / HTML', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { ext: '.yaml', label: 'YAML / TOML / INI', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { ext: '.txt', label: 'TXT / RTF / Logs', color: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  { ext: '.code', label: 'Code (Py, JS, TS, SQL)', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { ext: '*', label: 'All Document Files', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
];

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  selectedDocIds,
  onToggleDocSelection,
  onSelectAllDocs,
  onClearDocSelection,
  onRefreshDocs,
  loading,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<DocumentUploadResult[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingSample, setIsCreatingSample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunk Inspector Modal State
  const [inspectingDoc, setInspectingDoc] = useState<DocumentItem | null>(null);
  const [docChunks, setDocChunks] = useState<ChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkFilterTerm, setChunkFilterTerm] = useState('');
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    setErrorMessage(null);
    setUploadFeedback(null);
    try {
      const results = await documentApi.upload(files);
      setUploadFeedback(results);
      await onRefreshDocs();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Failed to upload documents. Please check file format.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}" and its vector embeddings?`)) {
      return;
    }
    try {
      await documentApi.delete(id);
      if (inspectingDoc?.id === id) {
        setInspectingDoc(null);
      }
      await onRefreshDocs();
    } catch (err: any) {
      alert(`Delete failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleOpenChunkInspector = async (doc: DocumentItem) => {
    setInspectingDoc(doc);
    setLoadingChunks(true);
    setChunkFilterTerm('');
    try {
      const chunks = await documentApi.getChunks(doc.id);
      setDocChunks(chunks);
    } catch (err: any) {
      alert(`Failed to load chunks: ${err.message}`);
    } finally {
      setLoadingChunks(false);
    }
  };

  const copyChunkText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const handleCreateSampleDocuments = async () => {
    setIsCreatingSample(true);
    setErrorMessage(null);
    try {
      const BrowserFile = (window as any).File;

      // 1. Create a 2-page sample PDF with exact offsets
      const stream1 = 'BT /F1 12 Tf 72 712 Td (Project Titan Specification - Page 1: Quantum Hybrid Architecture. Apex Systems deployed 8 cryogenic nodes running at 15 millikelvin. Two-qubit gate fidelity reached 99.82 percent with Kyber-1024 lattice encryption.) Tj ET';
      const stream2 = 'BT /F1 12 Tf 72 712 Td (Project Titan Specification - Page 2: Budget and Q3 Milestones. Distributed inference speed accelerated by 4.8x with power draw decreased by 34 percent. Commercial pilot scheduled for October 2025.) Tj ET';

      let pdf = '%PDF-1.4\n';
      const offsets: number[] = [];

      offsets.push(pdf.length);
      pdf += '1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n';

      offsets.push(pdf.length);
      pdf += '2 0 obj\n<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>\nendobj\n';

      offsets.push(pdf.length);
      pdf += '3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 5 0 R/Resources<<>>>>\nendobj\n';

      offsets.push(pdf.length);
      pdf += '4 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 6 0 R/Resources<<>>>>\nendobj\n';

      offsets.push(pdf.length);
      pdf += `5 0 obj\n<</Length ${stream1.length}>>\nstream\n${stream1}\nendstream\nendobj\n`;

      offsets.push(pdf.length);
      pdf += `6 0 obj\n<</Length ${stream2.length}>>\nstream\n${stream2}\nendstream\nendobj\n`;

      const xrefOffset = pdf.length;
      pdf += 'xref\n0 7\n0000000000 65535 f \n';
      for (const off of offsets) {
        pdf += String(off).padStart(10, '0') + ' 00000 n \n';
      }
      pdf += `trailer\n<</Size 7/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

      const pdfBlob = new Blob([pdf], { type: 'application/pdf' });
      const pdfFile = new BrowserFile([pdfBlob], 'project_titan_spec_multipage.pdf', { type: 'application/pdf' });

      // 2. Create a sample Markdown research overview
      const mdBlob = new Blob([
        `# Project Titan: Quantum Neural Architecture Overview\n\n` +
        `## Executive Summary\n` +
        `Project Titan is an advanced hybrid computing framework developed by Apex Systems in Q3 2024. ` +
        `It combines superconducting transmon qubits with edge tensor processing units (TPUs) to deliver 4.8x faster inference ` +
        `on large-scale generative models while decreasing overall power draw by 34%.\n\n` +
        `## Technical Benchmarks\n` +
        `- **Model Scale**: 70 Billion parameters distributed across 8 cryogenic nodes.\n` +
        `- **Thermal Envelope**: Operates under 15 millikelvin with helium dilution refrigeration.\n` +
        `- **Fidelity**: Two-qubit gate fidelity measures 99.82%, exceeding baseline targets.\n` +
        `- **Deployment Readiness**: Alpha enterprise pilot scheduled for October 2025.\n\n` +
        `## Security and Governance\n` +
        `All state vectors are encrypted in transit via post-quantum lattice cryptography (Kyber-1024) ` +
        `and zero-knowledge proof verification at every node boundary.`
      ], { type: 'text/markdown' });
      const mdFile = new BrowserFile([mdBlob], 'quantum_research_titan.md', { type: 'text/markdown' });

      // 3. Create a sample CSV with department metrics
      const csvBlob = new Blob([
        `Department,Quarter,BudgetAllocated_USD,Spend_USD,Headcount,KeyDeliverable,Status\n` +
        `AI Research,Q1,1200000,1140000,18,LangGraph Architecture Pilot,Completed\n` +
        `Engineering,Q1,2500000,2480000,42,ChromaDB Migration,Completed\n` +
        `Security,Q1,650000,610000,8,Kyber-1024 Post-Quantum Audit,Passed\n` +
        `Product,Q1,450000,420000,12,Agentic RAG Assistant MVP,Delivered\n` +
        `AI Research,Q2,1400000,1350000,22,Gemini 2.5 Grounding Pipeline,Completed\n` +
        `Engineering,Q2,2700000,2650000,46,Distributed Vector Ingestion,Active\n` +
        `Security,Q2,700000,690000,9,Multi-tenant User Isolation,Passed\n`
      ], { type: 'text/csv' });
      const csvFile = new BrowserFile([csvBlob], 'q1_q2_department_budgets.csv', { type: 'text/csv' });

      // 4. Create a sample JSON config file
      const jsonBlob = new Blob([
        JSON.stringify({
          cluster_name: "Apex-Titan-Alpha",
          environment: "production-hybrid",
          routing_rules: {
            primary_llm: "gemini-2.5-flash",
            fallback_llm: "gemini-3.8-flash",
            embedding_model: "text-embedding-004",
            vector_db: "ChromaDB Persistent",
            similarity_metric: "cosine",
            chunk_size: 800,
            chunk_overlap: 150,
            max_retries: 2
          },
          supported_document_types: [
            "PDF", "DOCX", "DOC", "TXT", "MARKDOWN", "RTF", "CSV", "EXCEL", "JSON", "XML", "YAML", "CODE"
          ],
          compliance: {
            gdpr: true,
            hipaa: false,
            soc2_type2: true,
            tenant_isolation: "enforced_user_id_where_filter"
          }
        }, null, 2)
      ], { type: 'application/json' });
      const jsonFile = new BrowserFile([jsonBlob], 'system_cluster_config.json', { type: 'application/json' });

      await uploadFiles([pdfFile, mdFile, csvFile, jsonFile]);
    } catch (err: any) {
      setErrorMessage(`Sample creation failed: ${err.message}`);
    } finally {
      setIsCreatingSample(false);
    }
  };

  const getFormatIcon = (fileType: string) => {
    switch (fileType.toUpperCase()) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-rose-400" />;
      case 'CSV':
      case 'EXCEL':
      case 'XLSX':
      case 'XLS':
      case 'TSV':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'JSON':
      case 'JSONL':
      case 'XML':
      case 'YAML':
      case 'YML':
        return <FileJson className="w-5 h-5 text-orange-400" />;
      case 'MD':
      case 'MARKDOWN':
      case 'PY':
      case 'TS':
      case 'JS':
      case 'HTML':
        return <FileCode className="w-5 h-5 text-amber-400" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredDocs = documents.filter((d) =>
    d.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.file_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChunks = docChunks.filter(
    (c) =>
      c.content.toLowerCase().includes(chunkFilterTerm.toLowerCase()) ||
      (c.metadata.section && c.metadata.section.toLowerCase().includes(chunkFilterTerm.toLowerCase())) ||
      (c.metadata.page && `page ${c.metadata.page}`.includes(chunkFilterTerm.toLowerCase())) ||
      (c.metadata.row_range && c.metadata.row_range.toLowerCase().includes(chunkFilterTerm.toLowerCase()))
  );

  return (
    <div id="document-manager-container" className="space-y-6">
      {/* Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-teal-400" />
              Document Ingestion & Knowledge Base
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload documents in <strong>PDF</strong>, Word, Excel, CSV, JSON, Markdown, Code, or any text document.
              PDFs are page-parsed and chunked with page-number metadata and overlap for precision RAG.
            </p>
          </div>

          <button
            id="load-sample-docs-btn"
            onClick={handleCreateSampleDocuments}
            disabled={isCreatingSample || isUploading}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-teal-500/20 to-emerald-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 transition-all flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            {isCreatingSample ? 'Generating & Indexing...' : 'Load Sample Documents (PDF, MD, CSV, JSON)'}
          </button>
        </div>

        {/* Drag & Drop Zone */}
        <div
          id="dropzone-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-teal-400 bg-teal-500/10 scale-[0.99]'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*,.pdf,.doc,.docx,.txt,.md,.markdown,.rtf,.csv,.xls,.xlsx,.json,.jsonl,.xml,.html,.htm,.yaml,.yml,.toml,.ini,.env,.log,.sql,.py,.js,.ts,.tsx,.jsx,.sh"
            onChange={handleFileInputChange}
            className="hidden"
            id="hidden-file-input"
          />

          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shadow-inner">
              {isUploading ? (
                <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                {isUploading ? 'Ingesting, chunking, and embedding files...' : 'Drag & drop any document here, or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports PDF, Word, Excel, CSV, JSON, Markdown, Code, & all text documents • Multi-file upload supported
              </p>
            </div>

            {/* Supported format chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 max-w-2xl">
              {SUPPORTED_EXTS.map((item) => (
                <span
                  key={item.ext}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border ${item.color}`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Feedback / Alerts */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {uploadFeedback && (
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Upload & Chunking Results</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {uploadFeedback.map((res, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    res.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {res.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-medium truncate">{res.filename}</span>
                  </div>
                  <span className="text-[11px] font-mono shrink-0">
                    {res.status === 'COMPLETED' ? `${res.chunk_count} chunks embedded` : res.error_message || 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Document Library Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Header & Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-white">Indexed Documents</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {documents.length} Total
            </span>
            {selectedDocIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {selectedDocIds.length} Active in Search
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                id="doc-search-input"
                type="text"
                placeholder="Filter documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 w-44"
              />
            </div>

            {/* Selection Toggles */}
            <button
              id="select-all-docs-btn"
              onClick={onSelectAllDocs}
              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Select All
            </button>
            <button
              id="clear-all-docs-btn"
              onClick={onClearDocSelection}
              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Clear
            </button>
            <button
              id="refresh-docs-btn"
              onClick={() => onRefreshDocs()}
              title="Refresh list"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table Body */}
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-300">No documents indexed yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload PDF or other documents above or click "Load Sample Documents" to populate the knowledge base with instant test data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-800/30 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Chunks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        isSelected ? 'bg-teal-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleDocSelection(doc.id)}
                          className="w-4 h-4 rounded border-slate-700 text-teal-500 focus:ring-teal-500/30 bg-slate-800 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-200">
                        <div className="flex items-center gap-2.5">
                          {getFormatIcon(doc.file_type)}
                          <div>
                            <p className="truncate max-w-xs sm:max-w-md font-medium text-slate-200" title={doc.original_filename}>
                              {doc.original_filename}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Hash: {doc.file_hash.substring(0, 10)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {doc.file_type}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {formatFileSize(doc.file_size)}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenChunkInspector(doc)}
                          title="Click to view all chunks and page metadata"
                          className="flex items-center gap-1.5 font-mono text-teal-400 hover:text-teal-300 hover:underline cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>{doc.chunk_count} chunks</span>
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        {doc.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Indexed
                          </span>
                        ) : doc.status === 'PROCESSING' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Processing
                          </span>
                        ) : (
                          <span
                            title={doc.error_message || 'Indexing failed'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 cursor-help"
                          >
                            <AlertCircle className="w-3 h-3" /> Error
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(doc.upload_time).toLocaleDateString()} {new Date(doc.upload_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`inspect-doc-${doc.id}-btn`}
                            onClick={() => handleOpenChunkInspector(doc)}
                            title="Inspect parsed chunks and page numbers"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`delete-doc-${doc.id}-btn`}
                            onClick={() => handleDelete(doc.id, doc.original_filename)}
                            title="Delete document and vector embeddings"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chunk Inspector Modal */}
      {inspectingDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>Parsed Chunks Inspector</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                      {inspectingDoc.file_type}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-md" title={inspectingDoc.original_filename}>
                    {inspectingDoc.original_filename} ({inspectingDoc.chunk_count} total chunks)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search chunk text, page, section..."
                  value={chunkFilterTerm}
                  onChange={(e) => setChunkFilterTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Showing {filteredChunks.length} of {docChunks.length} chunks
              </div>
            </div>

            {/* Modal Body: Chunk List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingChunks ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
                  <p className="text-xs">Loading document vector chunks...</p>
                </div>
              ) : filteredChunks.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm font-medium">No chunks match your filter</p>
                </div>
              ) : (
                filteredChunks.map((chunk) => {
                  const isCopied = copiedChunkId === chunk.id;
                  return (
                    <div
                      key={chunk.id}
                      className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/70 hover:border-slate-600 transition-all space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            Chunk #{chunk.chunk_index + 1}
                          </span>

                          {chunk.metadata.page && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Page {chunk.metadata.page}
                            </span>
                          )}

                          {chunk.metadata.sheet && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                              <FileSpreadsheet className="w-3 h-3" /> Sheet: {chunk.metadata.sheet}
                            </span>
                          )}

                          {chunk.metadata.row_range && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 bg-slate-800 border border-slate-700">
                              {chunk.metadata.row_range}
                            </span>
                          )}

                          {chunk.metadata.section && (
                            <span className="px-2 py-0.5 rounded text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20">
                              {chunk.metadata.section}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {chunk.content.length} chars
                          </span>
                          <button
                            onClick={() => copyChunkText(chunk.id, chunk.content)}
                            title="Copy chunk text"
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto selection:bg-teal-500/30">
                        {chunk.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
              <span>Each chunk is embedded with Google Gemini text-embedding-004 and indexed for agentic retrieval.</span>
              <button
                onClick={() => setInspectingDoc(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
