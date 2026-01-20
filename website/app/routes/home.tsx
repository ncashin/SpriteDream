import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
import { useState, useRef, useEffect } from "react";
import { Play, PlayIcon } from "@phosphor-icons/react";
import { db, games } from "../db";
import { asc } from "drizzle-orm";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "GameIDE" },
    { name: "description", content: "Build games without leaving VSCode" },
  ];
}

export async function loader({ }: Route.LoaderArgs) {
  const [firstGame] = await db
    .select({
      id: games.id,
    })
    .from(games)
    .orderBy(asc(games.createdAt))
    .limit(1);

  return {
    gameId: firstGame?.id || null,
  };
}

type TabId = "main.ts" | "main.scene";

interface Tab {
  id: TabId;
  label: string;
  icon: "ts" | "json";
}

interface CodeLine {
  num: number;
  content: React.ReactNode | string;
}

const CODE_LINES: CodeLine[] = [
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

const TABS: Tab[] = [
  { id: "main.scene", label: "main.scene", icon: "json" },
  { id: "main.ts", label: "main.ts", icon: "ts" },
];

function TabIcon({ icon }: { icon: Tab["icon"] }) {
  if (icon === "ts") {
    return <img src="/ts-logo-128.png" alt="TypeScript" className="w-4 h-4 brightness-110" />;
  }
  if (icon === "json") {
    return <img src="/json.png" alt="JSON" className="w-4 h-4 rounded-sm brightness-110" />;
  }
  return <i className="codicon codicon-file text-[var(--color-accent)]" />;
}

function CodeBlock({ gameId, containerRef }: { gameId: string | null; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [activeTab, setActiveTab] = useState<TabId>("main.scene");
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  return (
    <div 
      className="fixed top-14 right-4 md:right-10 min-w-0 flex flex-col h-[calc(100vh-6rem)] max-w-[calc(100vw-2rem)] md:max-w-none"
      style={{ width: width ? `${width}px` : undefined }}
    >
      <div className="flex z-20 pl-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pl-2.5 pr-4 py-2 text-xs font-mono transition-all rounded-t-lg ${activeTab === tab.id
                ? "bg-[var(--color-bg-base)] text-white/80 border border-white/[0.06] border-b-0 relative z-10"
                : "bg-[var(--color-bg-elevated)] text-white/40 hover:text-white/60 border border-white/[0.04] border-b-0"
              }`}
          >
            <TabIcon icon={tab.icon} />
            <span className="mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-[var(--color-bg-base)] shadow-2xl shadow-[var(--color-accent)]/10 flex-1 min-w-0 flex flex-col">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-[var(--color-accent)]/15 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[var(--color-ember)]/12 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
          {activeTab === "main.ts" ? (
            <div className="pt-5 pl-1 font-mono text-sm leading-relaxed h-full overflow-x-hidden">
              {CODE_LINES.map((line, i) => (
                <div key={i} className="flex items-center gap-4 hover:bg-white/[0.03] -mx-2 px-2 rounded min-w-0">
                  <span className="text-white/25 w-6 text-right text-xs select-none flex-shrink-0">{line.num}</span>
                  <span className="text-[#d4d4d4] min-w-0 whitespace-nowrap">{line.content || <>&nbsp;</>}</span>
                </div>
              ))}
            </div>
          ) : gameId ? (
            <iframe
              src={`/api/games/${gameId}/bundle`}
              className="w-full h-full border-0"
              title="Demo Game"
              allow="fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="pt-5 pl-1 font-mono text-sm leading-relaxed h-full flex items-center justify-center text-white/40">
              No games uploaded yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
}

function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="sidebar-section space-y-3">
      <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

interface FeatureItemProps {
  title: string;
  description: string;
}

function FeatureItem({ title, description }: FeatureItemProps) {
  return (
    <div className="sidebar-item space-y-1">
      <span className="text-base font-semibold text-white block leading-tight">{title}</span>
      <p className="text-sm font-normal text-white/50 leading-relaxed">{description}</p>
    </div>
  );
}

interface ToolLinkProps {
  href: string;
  icon: string;
  alt: string;
  label: string;
}

function ToolLink({ href, icon, alt, label }: ToolLinkProps) {
  const isSvg = icon.endsWith('.svg');
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 group cursor-pointer py-1.5 -mx-1.5 px-1.5 rounded-lg transition-colors hover:bg-white/5"
      >
        <img
          src={icon}
          alt={alt}
          className={`w-5 h-5 ${isSvg ? '' : 'rounded-sm'} brightness-110 flex-shrink-0`}
        />
        <span className="text-base font-medium text-white group-hover:text-white transition-colors">{label}</span>
      </a>
    </li>
  );
}

const TOOLS = [
  { href: "https://cursor.sh", icon: "/cursor.png", alt: "Cursor", label: "Cursor" },
  { href: "https://claude.ai", icon: "/claude.png", alt: "Claude", label: "Claude" },
  { href: "https://opencode.ai", icon: "/opencode.svg", alt: "OpenCode", label: "OpenCode" },
] as const;

export default function Home() {
  const { gameId } = useLoaderData<typeof loader>();
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="h-screen bg-[var(--color-bg-void)] grid-bg overflow-y-auto">
      <div className="spotlight fixed inset-0 pointer-events-none" />

      <section className="flex pb-12 pt-12  px-10">
        <div className="flex gap-8 items-start w-full">
          <div className="sidebar flex flex-col justify-between pb-4">
            <div className="space-y-7 max-w-full">
              <div className="flex flex-row h-min gap-3.5 w-full min-w-0 items-center">
                <img
                  src="/logo.svg"
                  alt="GameIDE Logo"
                  className="flex-shrink-0 h-[4rem] pt-0.5 max-h-full max-w-full object-contain"
                />
                <div className="flex flex-col items-start w-full min-w-0">
                  <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">GameIDE</h1>
                  <p className="text-base font-medium text-white/60 mt-1 leading-relaxed">The Engine that works where you do</p>
                </div>
              </div>

              <SidebarSection title="AI Native">
                <div className="space-y-4">
                  <FeatureItem
                    title="Created with agents in mind"
                    description="Provides first class tooling and prompting"
                  />
                  <FeatureItem
                    title="Designed to leverage existing training data"
                    description="Built with common formats and familiar patterns"
                  />
                </div>
              </SidebarSection>

              <SidebarSection title="Easy Distribution">
                <div className="space-y-4">
                  <FeatureItem
                    title="Upload from the Editor"
                    description="Share your work in seconds"
                  />
                  <FeatureItem
                    title="Portable Game Files"
                    description="Export standalone binaries that run anywhere"
                  />
                </div>
              </SidebarSection>

              <SidebarSection title="Made to work with the tools you love">
                <ul className="flex flex-col list-none">
                  {TOOLS.map((tool) => (
                    <ToolLink key={tool.href} {...tool} />
                  ))}
                </ul>
              </SidebarSection>
            </div>

            <div className="flex flex-col gap-2.5 pt-6 sidebar-divider">
              <a
                href="https://marketplace.visualstudio.com/items?itemName=gameide.gameide"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20 transition-all"
                aria-label="Download Extension"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                </svg>
                Download Extension
              </a>
              <Link
                to="/explore"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20 transition-all"
                aria-label="Play Games"
              >
                <PlayIcon className="w-3.5 h-3.5 flex-shrink-0" weight="fill" />
                Play Games
              </Link>
            </div>
          </div>

          <div ref={containerRef} className="min-w-0 flex-1 pt-8 hidden md:block">
            <div className="w-full h-[calc(100vh-8rem)]" aria-hidden="true" />
            <CodeBlock gameId={gameId} containerRef={containerRef} />
          </div>
        </div>
      </section>
    </div>
  );
}
