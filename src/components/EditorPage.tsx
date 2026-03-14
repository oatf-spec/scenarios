import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { decompressYaml } from '../lib/url-codec';
import DetailView from './DetailView/DetailView';

import singlePhaseTpl from '../templates/single-phase-mcp.yaml?raw';
import multiPhaseTpl from '../templates/multi-phase-mcp.yaml?raw';
import crossProtocolTpl from '../templates/cross-protocol.yaml?raw';
import blankTpl from '../templates/blank.yaml?raw';

const EditorView = lazy(() => import('./EditorView/EditorView'));

const TEMPLATES = [
  { name: 'Single-Phase MCP', desc: 'Minimal MCP server attack with one phase', content: singlePhaseTpl },
  { name: 'Multi-Phase MCP', desc: 'Rug pull pattern with trust building and payload delivery', content: multiPhaseTpl },
  { name: 'Cross-Protocol', desc: 'AG-UI + MCP coordinated two-actor attack', content: crossProtocolTpl },
  { name: 'Blank Document', desc: 'Minimal valid skeleton', content: blankTpl },
];

export default function EditorPage() {
  const [yamlText, setYamlText] = useState<string | null>(null);
  const [tab, setTab] = useState<'editor' | 'detail'>('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine initial content and tab from URL on mount
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get('load');

    if (params.get('tab') === 'detail') setTab('detail');

    if (hash.startsWith('#yaml=')) {
      // Shared scenario via compressed fragment
      const compressed = hash.slice(6);
      const text = decompressYaml(compressed);
      if (text) {
        setYamlText(text);
      } else {
        setError('Failed to decompress YAML from URL.');
      }
      setLoading(false);
    } else if (loadId) {
      // Load registry scenario by ID
      fetch(`/library/${loadId}.yaml`)
        .then((r) => {
          if (!r.ok) throw new Error(`Scenario ${loadId} not found`);
          return r.text();
        })
        .then((text) => {
          setYamlText(text);
          setLoading(false);
        })
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    } else {
      // No content — show template selector
      setLoading(false);
    }
  }, []);

  const handleYamlChange = useCallback((yaml: string) => {
    setYamlText(yaml);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] text-text-2 text-sm">
        Loading…
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-text-2 text-sm">{error}</div>
      </div>
    );
  }

  // Template selector (no content yet)
  if (!yamlText) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="bg-surface border border-border rounded-[6px] p-8 max-w-md w-full mx-4">
          <div className="text-text-2 font-mono text-xs mb-3"># start from a template or paste YAML</div>
          <h2 className="font-serif text-xl font-semibold mb-1">New Scenario</h2>
          <p className="text-sm text-text-2 mb-6">Choose a template to get started.</p>
          <div className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => setYamlText(t.content)}
                className="text-left p-3 rounded-[6px] border border-border bg-transparent hover:bg-[#20232d] hover:border-border-hover cursor-pointer transition-colors"
              >
                <div className="text-sm font-semibold text-text">{t.name}</div>
                <div className="text-xs text-text-2 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Editor with tabs
  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Tabs */}
      <div className="max-w-[calc(960px+96px)] w-full mx-auto px-6 md:px-12 pt-6">
        <div className="flex gap-4 border-b border-border pb-0">
          <button
            onClick={() => setTab('editor')}
            className={`pb-2.5 text-sm border-b-2 cursor-pointer bg-transparent border-0 ${
              tab === 'editor' ? 'text-text border-text' : 'text-text-2 border-transparent hover:text-text'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setTab('detail')}
            className={`pb-2.5 text-sm border-b-2 cursor-pointer bg-transparent border-0 ${
              tab === 'detail' ? 'text-text border-text' : 'text-text-2 border-transparent hover:text-text'
            }`}
          >
            Detail
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'editor' ? (
        <Suspense
          fallback={
            <div className="flex items-center justify-center flex-1 text-text-2 text-sm">
              Loading editor…
            </div>
          }
        >
          <EditorView initialYaml={yamlText} onYamlChange={handleYamlChange} />
        </Suspense>
      ) : (
        <DetailView yamlText={yamlText} shareTab="detail" onEdit={() => setTab('editor')} />
      )}
    </div>
  );
}
