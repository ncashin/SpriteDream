const images = new Map<string, HTMLImageElement>()

export function loadImage(source: string): HTMLImageElement | undefined {
  if (source === "") return
  let image = images.get(source)
  if (!image) {
    image = new Image()
    image.src = source
    images.set(source, image)
  }
  if (!image.complete || image.naturalWidth === 0) return
  return image
}
