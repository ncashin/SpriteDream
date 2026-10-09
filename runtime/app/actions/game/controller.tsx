import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { Document } from '../document.tsx'
import { Game } from './game.tsx'

export default createController(routes.game, {
  actions: {
    index(context) {
      const content = <Game />
      const isFrameRequest = context.request.headers.get('X-Remix-Frame') === 'true'
      if (isFrameRequest) return context.render(content)

      return context.render(
        <Document title="Game">
          {content}
        </Document>,
      )
    },
  },
})
