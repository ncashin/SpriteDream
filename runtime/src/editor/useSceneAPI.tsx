import { useContext } from "react";
import invariant from "tiny-invariant";
import { SceneContext } from "./SceneProvider";
import type { SceneAPI } from "../scene";

export default function useSceneAPI() {
  const scene = useContext(SceneContext);

  invariant(
    scene,
    "useSceneAPI must be used within SceneProvider",
  );

  return scene;
}