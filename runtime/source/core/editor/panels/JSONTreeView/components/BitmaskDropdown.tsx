import { useState, useMemo, useRef, useEffect } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { parseBitmaskOption, formatBitmaskValue } from '../utils';

interface BitmaskDropdownProps {
    value: number;
    options: string[];
    onChange: (value: number) => void;
}

export function BitmaskDropdown({
    value,
    options,
    onChange,
}: BitmaskDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const parsedOptions = useMemo(
        () =>
            options
                .map(parseBitmaskOption)
                .filter((option): option is { bit: number; label: string } => !!option),
        [options]
    );

    const allBits = useMemo(
        () => parsedOptions.reduce((acc, option) => acc | option.bit, 0),
        [parsedOptions]
    );

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    minHeight: "20px",
                    padding: "2px 4px",
                    color: "var(--vscode-symbolIcon-numberForeground, #b5cea8)",
                    fontSize: "inherit",
                    width: "100%",
                }}
            >
                <span style={{ flex: 1, textAlign: "left" }}>
                    {formatBitmaskValue(value, options)}
                </span>
                <CaretDown
                    size={10}
                    weight="bold"
                    style={{
                        color: "var(--vscode-descriptionForeground, #808080)",
                        marginLeft: "4px",
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.1s",
                    }}
                />
            </div>
            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        backgroundColor: "var(--vscode-dropdown-background, var(--vscode-editor-background, #1e1e1e))",
                        border: "1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1))",
                        marginTop: "2px",
                        maxHeight: "200px",
                        overflowY: "auto",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {parsedOptions.length === 0 ? (
                        <div
                            style={{
                                padding: "4px 8px",
                                textAlign: "center",
                                color: "var(--vscode-descriptionForeground, #808080)",
                                fontSize: "inherit",
                            }}
                        >
                            No layers defined
                        </div>
                    ) : (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 8px",
                                    borderBottom: "1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1))",
                                }}
                            >
                                <button
                                    onClick={() => onChange(0)}
                                    style={{
                                        backgroundColor: "transparent",
                                        border: "none",
                                        color: "var(--vscode-descriptionForeground, #808080)",
                                        cursor: "pointer",
                                        fontSize: "inherit",
                                    }}
                                >
                                    None
                                </button>
                                <button
                                    onClick={() => onChange(allBits)}
                                    style={{
                                        backgroundColor: "transparent",
                                        border: "none",
                                        color: "var(--vscode-descriptionForeground, #808080)",
                                        cursor: "pointer",
                                        fontSize: "inherit",
                                    }}
                                >
                                    All
                                </button>
                            </div>
                            {parsedOptions.map(({ bit, label }) => {
                                const checked = (value & bit) !== 0;
                                return (
                                    <label
                                        key={`${bit}:${label}`}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            padding: "4px 8px",
                                            cursor: "pointer",
                                            color: "var(--vscode-editor-foreground, #cccccc)",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {
                                                const nextValue = checked ? (value & ~bit) : (value | bit);
                                                onChange(nextValue);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ margin: 0 }}
                                        />
                                        <span>{label}</span>
                                    </label>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

