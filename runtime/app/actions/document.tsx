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
          <title>{title}</title>
          <style>{SIDEBAR_COLLAPSED_STYLE}</style>
          <script>{SIDEBAR_COLLAPSED_SCRIPT}</script>
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
            "--font-sans":
              '-apple-system, BlinkMacSystemFont, "avenir next", avenir, "segoe ui", "helvetica neue", "Adwaita Sans", Cantarell, Ubuntu, roboto, noto, helvetica, arial, sans-serif',
            "--font-serif":
              '"Iowan Old Style", "Apple Garamond", Baskerville, "Times New Roman", "Droid Serif", Times, "Source Serif Pro", serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            "--font-mono":
              'Menlo, Consolas, Monaco, "Adwaita Mono", "Liberation Mono", "Lucida Console", monospace',
            "--text-light": "#d4d4d4",
            fontFamily: "var(--font-sans)",
          })}
        >
          {children}
        </body>
      </html>
    )
  }
}

const SIDEBAR_COLLAPSED_STYLE = `
html[data-sidebar-collapsed] [data-sidebar],
html[data-sidebar-collapsed] [data-sidebar-bar] {
  transition: none !important;
}
html[data-sidebar-collapsed] [data-sidebar] {
  width: 0 !important;
}
html[data-sidebar-collapsed] [data-sidebar-bar] {
  left: 0 !important;
}
`

const SIDEBAR_COLLAPSED_SCRIPT = `
try {
  if (localStorage.getItem("sidebar-collapsed") === "1") {
    document.documentElement.dataset.sidebarCollapsed = "";
  }
} catch (e) {}
`

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
