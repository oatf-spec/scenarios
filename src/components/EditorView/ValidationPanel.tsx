import { useState, useEffect, useRef } from 'react';
import type { ValidationError } from '../../lib/validation';

interface Props {
  errors: ValidationError[];
  onLineClick?: (line: number) => void;
}

export default function ValidationPanel({ errors, onLineClick }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const prevCount = useRef(0);

  // Auto-expand when errors appear, auto-collapse when they clear
  useEffect(() => {
    if (errors.length > 0 && prevCount.current === 0) setCollapsed(false);
    if (errors.length === 0 && prevCount.current > 0) setCollapsed(true);
    prevCount.current = errors.length;
  }, [errors.length]);

  return (
    <div className="border-t border-border" style={{ background: '#11141c' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs cursor-pointer bg-transparent border-0 text-text-2 hover:text-text"
      >
        <span className="font-semibold">
          Validation
          {errors.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sev-critical text-white text-[10px] font-bold">
              {errors.length}
            </span>
          )}
        </span>
        <span>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className="max-h-[200px] overflow-y-auto">
          {errors.length === 0 ? (
            <div className="px-3 pb-2 text-xs text-text-2">No errors</div>
          ) : (
            <div className="flex flex-col">
              {errors.map((err) => (
                <div
                  key={`${err.code}-${err.line ?? 0}-${err.message}`}
                  className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-[#1a1d27] border-t border-border"
                >
                  <span className="font-mono text-sev-critical font-bold shrink-0">{err.code}</span>
                  <span className="text-text-2 flex-1 truncate">{err.message}</span>
                  {err.line && (
                    <button
                      onClick={() => onLineClick?.(err.line!)}
                      className="shrink-0 font-mono text-accent hover:underline cursor-pointer bg-transparent border-0 text-xs"
                    >
                      line {err.line}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
