import { SceneView } from "./SceneView";

export const Sidebar = () => {
  return (
    <div className="min-w-80 w-80 max-w-80 h-full pt-5.5 flex flex-col bg-dark-bg border border-dark-ui">
      <SceneView />
    </div>
  );
};
