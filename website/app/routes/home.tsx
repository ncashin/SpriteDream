import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useState } from "react";
import { Play } from "@phosphor-icons/react";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "GameIDE" },
    { name: "description", content: "Build games without leaving VSCode" },
  ];
}

function CodeBlock() {
  const [activeTab, setActiveTab] = useState<"main.ts" | "main.scene">("main.scene");

  const playerLines = [
    { num: 1, content: <><span className="text-[#c586c0]">import</span> {"{"} <span className="text-[#4ec9b0]">Entity</span>, <span className="text-[#4ec9b0]">Component</span> {"}"} <span className="text-[#c586c0]">from</span> <span className="text-[#ce9178]">"gameide"</span></> },
    { num: 2, content: "" },
    { num: 3, content: <><span className="text-[#c586c0]">export class</span> <span className="text-[#4ec9b0]">Player</span> <span className="text-[#c586c0]">extends</span> <span className="text-[#4ec9b0]">Component</span> {"{"}</> },
    { num: 4, content: <>&nbsp;&nbsp;<span className="text-[#9cdcfe]">speed</span> = <span className="text-[#b5cea8]">200</span></> },
    { num: 5, content: "" },
    { num: 6, content: <>&nbsp;&nbsp;<span className="text-[#dcdcaa]">update</span>(<span className="text-[#9cdcfe]">dt</span>: <span className="text-[#4ec9b0]">number</span>) {"{"}</> },
    { num: 7, content: <>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#c586c0]">if</span> (<span className="text-[#9cdcfe]">Input</span>.<span className="text-[#dcdcaa]">isKeyDown</span>(<span className="text-[#ce9178]">"ArrowRight"</span>)) {"{"}</> },
    { num: 8, content: <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#c586c0]">this</span>.<span className="text-[#9cdcfe]">entity</span>.<span className="text-[#9cdcfe]">x</span> += <span className="text-[#c586c0]">this</span>.<span className="text-[#9cdcfe]">speed</span> * <span className="text-[#9cdcfe]">dt</span></> },
    { num: 9, content: <>&nbsp;&nbsp;&nbsp;&nbsp;{"}"}</> },
    { num: 10, content: <>&nbsp;&nbsp;{"}"}</> },
    { num: 11, content: "}" },
  ];

  const tabs = [
    { id: "main.scene" as const, label: "main.scene", icon: "json" },
    { id: "main.ts" as const, label: "main.ts", icon: "ts" },
  ];

  return (
    <div className="relative pt-8 min-w-0 flex-1">
      {/* Tabs jutting out above */}
      <div className="absolute top-0 left-4 flex z-20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pl-2.5 pr-4 py-2 text-xs font-mono transition-all rounded-t-lg ${activeTab === tab.id
              ? "bg-[var(--color-bg-base)] text-white/80 border border-white/[0.06] border-b-0 relative z-10"
              : "bg-[var(--color-bg-elevated)] text-white/40 hover:text-white/60 border border-white/[0.04] border-b-0"
              }`}
          >
            {tab.icon === "ts" ? (
              <img src="/ts-logo-128.png" alt="TypeScript" className="w-4 h-4 brightness-110" />
            ) : tab.icon === "json" ? (
              <img src="/json.png" alt="JSON" className="w-4 h-4 rounded-sm brightness-110" />) : (
              <i className="codicon codicon-file text-[var(--color-accent)]" />
            )}
            <span className="mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main content area with glow contained within rounded window */}
      <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-[var(--color-bg-base)] shadow-2xl shadow-[var(--color-accent)]/10 h-[calc(100vh-12rem)] w-full min-w-0 flex-1 flex flex-col">
        {/* Glow effects contained within the rounded window */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-[var(--color-accent)]/15 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[var(--color-ember)]/12 rounded-full blur-[80px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 h-full overflow-y-auto">
          {activeTab === "main.ts" ? (
            <div className="pt-5 pl-1 font-mono text-sm leading-relaxed h-full">
              {playerLines.map((line, i) => (
                <div key={i} className="flex items-center gap-4 hover:bg-white/[0.03] -mx-2 px-2 rounded min-w-0">
                  <span className="text-white/25 w-6 text-right text-xs select-none flex-shrink-0">{line.num}</span>
                  <span className="text-[#d4d4d4] min-w-0 overflow-hidden">{line.content || <>&nbsp;</>}</span>
                </div>
              ))}
            </div>
          ) : (
            <iframe
              src="/api/games/1/bundle"
              className="w-full h-full border-0"
              title="Demo Game"
              allow="fullscreen"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="h-screen bg-[var(--color-bg-void)] grid-bg overflow-hidden">
      <div className="spotlight fixed inset-0 pointer-events-none" />

      <section className="relative h-full flex pt-20 w-full pl-10 pr-10 overflow-hidden">
        <div className="flex flex-row gap-8 items-start px-1 w-full min-w-0 h-full">
          <div className="flex flex-col justify-between h-[calc(100vh-10rem)] min-w-0 pt-8 flex-shrink-0 w-[280px]">
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">GameIDE</h1>
                <p className="text-sm font-medium text-white/60 mt-1">The Engine that works where you do</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-2">AI Native</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-bold text-white/90">Created with agents in mind</span>
                    <p className="text-sm font-medium text-white/60 mt-0.5">Provides tooling and instructions for </p>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white/90">Designed to leverage existing training data</span>
                    <p className="text-sm font-medium text-white/60 mt-0.5">Built with TypeScript, JSON and familiar patterns</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-2">Easy Distribution</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-bold text-white/90">Upload from the Editor</span>
                    <p className="text-sm font-medium text-white/60 mt-0.5">Share your work in seconds</p>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white/90">Portable Game Files</span>
                    <p className="text-sm font-medium text-white/60 mt-0.5">Export standalone binaries that run anywhere</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-3">Built to work with the tools you love</h3>
                <ul className="flex flex-col gap-2.5 list-none">
                  <li className="flex items-center gap-3 group">
                    <img src="/cursor.png" alt="Cursor" className="w-5 h-5 rounded-sm brightness-110 transition-transform group-hover:scale-110" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Cursor</span>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <img src="/claude.png" alt="Claude" className="w-5 h-5 rounded-sm brightness-110 transition-transform group-hover:scale-110" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Claude</span>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <img src="/opencode.svg" alt="OpenCode" className="w-5 h-5 brightness-110 transition-transform group-hover:scale-110" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">OpenCode</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href="https://marketplace.visualstudio.com/items?itemName=gameide.gameide"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-white/10 text-white/90 hover:bg-white/5 transition"
                aria-label="Download Extension"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                </svg>
                Download Extension
              </a>
              <Link
                to="/explore"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-white/10 text-white/90 hover:bg-white/5 transition"
                aria-label="Play Games"
              >
                <Play className="w-3.5 h-3.5" weight="fill" />
                Play Games
              </Link>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden flex-1">
            <CodeBlock />
          </div>
        </div>
      </section>
    </div>
  );
}
