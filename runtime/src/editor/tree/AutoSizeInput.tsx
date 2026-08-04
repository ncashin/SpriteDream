import { useLayoutEffect, useRef, useState } from "react";

import { type Serializable } from "../../tomove/scene";

function parseInputValue(input: string): Serializable {
  const trimmed = input.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return input;
  }
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}
function isBooleanString(value: string): boolean {
  return value === "true" || value === "false";
}

export type AutoSizeInputProperties = {
  value: string;
  onCommit: (value: Serializable) => void;
} & React.InputHTMLAttributes<HTMLInputElement>;

export default function AutoSizeInput({ value, onCommit, ...props }: AutoSizeInputProperties) {
  const [draft, setDraft] = useState(value);

  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const displayValue = draft ?? value;

  useLayoutEffect(() => {
    const input = inputRef.current;
    const measure = measureRef.current;

    if (!input || !measure) return;

    input.style.width = `${measure.offsetWidth}px`;
  }, [displayValue]);

  function focusCenter() {
    inputRef.current?.focus();
  }

  function startEdit() {
    setDraft(value);

    requestAnimationFrame(focusCenter);
  }

  function commit() {
    if (draft !== value) {
      onCommit(parseInputValue(draft));
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    commit();
    inputRef.current?.blur();
  }

  return (
    <>
      <span
        ref={measureRef}
        className="absolute invisible whitespace-pre font-inherit text-inherit tracking-inherit"
      >
        {displayValue || " "}
      </span>

      <input
        {...props}
        ref={inputRef}
        value={displayValue}
        onFocus={startEdit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />

      {isHexColor(displayValue) && (
        <input
          type="color"
          className="icon-size"
          value={displayValue}
          onChange={(event) => onCommit?.(event.target.value)}
          aria-label="Edit Color"
        />
      )}
      {isBooleanString(displayValue) && (
        <input
          type="checkbox"
          className="icon-size"
          checked={displayValue === "true"}
          onChange={(event) => onCommit(event.target.checked)}
          aria-label="Toggle value"
        />
      )}
    </>
  );
}
