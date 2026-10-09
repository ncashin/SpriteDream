export type SceneNode = string | DOMMatrix | { [name: string]: SceneNode };

export function createScene(): { [name: string]: SceneNode } {
  return {
    square: {
      transform: new DOMMatrix().translate(350, 300),
      width: "64",
      height: "64",
      tint: "#f4f4f5ff",
      image: "default.png",
      booleanValue: "true",
    },
    key: "property",
    test: { nested: { objects: "hello"}},
  };
}

export const scene = createScene();

export function queryScene<Result>(
  scene: { [name: string]: SceneNode },
  check: (value: SceneNode) => Result,
): NonNullable<Result>[] {
  return Object.values(scene)
    .map(check)
    .filter((node): node is NonNullable<Result> => node != null);
}
