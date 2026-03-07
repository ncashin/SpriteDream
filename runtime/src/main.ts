import { initializeGame } from './initializeGame'
import { render2DPlugin } from './render2DPlugin'
import './style.css'
import invariant from 'tiny-invariant'

const rootElement = document.getElementById('app');
invariant(rootElement)

initializeGame({
  initialContext: {
    rootElement
  },
  plugins: [render2DPlugin],
  main(gameContext) {
    console.log('Game started', gameContext);
  },
});