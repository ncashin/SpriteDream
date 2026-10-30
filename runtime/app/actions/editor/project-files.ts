type Reply = {
  directory?: string;
  files?: string[];
  body?: Uint8Array;
  ok?: boolean;
};

let chain: Promise<void> = Promise.resolve();
let accept: ((reply: Reply) => void) | undefined;

if (process.send) {
  process.on("message", (reply: Reply) => {
    accept?.(reply);
    accept = undefined;
  });
}

function call(message: { type: string; directory: string; filePath?: string; body?: Uint8Array }) {
  if (!process.send) return Promise.resolve(undefined);

  const result = chain.then(
    () =>
      new Promise<Reply | undefined>((resolve) => {
        accept = resolve;
        if (process.send?.(message) === false) {
          accept = undefined;
          resolve(undefined);
        }
      }),
  );
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function projectDirectory(directory: string) {
  return call({ type: "project-directory", directory }).then((reply) => reply?.directory);
}

export function listProjectFiles(directory: string) {
  return call({ type: "list-files", directory }).then((reply) => reply?.files ?? []);
}

export function readProjectFile(directory: string, filePath: string) {
  return call({ type: "read-file", directory, filePath }).then((reply) => reply?.body);
}

export function writeProjectFile(directory: string, filePath: string, body: Uint8Array) {
  return call({ type: "write-file", directory, filePath, body }).then((reply) => reply?.ok === true);
}
