import { useState, useRef, useEffect } from "react";

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

    const filteredOptions = options.filter((option) =>
        option.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    color: "#ce9178",
                    fontSize: "inherit",
                    width: "100%",
                }}
            >
                <span style={{ flex: 1, textAlign: "left" }}>{value || placeholder}</span>
                <span
                    className="codicon codicon-chevron-down"
                    style={{
                        fontSize: "10px",
                        color: "#808080",
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
                        backgroundColor: "#000000",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        marginTop: "2px",
                        maxHeight: "200px",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ padding: "2px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
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
                                backgroundColor: "transparent",
                                border: "none",
                                color: "#cccccc",
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
                        {filteredOptions.length === 0 ? (
                            <div
                                style={{
                                    padding: "4px 8px",
                                    textAlign: "center",
                                    color: "#808080",
                                    fontSize: "inherit",
                                }}
                            >
                                No options found
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
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
                                        color: "#cccccc",
                                        fontSize: "inherit",
                                        cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
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

