import type { ExtractorSummary } from '../../lib/oatf-model';

export default function ExtractorBadge({ extractor }: { extractor: ExtractorSummary }) {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded bg-[#13151d] border border-border text-[10px] font-mono text-text-2">
      {extractor.name}
    </span>
  );
}
