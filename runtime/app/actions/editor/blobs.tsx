import { css } from "remix/component";

const colors = ["#f43f5e", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#fb7185"];

export const blobs = [
  "M24 118.876C-14.4 95.6761 42.5 29.5051 74.5 1.50516C57.7 39.1051 81.4999 80.5051 95.4999 96.5051C88.4999 112.172 62.4 142.076 24 118.876Z",
  "M50 122C18 124 4 96 10 68C16 36 34 8 54 10C80 14 100 42 96 74C92 106 78 122 50 122Z",
  "M77 118.876C115.4 95.6761 58.5 29.5051 26.5 1.50516C43.3 39.1051 19.5 80.5051 5.5 96.5051C12.5 112.172 38.6 142.076 77 118.876Z",
  "M50 116C22 120 6 98 12 72C18 42 32 18 50 16C72 18 98 40 94 72C90 104 74 116 50 116Z",
];

export function blobColor(id: string) {
  let total = 0;
  for (const char of id) total = (total + char.charCodeAt(0)) % colors.length;
  return colors[total];
}

export function faceFor(id: string) {
  return (
    <svg viewBox="0 0 101 130" aria-hidden="true" mix={face}>
      <path d={blobs[hash(id) % blobs.length]} fill={blobColor(id)} stroke="black" stroke-width="4" stroke-linejoin="round" />
      <path d="M19 112C28.4 112 36 104.4 36 95C36 85.6 28.4 78 19 78C9.6 78 2 85.6 2 95C2 104.4 9.6 112 19 112Z" fill="#D9D9D9" stroke="black" stroke-width="4" />
      <path d="M82 112C91.4 112 99 104.4 99 95C99 85.6 91.4 78 82 78C72.6 78 65 85.6 65 95C65 104.4 72.6 112 82 112Z" fill="#D9D9D9" stroke="black" stroke-width="4" />
    </svg>
  );
}

function hash(value: string) {
  let total = 0;
  for (const char of value) total = (total * 33 + char.charCodeAt(0)) >>> 0;
  return total;
}

const face = css({
  display: "block",
  flex: "0 0 auto",
  height: "1.75rem",
  width: "1.4rem",
});
