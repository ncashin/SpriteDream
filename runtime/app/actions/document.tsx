import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { scriptEntry } from '../assets.ts'

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
}

const DEFAULT_TITLE = readAppDisplayName('SpriteDream')

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE } = handle.props
    let { href, importMap, preloads } = scriptEntry

    return (
      <html
        lang="en"
        mix={css({
          colorScheme: "dark",
        })}
      >
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="dark" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,420..560&display=swap"
            rel="stylesheet"
          />
          <title>{title}</title>
          <style>{READY_STYLE}</style>
          {head}
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body
          mix={css({
            margin: 0,
            background: "#121213",
            color: "#ededed",
            fontSize: "13px",
            lineHeight: 1.35,
            fontWeight: 450,
            letterSpacing: "-0.011em",
            WebkitFontSmoothing: "antialiased",
            "--font-sans":
              'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            "--font-serif":
              '"Iowan Old Style", "Apple Garamond", Baskerville, "Times New Roman", "Droid Serif", Times, "Source Serif Pro", serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            "--font-mono":
              'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            "--text": "#ededed",
            "--text-muted": "#8f8f8f",
            "--text-light": "#ededed",
            "--hover": "#ffffff12",
            "--selected": "#ffffff1a",
            "--line": "#ffffff14",
            "--menu": "#19191b",
            fontFamily: "var(--font-sans)",
          })}
        >
          {children}
        </body>
      </html>
    )
  }
}

const READY_STYLE = `
html:not([data-ready]) {
  opacity: 0;
}
`

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
