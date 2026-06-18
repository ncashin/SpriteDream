import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { ButtonLink } from "~/components/Button";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
  { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
];

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function Topbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isExplore = location.pathname === "/explore";
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="topbar fixed top-0 right-0 left-0 z-50 border-b border-white/[0.02] bg-[var(--color-bg-void)]/20 backdrop-blur-md">
      <div className="flex h-10 w-full items-center justify-between px-2 pl-4">
        <Link to="/" className="group flex items-center" onClick={() => setIsMenuOpen(false)}>
          <span className="font-semibold tracking-tight text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-text)]">
            gameide
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/explore"
            className={`hidden px-2.5 py-1 font-medium transition-all sm:inline-flex ${
              isExplore ? "text-[var(--color-accent)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            Explore
          </Link>
          <ButtonLink
            to="/"
            variant="surface"
            className="hidden sm:inline-flex"
          >
            Get Started
            <ArrowRight className="h-3 w-3" strokeWidth={2} />
          </ButtonLink>

          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-1.5 transition-colors sm:hidden ${
              isMenuOpen ? "text-[var(--color-text)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
            aria-label="Toggle menu"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="absolute top-10 right-0 left-0 border-b border-white/[0.02] bg-[var(--color-bg-void)]/95 backdrop-blur-md sm:hidden">
          <nav className="flex flex-col gap-1 py-4 pr-0 pl-4">
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className={`px-3 py-2 font-medium transition-all ${
                isHome ? "text-[var(--color-accent)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              Home
            </Link>
            <Link
              to="/explore"
              onClick={() => setIsMenuOpen(false)}
              className={`px-3 py-2 font-medium transition-all ${
                isExplore ? "text-[var(--color-accent)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              Explore
            </Link>
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className="px-3 py-2 font-medium text-[var(--color-muted)] transition-all hover:text-[var(--color-text)]"
            >
              Get Started
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="noise-overlay" />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <Topbar />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Oops!";
  let headline = "Something went wrong.";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    const routeErrorDetails =
      typeof error.data === "string"
        ? error.data
        : error.data && typeof error.data === "object" && "message" in error.data
          ? String(error.data.message)
          : undefined;

    title = error.status === 404 ? "404" : `${error.status}`;
    headline = error.status === 404 ? "Page not found." : "Request failed.";
    details = routeErrorDetails || error.statusText || details;
  } else if (error && error instanceof Error) {
    details = error.message || details;
    stack = import.meta.env.DEV ? error.stack : undefined;
  }

  return (
    <main className="grid-bg min-h-screen bg-[var(--color-bg-void)] text-[var(--color-text)]">
      <div className="spotlight pointer-events-none fixed inset-0" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
            <span className="block text-[var(--color-text)]">{title}</span>
            <span className="block pt-2 pl-1 text-lg font-medium text-[var(--color-muted)] sm:text-2xl">
              {headline}
            </span>
          </h1>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[var(--color-bg-elevated)] px-5 py-4 text-left shadow-[0_0_26px_rgba(90,110,255,0.22)]">
            <p className="font-semibold tracking-[0.2em] text-[var(--color-muted)] uppercase">
              Error Details
            </p>
            <p className="mt-2 break-words text-[var(--color-muted)]">{details}</p>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <Link
              to="/"
              className="inline-flex h-12 items-center justify-center border border-[#1e1e23] bg-[#121216] px-6 font-semibold text-[var(--color-text)] transition-all hover:border-[#37373b] hover:bg-[#1e1e23] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70 focus-visible:outline-none"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
      {stack ? (
        <pre className="relative z-10 mx-auto w-full max-w-4xl overflow-x-auto px-6 pb-16">
          <code className="font-mono text-[var(--color-muted)]">{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
