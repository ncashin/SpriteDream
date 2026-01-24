import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Plugin, PluginKey, type Transaction, type EditorState } from "prosemirror-state";
import { MagnifyingGlass, ArrowUp, ArrowDown, X } from "@phosphor-icons/react";

interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  isValid?: boolean;
  placeholder?: string;
  className?: string;
}

// Helper function to extract text from editor preserving whitespace
function getFormattedText(editor: any): string {
  const { state } = editor;
  const { doc } = state;

  // Check if content is in a code block
  if (doc.childCount === 1 && doc.firstChild?.type.name === "codeBlock") {
    return doc.firstChild.textContent;
  }

  // Fallback: extract all text content
  let text = "";
  doc.forEach((node: any, offset: number) => {
    if (node.type.name === "codeBlock") {
      text += node.textContent;
    } else if (node.isTextblock) {
      text += node.textContent;
      if (offset < doc.childCount - 1) {
        text += "\n";
      }
    }
  });

  return text;
}

export function JSONEditor({
  value,
  onChange,
  onFocus,
  onBlur,
  isValid = true,
  placeholder = "Enter JSON...",
  className = "",
}: JSONEditorProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find all matches in the document
  const findMatches = useCallback((query: string, text: string): Array<{ from: number; to: number }> => {
    if (!query) return [];
    const matches: Array<{ from: number; to: number }> = [];
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({ from: match.index, to: match.index + match[0].length });
    }
    return matches;
  }, []);

  // Search plugin key
  const searchPluginKey = useMemo(() => new PluginKey('searchHighlight'), []);
  
  // Use refs to access current search state in plugin
  const searchQueryRef = useRef(searchQuery);
  const currentMatchIndexRef = useRef(currentMatchIndex);
  
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);
  
  useEffect(() => {
    currentMatchIndexRef.current = currentMatchIndex;
  }, [currentMatchIndex]);

  // Create search plugin extension
  const searchExtension = useMemo(() => {
    return Extension.create({
      name: 'searchHighlight',
      addProseMirrorPlugins() {
        const plugin: Plugin<DecorationSet> = new Plugin({
          key: searchPluginKey,
          state: {
            init() {
              return DecorationSet.empty;
            },
            apply(_tr: Transaction, _value: DecorationSet, _oldState: EditorState, newState: EditorState) {
              const query = searchQueryRef.current;
              if (!query || !newState.doc) {
                return DecorationSet.empty;
              }

              const text = newState.doc.textContent;
              const matches = findMatches(query, text);
              
              if (matches.length === 0) {
                return DecorationSet.empty;
              }

              const currentIdx = currentMatchIndexRef.current;
              const decorations: Decoration[] = [];
              matches.forEach((match, index) => {
                try {
                  const decoration = Decoration.inline(match.from, match.to, {
                    class: index === currentIdx 
                      ? 'json-search-match json-search-match-active' 
                      : 'json-search-match',
                  });
                  decorations.push(decoration);
                } catch (e) {
                  // Skip invalid decorations
                  console.warn('Failed to create decoration:', e);
                }
              });

              return DecorationSet.create(newState.doc, decorations);
            },
          },
          props: {
            decorations(state: EditorState): DecorationSet {
              return plugin.getState(state) || DecorationSet.empty;
            },
          },
        });
        return [plugin];
      },
    });
  }, [searchPluginKey, findMatches]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable most formatting for JSON editing
        heading: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        code: false,
        codeBlock: false, // We'll use our own CodeBlock config
        // Keep only essential features
        history: {},
        dropcursor: {},
        gapcursor: false,
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: "json-editor-code-block",
          spellcheck: "false",
          style: "font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace); font-size: var(--vscode-editor-font-size, 14px); line-height: var(--vscode-editor-line-height, 1.5); color: var(--vscode-editor-foreground, #cccccc);",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      searchExtension,
    ],
    content: value ? `<pre><code>${value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>` : `<pre><code></code></pre>`,
    editorProps: {
      attributes: {
        class: `json-editor-content ${className}`,
        spellcheck: "false",
        style: "font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace); font-size: var(--vscode-editor-font-size, 14px); line-height: var(--vscode-editor-line-height, 1.5); color: var(--vscode-editor-foreground, #cccccc);",
      },
      transformPastedText(text: string) {
        // Preserve plain text when pasting
        return text;
      },
      handleDOMEvents: {
        // Prevent Enter from creating new paragraphs - keep it in code block
        keydown: (_view: any, event: KeyboardEvent) => {
          // Handle Cmd+F / Ctrl+F to open search
          if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
            event.preventDefault();
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 0);
            return true;
          }

          if (event.key === "Enter") {
            // Allow default behavior (new line in code block)
            return false;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }: { editor: any }) => {
      // Extract text from code block while preserving formatting
      const text = getFormattedText(editor);
      onChange(text);
    },
    onFocus: () => {
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  // Update search highlights when query or editor changes
  useEffect(() => {
    if (!editor) {
      return;
    }

    if (!searchQuery) {
      // Clear decorations when search is empty
      const tr = editor.state.tr;
      editor.view.dispatch(tr);
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }

    const text = getFormattedText(editor);
    const matches = findMatches(searchQuery, text);
    setTotalMatches(matches.length);
    
    if (matches.length > 0 && currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }

    // Force plugin update by dispatching a transaction
    // The plugin will read from refs
    const tr = editor.state.tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }, [editor, searchQuery, currentMatchIndex, findMatches]);

  // Navigate to current match
  useEffect(() => {
    if (!editor || !searchQuery || totalMatches === 0) {
      return;
    }

    const text = getFormattedText(editor);
    const matches = findMatches(searchQuery, text);
    
    if (matches.length > 0 && currentMatchIndex < matches.length) {
      const match = matches[currentMatchIndex];
      editor.commands.setTextSelection({ from: match.from, to: match.to });
      editor.commands.scrollIntoView();
    }
  }, [editor, searchQuery, currentMatchIndex, totalMatches, findMatches]);

  // Handle keyboard shortcuts for search
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Enter / Shift+Enter for navigation
      if (e.key === 'Enter' && totalMatches > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          // Navigate backward
          setCurrentMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
        } else {
          // Navigate forward
          setCurrentMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, totalMatches]);

  // Handle global Cmd+F / Ctrl+F
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        const editorElement = editor?.view.dom;
        if (editorElement && (editorElement === document.activeElement || editorElement.contains(document.activeElement))) {
          e.preventDefault();
          setIsSearchOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editor]);

  // Sync external value changes to editor
  useEffect(() => {
    if (editor) {
      const currentText = getFormattedText(editor);
      // Only update if the value actually changed to avoid unnecessary updates
      if (value !== currentText) {
        // Set content as code block to preserve formatting
        const escapedValue = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Use insertContent which properly handles code blocks
        editor.commands.setContent(`<pre><code>${escapedValue}</code></pre>`, false);
      }
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div 
      className={`json-editor-wrapper ${!isValid ? "json-editor-invalid" : ""}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
      }}
    >
      {isSearchOpen && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-[#252526] border-b border-[#3e3e42] px-3 py-2 flex items-center gap-2 shadow-lg">
          <div className="relative flex items-center min-w-0 flex-1">
            <MagnifyingGlass size={14} weight="bold" className="absolute left-2 pointer-events-none z-[1] text-white/60" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                  editor?.commands.focus();
                } else if (e.key === 'Enter' && totalMatches > 0) {
                  e.preventDefault();
                  if (e.shiftKey) {
                    setCurrentMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
                  } else {
                    setCurrentMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
                  }
                }
              }}
              className="flex-1 w-full py-1 pr-3 pl-6 text-xs bg-[#3c3c3c] text-white/90 border border-[#3e3e42] rounded-sm outline-none min-w-0 min-h-6 box-border focus:outline focus:outline-1 focus:outline-[#007acc] focus:-outline-offset-1"
              style={{
                fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
              }}
            />
          </div>
          {searchQuery && (
            <div className="flex items-center gap-2 text-xs text-white/60 whitespace-nowrap">
              <span>
                {totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : 'No results'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (totalMatches > 0) {
                      setCurrentMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
                    }
                  }}
                  disabled={totalMatches === 0}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous (Shift+Enter)"
                >
                  <ArrowUp size={14} weight="bold" className="text-white/60" />
                </button>
                <button
                  onClick={() => {
                    if (totalMatches > 0) {
                      setCurrentMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
                    }
                  }}
                  disabled={totalMatches === 0}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next (Enter)"
                >
                  <ArrowDown size={14} weight="regular" className="text-white/60" />
                </button>
              </div>
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                  editor?.commands.focus();
                }}
                className="p-1 rounded hover:bg-white/10"
                title="Close (Esc)"
              >
                <X size={14} weight="bold" className="text-white/60" />
              </button>
            </div>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

