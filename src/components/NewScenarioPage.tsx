import { useState, lazy, Suspense } from 'react';

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

export default function NewScenarioPage() {
  const [yamlText, setYamlText] = useState<string | null>(null);

  if (!yamlText) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="bg-surface border border-border rounded-[6px] p-8 max-w-md w-full mx-4">
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

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)] text-text-2 text-sm">
          Loading editor…
        </div>
      }
    >
      <EditorView initialYaml={yamlText} />
    </Suspense>
  );
}
