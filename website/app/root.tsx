import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
  useLocation,
} from "react-router";
import { useState } from "react";

import type { Route } from "./+types/root";
import "./app.css";
import "@vscode/codicons/dist/codicon.css";

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

function Topbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isExplore = location.pathname === "/explore";
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 topbar bg-[var(--color-bg-void)]/20 backdrop-blur-md border-b border-white/[0.02]">
      <div className="w-full px-6 h-10 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center group" onClick={() => setIsMenuOpen(false)}>
          <span className="text-sm font-semibold tracking-tight text-white/80 group-hover:text-white transition-colors">
            gameide
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-0.5">
          <Link
            to="/"
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${isHome
                ? 'text-[var(--color-accent)]'
                : 'text-white/50 hover:text-white/80'
              }`}
          >
            Home
          </Link>
          <Link
            to="/explore"
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${isExplore
                ? 'text-[var(--color-accent)]'
                : 'text-white/50 hover:text-white/80'
              }`}
          >
            Explore
          </Link>
          <a
            href="https://github.com/gameide"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded text-xs font-medium text-white/50 hover:text-white/80 transition-all"
          >
            Docs
          </a>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <a
            href="https://marketplace.visualstudio.com/items?itemName=gameide.gameide"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-white/60 hover:text-white/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
            </svg>
            Download
          </a>

          {/* Mobile menu button */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="sm:hidden p-1.5 rounded text-white/50 hover:text-white/80 transition-colors"
            aria-label="Toggle menu"
          >
            <i className={`codicon ${isMenuOpen ? 'codicon-close' : 'codicon-menu'} w-5 h-5`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="sm:hidden absolute top-10 left-0 right-0 bg-[var(--color-bg-void)]/95 backdrop-blur-md border-b border-white/[0.02]">
          <nav className="flex flex-col p-4 gap-1">
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className={`px-3 py-2 rounded text-sm font-medium transition-all ${isHome
                  ? 'text-[var(--color-accent)] bg-white/5'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
            >
              Home
            </Link>
            <Link
              to="/explore"
              onClick={() => setIsMenuOpen(false)}
              className={`px-3 py-2 rounded text-sm font-medium transition-all ${isExplore
                  ? 'text-[var(--color-accent)] bg-white/5'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
            >
              Explore
            </Link>
            <a
              href="https://github.com/gameide"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMenuOpen(false)}
              className="px-3 py-2 rounded text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all"
            >
              Docs
            </a>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=gameide.gameide"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMenuOpen(false)}
              className="px-3 py-2 rounded text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
              </svg>
              Download Extension
            </a>
          </nav>
        </div>
      )}
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
        <Topbar />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-8xl font-black text-gradient mb-4">{message}</h1>
        <p className="text-xl text-white/50 mb-8">{details}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] text-black font-semibold rounded-lg btn-lift transition-all"
        >
          Go Home
        </Link>
      </div>
      {stack && (
        <pre className="w-full max-w-4xl p-6 overflow-x-auto mt-12 bg-[var(--color-bg-elevated)] rounded-xl border border-white/5">
          <code className="text-sm text-white/60 font-mono">{stack}</code>
        </pre>
      )}
    </main>
  );
}
