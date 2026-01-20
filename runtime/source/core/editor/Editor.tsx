import { EntityListPanel } from "./panels/EntityListPanel";
import { EntityModalContainer } from "./panels/EntityModalContainer";
import { RunStopButton } from "./RunStopButton";
import { SceneDataButton } from "./SceneDataButton";

export function Editor() {
  return (
    <div className="flex flex-row w-full h-full justify-between p-2">
      <div className="flex flex-col gap-2 items-start">
        <EntityListPanel />
        <EntityModalContainer />
      </div>
      <div className="flex gap-2 items-start ml-auto">
        <SceneDataButton />
        <RunStopButton />
      </div>
    </div>
  );
}
