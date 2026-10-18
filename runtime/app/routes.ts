import { get, put, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  mario: get('/mario'),
  game: route('/game', {
    index: get('/'),
    panel: get('/panel'),
  }),
  editor: route('/editor', {
    scenes: get('/scenes'),
    scene: get('/scenes/:name'),
    saveScene: put('/scenes/:name'),
  }),
})
