import type { TimelineModel } from '../../lib/oatf-model';
import ActorLane from './ActorLane';
import ReadinessBarrier from './ReadinessBarrier';

interface Props {
  model: TimelineModel;
  highlightedPhase?: number;
  onPhaseClick?: (index: number) => void;
}

export default function TimelineView({ model, highlightedPhase, onPhaseClick }: Props) {
  if (!model.actors.length) {
    return <div className="text-sm text-text-2 py-4">No execution data found.</div>;
  }

  const isMultiActor = model.actors.length > 1;

  // Compute global phase offset per actor so indices are consistent with flatMap
  let offset = 0;
  const actorOffsets = model.actors.map((actor) => {
    const o = offset;
    offset += actor.phases.length;
    return o;
  });

  return (
    <div className="flex flex-col">
      {isMultiActor && <ReadinessBarrier />}
      <div className={`flex gap-4 ${isMultiActor ? 'flex-col lg:flex-row' : 'flex-col'}`}>
        {model.actors.map((actor, ai) => (
          <ActorLane
            key={actor.name}
            actor={actor}
            showHeader={isMultiActor}
            globalOffset={actorOffsets[ai]}
            highlightedPhase={highlightedPhase}
            onPhaseClick={onPhaseClick}
          />
        ))}
      </div>
    </div>
  );
}
