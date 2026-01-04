function initializeCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    canvas.style.display = 'block'
    canvas.style.margin = '0'
    canvas.style.padding = '0'
    canvas.style.pointerEvents = 'auto'
    canvas.style.touchAction = 'none'
    
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    })
    
    return canvas
  }