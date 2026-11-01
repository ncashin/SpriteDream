import { createRouter, type MiddlewareContext } from 'remix/router'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import controller from './actions/controller.tsx'
import editorController from './actions/editor/electron-controller.tsx'
import { assets } from './assets.ts'
import { loadDatabase } from './middleware/database.ts'
import { routes } from './routes.ts'

const databaseMiddleware = loadDatabase()
const renderMiddleware = render({ assets })
type AppContext = MiddlewareContext<[typeof databaseMiddleware, typeof renderMiddleware]>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({
  middleware: [staticFiles('./public', { index: false }), databaseMiddleware, renderMiddleware],
})

router.map(routes, controller)
router.map(routes.editor, editorController)
