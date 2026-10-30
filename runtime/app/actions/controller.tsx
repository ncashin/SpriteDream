import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'
import { Welcome } from './welcome/welcome.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    index(context) {
      return context.render(
        <Document title="SpriteDream">
          <Welcome />
        </Document>,
      )
    },
  },
})
