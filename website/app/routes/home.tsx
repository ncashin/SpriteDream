import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useState } from "react";
import { Play } from "@phosphor-icons/react";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "GameIDE" },
    { name: "description", content: "Build games without leaving VS Code. Write TypeScript, design visually, and ship instantly. The only game engine that lives inside your editor." },
  ];
}

function CodeBlock() {
  const [activeTab, setActiveTab] = useState<"player.ts" | "main.scene">("main.scene");

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
    { id: "main.scene" as const, label: "main.scene", icon: "scene" },
    { id: "player.ts" as const, label: "player.ts", icon: "ts" },
  ];

  return (
    <div className="relative pt-8 max-w-full min-w-0">
      {/* Tabs jutting out above */}
      <div className="absolute top-0 left-4 flex z-20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-mono transition-all rounded-t-lg ${activeTab === tab.id
              ? "bg-[var(--color-bg-base)] text-white/80 border border-white/[0.06] border-b-0 relative z-10"
              : "bg-[var(--color-bg-elevated)] text-white/40 hover:text-white/60 border border-white/[0.04] border-b-0"
              }`}
          >
            {tab.icon === "ts" ? (
              <i className="codicon codicon-file-code text-[#3178c6]" />
            ) : (
              <i className="codicon codicon-file text-[var(--color-accent)]" />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content area with glow contained within rounded window */}
      <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-[var(--color-bg-base)] shadow-2xl shadow-[var(--color-accent)]/10 h-[calc(100vh-12rem)] w-full max-w-full min-w-0">
        {/* Glow effects contained within the rounded window */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-[var(--color-accent)]/15 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[var(--color-ember)]/12 rounded-full blur-[80px] pointer-events-none" />
        
        {/* Content */}
        <div className="relative z-10 h-full">
          {activeTab === "player.ts" ? (
            <div className="pt-5 pl-1 font-mono text-sm leading-relaxed overflow-hidden h-full">
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
              className="w-full h-full border-0 max-w-full"
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

      <section className="relative h-full flex pt-20 w-full pl-10 pr-10 overflow-x-hidden">
        <div className="grid lg:grid-cols-[1.5fr_3.5fr] gap-8 items-start px-1 w-full max-w-full min-w-0">
          <div className="space-y-4 min-w-0">
            <div className="flex flex-col space-y-5 pt-2">
              {/* Logo with cyan-to-pink gradient backdrop */}
              <div className="flex items-center gap-6 mb-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-ember)] rounded-2xl scale-110" />
                  <img
                    src="/logo.svg"
                    alt="GameIDE Logo"
                    className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 drop-shadow-lg"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">GameIDE</span>
                  <div className="flex flex-col gap-1.5 pl-1">
                    <a
                      href="https://marketplace.visualstudio.com/items?itemName=gameide.gameide"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid grid-cols-[auto_1fr] items-center gap-2 text-lg text-white/70 hover:text-white transition-colors"
                    >
                      <div className="w-4 h-4 flex items-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                        </svg>
                      </div>
                      <span>Install Extension</span>
                    </a>

                    <Link
                      to="/explore"
                      className="grid grid-cols-[auto_1fr] items-center gap-2 text-lg text-white/70 hover:text-white transition-colors"
                    >
                      <div className="w-4 h-4 flex items-center">
                        <Play className="w-4 h-4" weight="fill" />
                      </div>
                      <span>Explore Games</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-3 -ml-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight text-white pl-0 pt-6">
                  Build games without leaving Cursor
                </h1>
                <p className="text-sm sm:text-base text-white/70 max-w-md leading-relaxed">
                  The only game engine that lives inside VS Code. Write TypeScript, design visually, and ship instantly.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">

            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-ember)] border-2 border-[var(--color-bg-void)] opacity-80" />
                ))}
              </div>
              <span className="text-xs text-white/60">Join developers building the future of game development</span>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden">
            <CodeBlock />
          </div>
        </div>
      </section>
    </div>
  );
}
