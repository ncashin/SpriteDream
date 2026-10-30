import { get, route } from 'remix/routes'

import { editorRoutes } from './actions/editor/routes.ts'
import { welcomeRoutes } from './actions/welcome/routes.ts'

export const routes = route({
  assets: get('/assets/*path'),
  welcome: welcomeRoutes,
  editor: route('/:project', editorRoutes),
})
