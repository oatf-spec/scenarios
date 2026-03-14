import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import yaml from 'js-yaml';
import { extractModel, type TimelineModel } from '../../lib/oatf-model';
import { validate, type ValidationError } from '../../lib/validation';
import TimelineView from '../Timeline/TimelineView';
import Toolbar from './Toolbar';
import ValidationPanel from './ValidationPanel';

interface Props {
  initialYaml: string;
  scenarioId?: string;
}

export default function EditorView({ initialYaml, scenarioId }: Props) {
  const [yamlText, setYamlText] = useState(initialYaml);
  const [lastValidModel, setLastValidModel] = useState<TimelineModel | null>(null);
  const [highlightedPhase, setHighlightedPhase] = useState<number | undefined>();
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [MonacoEditor, setMonacoEditor] = useState<any>(null);

  // Lazy-load Monaco
  useEffect(() => {
    import('@monaco-editor/react').then((mod) => {
      setMonacoEditor(() => mod.default);
    });
  }, []);

  // Parse model from current YAML
  const { model, attackId } = useMemo(() => {
    try {
      const doc = yaml.load(yamlText) as any;
      const m = extractModel(doc, yamlText);
      return { model: m, attackId: doc?.attack?.id ?? 'untitled' };
    } catch {
      return { model: null, attackId: 'untitled' };
    }
  }, [yamlText]);

  // Update lastValidModel when we get a good parse
  useEffect(() => {
    if (model && model.actors.length > 0) setLastValidModel(model);
  }, [model]);

  // Run validation on change
  useEffect(() => {
    setErrors(validate(yamlText));
  }, [yamlText]);

  // Debounced YAML change handler
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setYamlText(value ?? '');
    }, 150);
  }, []);

  // Phase click → scroll editor
  const handlePhaseClick = useCallback((index: number) => {
    const m = model ?? lastValidModel;
    if (!m || !editorRef.current) return;
    const allPhases = m.actors.flatMap((a) => a.phases);
    const phase = allPhases[index];
    if (!phase || !phase.yaml_line_start) return;
    editorRef.current.revealLineInCenter(phase.yaml_line_start);
    editorRef.current.setPosition({ lineNumber: phase.yaml_line_start, column: 1 });
    editorRef.current.focus();
  }, [model, lastValidModel]);

  // Cursor position → highlight phase
  const handleCursorChange = useCallback(() => {
    const m = model ?? lastValidModel;
    if (!m || !editorRef.current) return;
    const pos = editorRef.current.getPosition();
    if (!pos) return;
    const line = pos.lineNumber;
    const allPhases = m.actors.flatMap((a) => a.phases);
    const idx = allPhases.findIndex(
      (p) => p.yaml_line_start && p.yaml_line_end && line >= p.yaml_line_start && line <= p.yaml_line_end,
    );
    setHighlightedPhase(idx >= 0 ? idx : undefined);
  }, [model, lastValidModel]);

  // Line click from validation panel
  const handleLineClick = useCallback((line: number) => {
    if (!editorRef.current) return;
    editorRef.current.revealLineInCenter(line);
    editorRef.current.setPosition({ lineNumber: line, column: 1 });
    editorRef.current.focus();
  }, []);

  // Template replacement
  const handleTemplate = useCallback((content: string) => {
    setYamlText(content);
    if (editorRef.current) {
      editorRef.current.setValue(content);
    }
  }, []);

  // Insert snippet at cursor
  const handleInsert = useCallback((snippet: string) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const pos = editor.getPosition();
    if (!pos) return;

    const range = new monacoRef.current.Range(
      pos.lineNumber, pos.column, pos.lineNumber, pos.column,
    );
    editor.executeEdits('insert-snippet', [{ range, text: snippet }]);
    editor.focus();
  }, []);

  function handleEditorMount(editor: any, monaco: any) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Dark theme
    monaco.editor.defineTheme('oatf-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f1117',
        'editor.lineHighlightBackground': '#1a1d2740',
        'editorGutter.background': '#0d0f14',
      },
    });
    monaco.editor.setTheme('oatf-dark');

    // Track cursor position for phase highlighting
    editor.onDidChangeCursorPosition(handleCursorChange);
  }

  const displayModel = model && model.actors.length > 0 ? model : lastValidModel;
  const parseError = !model || model.actors.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-64px-44px)]">
      <Toolbar
        yamlText={yamlText}
        attackId={attackId}
        onTemplate={handleTemplate}
        onInsert={handleInsert}
      />

      {/* Split pane */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Editor */}
        <div className="flex-[3] min-h-[300px] lg:min-h-0 border-r border-border">
          {MonacoEditor ? (
            <MonacoEditor
              defaultLanguage="yaml"
              value={yamlText}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                tabSize: 2,
                automaticLayout: true,
              }}
              theme="vs-dark"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-2 text-sm">
              Loading editor…
            </div>
          )}
        </div>

        {/* Timeline preview */}
        <div className="flex-[2] min-h-[200px] lg:min-h-0 overflow-y-auto p-4" style={{ background: '#13151d' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-text-2 uppercase tracking-[0.1em] font-bold">
              Preview
            </span>
            {parseError && (
              <span className="text-[11px] text-sev-high font-mono">parse error</span>
            )}
          </div>
          {displayModel ? (
            <TimelineView
              model={displayModel}
              highlightedPhase={highlightedPhase}
              onPhaseClick={handlePhaseClick}
            />
          ) : (
            <div className="text-text-2 text-sm py-4">
              Start typing to see a preview…
            </div>
          )}
        </div>
      </div>

      {/* Validation panel */}
      <ValidationPanel errors={errors} onLineClick={handleLineClick} />
    </div>
  );
}
