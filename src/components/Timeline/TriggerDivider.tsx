import type { TriggerSummary } from '../../lib/oatf-model';

export default function TriggerDivider({ trigger }: { trigger: TriggerSummary }) {
  return (
    <div className="relative flex items-center py-2">
      <div className="flex-1 border-t border-dashed border-border" />
      <span className="px-2 text-[11px] text-text-2 whitespace-nowrap font-mono">
        {trigger.display}
      </span>
      <div className="flex-1 border-t border-dashed border-border" />
    </div>
  );
}
