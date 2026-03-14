import type { ActorModel } from '../../lib/oatf-model';
import PhaseCard from './PhaseCard';

const PROTOCOL_COLORS: Record<string, string> = {
  mcp: '#3b82f6',
  a2a: '#22c55e',
  ag_ui: '#a855f7',
};

const PROTOCOL_BG: Record<string, string> = {
  mcp: 'bg-mcp',
  a2a: 'bg-a2a',
  ag_ui: 'bg-agui',
};

interface Props {
  actor: ActorModel;
  showHeader: boolean;
  globalOffset: number;
  highlightedPhase?: number;
  onPhaseClick?: (index: number) => void;
}

export default function ActorLane({ actor, showHeader, globalOffset, highlightedPhase, onPhaseClick }: Props) {
  const borderColor = PROTOCOL_COLORS[actor.protocol] ?? '#2a2d37';

  return (
    <div
      className="flex-1 min-w-[200px] flex flex-col gap-0"
      style={{
        borderLeft: showHeader ? `1px solid ${borderColor}33` : undefined,
        paddingLeft: showHeader ? '12px' : undefined,
      }}
    >
      {showHeader && (
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-xs text-text">{actor.name}</span>
          <span
            className={`inline-flex items-center h-5 px-1.5 rounded text-[10px] font-bold text-white ${PROTOCOL_BG[actor.protocol] ?? 'bg-sev-info'}`}
          >
            {actor.mode}
          </span>
        </div>
      )}
      <div className="flex flex-col">
        {actor.phases.map((phase, i) => (
          <PhaseCard
            key={phase.name}
            phase={phase}
            index={globalOffset + i}
            highlighted={highlightedPhase === globalOffset + i}
            onPhaseClick={onPhaseClick}
          />
        ))}
      </div>
    </div>
  );
}
