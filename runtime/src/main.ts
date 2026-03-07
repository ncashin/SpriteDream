import { gameUpdate } from './gameloop'
import { initializeGame } from './initializeGame'
import { inputPlugin } from './inputPlugin'
import { render2DPlugin } from './render2DPlugin'
import './style.css'
import invariant from 'tiny-invariant'

const rootElement = document.getElementById('app');
invariant(rootElement)

const PLAYER_SPEED = 200
const PLAYER_SIZE = 24

initializeGame({
  initialContext: {
    rootElement
  },
  plugins: [inputPlugin(), render2DPlugin()] as const,
  main(gameContext) {
    const { render2D, input } = gameContext
    const { canvasElement, context } = render2D

    let playerX = canvasElement.width / 2 - PLAYER_SIZE / 2
    let playerY = canvasElement.height / 2 - PLAYER_SIZE / 2

    gameUpdate(() => {
      const h = input.getAxis('Horizontal')
      const v = input.getAxis('Vertical')
      playerX += h * PLAYER_SPEED * (1 / 60)
      playerY -= v * PLAYER_SPEED * (1 / 60)

      const maxX = canvasElement.width - PLAYER_SIZE
      const maxY = canvasElement.height - PLAYER_SIZE
      playerX = Math.max(0, Math.min(maxX, playerX))
      playerY = Math.max(0, Math.min(maxY, playerY))

      context.clearRect(0, 0, canvasElement.width, canvasElement.height)
      context.fillStyle = '#3b82f6'
      context.fillRect(playerX, playerY, PLAYER_SIZE, PLAYER_SIZE)
    })
  },
})