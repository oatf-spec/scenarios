export default function ReadinessBarrier() {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 border-t border-dashed border-[#6b7280]" />
      <span className="text-[11px] text-[#6b7280] whitespace-nowrap">server actors ready</span>
      <div className="flex-1 border-t border-dashed border-[#6b7280]" />
    </div>
  );
}
