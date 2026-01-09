import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor.tsx';

const rootMap = new WeakMap<HTMLDivElement, Root>();

export function initializeEditor() {
  const editor = document.querySelector<HTMLDivElement>('#editor');
  if (!editor) {
    console.error('Could not find #editor element');
    return;
  }

  if (getComputedStyle(editor).position === 'static') {
    editor.style.position = 'relative';
  }

  let root = rootMap.get(editor);
  
  if (!root) {
    editor.innerHTML = '';
    root = createRoot(editor);
    rootMap.set(editor, root);
  }

  root.render(React.createElement(Editor));
}

