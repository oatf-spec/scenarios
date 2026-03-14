import { useState, useEffect } from 'react';
import { decompressYaml } from '../../lib/url-codec';
import DetailView from './DetailView';

export default function CustomDetailView() {
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
      <div className="max-w-[calc(960px+96px)] mx-auto px-6 md:px-12 py-16 text-center">
        <div className="text-text-2 text-sm">{error}</div>
      </div>
    );
  }

  if (!yamlText) {
    return (
      <div className="max-w-[calc(960px+96px)] mx-auto px-6 md:px-12 py-16 text-center">
        <div className="text-text-2 text-sm">Loading…</div>
      </div>
    );
  }

  return <DetailView yamlText={yamlText} />;
}
