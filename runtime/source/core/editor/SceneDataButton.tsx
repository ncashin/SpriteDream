import { useState } from "react";
import { EditorButton } from "./EditorButton";
import { SceneDataModal } from "./SceneDataModal";

export function SceneDataButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <EditorButton onClick={() => setIsOpen(true)}>
        Scene Data
      </EditorButton>
      <SceneDataModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

