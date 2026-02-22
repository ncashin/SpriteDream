export const $string = Symbol("string");
export const $number = Symbol("number");
export const $boolean = Symbol("boolean");
export const $object = Symbol("object");
export const $array = Symbol("array");
export const $function = Symbol("function");
export const $null = Symbol("null");
export const $undefined = Symbol("undefined");
export const $symbol = Symbol("symbol");

export type TypeSymbolMap = {
  [K in typeof $string]: string;
} & {
  [K in typeof $number]: number;
} & {
  [K in typeof $boolean]: boolean;
} & {
  [K in typeof $object]: object;
} & {
  [K in typeof $array]: unknown[];
} & {
  [K in typeof $function]: (...args: unknown[]) => unknown;
} & {
  [K in typeof $null]: null;
} & {
  [K in typeof $undefined]: undefined;
} & {
  [K in typeof $symbol]: symbol;
};

export type TypeSymbol = keyof TypeSymbolMap;

export const TYPE_SYMBOLS = new Set<symbol>([
  $string, $number, $boolean, $object, $array, $function, $null, $undefined, $symbol,
]);

export function isTypeSymbol(value: unknown): value is TypeSymbol {
  return typeof value === "symbol" && TYPE_SYMBOLS.has(value);
}