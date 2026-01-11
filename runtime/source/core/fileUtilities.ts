// Type declaration for Tauri window property
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

// Message types for file operations
type FileRequest =
  | { type: "readFile"; path: string }
  | { type: "writeFile"; path: string; content: string }
  | { type: "listFiles"; path: string }
  | { type: "getWorkspaceRoot" };

type FileResponse =
  | { type: "readFile"; success: true; content: string }
  | { type: "readFile"; success: false; error: string }
  | { type: "writeFile"; success: true }
  | { type: "writeFile"; success: false; error: string }
  | { type: "listFiles"; success: true; files: [string, number][] }
  | { type: "listFiles"; success: false; error: string }
  | { type: "getWorkspaceRoot"; success: true; root: string }
  | { type: "getWorkspaceRoot"; success: false; error: string };

// Send a file operation request and wait for response
async function requestFileOperation<T extends FileRequest>(
  request: T
): Promise<Extract<FileResponse, { type: T["type"] }>> {
  if (!window.parent || window.parent === window) {
    throw new Error("Not running in iframe");
  }

  const requestId = `file_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error(`File operation timeout: ${request.type}`));
    }, 10000);

    const handler = (event: MessageEvent) => {
      const response = event.data as FileResponse & { requestId?: string };

      if (response.requestId === requestId && response.type === request.type) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);

        if (response.success) {
          resolve(response as Extract<FileResponse, { type: T["type"] }>);
        } else {
          reject(new Error(response.error || `${request.type} failed`));
        }
      }
    };

    window.addEventListener("message", handler);
    window.parent.postMessage({ ...request, requestId }, "*");
  });
}

export async function readFile(filePath: string): Promise<string> {
  // In Tauri production, try to use Tauri's resource API
  if (typeof window !== "undefined" && window.__TAURI__) {
    try {
      const { resolveResource } = await import("@tauri-apps/api/path");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const resourcePath = await resolveResource(filePath);
      return await readTextFile(resourcePath);
    } catch (error) {
      // Fall back to message-based file reading if Tauri API fails
      console.warn(
        "Tauri resource read failed, falling back to message API:",
        error
      );
    }
  }

  // Use message-based file reading (for VSCode context or fallback)
  const response = await requestFileOperation({
    type: "readFile",
    path: filePath,
  });
  if (!response.success) throw new Error(response.error);
  return response.content;
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  const response = await requestFileOperation({
    type: "writeFile",
    path: filePath,
    content,
  });
  if (!response.success) throw new Error(response.error);
}

export async function listFiles(dirPath: string): Promise<[string, number][]> {
  const response = await requestFileOperation({
    type: "listFiles",
    path: dirPath,
  });
  if (!response.success) throw new Error(response.error);
  return response.files;
}

export async function getWorkspaceRoot(): Promise<string> {
  const response = await requestFileOperation({ type: "getWorkspaceRoot" });
  if (!response.success) throw new Error(response.error);
  return response.root;
}

export function isVSCodeContext(): boolean {
  return window.parent !== window && window.parent !== null;
}
