import { useScene } from "./core/editor/useScene";

export function GameUI() {
    const scene = useScene();
    return (
        <div className="flex items-center justify-center h-full w-full" onClick={() => {
            scene.ecs.entities.player.sprite.image = "/hello.jpg"
        }}>
            {JSON.stringify(scene.ecs.entities.player.sprite.image)}
        </div>
    );
}

