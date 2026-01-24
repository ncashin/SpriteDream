import { useState, useRef, useEffect, useMemo } from "react";
import { CaretDown } from "@phosphor-icons/react";

interface SearchableDropdownProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
}

export function SearchableDropdown({
    value,
    options,
    onChange,
    placeholder = "Select...",
}: SearchableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Detect if this is a parent dropdown (first option is empty string)
    const isParentDropdown = useMemo(() => options.length > 0 && options[0] === '', [options]);
    
    // Separate "No Parent" option from other options
    const { regularOptions } = useMemo(() => {
        if (isParentDropdown) {
            return {
                regularOptions: options.slice(1)
            };
        }
        return { regularOptions: options };
    }, [options, isParentDropdown]);

    const filteredRegularOptions = regularOptions.filter((option) =>
        option.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Show "No Parent" if search matches or search is empty
    const showNoParent = isParentDropdown && (searchQuery === '' || 'no parent'.includes(searchQuery.toLowerCase()));

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchQuery("");
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (option: string) => {
        onChange(option);
        setIsOpen(false);
        setSearchQuery("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false);
            setSearchQuery("");
        }
    };

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                    if (!isOpen) {
                        setSearchQuery("");
                    }
                }}
                style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    minHeight: "20px",
                    padding: "2px 4px",
                    color: "var(--vscode-symbolIcon-stringForeground, #ce9178)",
                    fontSize: "inherit",
                    width: "100%",
                }}
            >
                <span style={{ flex: 1, textAlign: "left" }}>{value || placeholder}</span>
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
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ padding: "2px", borderBottom: "1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1))" }}>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: "100%",
                                padding: "2px 4px",
                                fontSize: "inherit",
                                backgroundColor: "var(--vscode-input-background, transparent)",
                                border: "none",
                                color: "var(--vscode-input-foreground, var(--vscode-dropdown-foreground, #cccccc))",
                                outline: "none",
                                fontFamily: 'inherit',
                            }}
                        />
                    </div>
                    <div
                        style={{
                            overflowY: "auto",
                            maxHeight: "150px",
                        }}
                    >
                        {showNoParent && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect('');
                                }}
                                style={{
                                    width: "100%",
                                    padding: "2px 4px",
                                    textAlign: "left",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    color: "var(--vscode-testing-iconPassed, #89d185)",
                                    fontSize: "inherit",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={() => {
                                    // Keep transparent background on hover for "No Parent"
                                }}
                                onMouseLeave={() => {
                                    // Keep transparent background
                                }}
                            >
                                No Parent
                            </button>
                        )}
                        {filteredRegularOptions.length === 0 && !showNoParent ? (
                            <div
                                style={{
                                    padding: "4px 8px",
                                    textAlign: "center",
                                    color: "var(--vscode-descriptionForeground, #808080)",
                                    fontSize: "inherit",
                                }}
                            >
                                No options found
                            </div>
                        ) : (
                            filteredRegularOptions.map((option) => (
                                <button
                                    key={option}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(option);
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "2px 4px",
                                        textAlign: "left",
                                        backgroundColor: "transparent",
                                        border: "none",
                                        color: "var(--vscode-dropdown-foreground, var(--vscode-editor-foreground, #cccccc))",
                                        fontSize: "inherit",
                                        cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                >
                                    {option}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

