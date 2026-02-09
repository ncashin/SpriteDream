import { Check, X } from '@phosphor-icons/react';

interface AddChildFormProps {
    nodeType: 'object' | 'array';
    newChildKey: string;
    newChildValue: string;
    onKeyChange: (key: string) => void;
    onValueChange: (value: string) => void;
    onConfirm: (e: React.MouseEvent) => void;
    onCancel: (e: React.MouseEvent) => void;
}

export function AddChildForm({
    nodeType,
    newChildKey,
    newChildValue,
    onKeyChange,
    onValueChange,
    onConfirm,
    onCancel,
}: AddChildFormProps) {
    return (
        <div
            className="json-tree-row grid w-full box-border px-[5px] py-1"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="h-3 w-3" />
            <div className="flex items-center px-1 py-1 text-left">
                {nodeType === 'object' ? (
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
                ) : (
                    <span />
                )}
            </div>
            <div className="flex items-center px-1 py-1 pl-2">
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
                    className="ml-1 bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                    title="Add"
                >
                    <Check size={12} weight="bold" />
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="ml-1 bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                    title="Cancel"
                >
                    <X size={12} weight="bold" />
                </button>
            </div>
        </div>
    );
}

