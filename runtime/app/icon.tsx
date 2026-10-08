import { css } from "remix/component";
import type { Handle } from "remix/component";
import { jsx } from "remix/component/jsx-runtime";
import type { IconNode } from "lucide";

const iconStyle = css({
  display: "block",
  flex: "0 0 auto",
});

export function Icon(handle: Handle<{ icon: IconNode; size?: number }>) {
  return () => {
    let { icon, size = 16 } = handle.props;

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        mix={iconStyle}
      >
        {icon.map(([tag, attrs], index) => jsx(tag, { ...attrs }, index))}
      </svg>
    );
  };
}
