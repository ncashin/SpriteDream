import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorButton } from './EditorButton';
import { SceneDataModal } from './SceneDataModal';
import { initializePluginUI } from './ecsEditorPlugin.tsx';
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

// Editor state that persists across reinitializations
let editorState: {
  sceneSnapshot: any;
  reactRoot: ReturnType<typeof createRoot> | null;
} = {
  sceneSnapshot: null,
  reactRoot: null,
};

export function Editor() {
  const [isSceneDataModalOpen, setIsSceneDataModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(isUpdateEnabled());

  useEffect(() => {
    // Update button state when updateEnabled changes externally
    setIsRunning(isUpdateEnabled());
  }, []);

  const handleRunStop = async () => {
    const wasRunning = isUpdateEnabled();
    
    if (wasRunning) {
      // Stop: restore from snapshot
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
      // Start: save snapshot
      editorState.sceneSnapshot = saveSceneSnapshot();
      setEditorEnabled(false);
      setUpdateEnabled(true);
      setPersistenceEnabled(false);
      initializeGame();
    }
    
    setIsRunning(!wasRunning);
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
      <EditorButton onClick={handleRunStop}>
        {isRunning ? 'Stop' : 'Run'}
      </EditorButton>
      <SceneDataModal
        isOpen={isSceneDataModalOpen}
        onClose={() => setIsSceneDataModalOpen(false)}
      />
    </div>
  );
}

export function initializeEditor() {
  const editor = document.querySelector<HTMLDivElement>('#editor');
  if (!editor) {
    console.error('Could not find #editor element');
    return;
  }

  // Ensure editor has relative positioning for absolute children
  if (getComputedStyle(editor).position === 'static') {
    editor.style.position = 'relative';
  }

  // Reuse existing root or create a new one
  if (!editorState.reactRoot) {
    // Clear editor content only on first initialization
    editor.innerHTML = '';
    editorState.reactRoot = createRoot(editor);
  }

  // Render or re-render the Editor component
  editorState.reactRoot.render(<Editor />);
  
  // Re-initialize plugin UI after editor is rendered
  // This ensures the plugin container is recreated if it was cleared
  requestAnimationFrame(() => {
    initializePluginUI();
  });
}
