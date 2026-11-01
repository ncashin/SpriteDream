import { get, put, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  index: get('/'),
  editor: route('/:project', {
    index: get('/'),
    listFiles: get('/files'),
    agentChanges: get('/agent-changes'),
    getFile: get('/*filePath'),
    saveFile: put('/*filePath'),
  }),
})
