import type { SerializableObject } from "../../tomove/scene";
import useEditorStore from "./useEditorStore";

export default function useScene() {
  const { value: scene, setState } = useEditorStore((state) => state.scene);

  const setScene = (newScene: SerializableObject) => {
    setState((state) => {
      console.log(newScene);
      return { ...state, scene: newScene };
    });
  };
  
  return { scene, setScene };
}
