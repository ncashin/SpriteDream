import { useState, useEffect, useRef } from 'react';
import { EditorButton } from './EditorButton';
import { SceneDataModal } from './SceneDataModal';
import {
  setEditorEnabled,
  setUpdateEnabled,
  isUpdateEnabled,
} from '../gameloop';
import {
  setPersistenceEnabled,
  saveSceneSnapshot,
  restoreSceneFromSnapshot,
} from '../scene/scene';
import { initializeGame } from '../../runtimeWrapper';

let editorState: {
  sceneSnapshot: any;
} = {
  sceneSnapshot: null,
};

export function Editor() {
  const [isSceneDataModalOpen, setIsSceneDataModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(isUpdateEnabled());
  const runButtonRef = useRef<HTMLButtonElement>(null);

  useState(() => {
    setIsRunning(isUpdateEnabled());
  });

  const handleRunStop = async () => {
    const wasRunning = isUpdateEnabled();
    
    if (wasRunning) {
      setEditorEnabled(true);
      setUpdateEnabled(false);

      if (editorState.sceneSnapshot !== null) {
        await restoreSceneFromSnapshot(editorState.sceneSnapshot);
        editorState.sceneSnapshot = null;
      } else {
        console.warn('No scene snapshot to restore from');
      }
      setPersistenceEnabled(true);
      initializeGame();
    } else {
      editorState.sceneSnapshot = saveSceneSnapshot();
      setEditorEnabled(false);
      setUpdateEnabled(true);
      setPersistenceEnabled(false);
      initializeGame();
    }
    
    setIsRunning(!wasRunning);
    runButtonRef.current?.blur();
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '0.5rem',
        right: '0.5rem',
        zIndex: 10000,
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
      }}
    >
      <EditorButton onClick={() => setIsSceneDataModalOpen(true)}>
        Scene Data
      </EditorButton>
      <EditorButton ref={runButtonRef} onClick={handleRunStop}>
        {isRunning ? 'Stop' : 'Run'}
      </EditorButton>
      <SceneDataModal
        isOpen={isSceneDataModalOpen}
        onClose={() => setIsSceneDataModalOpen(false)}
      />
    </div>
  );
}

