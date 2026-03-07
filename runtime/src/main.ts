import { initializeGame } from './initializeGame'
import './style.css'

initializeGame({
  main(gameContext) {
    console.log('Game started', gameContext);
  },
});