import { setEditorEnabled, setUpdateEnabled, isUpdateEnabled } from '../gameloop'
import { setPersistenceEnabled, saveSceneSnapshot, restoreSceneFromSnapshot, getScene } from '../scene/scene'

export function initializeEditor() {
  const editor = document.querySelector<HTMLDivElement>('#editor')
  if (!editor) {
    console.error('Could not find #editor element')
    return
  }

  // Create run button
  const runButton = document.createElement('button')
  runButton.style.padding = '0.25rem 0.75rem'
  runButton.style.fontSize = '0.8125rem'
  runButton.style.fontWeight = '400'
  runButton.style.borderRadius = '2px'
  runButton.style.border = 'none'
  runButton.style.cursor = 'pointer'
  runButton.style.transition = 'background-color 0.1s ease-out'
  runButton.style.backgroundColor = 'transparent'
  runButton.style.color = 'var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))'
  runButton.style.fontFamily = 'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)'
  runButton.style.outline = 'none'
  runButton.style.boxSizing = 'border-box'
  runButton.style.display = 'inline-flex'
  runButton.style.alignItems = 'center'
  runButton.style.justifyContent = 'center'
  runButton.style.minHeight = '22px'
  runButton.style.lineHeight = '1.4em'
  
  const updateButtonText = () => {
    runButton.textContent = isUpdateEnabled() ? 'Stop' : 'Run'
  }
  
  updateButtonText()
  
  runButton.addEventListener('mouseenter', () => {
    runButton.style.backgroundColor = 'var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))'
  })
  
  runButton.addEventListener('mouseleave', () => {
    runButton.style.backgroundColor = 'transparent'
  })
  
  runButton.addEventListener('mousedown', () => {
    runButton.style.backgroundColor = 'var(--vscode-button-activeBackground, rgba(255, 255, 255, 0.15))'
  })
  
  runButton.addEventListener('mouseup', () => {
    runButton.style.backgroundColor = 'var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))'
  })
  
  runButton.addEventListener('focus', () => {
    runButton.style.outline = '1px solid var(--vscode-focusBorder, #007acc)'
    runButton.style.outlineOffset = '-1px'
  })
  
  runButton.addEventListener('blur', () => {
    runButton.style.outline = 'none'
  })
  
  let sceneSnapshot: any = null

  runButton.addEventListener('click', async () => {
    const isRunning = isUpdateEnabled()
    if (isRunning) {
      setEditorEnabled(true)
      setUpdateEnabled(false)
      setPersistenceEnabled(true)
      
      if (sceneSnapshot !== null) {
        await restoreSceneFromSnapshot(sceneSnapshot)
        sceneSnapshot = null
      }
    } else {
      sceneSnapshot = saveSceneSnapshot()
      setEditorEnabled(false)
      setUpdateEnabled(true)
      setPersistenceEnabled(false)
    }
    updateButtonText()
  })
  
  // Create button container
  const buttonContainer = document.createElement('div')
  buttonContainer.style.position = 'absolute'
  buttonContainer.style.top = '0.5rem'
  buttonContainer.style.right = '0.5rem'
  buttonContainer.style.zIndex = '10000'
  buttonContainer.style.display = 'flex'
  buttonContainer.style.gap = '0.5rem'
  buttonContainer.style.alignItems = 'center'
  
  // Create show scene data button
  const showSceneDataButton = document.createElement('button')
  showSceneDataButton.textContent = 'Show Scene Data'
  showSceneDataButton.style.padding = '0.25rem 0.75rem'
  showSceneDataButton.style.fontSize = '0.8125rem'
  showSceneDataButton.style.fontWeight = '400'
  showSceneDataButton.style.borderRadius = '2px'
  showSceneDataButton.style.border = 'none'
  showSceneDataButton.style.cursor = 'pointer'
  showSceneDataButton.style.transition = 'background-color 0.1s ease-out'
  showSceneDataButton.style.backgroundColor = 'transparent'
  showSceneDataButton.style.color = 'var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))'
  showSceneDataButton.style.fontFamily = 'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)'
  showSceneDataButton.style.outline = 'none'
  showSceneDataButton.style.boxSizing = 'border-box'
  showSceneDataButton.style.display = 'inline-flex'
  showSceneDataButton.style.alignItems = 'center'
  showSceneDataButton.style.justifyContent = 'center'
  showSceneDataButton.style.minHeight = '22px'
  showSceneDataButton.style.lineHeight = '1.4em'
  
  showSceneDataButton.addEventListener('mouseenter', () => {
    showSceneDataButton.style.backgroundColor = 'var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))'
  })
  
  showSceneDataButton.addEventListener('mouseleave', () => {
    showSceneDataButton.style.backgroundColor = 'transparent'
  })
  
  showSceneDataButton.addEventListener('mousedown', () => {
    showSceneDataButton.style.backgroundColor = 'var(--vscode-button-activeBackground, rgba(255, 255, 255, 0.15))'
  })
  
  showSceneDataButton.addEventListener('mouseup', () => {
    showSceneDataButton.style.backgroundColor = 'var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))'
  })
  
  showSceneDataButton.addEventListener('focus', () => {
    showSceneDataButton.style.outline = '1px solid var(--vscode-focusBorder, #007acc)'
    showSceneDataButton.style.outlineOffset = '-1px'
  })
  
  showSceneDataButton.addEventListener('blur', () => {
    showSceneDataButton.style.outline = 'none'
  })
  
  // Create fullscreen modal for scene data
  let sceneDataModal: HTMLDivElement | null = null
  let sceneDataTextarea: HTMLTextAreaElement | null = null
  let refreshInterval: ReturnType<typeof setInterval> | null = null
  
  function createSceneDataModal(): HTMLDivElement {
    const modal = document.createElement('div')
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.width = '100vw'
    modal.style.height = '100vh'
    modal.style.backgroundColor = 'var(--vscode-editor-background, #1e1e1e)'
    modal.style.zIndex = '20000'
    modal.style.display = 'flex'
    modal.style.flexDirection = 'column'
    modal.style.fontFamily = 'var(--vscode-font-family, "Consolas", "Courier New", monospace)'
    
    // Create header with title and close button
    const header = document.createElement('div')
    header.style.display = 'flex'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'
    header.style.padding = '0.75rem 1rem'
    header.style.borderBottom = '1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))'
    header.style.backgroundColor = 'var(--vscode-titleBar-activeBackground, #2d2d30)'
    
    const title = document.createElement('div')
    title.textContent = 'Scene Data'
    title.style.fontSize = '0.8125rem'
    title.style.fontWeight = '600'
    title.style.color = 'var(--vscode-foreground, #cccccc)'
    
    const closeButton = document.createElement('button')
    closeButton.textContent = '✕'
    closeButton.style.background = 'transparent'
    closeButton.style.border = 'none'
    closeButton.style.color = 'var(--vscode-foreground, #cccccc)'
    closeButton.style.cursor = 'pointer'
    closeButton.style.fontSize = '1.2rem'
    closeButton.style.padding = '0.25rem 0.5rem'
    closeButton.style.borderRadius = '2px'
    closeButton.style.transition = 'background-color 0.1s ease-out'
    
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = 'var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))'
    })
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent'
    })
    
    closeButton.addEventListener('click', () => {
      hideSceneDataModal()
    })
    
    header.appendChild(title)
    header.appendChild(closeButton)
    
    // Create textarea for scene data
    const textarea = document.createElement('textarea')
    textarea.style.flex = '1'
    textarea.style.width = '100%'
    textarea.style.padding = '1rem'
    textarea.style.margin = '0'
    textarea.style.border = 'none'
    textarea.style.outline = 'none'
    textarea.style.backgroundColor = 'var(--vscode-editor-background, #1e1e1e)'
    textarea.style.color = 'var(--vscode-editor-foreground, #d4d4d4)'
    textarea.style.fontSize = '0.875rem'
    textarea.style.fontFamily = 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)'
    textarea.style.lineHeight = '1.5'
    textarea.style.resize = 'none'
    textarea.style.overflow = 'auto'
    textarea.readOnly = true
    textarea.spellcheck = false
    
    modal.appendChild(header)
    modal.appendChild(textarea)
    
    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal.parentElement) {
        hideSceneDataModal()
      }
    }
    document.addEventListener('keydown', handleEscape)
    
    // Store reference to cleanup
    ;(modal as any)._escapeHandler = handleEscape
    
    return modal
  }
  
  function updateSceneDataContent() {
    if (!sceneDataTextarea) return
    
    try {
      const scene = getScene()
      const sceneJson = JSON.stringify(scene, null, 2)
      sceneDataTextarea.value = sceneJson
    } catch (error) {
      sceneDataTextarea.value = `Error displaying scene data: ${error}`
    }
  }
  
  function showSceneDataModal() {
    if (sceneDataModal) {
      // Already open, just update content
      updateSceneDataContent()
      return
    }
    
    sceneDataModal = createSceneDataModal()
    sceneDataTextarea = sceneDataModal.querySelector('textarea')!
    document.body.appendChild(sceneDataModal)
    
    // Update content immediately
    updateSceneDataContent()
    
    // Refresh content periodically to keep it up to date
    refreshInterval = setInterval(() => {
      updateSceneDataContent()
    }, 500) // Update every 500ms
  }
  
  function hideSceneDataModal() {
    if (sceneDataModal) {
      // Remove escape handler
      const escapeHandler = (sceneDataModal as any)._escapeHandler
      if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler)
      }
      
      sceneDataModal.remove()
      sceneDataModal = null
      sceneDataTextarea = null
    }
    
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
  
  showSceneDataButton.addEventListener('click', () => {
    showSceneDataModal()
  })
  
  // Ensure editor has relative positioning for absolute children
  if (getComputedStyle(editor).position === 'static') {
    editor.style.position = 'relative'
  }
  
  // Add buttons to container
  buttonContainer.appendChild(showSceneDataButton)
  buttonContainer.appendChild(runButton)
  
  // Add button container to editor
  editor.appendChild(buttonContainer)
}
