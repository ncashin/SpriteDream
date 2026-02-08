import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Play, PlayIcon } from "@phosphor-icons/react";
import { db, games } from "../db";
import { asc } from "drizzle-orm";
import React from "react";
import runtimeMainTsSource from "../runtime/main.ts?raw";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "GameIDE" },
    { name: "description", content: "Build games without leaving VSCode" },
  ];
}

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: "/api/runtime/", as: "document" },
];

const CODE_KEYWORDS = [
  "import",
  "export",
  "from",
  "function",
  "const",
  "let",
  "var",
  "if",
  "else",
  "return",
  "class",
  "extends",
  "type",
  "interface",
  "as",
  "async",
  "await",
];

const CODE_TYPES = ["string", "number", "boolean", "void", "null", "undefined"];

type CodeToken = {
  text: string;
  className?: string;
};

function tokenizePlainText(text: string): CodeToken[] {
  const keywordPattern = CODE_KEYWORDS.join("|");
  const typePattern = CODE_TYPES.join("|");
  const tokenRegex = new RegExp(
    `\\b(${keywordPattern})\\b|\\b(${typePattern})\\b|\\b(\\d+)\\b`,
    "g"
  );
  const tokens: CodeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      tokens.push({ text: match[1], className: "text-[#c586c0]" });
    } else if (match[2]) {
      tokens.push({ text: match[2], className: "text-[#4ec9b0]" });
    } else if (match[3]) {
      tokens.push({ text: match[3], className: "text-[#b5cea8]" });
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens;
}

function tokenizeWithBaseColor(text: string, baseClassName: string): CodeToken[] {
  const keywordPattern = CODE_KEYWORDS.join("|");
  const typePattern = CODE_TYPES.join("|");
  const tokenRegex = new RegExp(
    `\\b(${keywordPattern})\\b|\\b(${typePattern})\\b|\\b(\\d+)\\b`,
    "g"
  );
  const tokens: CodeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        className: baseClassName,
      });
    }
    if (match[1]) {
      tokens.push({ text: match[1], className: "text-[#c586c0]" });
    } else if (match[2]) {
      tokens.push({ text: match[2], className: "text-[#4ec9b0]" });
    } else if (match[3]) {
      tokens.push({ text: match[3], className: "text-[#b5cea8]" });
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      text: text.slice(lastIndex),
      className: baseClassName,
    });
  }

  return tokens;
}

function tokenizeLine(line: string): CodeToken[] {
  if (!line) return [{ text: "" }];

  const tokens: CodeToken[] = [];
  let current = "";
  let inString: "'" | '"' | "`" | null = null;
  let isEscaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inString) {
      current += char;
      if (char === "\\" && !isEscaped) {
        isEscaped = true;
        continue;
      }
      if (char === inString && !isEscaped) {
        tokens.push({ text: current, className: "text-[#ce9178]" });
        current = "";
        inString = null;
      }
      isEscaped = false;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      if (current) {
        tokens.push(...tokenizePlainText(current));
        current = "";
      }
      tokens.push(...tokenizeWithBaseColor(line.slice(i), "text-[#6a9955]"));
      return tokens;
    }

    if (char === "'" || char === '"' || char === "`") {
      if (current) {
        tokens.push(...tokenizePlainText(current));
        current = "";
      }
      inString = char;
      current = char;
      continue;
    }

    current += char;
  }

  if (current) {
    if (inString) {
      tokens.push(...tokenizeWithBaseColor(current, "text-[#ce9178]"));
    } else {
      tokens.push(...tokenizePlainText(current));
    }
  }

  return tokens;
}

function parseTypeScriptCode(code: string): CodeLine[] {
  return code.split("\n").map((line, index) => ({
    num: index + 1,
    tokens: tokenizeLine(line),
  }));
}

export async function loader({ }: Route.LoaderArgs) {
  const [firstGame] = await db
    .select({
      id: games.id,
    })
    .from(games)
    .orderBy(asc(games.createdAt))
    .limit(1);

  const mainTsLines = parseTypeScriptCode(runtimeMainTsSource) as CodeLine[];

  return {
    gameId: firstGame?.id || null,
    mainTsLines: mainTsLines as any as CodeLine[],
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
  content?: React.ReactNode | string;
  tokens?: CodeToken[];
}

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

function CodeBlock({ gameId, mainTsLines }: { gameId: string | null; mainTsLines: CodeLine[] }) {
  const [activeTab, setActiveTab] = useState<TabId>("main.scene");
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(new Set());
  const runtimeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeVisible, setRuntimeVisible] = useState(false);
  const isSceneActive = activeTab === "main.scene";
  const isMainTsActive = activeTab === "main.ts";
  const isRuntimeVisible = isSceneActive && runtimeVisible;
  const runtimeRevealDelayMs = 350;

  const postRuntimeCommand = (command: string, data?: Record<string, unknown>) => {
    const targetWindow = runtimeIframeRef.current?.contentWindow;
    if (!targetWindow) return;
    targetWindow.postMessage({ command, ...data }, "*");
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== runtimeIframeRef.current?.contentWindow) return;
      if (event.data?.command === "runtimeReady") {
        setRuntimeReady(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!runtimeReady) return;
    // Default to editor-ready (not running) so editor interactions work.
    postRuntimeCommand("setRunning", { running: false });

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }
    revealTimerRef.current = setTimeout(() => {
      setRuntimeVisible(true);
    }, runtimeRevealDelayMs);
  }, [runtimeReady]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  const toggleLineHighlight = (lineNum: number) => {
    setHighlightedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineNum)) {
        next.delete(lineNum);
      } else {
        next.add(lineNum);
      }
      return next;
    });
  };

  return (
    <div 
      className="fixed top-14 right-2 md:right-4 w-[calc(100vw-1rem)] md:w-[calc(100vw-var(--sidebar-width)-5rem)] flex flex-col h-[calc(100vh-6rem)] max-w-[calc(100vw-1rem)] md:max-w-none"
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

        <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
          <div
            className={`absolute inset-0 z-10 h-full pt-5 pl-1 font-mono text-sm leading-6 overflow-y-auto overflow-x-auto overscroll-contain transition-opacity duration-200 ${
              isMainTsActive ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={!isMainTsActive}
          >
            {mainTsLines.map((line, i) => {
              const isHighlighted = highlightedLines.has(line.num);
              return (
                <div 
                  key={i} 
                  onClick={() => toggleLineHighlight(line.num)}
                  className={`flex items-center gap-4 hover:bg-white/[0.03] -mx-2 px-2 rounded min-w-0 cursor-pointer transition-colors leading-6 ${
                    isHighlighted ? "bg-[var(--color-accent)]/20 border-l-2 border-[var(--color-accent)]" : ""
                  }`}
                >
                  <span className="text-white/25 w-6 text-right text-xs select-none flex-shrink-0">{line.num}</span>
                  <span className="text-[#d4d4d4] min-w-0 whitespace-pre">
                    {line.tokens
                      ? line.tokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={token.className}>
                          {token.text}
                        </span>
                      ))
                      : line.content || <>&nbsp;</>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="absolute inset-0 z-0">
            <iframe
              src="/api/runtime/"
              className={`w-full h-full border-0 transition-opacity duration-300 ${
                isRuntimeVisible ? "opacity-100" : "opacity-0"
              } ${isSceneActive ? "pointer-events-auto" : "pointer-events-none"}`}
              title="GameIDE Runtime"
              allow="fullscreen"
              allowFullScreen
              loading="eager"
              style={{ backgroundColor: "var(--color-bg-base)" }}
              ref={runtimeIframeRef}
              onLoad={() => {
                setRuntimeReady(false);
                setRuntimeVisible(false);
                if (revealTimerRef.current) {
                  clearTimeout(revealTimerRef.current);
                }
                postRuntimeCommand("ping");
              }}
            />
            {!runtimeVisible && (
              <div
                className={`absolute inset-0 flex items-center justify-center text-xs font-mono text-white/60 bg-[var(--color-bg-base)] transition-opacity duration-200 ${
                  isSceneActive ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-hidden={!isSceneActive}
              >
                Loading runtime…
              </div>
            )}
            {highlightedLines.size > 0 && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {Array.from(highlightedLines).map((lineNum) => {
                  const lineIndex = mainTsLines.findIndex(l => l.num === lineNum);
                  if (lineIndex === -1) return null;
                  
                  // Calculate position based on line number (approximate)
                  const lineHeight = 24; // Approximate line height in pixels
                  const topOffset = 20; // Padding top
                  const yPosition = topOffset + (lineIndex * lineHeight);
                  
                  return (
                    <div
                      key={lineNum}
                      className="absolute left-0 right-0 border-l-4 border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                      style={{
                        top: `${yPosition}px`,
                        height: `${lineHeight}px`,
                      }}
                    >
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--color-accent)] bg-[var(--color-bg-base)] px-1.5 py-0.5 rounded border border-[var(--color-accent)]/30">
                        Line {lineNum}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
    <div className="sidebar-section space-y-5">
      <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider mb-4">{title}</h3>
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
    <div className="sidebar-item space-y-2">
      <span className="text-base font-semibold text-white block leading-tight">{title}</span>
      <p className="text-base font-medium text-white/50 leading-relaxed">{description}</p>
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
  const isClaude = label === "Claude Code";
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center gap-1 group cursor-pointer p-0"
      >
        <img
          src={icon}
          alt={alt}
          className={`w-10 h-10 aspect-square object-contain ${isSvg ? '' : 'rounded-sm'} brightness-110 flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${isClaude ? 'bg-[#f5f0e6] p-1 rounded' : ''}`}
        />
        <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">{label}</span>
      </a>
    </li>
  );
}

const TOOLS = [
  { href: "https://cursor.sh", icon: "/cursor.png", alt: "Cursor", label: "Cursor" },
  { href: "https://claude.ai", icon: "/claude.png", alt: "Claude Code", label: "Claude Code" },
  { href: "https://openai.com/codex", icon: "/codex.png", alt: "Codex", label: "Codex" },
  { href: "https://opencode.ai", icon: "/opencode.svg", alt: "OpenCode", label: "OpenCode" },
] as const;

export default function Home() {
  const { gameId, mainTsLines } = useLoaderData<typeof loader>();

  return (
    <div className="h-screen bg-[var(--color-bg-void)] grid-bg overflow-y-auto">
      <div className="spotlight fixed inset-0 pointer-events-none" />

      <section className="flex pb-12 pt-12 px-10 h-[calc(100vh-3.5rem)] h-max">
        <div className="flex gap-8 items-start w-full h-full">
          <div className="sidebar flex flex-col justify-between pb-14 h-max">
            <div className="space-y-7 max-w-full">
              <div className="inline-flex flex-row h-min gap-3.5 w-fit max-w-full min-w-0 items-center">
                <img
                  src="/logo.svg"
                  alt="GameIDE Logo"
                  className="flex-shrink-0 h-[4rem] pt-0.5 max-h-full max-w-full object-contain"
                />
                <div className="flex flex-col items-start w-full min-w-0">
                  <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">GameIDE</h1>
                  <p className="text-lg font-medium text-white/60 mt-1 leading-relaxed">The Engine that works where you do</p>
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
                <div className="w-full min-w-0 pl-0.5 pt-0.5">
                  <div className="inline-flex w-fit max-w-full">
                    <ul className="flex flex-row flex-wrap justify-start gap-6 list-none w-fit max-w-full">
                      {TOOLS.map((tool) => (
                        <ToolLink key={tool.href} {...tool} />
                      ))}
                    </ul>
                  </div>
                </div>
              </SidebarSection>
            </div>

            <div className="flex flex-col gap-2.5 pt-6 sidebar-divider">
              <Link
                to="/coming-soon"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#1e1e23] bg-[#121216] text-white/90 hover:bg-[#1e1e23] hover:border-[#37373b] transition-all"
                aria-label="Download Extension"
              >
                <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                  </svg>
                </span>
                Download Extension
              </Link>
              <Link
                to="/coming-soon"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#1e1e23] bg-[#121216] text-white/90 hover:bg-[#1e1e23] hover:border-[#37373b] transition-all"
                aria-label="Play Games"
              >
                <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">
                  <PlayIcon className="w-3.5 h-3.5" weight="fill" />
                </span>
                Play Games
              </Link>
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-8 hidden md:block relative h-full">
            {/* @ts-ignore - Type inference issue with CodeLine content type */}
            <CodeBlock gameId={gameId} mainTsLines={mainTsLines} />
          </div>
        </div>
      </section>
    </div>
  );
}
