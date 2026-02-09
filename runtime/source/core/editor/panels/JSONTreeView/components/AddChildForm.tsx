import { Check, X } from '@phosphor-icons/react';

interface AddChildFormProps {
    nodeType: 'object' | 'array';
    indent: number;
    newChildKey: string;
    newChildValue: string;
    onKeyChange: (key: string) => void;
    onValueChange: (value: string) => void;
    onConfirm: (e: React.MouseEvent) => void;
    onCancel: (e: React.MouseEvent) => void;
}

export function AddChildForm({
    nodeType,
    indent,
    newChildKey,
    newChildValue,
    onKeyChange,
    onValueChange,
    onConfirm,
    onCancel,
}: AddChildFormProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                paddingTop: '4px',
                paddingBottom: '4px',
                paddingLeft: `${8 + indent + 16}px`,
                paddingRight: '4px',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {nodeType === 'object' && (
                <input
                    type="text"
                    value={newChildKey}
                    onChange={(e) => onKeyChange(e.target.value)}
                    placeholder="key"
                    style={{
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(128, 128, 128, 0.35)',
                        color: 'var(--vscode-editor-foreground, #cccccc)',
                        fontSize: 'inherit',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        width: '120px',
                        fontFamily: 'inherit',
                    }}
                />
            )}
            <input
                type="text"
                value={newChildValue}
                onChange={(e) => onValueChange(e.target.value)}
                placeholder="value (JSON)"
                style={{
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(128, 128, 128, 0.35)',
                    color: 'var(--vscode-editor-foreground, #cccccc)',
                    fontSize: 'inherit',
                    padding: '1px 4px',
                    borderRadius: '2px',
                    flex: 1,
                    minWidth: '120px',
                    fontFamily: 'inherit',
                }}
            />
            <button
                type="button"
                onClick={onConfirm}
                className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                title="Add"
            >
                <Check size={12} weight="bold" />
            </button>
            <button
                type="button"
                onClick={onCancel}
                className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                title="Cancel"
            >
                <X size={12} weight="bold" />
            </button>
        </div>
    );
}

