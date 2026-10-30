import { get, put, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  index: get('/'),
  editor: route('/:project', {
    index: get('/'),
    listFiles: get('/files'),
    getFile: get('/*filePath'),
    saveFile: put('/*filePath'),
  }),
})
