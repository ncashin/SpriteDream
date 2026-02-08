import { useScene } from "./core/editor/useScene.tsx";
import { useUIVisibilityStore } from "./core/editor/uiVisibility.ts";

export function GameUI() {
    const { scene } = useScene();
    const isGrounded = scene?.ecs?.entities?.player?.playerComponent?.isGrounded ?? false;
    const visible = useUIVisibilityStore((state) => state.gameUIVisible);

    if (!visible) {
        return null;
    }

    return (
        <div className="flex items-center justify-center h-full w-full text-white">
            This is GameUI<br></br>
            isGrounded: {String(isGrounded)}
        </div>
    );
}

