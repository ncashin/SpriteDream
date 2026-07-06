import GameView from "./GameView";
import useScene from "./useScene";

export default function Editor() {
  const scene = useScene();

  return (
    <div className="flex flex-row gap-32">
      <div>
        {Object.entries(scene.sceneObject).map(([key, gameObject]) => (
          <div key={key} className="flex flex-row">
            <span>{key}:</span>
            {JSON.stringify(gameObject)}
          </div>
        ))}
      </div>
      <GameView />
    </div>
  );
}
