import { useState, useRef, useEffect } from 'react';
import { SNIPPETS } from './snippets';
import ShareButton from '../ShareButton';

import singlePhaseTpl from '../../templates/single-phase-mcp.yaml?raw';
import multiPhaseTpl from '../../templates/multi-phase-mcp.yaml?raw';
import crossProtocolTpl from '../../templates/cross-protocol.yaml?raw';
import blankTpl from '../../templates/blank.yaml?raw';

const TEMPLATES: Record<string, string> = {
  'Single-Phase MCP': singlePhaseTpl,
  'Multi-Phase MCP': multiPhaseTpl,
  'Cross-Protocol': crossProtocolTpl,
  'Blank Document': blankTpl,
};

interface Props {
  yamlText: string;
  attackId: string;
  onTemplate: (content: string) => void;
  onInsert: (snippet: string) => void;
}

export default function Toolbar({ yamlText, attackId, onTemplate, onInsert }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border" style={{ background: '#11141c' }}>
      <div className="flex items-center gap-1.5">
        <Dropdown
          label="Templates"
          items={Object.keys(TEMPLATES)}
          onSelect={(name) => {
            if (confirm('Replace current content with template?')) {
              onTemplate(TEMPLATES[name]);
            }
          }}
        />
        <Dropdown
          label="Insert"
          items={Object.keys(SNIPPETS)}
          onSelect={(name) => onInsert(SNIPPETS[name])}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <ShareButton yamlText={yamlText} tab="editor" />
        <DownloadButton yamlText={yamlText} attackId={attackId} />
      </div>
    </div>
  );
}

function Dropdown({ label, items, onSelect }: {
  label: string;
  items: string[];
  onSelect: (item: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-7 px-2.5 rounded-[6px] border border-border bg-surface text-text text-xs font-semibold cursor-pointer hover:border-border-hover"
      >
        {label} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-50 min-w-[200px] bg-surface border border-border rounded-[6px] py-1 shadow-xl">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => { onSelect(item); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-text hover:bg-[#20232d] cursor-pointer bg-transparent border-0"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadButton({ yamlText, attackId }: { yamlText: string; attackId: string }) {
  function handleDownload() {
    const filename = `${attackId || 'untitled'}.yaml`;
    const blob = new Blob([yamlText], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  return (
    <button
      onClick={handleDownload}
      className="h-7 px-2.5 rounded-[6px] border border-border bg-surface text-text text-xs font-semibold cursor-pointer hover:border-border-hover"
    >
      Download
    </button>
  );
}
