export default function ResearchBanner() {
  const label = process.env.NEXT_PUBLIC_RESEARCH_BANNER ?? "研究モード";
  return <div className="w-full text-center text-xs py-1 bg-amber-50 text-amber-700 border-b">{label}</div>;
}
