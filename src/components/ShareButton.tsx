import { useState } from 'react';
import { compressYaml } from '../lib/url-codec';

interface Props {
  yamlText: string;
  tab?: 'editor' | 'detail';
  className?: string;
}

export default function ShareButton({ yamlText, tab = 'editor', className }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  function showStatus(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  }

  function handleShare() {
    const compressed = compressYaml(yamlText);
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://oatf.dev';
    const tabParam = tab === 'detail' ? '?tab=detail' : '';
    const url = `${base}/editor${tabParam}#yaml=${compressed}`;

    if (url.length > 15000) {
      showStatus('URL too long — use Download instead');
      return;
    }

    navigator.clipboard.writeText(url).then(() => {
      if (url.length > 8000) {
        showStatus('Copied (warning: long URL may be truncated by Slack/Teams)');
      } else {
        showStatus('Link copied!');
      }
    }).catch(() => {
      showStatus('Failed to copy — check clipboard permissions');
    });
  }

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className={className ?? "h-7 px-2.5 rounded-[6px] border border-border bg-surface text-text text-xs font-semibold cursor-pointer hover:border-border-hover"}
      >
        Share
      </button>
      {status && (
        <div className="absolute right-0 top-8 z-50 whitespace-nowrap bg-surface border border-border rounded-[6px] px-3 py-1.5 text-xs text-text shadow-xl">
          {status}
        </div>
      )}
    </div>
  );
}
