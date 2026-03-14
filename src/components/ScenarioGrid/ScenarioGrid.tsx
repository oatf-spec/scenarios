import { useState, useEffect, useCallback } from 'react';

interface ScenarioEntry {
  id: string;
  name: string;
  description: string;
  severity_level: string;
  protocols: string[];
  interaction_models: string[];
  classification_category: string;
  impact: string[];
  has_indicators: boolean;
  phase_count: number;
  file: string;
}

const PROTOCOL_COLORS: Record<string, string> = {
  MCP: 'bg-mcp',
  A2A: 'bg-a2a',
  'AG-UI': 'bg-agui',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-sev-critical text-white',
  high: 'bg-sev-high text-white',
  medium: 'bg-sev-medium text-[#111]',
  low: 'bg-sev-low text-white',
  informational: 'bg-sev-info text-white',
};

const ALL_PROTOCOLS = ['MCP', 'A2A', 'AG-UI'] as const;

function getUrlParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function setUrlParams(params: URLSearchParams) {
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.replaceState({}, '', url.toString());
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ScenarioGrid() {
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [activeProtocols, setActiveProtocols] = useState<Set<string>>(() => {
    const params = getUrlParams();
    const p = params.get('protocol');
    return p ? new Set(p.split(',')) : new Set<string>();
  });

  const [severity, setSeverity] = useState<string>(() => {
    return getUrlParams().get('severity') ?? '';
  });

  const [category, setCategory] = useState<string>(() => {
    return getUrlParams().get('category') ?? '';
  });

  const [impact, setImpact] = useState<string>(() => {
    return getUrlParams().get('impact') ?? '';
  });

  useEffect(() => {
    fetch('/library/index.json')
      .then(r => r.json())
      .then((data: ScenarioEntry[]) => {
        setScenarios(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Sync filter state to URL
  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (activeProtocols.size > 0) params.set('protocol', [...activeProtocols].join(','));
    if (severity) params.set('severity', severity);
    if (category) params.set('category', category);
    if (impact) params.set('impact', impact);
    setUrlParams(params);
  }, [activeProtocols, severity, category, impact]);

  useEffect(() => { syncUrl(); }, [syncUrl]);

  // Derived: unique categories and impacts
  const categories = [...new Set(scenarios.map(s => s.classification_category))].sort();
  const impacts = [...new Set(scenarios.flatMap(s => s.impact))].sort();

  // Filter scenarios
  const filtered = scenarios.filter(s => {
    if (activeProtocols.size > 0 && !s.protocols.some(p => activeProtocols.has(p))) return false;
    if (severity && s.severity_level !== severity) return false;
    if (category && s.classification_category !== category) return false;
    if (impact && !s.impact.includes(impact)) return false;
    return true;
  });

  function toggleProtocol(proto: string) {
    setActiveProtocols(prev => {
      const next = new Set(prev);
      if (next.has(proto)) next.delete(proto);
      else next.add(proto);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-text-2 text-sm">
        Loading scenarios...
      </div>
    );
  }

  return (
    <>
      {/* Filter Bar */}
      <section
        className="w-full border-b border-border"
        style={{ background: '#11141c' }}
      >
        {/* Desktop filters */}
        <div className="hidden md:grid items-center gap-4 px-6 py-4"
             style={{ gridTemplateColumns: 'auto auto auto auto 1fr auto' }}>
          {/* Protocol chips */}
          <div className="flex items-center gap-2">
            {ALL_PROTOCOLS.map(proto => (
              <button
                key={proto}
                onClick={() => toggleProtocol(proto)}
                className={`inline-flex items-center justify-center h-7 px-2.5 rounded-[6px] text-xs font-semibold tracking-wide transition-colors cursor-pointer
                  ${activeProtocols.has(proto)
                    ? `${PROTOCOL_COLORS[proto]} text-white border border-transparent`
                    : 'bg-[#20232d] text-text-2 border border-border hover:border-border-hover'
                  }`}
              >
                {proto}
              </button>
            ))}
          </div>

          {/* Severity dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value)}
              className="h-8 rounded-[6px] border border-border bg-surface text-text text-[13px] px-2.5 min-w-[164px] cursor-pointer"
              style={{
                appearance: 'none',
                backgroundImage: `linear-gradient(45deg, transparent 50%, #a1a1aa 50%), linear-gradient(135deg, #a1a1aa 50%, transparent 50%)`,
                backgroundPosition: 'calc(100% - 16px) 13px, calc(100% - 11px) 13px',
                backgroundSize: '5px 5px, 5px 5px',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="informational">Informational</option>
            </select>
          </div>

          {/* Category dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="h-8 rounded-[6px] border border-border bg-surface text-text text-[13px] px-2.5 min-w-[164px] cursor-pointer"
              style={{
                appearance: 'none',
                backgroundImage: `linear-gradient(45deg, transparent 50%, #a1a1aa 50%), linear-gradient(135deg, #a1a1aa 50%, transparent 50%)`,
                backgroundPosition: 'calc(100% - 16px) 13px, calc(100% - 11px) 13px',
                backgroundSize: '5px 5px, 5px 5px',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <option value="">All categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{formatCategory(c)}</option>
              ))}
            </select>
          </div>

          {/* Impact dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={impact}
              onChange={e => setImpact(e.target.value)}
              className="h-8 rounded-[6px] border border-border bg-surface text-text text-[13px] px-2.5 min-w-[164px] cursor-pointer"
              style={{
                appearance: 'none',
                backgroundImage: `linear-gradient(45deg, transparent 50%, #a1a1aa 50%), linear-gradient(135deg, #a1a1aa 50%, transparent 50%)`,
                backgroundPosition: 'calc(100% - 16px) 13px, calc(100% - 11px) 13px',
                backgroundSize: '5px 5px, 5px 5px',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <option value="">All impacts</option>
              {impacts.map(i => (
                <option key={i} value={i}>{formatCategory(i)}</option>
              ))}
            </select>
          </div>

          {/* Result count */}
          <div className="justify-self-end text-[13px] text-text-2 whitespace-nowrap">
            {filtered.length !== scenarios.length
              ? `${filtered.length} of ${scenarios.length} scenarios`
              : `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Mobile filter row */}
        <div className="md:hidden flex items-center justify-between gap-2 px-4 py-3">
          <span className="text-[13px] text-text-2">
            {filtered.length !== scenarios.length
              ? `${filtered.length} of ${scenarios.length} scenarios`
              : `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''}`}
          </span>
          <MobileFilterButton
            activeProtocols={activeProtocols}
            toggleProtocol={toggleProtocol}
            severity={severity}
            setSeverity={setSeverity}
            category={category}
            setCategory={setCategory}
            categories={categories}
            impact={impact}
            setImpact={setImpact}
            impacts={impacts}
          />
        </div>
      </section>

      {/* Cards Grid */}
      <section className="p-5 md:px-6 md:pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(scenario => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-text-2 text-sm">
            No scenarios match the current filters.
          </div>
        )}
      </section>
    </>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioEntry }) {
  const sevStyle = SEVERITY_STYLES[scenario.severity_level] ?? SEVERITY_STYLES.informational;
  const descOneLine = scenario.description.replace(/\n/g, ' ');

  return (
    <a
      href={`/${scenario.id}/`}
      className="bg-surface border border-border rounded-[6px] p-4 min-h-[148px] flex flex-col gap-3 transition-colors hover:border-border-hover"
    >
      {/* Top: ID + severity */}
      <div className="flex items-center justify-between gap-2.5">
        <span className="font-mono text-xs text-text-2">{scenario.id}</span>
        <span className={`inline-flex items-center justify-center min-w-[58px] h-[22px] px-2 rounded-full text-[11px] font-bold tracking-wide uppercase ${sevStyle}`}>
          {scenario.severity_level}
        </span>
      </div>

      {/* Title */}
      <div className="font-serif text-base leading-tight text-text whitespace-nowrap overflow-hidden text-ellipsis">
        {scenario.name}
      </div>

      {/* Description */}
      <div className="text-[13px] text-text-2 whitespace-nowrap overflow-hidden text-ellipsis">
        {descOneLine}
      </div>

      {/* Bottom: protocols */}
      <div className="mt-auto flex gap-2 flex-wrap">
        {scenario.protocols.map(p => (
          <span
            key={p}
            className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold tracking-wide text-white ${PROTOCOL_COLORS[p] ?? 'bg-sev-info'}`}
          >
            {p}
          </span>
        ))}
      </div>
    </a>
  );
}

function MobileFilterButton({
  activeProtocols, toggleProtocol,
  severity, setSeverity,
  category, setCategory,
  categories,
  impact, setImpact,
  impacts,
}: {
  activeProtocols: Set<string>;
  toggleProtocol: (p: string) => void;
  severity: string;
  setSeverity: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  categories: string[];
  impact: string;
  setImpact: (v: string) => void;
  impacts: string[];
}) {
  const [open, setOpen] = useState(false);
  const activeCount = activeProtocols.size + (severity ? 1 : 0) + (category ? 1 : 0) + (impact ? 1 : 0);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 px-3 rounded-[6px] border border-border bg-surface text-text text-[13px] font-semibold cursor-pointer"
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 bg-surface border border-border rounded-[6px] p-4 flex flex-col gap-4 shadow-xl">
          <div>
            <div className="text-xs text-text-2 uppercase tracking-wider mb-2 font-semibold">Protocol</div>
            <div className="flex gap-2 flex-wrap">
              {ALL_PROTOCOLS.map(proto => (
                <button
                  key={proto}
                  onClick={() => toggleProtocol(proto)}
                  className={`h-7 px-2.5 rounded-[6px] text-xs font-semibold cursor-pointer
                    ${activeProtocols.has(proto)
                      ? `${PROTOCOL_COLORS[proto]} text-white border border-transparent`
                      : 'bg-[#20232d] text-text-2 border border-border'
                    }`}
                >
                  {proto}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-2 uppercase tracking-wider mb-2 font-semibold">Severity</div>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value)}
              className="w-full h-8 rounded-[6px] border border-border bg-[#20232d] text-text text-[13px] px-2"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-text-2 uppercase tracking-wider mb-2 font-semibold">Category</div>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full h-8 rounded-[6px] border border-border bg-[#20232d] text-text text-[13px] px-2"
            >
              <option value="">All</option>
              {categories.map(c => (
                <option key={c} value={c}>{formatCategory(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-text-2 uppercase tracking-wider mb-2 font-semibold">Impact</div>
            <select
              value={impact}
              onChange={e => setImpact(e.target.value)}
              className="w-full h-8 rounded-[6px] border border-border bg-[#20232d] text-text text-[13px] px-2"
            >
              <option value="">All</option>
              {impacts.map(i => (
                <option key={i} value={i}>{formatCategory(i)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="h-8 rounded-[6px] bg-accent text-white text-[13px] font-semibold cursor-pointer border-0"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
