import { useState, useEffect, useMemo, useRef } from 'react';
import yaml from 'js-yaml';
import { extractModel, type TimelineModel } from '../../lib/oatf-model';
import { generateSequence } from '../../lib/oatf-sequence';
import { highlightYaml } from '../../lib/yaml-highlight';
import ShareButton from '../ShareButton';
import TimelineView from '../Timeline/TimelineView';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-sev-critical text-white',
  high: 'bg-sev-high text-white',
  medium: 'bg-sev-medium text-[#111]',
  low: 'bg-sev-low text-white',
  informational: 'bg-sev-info text-white',
};

const PROTOCOL_BG: Record<string, string> = {
  MCP: 'bg-mcp',
  A2A: 'bg-a2a',
  'AG-UI': 'bg-agui',
};

const FRAMEWORK_LABELS: Record<string, string> = {
  atlas: 'MITRE ATLAS',
  mitre_attack: 'MITRE ATT&CK',
  owasp_llm: 'OWASP LLM',
  owasp_mcp: 'OWASP MCP',
};

const FRAMEWORK_URLS: Record<string, (id: string) => string> = {
  atlas: (id) => `https://atlas.mitre.org/techniques/${id}`,
  mitre_attack: (id) => `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`,
  owasp_llm: (id) => `https://genai.owasp.org/llmrisk/${id}/`,
  owasp_mcp: () => '#',
};

function protocolLabel(mode: string): string {
  if (mode.startsWith('mcp_')) return 'MCP';
  if (mode.startsWith('a2a_')) return 'A2A';
  if (mode.startsWith('ag_ui_')) return 'AG-UI';
  return mode.toUpperCase();
}

function interactionLabel(mode: string): string {
  if (mode === 'mcp_server' || mode === 'mcp_client') return 'agent-to-tool';
  if (mode.startsWith('a2a_')) return 'agent-to-agent';
  if (mode.startsWith('ag_ui_')) return 'user-to-agent';
  return 'unknown';
}

function getProtocols(doc: any): string[] {
  const exec = doc?.attack?.execution;
  if (!exec) return [];
  const protocols = new Set<string>();
  if (exec.actors) {
    for (const a of exec.actors) protocols.add(protocolLabel(a.mode));
  } else if (exec.mode) {
    protocols.add(protocolLabel(exec.mode));
  }
  return [...protocols];
}

function getInteraction(doc: any): string {
  const exec = doc?.attack?.execution;
  if (!exec) return '';
  if (exec.actors) {
    const models = new Set(exec.actors.map((a: any) => interactionLabel(a.mode)));
    return [...models].join(', ');
  }
  return interactionLabel(exec.mode);
}

interface Props {
  yamlText: string;
  scenarioId?: string;
  editorUrl?: string;
  shareTab?: 'editor' | 'detail';
}

export default function DetailView({ yamlText, scenarioId, editorUrl, shareTab }: Props) {
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [yamlExpanded, setYamlExpanded] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);

  const { doc, model } = useMemo(() => {
    try {
      const parsed = yaml.load(yamlText) as any;
      const m = extractModel(parsed, yamlText);
      return { doc: parsed, model: m };
    } catch {
      return { doc: null, model: null };
    }
  }, [yamlText]);

  // Lazy-load and render Mermaid
  const seqSource = model ? generateSequence(model) : '';

  useEffect(() => {
    if (!seqSource) return;

    let cancelled = false;
    import('mermaid').then(async (mermaid) => {
      if (cancelled) return;
      mermaid.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          darkMode: true,
          background: '#13151d',
          primaryColor: '#1a1d27',
          primaryBorderColor: '#2a2d37',
          primaryTextColor: '#e4e4e7',
          secondaryColor: '#1a1d27',
          lineColor: '#a1a1aa',
          noteBkgColor: '#1a1d27',
          noteTextColor: '#a1a1aa',
          noteBorderColor: '#2a2d37',
          actorBkg: '#1a1d27',
          actorBorder: '#3b82f6',
          actorTextColor: '#e4e4e7',
          actorLineColor: '#2a2d37',
        },
      });
      try {
        const { svg } = await mermaid.default.render(
          `mermaid-${scenarioId ?? 'view'}`,
          seqSource,
        );
        if (!cancelled) setMermaidSvg(svg);
      } catch {
        // Mermaid render error — skip
      }
    }).catch(() => {
      // Mermaid failed to load — skip diagram
    });

    return () => { cancelled = true; };
  }, [seqSource, scenarioId]);

  if (!doc?.attack) {
    return <div className="text-text-2 text-sm py-8">Unable to parse scenario YAML.</div>;
  }

  const attack = doc.attack;
  const sevStyle = SEVERITY_STYLES[attack.severity?.level] ?? SEVERITY_STYLES.informational;
  const protocols = getProtocols(doc);
  const interaction = getInteraction(doc);
  const mappings = attack.classification?.mappings ?? [];
  const indicators = attack.indicators ?? [];
  const yamlLines = yamlText.split('\n');
  const previewLines = yamlExpanded ? yamlLines : yamlLines.slice(0, 20);

  function handleDownload() {
    const blob = new Blob([yamlText], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${attack.id}.yaml`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  return (
    <div className="max-w-[calc(960px+96px)] w-full mx-auto px-6 md:px-12 py-8 pb-16 overflow-x-hidden">
      {/* Header */}
      <section className="flex flex-col gap-3 pb-6">
        <div className="font-mono text-sm text-text-2">{attack.id}</div>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-tight m-0">
          {attack.name}
        </h1>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center justify-center min-w-[58px] h-[22px] px-2 rounded-full text-[11px] font-bold tracking-wide uppercase ${sevStyle}`}
            >
              {attack.severity?.level}
            </span>
            {protocols.map((p) => (
              <span
                key={p}
                className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold tracking-wide text-white ${PROTOCOL_BG[p] ?? 'bg-sev-info'}`}
              >
                {p}
              </span>
            ))}
            <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold text-text bg-[#2a2d37] lowercase">
              {interaction}
            </span>
            {attack.status && (
              <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold text-text bg-[#2a2d37] lowercase">
                {attack.status}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="h-8 px-3 rounded-[6px] border border-border bg-transparent text-text text-[13px] font-semibold cursor-pointer"
            >
              Download
            </button>
            {shareTab && (
              <ShareButton
                yamlText={yamlText}
                tab={shareTab}
                className="h-8 px-3 rounded-[6px] border border-border bg-transparent text-text text-[13px] font-semibold cursor-pointer hover:border-border-hover"
              />
            )}
            {editorUrl && (
              <a
                href={editorUrl}
                className="h-8 px-3 rounded-[6px] border border-accent text-text text-[13px] font-semibold inline-flex items-center cursor-pointer"
              >
                Open in Editor
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="mt-12 flex flex-col gap-4">
        <div className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold">
          Description
        </div>
        <p className="text-[15px] text-text leading-relaxed max-w-[74ch] m-0">
          {attack.description?.trim().replace(/\n(?!\n)/g, ' ')}
        </p>
      </section>

      {/* Framework Mappings */}
      {mappings.length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <div className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold">
            Framework Mappings
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-text-2 font-semibold text-[13px] pb-3 pr-2">
                    Framework
                  </th>
                  <th className="text-left text-text-2 font-semibold text-[13px] pb-3 px-2">
                    Technique ID
                  </th>
                  <th className="text-left text-text-2 font-semibold text-[13px] pb-3 px-2">
                    Name
                  </th>
                  <th className="text-left text-text-2 font-semibold text-[13px] pb-3 pl-2">
                    Relationship
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m: any, i: number) => {
                  const urlFn = FRAMEWORK_URLS[m.framework];
                  const url = urlFn ? urlFn(m.id) : '#';
                  return (
                    <tr key={`${m.framework}-${m.id}`} className="border-t border-border">
                      <td className="py-3 pr-2 text-[13px]">
                        {FRAMEWORK_LABELS[m.framework] ?? m.framework}
                      </td>
                      <td className="py-3 px-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[13px] text-accent hover:underline"
                        >
                          {m.id}
                        </a>
                      </td>
                      <td className="py-3 px-2 text-[13px]">{m.name ?? '—'}</td>
                      <td className="py-3 pl-2 text-[13px] text-text-2">
                        {m.relationship ?? 'primary'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Attack Structure (Timeline) */}
      {model && model.actors.length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <div className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold">
            Attack Structure
          </div>
          <div className="bg-surface-2 border border-border rounded-[6px] p-6">
            <TimelineView model={model} />
          </div>
        </section>
      )}

      {/* Message Flow (Mermaid) */}
      {seqSource && (
        <section className="mt-12 flex flex-col gap-4">
          <div className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold">
            Message Flow
          </div>
          <div
            ref={mermaidRef}
            className="bg-surface-2 border border-border rounded-[6px] p-6 min-h-[200px] flex items-center justify-center overflow-x-auto"
          >
            {mermaidSvg ? (
              <div
                className="mx-auto max-w-4xl [&>svg]:w-full [&>svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              />
            ) : (
              <div className="text-text-2 text-sm">Loading sequence diagram…</div>
            )}
          </div>
        </section>
      )}

      {/* Indicators */}
      {indicators.length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <div className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold">
            Indicators
          </div>
          <div className="flex flex-col gap-2">
            {indicators.map((ind: any) => (
              <IndicatorRow key={ind.id} indicator={ind} />
            ))}
          </div>
        </section>
      )}

      {/* YAML */}
      <section className="mt-12 flex flex-col gap-4">
        <div className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold">YAML</div>
        <div className="border border-border rounded-[6px] overflow-hidden" style={{ background: '#0d0f14' }}>
          <div
            className="flex items-center justify-between px-3 py-2.5 text-text-2 text-xs border-b"
            style={{ borderColor: '#171a22', background: '#0b0d13' }}
          >
            <span>scenario.yaml</span>
            <span>
              {yamlExpanded
                ? `${yamlLines.length} lines`
                : `${Math.min(20, yamlLines.length)} of ${yamlLines.length} lines`}
            </span>
          </div>
          <pre className="m-0 p-4 overflow-auto font-mono text-xs leading-relaxed text-[#d4d4d8]">
            <code>{highlightYaml(previewLines.join('\n'))}</code>
          </pre>
          {yamlLines.length > 20 && (
            <button
              onClick={() => setYamlExpanded(!yamlExpanded)}
              className="w-full py-2 text-xs text-text-2 hover:text-text border-t cursor-pointer bg-transparent border-border"
            >
              {yamlExpanded ? 'Show less' : `Show all ${yamlLines.length} lines…`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function IndicatorRow({ indicator }: { indicator: any }) {
  const [expanded, setExpanded] = useState(false);
  const protocolColor = indicator.protocol
    ? PROTOCOL_BG[protocolLabel(indicator.protocol)] ?? 'bg-sev-info'
    : 'bg-sev-info';

  return (
    <div
      className="border border-border bg-surface rounded-[6px] px-3.5 py-3 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 text-[13px] min-w-0">
        <span className="font-mono text-text-2 shrink-0">{indicator.id}</span>
        {indicator.protocol && (
          <span
            className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold text-white shrink-0 ${protocolColor}`}
          >
            {protocolLabel(indicator.protocol)}
          </span>
        )}
        <span className="text-text-2 truncate flex-1 min-w-0">{indicator.description}</span>
        <span className="text-text-2 text-base shrink-0">{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="font-mono text-xs text-text-2 whitespace-pre-wrap">
            {indicator.target && (
              <div>
                <span className="text-text">target: </span>
                {indicator.target}
              </div>
            )}
            {indicator.pattern?.regex && (
              <div>
                <span className="text-text">pattern: </span>
                {indicator.pattern.regex}
              </div>
            )}
            {indicator.pattern?.condition?.regex && (
              <div>
                <span className="text-text">condition regex: </span>
                {indicator.pattern.condition.regex}
              </div>
            )}
            {indicator.pattern?.condition?.contains && (
              <div>
                <span className="text-text">condition contains: </span>
                {indicator.pattern.condition.contains}
              </div>
            )}
            {indicator.semantic && (
              <div>
                <span className="text-text">semantic intent: </span>
                {indicator.semantic.intent}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
