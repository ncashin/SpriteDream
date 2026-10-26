import { css } from "remix/component";
import type { Handle } from "remix/component";
import type { IconNode } from "lucide";

import { Icon } from "../../icon.tsx";

import File from "lucide/dist/esm/icons/file.mjs";
import FileImage from "lucide/dist/esm/icons/file-image.mjs";

const brandIcons: Record<string, string> = {
  js: "/icons/javascript.svg",
  mjs: "/icons/javascript.svg",
  cjs: "/icons/javascript.svg",
  ts: "/icons/typescript.svg",
  tsx: "/icons/react.svg",
  json: "/icons/json.svg",
  scene: "/icons/json.svg",
  md: "/icons/markdown.svg",
  svg: "/icons/svg.svg",
};

const fileIcons: Record<string, IconNode> = {
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  webp: FileImage,
};

const iconStyle = css({
  display: "block",
  flex: "0 0 auto",
});

export function FileIcon(handle: Handle<{ path: string; size?: number }>) {
  return () => {
    const { path, size = 16 } = handle.props;
    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    const brand = brandIcons[extension];

    if (brand) {
      return <img src={brand} alt="" width={size} height={size} mix={iconStyle} />;
    }

    return <Icon icon={fileIcons[extension] ?? File} size={size} />;
  };
}
