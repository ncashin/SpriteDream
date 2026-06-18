import { useState } from "react";
import { Check, Copy } from "lucide-react";

import type { Route } from "./+types/home";

const INSTALL_COMMAND = "npm install -g gameide && gameide create";

const TOOLS = [
  { href: "https://cursor.sh", icon: "/cursor.png", alt: "Cursor", label: "Cursor" },
  { href: "https://claude.ai", icon: "/claude.png", alt: "Claude Code", label: "Claude Code" },
  { href: "https://openai.com/codex", icon: "/codex.png", alt: "Codex", label: "Codex" },
  { href: "https://opencode.ai", icon: "/opencode.svg", alt: "OpenCode", label: "OpenCode" },
] as const;

function ToolLink({
  href,
  icon,
  alt,
  label,
}: {
  href: string;
  icon: string;
  alt: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group block shrink-0 cursor-pointer"
    >
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-105">
          <img
            src={icon}
            alt={alt}
            className="h-full w-full object-contain brightness-110"
          />
        </span>
    </a>
  );
}

function AppPreview() {
  return (
    <div className="fixed top-14 right-2 flex h-[calc(100vh-6rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] items-center justify-center md:right-4 md:w-[calc(100vw-var(--sidebar-width)-5rem)] md:max-w-none">
      <img
        src="/engineimage.png"
        alt="GameIDE scene editor with physics simulation"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

function InstallCommand() {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    await navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative inline-flex w-fit max-w-full border border-[#1e1e23] bg-[#121216] py-1 pr-8 pl-3">
      <code className="min-w-0 select-text overflow-x-auto font-mono text-[var(--color-text)]">
        {INSTALL_COMMAND}
      </code>
      <button
        type="button"
        onClick={copyCommand}
        aria-label={copied ? "Copied install command" : "Copy install command"}
        className="absolute top-1/2 right-0 flex -translate-y-1/2 cursor-pointer items-center px-2 text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] focus-visible:ring-1 focus-visible:ring-[var(--color-border)] focus-visible:outline-none"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GameIDE" },
    {
      name: "description",
      content: "Build games without leaving VSCode",
    },
  ];
}

export default function Home() {
  return (
    <div className="grid-bg min-h-screen bg-[var(--color-bg-void)]">
      <div className="spotlight pointer-events-none fixed inset-0" />

      <section className="flex h-[calc(100vh-3.5rem)] h-max px-10 pt-12 pb-12">
        <div className="flex h-full w-full items-start gap-8">
          <div className="sidebar flex h-max flex-col pb-14">
            <div className="max-w-full space-y-7">
              <div className="inline-flex h-min w-fit max-w-full min-w-0 flex-row items-center gap-3.5">
                <img
                  src="/logo.svg"
                  alt="GameIDE Logo"
                  className="h-[4rem] max-h-full max-w-full flex-shrink-0 object-contain pt-0.5"
                />
                <div className="flex w-full min-w-0 flex-col items-start">
                  <h1 className="text-3xl leading-tight font-bold tracking-tight text-[var(--color-text)]">
                    GameIDE
                  </h1>
                  <p className="mt-1 text-lg leading-relaxed font-medium text-[var(--color-muted)]">
                    The Engine that works where you do
                  </p>
                </div>
              </div>

              <div className="sidebar-item space-y-2">
                <span className="block font-medium text-[var(--color-text)]">
                  Made to work with the tools you love
                </span>
                <div className="flex flex-row flex-nowrap items-center gap-2">
                  {TOOLS.map((tool) => (
                    <ToolLink key={tool.href} {...tool} />
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <InstallCommand />
              </div>
            </div>
          </div>

          <div className="relative hidden h-full min-w-0 flex-1 pt-8 md:block">
            <AppPreview />
          </div>
        </div>
      </section>
    </div>
  );
}
