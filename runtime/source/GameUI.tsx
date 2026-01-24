import { useScene } from "./core/editor/useScene";

export function GameUI() {
    const scene = useScene();
    const isGrounded = scene?.ecs?.entities?.player?.player?.isGrounded ?? false;

    return (
        <div className="flex items-center justify-center h-full w-full text-white">
            This is GameUI<br></br>
            isGrounded: {String(isGrounded)}
        </div>
    );
}

