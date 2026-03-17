import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  owasp_agentic: 'OWASP Agentic',
};

const FRAMEWORK_URLS: Record<string, (id: string) => string> = {
  atlas: (id) => `https://atlas.mitre.org/techniques/${id}`,
  mitre_attack: (id) => `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`,
  owasp_llm: (id) => `https://genai.owasp.org/llmrisk/${id}/`,
  owasp_mcp: () => '#',
  owasp_agentic: () => 'https://genai.owasp.org/agentic-security/',
};

function protocolLabel(mode: string): string {
  if (mode.startsWith('mcp_')) return 'MCP';
  if (mode.startsWith('a2a_')) return 'A2A';
  if (mode.startsWith('ag_ui_')) return 'AG-UI';
  return mode.toUpperCase();
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(raw: unknown): string {
  const d = raw instanceof Date ? raw : new Date(String(raw) + 'T00:00:00');
  if (isNaN(d.getTime())) return String(raw);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold cursor-pointer scroll-mt-24 group m-0"
      onClick={() => window.history.replaceState(null, '', `#${id}`)}
    >
      {children}
      <span className="opacity-0 group-hover:opacity-100 ml-1.5 text-text-2/50 transition-opacity">#</span>
    </h2>
  );
}

interface RelatedScenario {
  id: string;
  name: string;
  description: string;
  severity_level: string;
  protocols: string[];
  mappings: { framework: string; id: string; name: string }[];
  tags: string[];
  impact: string[];
}

interface Props {
  yamlText: string;
  scenarioId?: string;
  editorUrl?: string;
  shareTab?: 'editor' | 'detail';
  onEdit?: () => void;
  relatedScenarios?: RelatedScenario[];
}

export default function DetailView({ yamlText, scenarioId, editorUrl, shareTab, onEdit, relatedScenarios }: Props) {
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

  // Scroll to hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  if (!doc?.attack) {
    return <div className="text-text-2 text-sm py-8">Unable to parse scenario YAML.</div>;
  }

  const attack = doc.attack;
  const sevStyle = SEVERITY_STYLES[attack.severity?.level] ?? SEVERITY_STYLES.informational;
  const protocols = getProtocols(doc);
  const mappings = attack.classification?.mappings ?? [];
  const indicators = attack.indicators ?? [];
  const yamlLines = yamlText.split('\n');
  const previewLines = yamlExpanded ? yamlLines : yamlLines.slice(0, 20);

  const topRelated = useMemo(() => {
    if (!relatedScenarios?.length) return [];
    const myMappings = new Set(mappings.map((m: any) => m.id));
    const myTags = new Set(attack.classification?.tags ?? []);
    const myImpact = new Set(attack.impact ?? []);
    return relatedScenarios
      .filter(s => s.id !== attack.id)
      .map(s => {
        let score = 0;
        for (const m of s.mappings) if (myMappings.has(m.id)) score += 3;
        for (const t of s.tags ?? []) if (myTags.has(t)) score += 2;
        for (const i of s.impact ?? []) if (myImpact.has(i)) score += 1;
        return { ...s, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [relatedScenarios, mappings, attack]);

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
        {/* Badge bar + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Severity + confidence compound pill */}
            <span className={`inline-flex items-center h-[22px] rounded-full overflow-hidden text-[11px] font-bold tracking-wide uppercase ${sevStyle}`}>
              <span className="px-2 h-full flex items-center">{attack.severity?.level}</span>
              {attack.severity?.confidence != null && (
                <span className="px-1.5 h-full flex items-center bg-black/20 text-white/70 font-semibold">{attack.severity.confidence}%</span>
              )}
            </span>
            {protocols.map((p) => (
              <span
                key={p}
                className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold tracking-wide text-white ${PROTOCOL_BG[p] ?? 'bg-sev-info'}`}
              >
                {p}
              </span>
            ))}
            {(attack.status || attack.version) && (
              <span className="inline-flex items-center h-[22px] rounded-full overflow-hidden text-[11px] font-semibold bg-[#2a2d37]">
                {attack.status && <span className="px-2 h-full flex items-center text-text">{attack.status}</span>}
                {attack.version && <span className={`px-1.5 h-full flex items-center text-text-2${attack.status ? ' bg-black/20' : ''}`}>v{attack.version}</span>}
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
            {onEdit && (
              <button
                onClick={onEdit}
                className="h-8 px-3 rounded-[6px] border border-accent bg-transparent text-text text-[13px] font-semibold inline-flex items-center cursor-pointer"
              >
                Edit
              </button>
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
        {/* Metadata key-value lines */}
        {((attack.impact ?? []).length > 0 || (attack.classification?.tags ?? []).length > 0 || attack.created || attack.author) && (
          <div className="flex flex-col gap-2 mt-1">
            {(attack.impact ?? []).length > 0 && (
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] text-text-2 font-semibold uppercase tracking-wide shrink-0 w-[52px]">Impact</span>
                <span className="text-[13px] text-text">{attack.impact.map(formatLabel).join(' · ')}</span>
              </div>
            )}
            {(attack.classification?.tags ?? []).length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-text-2 font-semibold uppercase tracking-wide shrink-0 w-[52px]">Tags</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {attack.classification.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="inline-flex items-center text-[11px] text-text-2 bg-surface-2 border border-border rounded-full h-[22px] px-2"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(attack.created || attack.modified || attack.author) && (() => {
              const isUpdated = attack.modified && String(attack.modified) !== String(attack.created);
              const label = isUpdated ? 'Updated' : 'Created';
              const date = isUpdated ? attack.modified : attack.created;
              return (
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] text-text-2 font-semibold uppercase tracking-wide shrink-0 w-[52px]">{label}</span>
                  <span className="text-[13px] text-text-2">{[date && formatDate(date), attack.author && `by ${attack.author}`].filter(Boolean).join(' ')}</span>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* Description */}
      <section className="mt-12 flex flex-col gap-4">
        <SectionHeading id="description">Description</SectionHeading>
        <p className="text-[15px] text-text leading-relaxed max-w-[74ch] m-0">
          {attack.description?.trim().replace(/\n(?!\n)/g, ' ')}
        </p>
      </section>

      {/* References */}
      {(attack.references ?? []).length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <SectionHeading id="references">References</SectionHeading>
          <div className="flex flex-col gap-3">
            {attack.references.map((ref: { title?: string; url: string; description?: string }, i: number) => (
              <div key={i} className="flex flex-col gap-0.5">
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text hover:text-text-2 underline decoration-border hover:decoration-text-2 text-[14px]"
                >
                  {ref.title || ref.url} ↗
                </a>
                {ref.description && (
                  <p className="text-[13px] text-text-2 m-0">{ref.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Framework Mappings */}
      {mappings.length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <SectionHeading id="framework-mappings">Framework Mappings</SectionHeading>
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
          <SectionHeading id="attack-structure">Attack Structure</SectionHeading>
          <div className="bg-surface-2 border border-border rounded-[6px] p-6">
            <TimelineView model={model} />
          </div>
        </section>
      )}

      {/* Message Flow (Mermaid) */}
      {seqSource && (
        <section className="mt-12 flex flex-col gap-4">
          <SectionHeading id="message-flow">Message Flow</SectionHeading>
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
          <SectionHeading id="indicators">
            Indicators
            {attack.correlation?.logic && (
              <span className="text-text-2 normal-case tracking-normal font-normal"> · match {attack.correlation.logic}</span>
            )}
          </SectionHeading>
          <div className="flex flex-col gap-2">
            {indicators.map((ind: any) => (
              <IndicatorRow key={ind.id} indicator={ind} />
            ))}
          </div>
        </section>
      )}

      {/* YouTube PoC embed — first YouTube link from references */}
      {(() => {
        const ytRef = (attack.references ?? []).find((ref: any) =>
          /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(ref.url)
        );
        if (!ytRef) return null;
        const match = ytRef.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
        if (!match) return null;
        return (
          <section className="mt-12 flex flex-col gap-4">
            <SectionHeading id="video-demonstration">Video demonstration</SectionHeading>
            <div className="rounded-[6px] overflow-hidden border border-border" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${match[1]}`}
                title={ytRef.title || 'Video demonstration'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </section>
        );
      })()}

      {/* YAML */}
      <section className="mt-12 flex flex-col gap-4">
        <SectionHeading id="yaml">YAML</SectionHeading>
        <div className="border border-border rounded-[6px] overflow-hidden" style={{ background: '#0d0f14' }}>
          <div
            className="flex items-center justify-between px-3 py-2.5 text-text-2 text-xs border-b"
            style={{ borderColor: '#171a22', background: '#0b0d13' }}
          >
            <span>scenario.yaml</span>
            <div className="flex items-center gap-3">
              <span>
                {yamlExpanded
                  ? `${yamlLines.length} lines`
                  : `${Math.min(20, yamlLines.length)} of ${yamlLines.length} lines`}
              </span>
              <CopyButton text={yamlText} />
            </div>
          </div>
          <pre className="m-0 p-4 overflow-auto font-mono text-xs leading-relaxed text-[#d4d4d8]">
            <code>{highlightYaml(previewLines.join('\n'))}</code>
          </pre>
          {yamlLines.length > 20 && (
            <button
              onClick={() => setYamlExpanded(!yamlExpanded)}
              className="w-full py-2 text-xs text-text-2 hover:text-text border-t cursor-pointer bg-[#13151d] border-border"
            >
              {yamlExpanded ? '▴ Show less' : `▾ Show all ${yamlLines.length} lines…`}
            </button>
          )}
        </div>
      </section>

      {/* Related Scenarios */}
      {topRelated.length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <SectionHeading id="related-scenarios">Related Scenarios</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topRelated.map(s => (
              <a
                key={s.id}
                href={`/${s.id}/`}
                className="bg-surface border border-border rounded-[6px] p-4 min-h-[148px] flex flex-col gap-3 transition-colors hover:border-border-hover"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="font-mono text-xs text-text-2">{s.id}</span>
                  <span className={`inline-flex items-center justify-center min-w-[58px] h-[22px] px-2 rounded-full text-[11px] font-bold tracking-wide uppercase ${SEVERITY_STYLES[s.severity_level] ?? SEVERITY_STYLES.informational}`}>
                    {s.severity_level}
                  </span>
                </div>
                <div className="font-serif text-base leading-tight text-text whitespace-nowrap overflow-hidden text-ellipsis">
                  {s.name}
                </div>
                <div className="text-[13px] text-text-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {s.description.replace(/\n/g, ' ')}
                </div>
                <div className="mt-auto flex gap-2 flex-wrap">
                  {s.protocols.map(p => (
                    <span
                      key={p}
                      className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold tracking-wide text-white ${PROTOCOL_BG[p] ?? 'bg-sev-info'}`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <button
      onClick={handleCopy}
      className="text-text-2 hover:text-text cursor-pointer bg-transparent border-0 text-xs"
      title="Copy YAML"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
