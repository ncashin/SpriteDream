import { css, on } from "remix/component";
import type { Handle } from "remix/component";

const field = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: 0,
  boxShadow: "none",
  boxSizing: "border-box",
  color: "inherit",
  display: "block",
  flex: "0 0 auto",
  fieldSizing: "content",
  font: "inherit",
  lineHeight: "inherit",
  margin: 0,
  maxWidth: "100%",
  minWidth: 0,
  outline: "none",
  padding: 0,
  width: "auto",
  "&::placeholder": {
    color: "inherit",
    opacity: 0.5,
  },
  "&:focus, &:focus-visible": {
    outline: "none",
  },
});

type AutoSizeInputProps = {
  value: string;
  placeholder?: string;
  label: string;
  onPointerDown?: () => void;
  /** Return false to restore the previous value. */
  onCommit: (value: string) => boolean | void;
};

export function AutoSizeInput(handle: Handle<AutoSizeInputProps>) {
  let saved = handle.props.value;
  let draft = saved;
  let committing = false;

  function commit() {
    if (committing) return;
    let next = draft;
    if (next === saved) return;
    committing = true;
    let rejected = next === "" || handle.props.onCommit(next) === false;
    committing = false;
    if (rejected) {
      draft = saved;
      handle.update();
      return;
    }
    saved = next;
  }

  return () => (
    <input
      type="text"
      aria-label={handle.props.label}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck={false}
      data-1p-ignore=""
      data-lpignore="true"
      data-bwignore=""
      data-form-type="other"
      value={draft}
      placeholder={handle.props.placeholder}
      mix={[
        field,
        on("pointerdown", () => {
          handle.props.onPointerDown?.();
        }),
        on("click", (event) => {
          event.stopPropagation();
        }),
        on("input", (event) => {
          draft = event.currentTarget.value;
          handle.update();
        }),
        on("blur", commit),
        on("keydown", (event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key !== "Escape") return;
          draft = saved;
          handle.update();
          event.currentTarget.blur();
        }),
      ]}
    />
  );
}
