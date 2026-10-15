import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  mario: get('/mario'),
  game: route('/game', {
    index: get('/'),
    panel: get('/panel'),
  }),
})
