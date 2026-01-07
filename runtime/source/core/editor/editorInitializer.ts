import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor.tsx';

const ROOT_PROP = '__reactRoot__';

export function initializeEditor() {
  const editor = document.querySelector<HTMLDivElement>('#editor');
  if (!editor) {
    console.error('Could not find #editor element');
    return;
  }

  if (getComputedStyle(editor).position === 'static') {
    editor.style.position = 'relative';
  }

  let root = (editor as any)[ROOT_PROP] as Root | undefined;
  
  if (!root) {
    editor.innerHTML = '';
    root = createRoot(editor);
    (editor as any)[ROOT_PROP] = root;
  }

  root.render(React.createElement(Editor));
}

