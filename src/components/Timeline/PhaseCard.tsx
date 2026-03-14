import type { PhaseModel } from '../../lib/oatf-model';
import ExtractorBadge from './ExtractorBadge';
import TriggerDivider from './TriggerDivider';

interface Props {
  phase: PhaseModel;
  index: number;
  highlighted?: boolean;
  onPhaseClick?: (index: number) => void;
}

export default function PhaseCard({ phase, index, highlighted, onPhaseClick }: Props) {
  return (
    <div>
      <div
        onClick={() => onPhaseClick?.(index)}
        className={`bg-surface border rounded-[6px] p-3 flex flex-col gap-2 transition-colors ${
          onPhaseClick ? 'cursor-pointer' : ''
        } ${highlighted ? 'border-border-hover' : 'border-border'}`}
      >
        {/* Phase name */}
        <div className="text-[13px] text-text font-medium">{phase.name}</div>

        {/* State summary */}
        {phase.state_summary && (
          <div className="font-mono text-xs text-text-2 truncate">{phase.state_summary}</div>
        )}

        {/* Extractors */}
        {phase.extractors.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {phase.extractors.map((ext) => (
              <ExtractorBadge key={ext.name} extractor={ext} />
            ))}
          </div>
        )}
      </div>

      {/* Trigger divider or terminal label */}
      {phase.trigger ? (
        <TriggerDivider trigger={phase.trigger} />
      ) : phase.is_terminal ? (
        <div className="py-2 text-center text-[11px] text-[#6b7280]">terminal</div>
      ) : null}
    </div>
  );
}
