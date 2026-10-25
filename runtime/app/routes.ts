import { get, put, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  mario: get('/mario'),
  game: route('/game', {
    index: get('/'),
    panel: get('/panel'),
  }),
  // Scene routes stay here for hrefs. They are temporarily not mounted.
  editor: route('/editor', {
    scenes: get('/scenes'),
    scene: get('/scenes/:name'),
    saveScene: put('/scenes/:name'),
  }),
})
