export function DemoModeBanner() {
  return (
    <div className="w-full bg-[#F59E0B]/10 border-b border-[#F59E0B]/20 px-4 py-2 text-center absolute top-0 z-[60]">
      <p className="text-[10px] font-mono font-semibold text-[#F59E0B] tracking-widest uppercase">
        ⚠ This demo does not connect to live banking, NCRP, or I4C systems. All data is synthetic.
      </p>
    </div>
  );
}
