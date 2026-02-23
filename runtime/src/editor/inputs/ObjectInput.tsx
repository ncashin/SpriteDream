import type { InputDisplayProps } from "./types";

export function ObjectInput({ value }: InputDisplayProps) {
  return (
    <pre className="flex-1 max-w-full whitespace-pre-wrap break-words text-dark-tx-2">
      {JSON.stringify(value)}
    </pre>
  );
}
