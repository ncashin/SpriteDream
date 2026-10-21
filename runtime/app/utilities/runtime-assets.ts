const images = new Map<string, HTMLImageElement>()

export function loadImage(source: string): HTMLImageElement | undefined {
  const image = imageElement(source)
  if (!image || !image.complete || image.naturalWidth === 0) return
  return image
}

export function whenImageReady(source: string): Promise<void> {
  const image = imageElement(source)
  if (!image) return Promise.resolve()
  if (image.complete && image.naturalWidth > 0) return Promise.resolve()
  return image.decode().then(
    () => undefined,
    () => undefined,
  )
}

function imageElement(source: string): HTMLImageElement | undefined {
  if (source === "") return
  let image = images.get(source)
  if (!image) {
    image = new Image()
    image.src = source
    images.set(source, image)
  }
  return image
}
