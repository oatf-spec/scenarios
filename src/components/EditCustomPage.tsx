import { useState, useEffect, lazy, Suspense } from 'react';
import { decompressYaml } from '../lib/url-codec';

const EditorView = lazy(() => import('./EditorView/EditorView'));

export default function EditCustomPage() {
  const [yamlText, setYamlText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#yaml=')) {
      setError('No YAML data found in URL. Use #yaml=<compressed> format.');
      return;
    }
    const compressed = hash.slice(6);
    const text = decompressYaml(compressed);
    if (!text) {
      setError('Failed to decompress YAML data from URL.');
      return;
    }
    setYamlText(text);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-text-2 text-sm">{error}</div>
      </div>
    );
  }

  if (!yamlText) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-text-2 text-sm">Loading…</div>
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
