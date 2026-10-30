import { get, route } from 'remix/routes'

import { editorRoutes } from './actions/editor/routes.ts'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  editor: route('/editor', editorRoutes),
})
