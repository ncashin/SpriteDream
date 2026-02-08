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
        <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="flex flex-col items-start text-left">
                <div>This is GameUI</div>
                <div className="grid grid-cols-[auto_5ch] items-center justify-items-start gap-2">
                    <span>isGrounded:</span>
                    <span className="tabular-nums">{String(isGrounded)}</span>
                </div>
            </div>
        </div>
    );
}

