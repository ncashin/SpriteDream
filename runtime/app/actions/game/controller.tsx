import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { Document } from '../document.tsx'
import { Game } from './game.tsx'

export default createController(routes.game, {
  actions: {
    index(context) {
      let content = <Game />
      let isFrameRequest = context.request.headers.get('X-Remix-Frame') === 'true'
      if (isFrameRequest) return context.render(content)

      return context.render(
        <Document title="Game">
          {content}
        </Document>,
      )
    },
  },
})
