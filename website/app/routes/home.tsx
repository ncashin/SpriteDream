import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Natstack — The Game Engine That Lives in Your Editor" },
    { name: "description", content: "Build games in TypeScript with a visual editor inside VS Code. Export and share instantly." },
  ];
}

function CodeBlock() {
  const [activeTab, setActiveTab] = useState<"player.ts" | "main.scene">("player.ts");
  
  const playerLines = [
    { num: 1, content: <><span className="text-[#ff6b35]">import</span> {"{"} <span className="text-[#00d4ff]">Entity</span>, <span className="text-[#00d4ff]">Component</span> {"}"} <span className="text-[#ff6b35]">from</span> <span className="text-[#98c379]">"natstack"</span></> },
    { num: 2, content: "" },
    { num: 3, content: <><span className="text-[#ff6b35]">export class</span> <span className="text-[#00d4ff]">Player</span> <span className="text-[#ff6b35]">extends</span> <span className="text-[#00d4ff]">Component</span> {"{"}</> },
    { num: 4, content: <>&nbsp;&nbsp;<span className="text-white/40">speed</span> = <span className="text-[#d19a66]">200</span></> },
    { num: 5, content: "" },
    { num: 6, content: <>&nbsp;&nbsp;<span className="text-[#ff6b35]">update</span>(<span className="text-white/60">dt</span>: <span className="text-[#00d4ff]">number</span>) {"{"}</> },
    { num: 7, content: <>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#ff6b35]">if</span> (<span className="text-white/60">Input</span>.<span className="text-white/60">isKeyDown</span>(<span className="text-[#98c379]">"ArrowRight"</span>)) {"{"}</> },
    { num: 8, content: <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#ff6b35]">this</span>.<span className="text-white/60">entity</span>.<span className="text-white/60">x</span> += <span className="text-[#ff6b35]">this</span>.<span className="text-white/60">speed</span> * <span className="text-white/60">dt</span></> },
    { num: 9, content: <>&nbsp;&nbsp;&nbsp;&nbsp;{"}"}</> },
    { num: 10, content: <>&nbsp;&nbsp;{"}"}</> },
    { num: 11, content: "}" },
  ];

  const tabs = [
    { id: "player.ts" as const, label: "player.ts", icon: "ts" },
    { id: "main.scene" as const, label: "main.scene", icon: "scene" },
  ];

  return (
    <div className="relative pt-8">
      {/* Tabs jutting out above */}
      <div className="absolute top-0 left-4 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-mono transition-all rounded-t-lg ${
              activeTab === tab.id
                ? "bg-[var(--color-bg-base)] text-white/80 border border-white/[0.06] border-b-0 relative z-10"
                : "bg-[var(--color-bg-elevated)] text-white/40 hover:text-white/60 border border-white/[0.04] border-b-0"
            }`}
          >
            {tab.icon === "ts" ? (
              <span className="text-[#3178c6] font-bold text-[10px]">TS</span>
            ) : (
              <span className="text-[var(--color-accent)]">◇</span>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[var(--color-bg-base)] shadow-2xl shadow-black/50 h-[480px]">
        {activeTab === "player.ts" ? (
          <div className="pt-5 pl-1 font-mono text-sm leading-relaxed overflow-x-auto h-full">
            {playerLines.map((line, i) => (
              <div key={i} className="flex items-center gap-4 hover:bg-white/[0.02] -mx-2 px-2 rounded">
                <span className="text-white/20 w-6 text-right text-xs select-none">{line.num}</span>
                <span className="text-white/80">{line.content || <>&nbsp;</>}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full relative">
            <iframe
              src="/api/games/1/bundle"
              className="absolute inset-0 w-full h-full border-0"
              title="Demo Game"
              allow="fullscreen"
              allowFullScreen
            />
          </div>
        )}
      </div>
      
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-[var(--color-accent)]/20 rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[var(--color-ember)]/15 rounded-full blur-[80px] pointer-events-none" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-void)] grid-bg">
      <div className="spotlight fixed inset-0 pointer-events-none" />
      
      <section className="relative min-h-screen flex items-center ">
        <div className="w-full px-12">
          <div className="grid lg:grid-cols-[2fr_3fr] gap-8 items-center px-1">
            <div className="space-y-6">
              <div className="flex flex-col space-y-4">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] flex flex-col gap-3">
                  <span className="text-white">Build games</span>
                  <span className="text-gradient">inside Cursor</span>
                </h1>
                <p className="text-lg sm:text-xl text-white/40 max-w-lg leading-relaxed">
                  Natstack is a TypeScript game engine with a visual scene editor. 
                  Create 2D games, export with one click, share instantly.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=natstack.natstack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
                  </svg>
                  Install
                </a>
                
                <Link
                  to="/explore"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Explore
                </Link>
              </div>
              
              <div className="flex items-center gap-8 pt-4">
                <div className="flex -space-x-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-ember)] border-2 border-[var(--color-bg-void)] opacity-80" />
                  ))}
                </div>
                <span className="text-sm text-white/40">Join developers building with Natstack</span>
              </div>
            </div>
            
            <div>
              <CodeBlock />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
