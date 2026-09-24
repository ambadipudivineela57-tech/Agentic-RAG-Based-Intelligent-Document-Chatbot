import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Cpu,
  Layers,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  RefreshCw,
  GitFork,
  ArrowRight,
  ShieldCheck,
  Zap,
  Code2,
  Copy,
  Check,
} from 'lucide-react';
import {
  backendApi,
  BackendStatus,
  ApiRouteInfo,
  PipelineInfo,
  ServerLogItem,
} from '../api/client';

export const BackendDashboard: React.FC = () => {
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [routes, setRoutes] = useState<ApiRouteInfo[]>([]);
  const [pipeline, setPipeline] = useState<PipelineInfo | null>(null);
  const [logs, setLogs] = useState<ServerLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active subtab
  const [activeTab, setActiveTab] = useState<'endpoints' | 'pipeline' | 'logs' | 'architecture'>('endpoints');

  // Interactive API tester state
  const [selectedRoute, setSelectedRoute] = useState<ApiRouteInfo | null>(null);
  const [requestPath, setRequestPath] = useState('');
  const [requestBodyText, setRequestBodyText] = useState('');
  const [testResult, setTestResult] = useState<{ status: number; duration: number; data: any } | null>(null);
  const [testing, setTesting] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  // Filter logs
  const [logFilter, setLogFilter] = useState<string>('ALL');

  const loadBackendData = async () => {
    setLoading(true);
    try {
      const [statusRes, routesRes, pipelineRes, logsRes] = await Promise.all([
        backendApi.getStatus(),
        backendApi.getRoutes(),
        backendApi.getPipeline(),
        backendApi.getLogs(),
      ]);
      setStatus(statusRes);
      setRoutes(routesRes);
      setPipeline(pipelineRes);
      setLogs(logsRes);

      if (routesRes.length > 0 && !selectedRoute) {
        const defaultRoute = routesRes.find((r) => r.path === '/api/health') || routesRes[0];
        setSelectedRoute(defaultRoute);
        setRequestPath(defaultRoute.path);
        setRequestBodyText(defaultRoute.sampleBody ? JSON.stringify(defaultRoute.sampleBody, null, 2) : '');
      }
    } catch (err) {
      console.error('Failed to load backend status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackendData();
    const interval = setInterval(async () => {
      try {
        const freshLogs = await backendApi.getLogs();
        setLogs(freshLogs);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectRoute = (route: ApiRouteInfo) => {
    setSelectedRoute(route);
    let resolvedPath = route.path;
    if (resolvedPath.includes(':name')) resolvedPath = resolvedPath.replace(':name', 'documents');
    if (resolvedPath.includes(':id')) resolvedPath = resolvedPath.replace(':id', 'doc_seed_rag_arch');
    setRequestPath(resolvedPath);
    setRequestBodyText(route.sampleBody ? JSON.stringify(route.sampleBody, null, 2) : '');
    setTestResult(null);
  };

  const handleRunTest = async () => {
    if (!selectedRoute) return;
    setTesting(true);
    setTestResult(null);

    let parsedBody = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(selectedRoute.method) && requestBodyText.trim()) {
      try {
        parsedBody = JSON.parse(requestBodyText);
      } catch {
        setTestResult({
          status: 400,
          duration: 0,
          data: { error: 'Invalid JSON formatted in request body' },
        });
        setTesting(false);
        return;
      }
    }

    try {
      const targetUrl = requestPath.trim() || selectedRoute.path;
      const res = await backendApi.runCustomRequest(selectedRoute.method, targetUrl, parsedBody);
      setTestResult(res);
      // Refresh logs
      const updatedLogs = await backendApi.getLogs();
      setLogs(updatedLogs);
    } catch (err: any) {
      setTestResult({
        status: 500,
        duration: 0,
        data: { error: err.message || 'Network request failed' },
      });
    } finally {
      setTesting(false);
    }
  };

  const copyResponse = () => {
    if (!testResult) return;
    navigator.clipboard.writeText(JSON.stringify(testResult.data, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'ALL') return true;
    return log.type === logFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / System Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Backend Service Tier</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Service Healthy
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Node.js Express + TSX Engine with LangGraph RAG Agent & Gemini 2.5 Flash
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadBackendData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Runtime Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span>Server Port & Host</span>
            </div>
            <div className="text-sm font-semibold text-white font-mono">
              0.0.0.0:{status?.port || 3000}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Dual-stack IPv4/v6</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Gemini LLM Engine</span>
            </div>
            <div className="text-sm font-semibold text-amber-300 truncate">
              {status?.geminiConfigured ? 'gemini-2.5-flash' : 'Direct Grounding Mode'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {status?.geminiConfigured ? 'API Key Active' : 'Fallback Resilient'}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Embedding Vectorizer</span>
            </div>
            <div className="text-sm font-semibold text-indigo-300">
              text-embedding-004
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">768-D Float32 Cosine</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Runtime & Uptime</span>
            </div>
            <div className="text-sm font-semibold text-cyan-300 font-mono">
              {status?.nodeVersion || 'v22.x'} ({Math.floor((status?.uptimeSeconds || 0) / 60)}m uptime)
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Linux Container</div>
          </div>
        </div>
      </div>

      {/* Backend Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'endpoints'
              ? 'bg-teal-500 text-slate-950 font-semibold shadow-lg shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>API Gateway & Interactive Tester ({routes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'pipeline'
              ? 'bg-teal-500 text-slate-950 font-semibold shadow-lg shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <GitFork className="w-4 h-4" />
          <span>LangGraph Agentic Pipeline</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'bg-teal-500 text-slate-950 font-semibold shadow-lg shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Server Request Logs ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'architecture'
              ? 'bg-teal-500 text-slate-950 font-semibold shadow-lg shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Architecture Specs</span>
        </button>
      </div>

      {/* Tab 1: API Gateway & Interactive Tester */}
      {activeTab === 'endpoints' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Endpoint Directory */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold text-white">Registered API Endpoints</h3>
              <span className="text-xs text-slate-500 font-mono">REST / JSON</span>
            </div>

            <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
              {routes.map((route, i) => {
                const isSelected = selectedRoute?.path === route.path && selectedRoute?.method === route.method;
                const methodColor =
                  route.method === 'GET'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    : route.method === 'POST'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30';

                return (
                  <button
                    key={i}
                    onClick={() => handleSelectRoute(route)}
                    className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-500/40 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${methodColor}`}>
                        {route.method}
                      </span>
                      <span className="text-xs font-mono text-slate-200 truncate">{route.path}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {route.auth && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                          JWT
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                        {route.tag}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Interactive Request / Response Panel */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            {selectedRoute ? (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-bold font-mono border ${
                          selectedRoute.method === 'GET'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : selectedRoute.method === 'POST'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {selectedRoute.method}
                      </span>
                      <input
                        type="text"
                        value={requestPath}
                        onChange={(e) => setRequestPath(e.target.value)}
                        className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500 w-64 sm:w-80"
                        title="Endpoint Path (editable)"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{selectedRoute.desc}</p>
                  </div>

                  <button
                    onClick={handleRunTest}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{testing ? 'Sending...' : 'Send Request'}</span>
                  </button>
                </div>

                {/* Request Payload (if POST/PUT) */}
                {['POST', 'PUT', 'PATCH'].includes(selectedRoute.method) && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Request Body (JSON)
                    </label>
                    <textarea
                      rows={5}
                      value={requestBodyText}
                      onChange={(e) => setRequestBodyText(e.target.value)}
                      placeholder="{ ... }"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500/50 resize-y"
                    />
                  </div>
                )}

                {/* Response Visualizer */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">Live Server Response</span>
                      {testResult && (
                        <>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              testResult.status >= 200 && testResult.status < 300
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            HTTP {testResult.status}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {testResult.duration}ms
                          </span>
                        </>
                      )}
                    </div>

                    {testResult && (
                      <button
                        onClick={copyResponse}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedResponse ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 max-h-[300px] overflow-auto">
                    {testResult ? (
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    ) : (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        Click <span className="text-teal-400 font-semibold">"Send Request"</span> to test this endpoint live against the backend engine.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-slate-500 text-sm">
                Select an endpoint from the left directory to test.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: LangGraph Agentic Pipeline */}
      {activeTab === 'pipeline' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">{pipeline?.name}</h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Self-Reflective Architecture
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{pipeline?.architecture}</p>
          </div>

          {/* Graph Nodes Visual Flow */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {pipeline?.nodes.map((node, i) => {
              const nodeColors: Record<string, string> = {
                input: 'border-sky-500/40 bg-sky-950/20 text-sky-400',
                retriever: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-400',
                evaluator: 'border-amber-500/40 bg-amber-950/20 text-amber-400',
                generator: 'border-teal-500/40 bg-teal-950/20 text-teal-400',
                verifier: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400',
              };

              return (
                <div
                  key={node.id}
                  className={`border rounded-2xl p-4 flex flex-col justify-between relative shadow-lg ${
                    nodeColors[node.type] || 'border-slate-700 bg-slate-800'
                  }`}
                >
                  {i < (pipeline.nodes.length - 1) && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-500">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700/50 inline-block mb-2">
                      Node {i + 1}
                    </span>
                    <h4 className="text-xs font-bold text-white mb-1.5">{node.title}</h4>
                    <p className="text-[11px] text-slate-300 leading-snug">{node.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
                    <div className="text-slate-400 font-medium">Output:</div>
                    <div className="text-slate-200 font-mono text-[10px] mt-0.5">{node.output}</div>
                    {node.fallbackCondition && (
                      <div className="mt-2 text-[10px] text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-500/20">
                        {node.fallbackCondition}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Agentic RAG Control Loops & Self-Correction
            </h4>
            <p>
              1. <strong>Deterministic Routing:</strong> When question keywords match document chunks with high cosine similarity (≥0.65), synthesis begins immediately.
            </p>
            <p>
              2. <strong>Autonomous Query Rewriting:</strong> If retrieved chunks yield poor semantic alignment, the LangGraph supervisor invokes <code className="text-teal-300 font-mono">GeminiService.rewriteQuery()</code> using conversational memory to resolve ambiguity.
            </p>
            <p>
              3. <strong>Anti-Hallucination Guardrails:</strong> The synthesis engine is strictly bounded by retrieved passage tokens. Any unverified factual claim is flagged and replaced with explicit citation metadata cards.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Server Request Logs */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Live Execution Traces</h3>
              <p className="text-xs text-slate-400">In-memory telemetry circular buffer (auto-polling every 5s)</p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {['ALL', 'HTTP', 'RAG_PIPELINE', 'VECTOR_SEARCH', 'DB_OPERATION'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    logFilter === filter
                      ? 'bg-teal-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 max-h-[500px] overflow-y-auto font-mono text-xs">
            {filteredLogs.length > 0 ? (
              <div className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => {
                  const isOk = log.statusCode >= 200 && log.statusCode < 400;
                  return (
                    <div key={log.id} className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/50 transition">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                        <span className="text-slate-400 font-semibold">{log.method}</span>
                        <span className="text-teal-300 truncate">{log.path}</span>
                        {log.details && (
                          <span className="text-slate-500 truncate max-w-xs text-[11px]">
                            ({log.details})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-500 text-[11px] shrink-0">
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px]">
                          {log.type}
                        </span>
                        <span>{log.durationMs}ms</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">No logs found for selected filter.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Architecture Specs */}
      {activeTab === 'architecture' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Full-Stack RAG Architecture</h3>
                <p className="text-xs text-slate-400">Hybrid Node.js TSX + FastAPI Core</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                The application operates a unified dual-engine architecture:
              </p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="font-semibold text-teal-300">1. Node.js TSX Express Gateway (Port 3000):</div>
                <p className="text-slate-400">
                  Hosts the high-performance Vite SPA frontend, authenticates user JWT sessions with bcrypt, chunks multi-format documents (PDF, DOCX, XLSX, TXT), generates Gemini embeddings, and executes LangGraph agent workflows with cosine similarity scoring.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="font-semibold text-indigo-300">2. Python FastAPI Alternative (/backend):</div>
                <p className="text-slate-400">
                  Contains the alternative Python microservice implementation with SQLAlchemy, native ChromaDB, LangChain, and LangGraph for high-scale enterprise deployment.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Security & Environment</h3>
                <p className="text-xs text-slate-400">Zero-leak credential protection</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span>GEMINI_API_KEY</span>
                <span className="font-mono text-teal-400 font-semibold">
                  {status?.geminiConfigured ? 'Configured (Active)' : 'Not Set (Using Resilient Grounding)'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span>JWT Authentication</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  Active (HS256 7-Day Sessions)
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span>Data Isolation</span>
                <span className="font-mono text-indigo-400 font-semibold">
                  Tenant user_id Partitioning
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span>CORS Policy</span>
                <span className="font-mono text-slate-400 font-semibold">
                  Standard Origin Allow
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
