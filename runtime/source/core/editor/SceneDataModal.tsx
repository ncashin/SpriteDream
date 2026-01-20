import { useEffect, useState, useRef } from 'react';
import { getScene } from '../scene/scene';

interface SceneDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SceneDataModal({ isOpen, onClose }: SceneDataModalProps) {
  const [sceneData, setSceneData] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const updateSceneData = () => {
      try {
        const scene = getScene();
        const sceneJson = JSON.stringify(scene, null, 2);
        setSceneData(sceneJson);
      } catch (error) {
        setSceneData(`Error displaying scene data: ${error}`);
      }
    };

    updateSceneData();

    intervalRef.current = setInterval(updateSceneData, 500);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen z-[20000] flex flex-col"
      style={{
        backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
        fontFamily: 'var(--vscode-font-family, "Consolas", "Courier New", monospace)',
      }}
    >
      <div
        className="flex justify-between items-center px-4 py-3 border-b"
        style={{
          borderBottomColor: 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))',
          backgroundColor: 'var(--vscode-titleBar-activeBackground, #2d2d30)',
        }}
      >
        <div className="text-[0.8125rem] font-semibold" style={{ color: 'var(--vscode-foreground, #cccccc)' }}>
          Scene Data
        </div>
        <button
          className="bg-transparent border-none cursor-pointer px-2 py-1 rounded-sm duration-100 ease-out flex items-center justify-center hover:bg-[var(--vscode-button-hoverBackground,rgba(255,255,255,0.1))]"
          style={{
            color: 'var(--vscode-foreground, #cccccc)',
          }}
          onClick={onClose}
        >
          <span className="codicon codicon-close text-xl" />
        </button>
      </div>
      <textarea
        className="flex-1 w-full p-4 m-0 border-none outline-none text-sm leading-normal resize-none overflow-auto"
        style={{
          backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
          color: 'var(--vscode-editor-foreground, #d4d4d4)',
          fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
        }}
        value={sceneData}
        readOnly
        spellCheck={false}
      />
    </div>
  );
}

