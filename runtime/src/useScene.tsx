import { useContext } from "react";
import invariant from "tiny-invariant";
import { SceneContext } from "./SceneProvider";

export default function useScene() {
  const scene = useContext(SceneContext);
  invariant(scene, "useScene must be used within SceneProvider");

  return scene;
}
