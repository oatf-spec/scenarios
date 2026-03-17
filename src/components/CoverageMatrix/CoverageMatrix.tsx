import { useState, useEffect, useMemo } from 'react';

interface ScenarioIndex {
  id: string;
  name: string;
  protocols: string[];
  mappings: { framework: string; id: string; name: string }[];
}

const PROTOCOLS = ['MCP', 'A2A', 'AG-UI'] as const;

const FRAMEWORK_ORDER: { key: string; label: string }[] = [
  { key: 'atlas', label: 'MITRE ATLAS' },
  { key: 'owasp_agentic', label: 'OWASP Agentic' },
  { key: 'owasp_llm', label: 'OWASP LLM' },
  { key: 'owasp_mcp', label: 'OWASP MCP' },
  { key: 'mitre_attack', label: 'MITRE ATT&CK' },
];

const PROTOCOL_COLORS: Record<string, { base: string }> = {
  MCP: { base: '59,130,246' },
  A2A: { base: '34,197,94' },
  'AG-UI': { base: '168,85,247' },
};

const PROTOCOL_HEADER_COLORS: Record<string, string> = {
  MCP: '#3b82f6',
  A2A: '#22c55e',
  'AG-UI': '#a855f7',
};

function cellStyle(count: number, protocol: string): React.CSSProperties {
  if (count === 0) {
    return {
      background: '#10131a',
      color: '#5f6470',
      border: '1px solid transparent',
    };
  }
  const base = PROTOCOL_COLORS[protocol]?.base ?? '59,130,246';
  const level = count >= 3 ? 2 : 1;
  const bgAlpha = level === 1 ? 0.12 : 0.18;
  const borderAlpha = level === 1 ? 0.28 : 0.38;
  return {
    background: `rgba(${base},${bgAlpha})`,
    border: `1px solid rgba(${base},${borderAlpha})`,
    color: '#e4e4e7',
    transition: 'border-color 0.15s, background 0.15s',
  };
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

export default function CoverageMatrix() {
  const [scenarios, setScenarios] = useState<ScenarioIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch('/library/index.json')
      .then((r) => r.json())
      .then((data) => {
        setScenarios(data);
        setLoading(false);
      });
  }, []);

  const { groups, techniqueCount } = useMemo(() => {
    // Build counts: technique -> protocol -> count
    const counts = new Map<string, Map<string, number>>();
    const techniqueNames = new Map<string, string>();
    const techniqueFrameworks = new Map<string, string>();

    for (const scenario of scenarios) {
      for (const mapping of scenario.mappings) {
        const key = `${mapping.framework}::${mapping.id}`;
        techniqueNames.set(key, mapping.name);
        techniqueFrameworks.set(key, mapping.framework);

        if (!counts.has(key)) {
          counts.set(key, new Map());
        }
        const protocolCounts = counts.get(key)!;
        for (const protocol of scenario.protocols) {
          protocolCounts.set(protocol, (protocolCounts.get(protocol) ?? 0) + 1);
        }
      }
    }

    // Group by framework
    const grouped: {
      framework: string;
      label: string;
      techniques: { key: string; id: string; name: string; counts: Map<string, number> }[];
    }[] = [];

    for (const fw of FRAMEWORK_ORDER) {
      const techniques: typeof grouped[0]['techniques'] = [];
      for (const [key, protocolCounts] of counts) {
        if (techniqueFrameworks.get(key) === fw.key) {
          const id = key.split('::')[1];
          techniques.push({
            key,
            id,
            name: techniqueNames.get(key) ?? '',
            counts: protocolCounts,
          });
        }
      }
      if (techniques.length === 0) continue;
      techniques.sort((a, b) => a.id.localeCompare(b.id));
      grouped.push({ framework: fw.key, label: fw.label, techniques });
    }

    const totalTechniques = grouped.reduce((sum, g) => sum + g.techniques.length, 0);
    return { groups: grouped, techniqueCount: totalTechniques };
  }, [scenarios]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
        <div className="text-text-2 text-sm">Loading coverage data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
      <div className="mb-8">
        <h1 className="font-serif text-[26px] text-text font-semibold mb-1">Coverage matrix</h1>
        <p className="text-text-2 text-sm mb-2">
          Protocol coverage by mapped framework technique
        </p>
        <p className="text-text-2 text-xs">
          {scenarios.length} scenarios &middot; {techniqueCount} techniques represented
        </p>
      </div>

      <div className="overflow-x-auto">
        <table
          style={{ borderCollapse: 'separate', borderSpacing: '0 8px', width: '100%' }}
        >
          <thead>
            <tr>
              <th style={{ width: isMobile ? 100 : 180 }} />
              {PROTOCOLS.map((p) => (
                <th
                  key={p}
                  className="text-xs font-semibold pb-2"
                  style={{ color: PROTOCOL_HEADER_COLORS[p], minWidth: isMobile ? 70 : 110, textAlign: 'center' }}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.framework}>
              <tr>
                <td
                  colSpan={4}
                  className="text-[11px] font-semibold uppercase tracking-wider text-text-2 pt-4 pb-1 px-1"
                  style={{ letterSpacing: '0.08em' }}
                >
                  {group.label}
                </td>
              </tr>
              {group.techniques.map((tech) => (
                <tr key={tech.key}>
                  <td
                    className="pr-3"
                    style={{ width: isMobile ? 100 : 180, maxWidth: isMobile ? 100 : 180 }}
                  >
                    <a href={`/?mapping=${tech.id}`} className="font-mono text-xs text-text-2 hover:text-text transition-colors">
                      {tech.id}
                    </a>
                    <div className="text-[11px] text-text-2/60 truncate" title={tech.name} style={{ maxWidth: isMobile ? 90 : 170 }}>
                      {tech.name}
                    </div>
                  </td>
                  {PROTOCOLS.map((protocol) => {
                    const count = tech.counts.get(protocol) ?? 0;
                    const cellContent = (
                      <div
                        style={{
                          ...cellStyle(count, protocol),
                          height: isMobile ? 36 : 44,
                          borderRadius: 6,
                          minWidth: isMobile ? 70 : 110,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 500,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    );
                    return (
                      <td key={protocol} style={{ padding: '0 2px' }}>
                        {count > 0 ? (
                          <a
                            href={`/?protocol=${protocol}&mapping=${tech.id}`}
                            className="block cursor-pointer [&>div]:hover:brightness-150 [&>div]:hover:!border-white/25"
                            title={`View ${count} ${protocol} scenario${count !== 1 ? 's' : ''} for ${tech.name}`}
                          >
                            {cellContent}
                          </a>
                        ) : (
                          cellContent
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
