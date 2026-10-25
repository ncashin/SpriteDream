import { css } from "remix/component";
import type { Handle } from "remix/component";
import { enum_, parseSafe } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

export const supportedFileType = enum_(["scene", "json", "ts", "tsx"] as const);
export type SupportedFileType = InferOutput<typeof supportedFileType>;

export type ProjectFile = {
  type: SupportedFileType;
  path: string;
  content: string;
};

export function FileViewer(handle: Handle<{ file: ProjectFile }>) {
  const { file } = handle.props;
  let content = file.content;

  return () => {
    const fileType = parseSafe(supportedFileType, file.type);
    if (!fileType.success) return <>Unsupported File Type</>;

    switch (file.type) {
      case "scene":
        
      case "json":
      case "ts":
      case "tsx":
        return (
          <pre
            mix={css({
              boxSizing: "border-box",
              height: "100%",
              margin: 0,
              overflow: "auto",
              padding: "1rem",
              whiteSpace: "pre-wrap",
            })}
          >
            {content}
          </pre>
        );
    }
  };
}
