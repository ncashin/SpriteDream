import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'
import { Editor } from './editor/editor.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    home(context) {
      return context.render(
        <Document>
          <Editor />
        </Document>,
      )
    },
    mario(context) {
      return context.render(
        <Document title="Mario">
          <img src="/mario.png" alt="Mario" />
        </Document>,
      )
    },
  },
})
