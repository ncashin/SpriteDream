import './style.css'
import { readFile, writeFile } from './fileUtilities'

const app = document.querySelector<HTMLDivElement>('#app')!
let currentFilePath: string | null = null
let textarea: HTMLTextAreaElement | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function displaySceneContent(content: string, filePath: string) {
  currentFilePath = filePath
  
  if (textarea) {
    textarea.value = content
    return
  }
  
  textarea = document.createElement('textarea')
  textarea.value = content
  textarea.style.width = '100%'
  textarea.style.height = '100vh'
  textarea.style.border = 'none'
  textarea.style.outline = 'none'
  textarea.style.padding = '0'
  textarea.style.margin = '0'
  textarea.style.fontFamily = 'monospace'
  textarea.style.fontSize = '14px'
  textarea.style.resize = 'none'
  
  textarea.addEventListener('input', () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
    
    saveTimeout = setTimeout(async () => {
      if (currentFilePath && textarea) {
        try {
          await writeFile(currentFilePath, textarea.value)
        } catch (error) {
          console.error('Failed to save file:', error)
        }
      }
    }, 500)
  })
  
  app.innerHTML = ''
  app.appendChild(textarea)
}

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.data.command === 'openScene' && event.data.path) {
    try {
      const content = await readFile(event.data.path)
      displaySceneContent(content, event.data.path)
    } catch (error: any) {
      app.innerHTML = error.message || 'Failed to load scene file'
    }
  }
})

app.innerHTML = ''
