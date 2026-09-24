import React, { useState, useEffect } from 'react';
import {
  Database,
  Layers,
  Search,
  RefreshCw,
  Download,
  Sparkles,
  FileText,
  MessageSquare,
  Users,
  HardDrive,
  CheckCircle2,
  ExternalLink,
  Code,
  X,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  databaseApi,
  DatabaseStats,
  VectorSearchResult,
  default as api,
} from '../api/client';

export const DatabaseDashboard: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [activeTab, setActiveTab] = useState<'tables' | 'vectors' | 'overview'>('tables');
  const [loading, setLoading] = useState(true);

  // Table state
  const [selectedTable, setSelectedTable] = useState<'users' | 'documents' | 'chunks' | 'conversations' | 'messages'>('documents');
  const [tableData, setTableData] = useState<{ total: number; rows: any[] }>({ total: 0, rows: [] });
  const [tableSearch, setTableSearch] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [inspectRow, setInspectRow] = useState<any | null>(null);
  const [copiedInspect, setCopiedInspect] = useState(false);

  // Vector Search Playground state
  const [vectorQuery, setVectorQuery] = useState('Enterprise AI and vector retrieval latency');
  const [vectorTopK, setVectorTopK] = useState(5);
  const [vectorResults, setVectorResults] = useState<VectorSearchResult | null>(null);
  const [vectorSearching, setVectorSearching] = useState(false);

  // Seeding state
  const [seeding, setSeeding] = useState(false);
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const data = await databaseApi.getOverview();
      setStats(data);
    } catch (err) {
      console.error('Failed to load DB stats:', err);
    }
  };

  const fetchTableRows = async (table: string, search = '') => {
    setTableLoading(true);
    try {
      const res = await databaseApi.getTableRows(table, search, 50, 0);
      setTableData(res);
    } catch (err) {
      console.error('Failed to load table rows:', err);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchTableRows(selectedTable, tableSearch)]).finally(() =>
      setLoading(false)
    );
  }, []);

  const handleSelectTable = (table: 'users' | 'documents' | 'chunks' | 'conversations' | 'messages') => {
    setSelectedTable(table);
    setTableSearch('');
    fetchTableRows(table, '');
  };

  const handleTableSearchChange = (val: string) => {
    setTableSearch(val);
    fetchTableRows(selectedTable, val);
  };

  const handleRunVectorSearch = async () => {
    if (!vectorQuery.trim()) return;
    setVectorSearching(true);
    try {
      const res = await databaseApi.testVectorSearch(vectorQuery.trim(), vectorTopK);
      setVectorResults(res);
    } catch (err) {
      console.error('Vector search failed:', err);
    } finally {
      setVectorSearching(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    setSeedSuccessMessage(null);
    try {
      const res = await databaseApi.seedSampleKnowledge();
      setSeedSuccessMessage(res.message);
      await fetchStats();
      await fetchTableRows(selectedTable, tableSearch);
      setTimeout(() => setSeedSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to seed data:', err);
    } finally {
      setSeeding(false);
    }
  };

  const handleExportDB = async () => {
    try {
      const res = await api.get('/database/export', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rag_database_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export DB:', err);
    }
  };

  const copyRowJson = () => {
    if (!inspectRow) return;
    navigator.clipboard.writeText(JSON.stringify(inspectRow, null, 2));
    setCopiedInspect(true);
    setTimeout(() => setCopiedInspect(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Database & Vector Store Tier</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  ChromaDB & SQLite Online
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Relational Tables + 768-D Float32 Cosine Similarity Vector Index
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-teal-500/20 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Seeding Knowledge...' : 'Seed Demo Knowledge'}</span>
            </button>

            <button
              onClick={handleExportDB}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Download entire database as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={() => {
                fetchStats();
                fetchTableRows(selectedTable, tableSearch);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Refresh database"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Seed Success Alert */}
        {seedSuccessMessage && (
          <div className="mt-4 p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-xs text-teal-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{seedSuccessMessage}</span>
          </div>
        )}

        {/* Database Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mt-5">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              <span>Documents</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {stats?.documentsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Parsed files</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Vector Chunks</span>
            </div>
            <div className="text-xl font-bold text-indigo-300 font-mono">
              {stats?.chunksCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{stats?.vectorDimensions ?? 768}-D vectors</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Conversations</span>
            </div>
            <div className="text-xl font-bold text-cyan-300 font-mono">
              {stats?.conversationsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{stats?.messagesCount ?? 0} total messages</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Users</span>
            </div>
            <div className="text-xl font-bold text-amber-300 font-mono">
              {stats?.usersCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Authenticated</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Storage Size</span>
            </div>
            <div className="text-xl font-bold text-emerald-300 font-mono">
              {stats ? `${(stats.storageSizeBytes / 1024).toFixed(1)} KB` : '0 KB'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Persistent disk store</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('tables')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'tables'
              ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Relational Tables Browser</span>
        </button>

        <button
          onClick={() => setActiveTab('vectors')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'vectors'
              ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>ChromaDB Vector Store & Cosine Similarity Inspector</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Schema & Storage Architecture</span>
        </button>
      </div>

      {/* TAB 1: Relational Tables Browser */}
      {activeTab === 'tables' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          {/* Table Selector Pills & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              {(['documents', 'chunks', 'conversations', 'messages', 'users'] as const).map((tbl) => (
                <button
                  key={tbl}
                  onClick={() => handleSelectTable(tbl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    selectedTable === tbl
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tbl}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${selectedTable}...`}
                value={tableSearch}
                onChange={(e) => handleTableSearchChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          {/* Table View */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400 tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    {selectedTable === 'documents' && (
                      <>
                        <th className="py-2.5 px-3">Filename</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Chunks</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Upload Time</th>
                      </>
                    )}
                    {selectedTable === 'chunks' && (
                      <>
                        <th className="py-2.5 px-3">Chunk Index</th>
                        <th className="py-2.5 px-3">Content Excerpt</th>
                        <th className="py-2.5 px-3">Embedding Dim</th>
                        <th className="py-2.5 px-3">Document Source</th>
                      </>
                    )}
                    {selectedTable === 'conversations' && (
                      <>
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">User ID</th>
                        <th className="py-2.5 px-3">Updated At</th>
                      </>
                    )}
                    {selectedTable === 'messages' && (
                      <>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Content Excerpt</th>
                        <th className="py-2.5 px-3">Sources</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </>
                    )}
                    {selectedTable === 'users' && (
                      <>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Password Hash</th>
                        <th className="py-2.5 px-3">Created</th>
                      </>
                    )}
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {tableLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                        Loading {selectedTable}...
                      </td>
                    </tr>
                  ) : tableData.rows.length > 0 ? (
                    tableData.rows.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>

                        {selectedTable === 'documents' && (
                          <>
                            <td className="py-2 px-3 font-semibold text-white truncate max-w-xs">
                              {row.original_filename}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-teal-300 font-mono">
                                {row.file_type}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-indigo-300">{row.chunk_count}</td>
                            <td className="py-2 px-3 text-slate-400">
                              {(row.file_size / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                              {new Date(row.upload_time).toLocaleDateString()}
                            </td>
                          </>
                        )}

                        {selectedTable === 'chunks' && (
                          <>
                            <td className="py-2 px-3 font-mono text-indigo-300">
                              #{row.chunk_index}
                            </td>
                            <td className="py-2 px-3 text-slate-300 truncate max-w-md">
                              {row.content}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                                {row.embedding_dimension || 128}-D
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-400 truncate max-w-xs">
                              {row.metadata?.filename || row.document_id}
                            </td>
                          </>
                        )}

                        {selectedTable === 'conversations' && (
                          <>
                            <td className="py-2 px-3 font-mono text-slate-400 text-[11px] truncate max-w-[120px]">
                              {row.id}
                            </td>
                            <td className="py-2 px-3 font-semibold text-white truncate max-w-xs">
                              {row.title}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px] truncate max-w-[100px]">
                              {row.user_id}
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                              {new Date(row.updated_at).toLocaleString()}
                            </td>
                          </>
                        )}

                        {selectedTable === 'messages' && (
                          <>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  row.role === 'user'
                                    ? 'bg-sky-500/10 text-sky-400'
                                    : 'bg-teal-500/10 text-teal-400'
                                }`}
                              >
                                {row.role}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-300 truncate max-w-md">
                              {row.content}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {row.sources ? 'Cited Sources' : '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                              {new Date(row.created_at).toLocaleTimeString()}
                            </td>
                          </>
                        )}

                        {selectedTable === 'users' && (
                          <>
                            <td className="py-2 px-3 font-semibold text-white">{row.name}</td>
                            <td className="py-2 px-3 font-mono text-teal-300">{row.email}</td>
                            <td className="py-2 px-3 font-mono text-slate-500 text-[10px]">
                              {row.password_hash}
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                              {new Date(row.created_at).toLocaleDateString()}
                            </td>
                          </>
                        )}

                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => setInspectRow(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] transition font-medium"
                          >
                            <Code className="w-3 h-3" />
                            <span>JSON</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No records found in table "{selectedTable}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Showing {tableData.rows.length} of {tableData.total} records</span>
              <span className="font-mono text-slate-500">Format: JSON Document Store</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Vector Store & Cosine Similarity Inspector */}
      {activeTab === 'vectors' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">ChromaDB Vector Distance & Similarity Tester</h3>
                <p className="text-xs text-slate-400">
                  Embed any query string and test live cosine similarity matching against candidate document chunks
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Top-K:</span>
                <select
                  value={vectorTopK}
                  onChange={(e) => setVectorTopK(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none"
                >
                  <option value={3}>Top 3</option>
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                </select>
              </div>
            </div>

            {/* Query Input Box */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter query to vectorize (e.g., quarterly revenue figures, latency targets, compliance)..."
                value={vectorQuery}
                onChange={(e) => setVectorQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunVectorSearch()}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={handleRunVectorSearch}
                disabled={vectorSearching}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                {vectorSearching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>{vectorSearching ? 'Calculating Vectors...' : 'Run Vector Search'}</span>
              </button>
            </div>

            {/* Results Preview */}
            {vectorResults && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    Scanned <strong>{vectorResults.total_chunks_scanned} chunks</strong> across index in{' '}
                    <strong className="text-teal-400 font-mono">{vectorResults.latency_ms}ms</strong>
                  </span>
                  <span className="font-mono text-[11px] text-indigo-300">
                    Vector Embedding Dimension: {vectorResults.vector_dimension}-D
                  </span>
                </div>

                <div className="space-y-3">
                  {vectorResults.results.map((item, idx) => {
                    const pct = Math.round(item.similarity * 100);
                    const isHigh = item.similarity >= 0.7;

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2 hover:border-indigo-500/40 transition"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-300">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {item.metadata?.filename || 'Document'}
                            </span>
                            {item.metadata?.page && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                Page {item.metadata.page}
                              </span>
                            )}
                            {item.metadata?.sheet && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                Sheet: {item.metadata.sheet}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  isHigh ? 'bg-emerald-400' : 'bg-indigo-400'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-mono font-bold ${
                                isHigh ? 'text-emerald-400' : 'text-indigo-400'
                              }`}
                            >
                              {(item.similarity).toFixed(3)} ({pct}%)
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 font-sans leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
                          {item.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Schema & Storage Architecture */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              Relational Storage Schema
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-semibold text-teal-300">users Table</span>
                <p className="text-slate-400 font-mono text-[11px]">
                  id (PK, string), name (string), email (unique string), hashed_password (bcrypt), created_at (iso)
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-semibold text-sky-300">documents Table</span>
                <p className="text-slate-400 font-mono text-[11px]">
                  id (PK, string), user_id (FK), original_filename, file_type (PDF|DOCX|XLSX|TXT), file_size, chunk_count, status
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-semibold text-indigo-300">document_chunks Table</span>
                <p className="text-slate-400 font-mono text-[11px]">
                  id (PK), document_id (FK), user_id (FK), chunk_index, content, embedding (768 float array), metadata (JSON)
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-semibold text-amber-300">conversations & messages Tables</span>
                <p className="text-slate-400 font-mono text-[11px]">
                  conversations: id, user_id, title, updated_at | messages: id, conversation_id, role, content, sources (JSON)
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              ChromaDB Vector Store Mechanics
            </h3>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong>Vector Dimension:</strong> 768 float32 dimensions generated by Google Gemini's <code className="text-teal-300 font-mono">text-embedding-004</code> / <code className="text-teal-300 font-mono">gemini-embedding-2-preview</code>.
              </p>
              <p>
                <strong>Metric Formula:</strong> Cosine similarity:
                <br />
                <code className="text-indigo-300 font-mono text-[11px] block bg-slate-950 p-2 rounded mt-1">
                  similarity = (A • B) / (||A|| * ||B||)
                </code>
              </p>
              <p>
                <strong>Multi-Tenant Isolation:</strong> Every chunk query automatically enforces an exact <code className="text-amber-300 font-mono">user_id</code> filter boundary, ensuring zero data bleed between research tenants.
              </p>
              <p>
                <strong>Hybrid Fallback:</strong> If live embedding rate-limits occur, the engine falls back gracefully to a 128-D normalized deterministic frequency vectorizer without throwing user-facing interruptions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Row Inspection Modal */}
      {inspectRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-400" />
                Raw Database Entity: {selectedTable}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyRowJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs transition"
                >
                  {copiedInspect ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInspect ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setInspectRow(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 max-h-[420px] overflow-auto">
              <pre className="text-xs font-mono text-indigo-300 whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(inspectRow, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
