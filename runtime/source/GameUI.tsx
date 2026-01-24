import { useState, useEffect } from "react";
import { useScene } from "./core/editor/useScene.tsx";
import {
  isGameUIVisible,
  subscribeToVisibilityChanges,
} from "./core/editor/uiVisibility.ts";

export function GameUI() {
    const { scene } = useScene();
    const isGrounded = scene?.ecs?.entities?.player?.player?.isGrounded ?? false;
    const [visible, setVisible] = useState(isGameUIVisible());

    useEffect(() => {
      const unsubscribe = subscribeToVisibilityChanges(() => {
        setVisible(isGameUIVisible());
      });
      return unsubscribe;
    }, []);

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

