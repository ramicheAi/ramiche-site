"use client";

export default function BgOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute inset-0 bg-[#06020f]" />
      <div className="absolute inset-0 data-grid-bg opacity-30" />
      <div className="nebula-1 absolute -top-[20%] left-[20%] w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.08)_0%,rgba(107,33,168,0.12)_30%,transparent_60%)]" />
      <div className="nebula-2 absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.1)_0%,rgba(0,240,255,0.04)_40%,transparent_60%)]" />
      <div className="nebula-3 absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.06)_0%,transparent_55%)]" />
      <div className="nebula-drift absolute top-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.05)_0%,transparent_55%)]" />
      <div className="scan-line absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff]/20 to-transparent" />
    </div>
  );
}
