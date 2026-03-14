import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import DetailView from './DetailView/DetailView';

const EditorView = lazy(() => import('./EditorView/EditorView'));

interface Props {
  initialYaml: string;
  scenarioId?: string;
  defaultTab?: 'detail' | 'editor';
}

export default function ScenarioPage({ initialYaml, scenarioId, defaultTab = 'detail' }: Props) {
  const [tab, setTab] = useState<'detail' | 'editor'>(defaultTab);
  const [yamlText, setYamlText] = useState(initialYaml);

  // Read tab from URL after hydration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'editor') setTab('editor');
  }, []);

  // Sync tab to URL on change
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'editor') {
      url.searchParams.set('tab', 'editor');
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
  }, [tab]);

  const handleYamlChange = useCallback((yaml: string) => {
    setYamlText(yaml);
  }, []);

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Tabs */}
      <div className="max-w-[calc(960px+96px)] w-full mx-auto px-6 md:px-12 pt-6">
        <div className="flex gap-4 border-b border-border pb-0">
          <button
            onClick={() => setTab('detail')}
            className={`pb-2.5 text-sm border-b-2 cursor-pointer bg-transparent border-0 ${
              tab === 'detail' ? 'text-text border-text' : 'text-text-2 border-transparent hover:text-text'
            }`}
          >
            Detail
          </button>
          <button
            onClick={() => setTab('editor')}
            className={`pb-2.5 text-sm border-b-2 cursor-pointer bg-transparent border-0 ${
              tab === 'editor' ? 'text-text border-text' : 'text-text-2 border-transparent hover:text-text'
            }`}
          >
            Editor
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'detail' ? (
        <DetailView yamlText={yamlText} scenarioId={scenarioId} />
      ) : (
        <Suspense
          fallback={
            <div className="flex items-center justify-center flex-1 text-text-2 text-sm">
              Loading editor…
            </div>
          }
        >
          <EditorView
            initialYaml={yamlText}
            scenarioId={scenarioId}
            onYamlChange={handleYamlChange}
          />
        </Suspense>
      )}
    </div>
  );
}
