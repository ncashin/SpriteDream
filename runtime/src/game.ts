import "./style.css";
import { initializeGame } from "./runtime/initializeGame";
import { gameStart, gameUpdate } from "./runtime/gameloop";
import { render2DPlugin } from "./render2D/render2DPlugin";
import { getScene } from "./scene/scene";
import { SpriteDefinition } from "./render2D/sprite";
import { instantiateObject } from "./scene/objectDefinition";
import { inputPlugin } from "./input/inputPlugin";
import { networkingPlugin, NetworkedObjectDefinition } from "./networking/networkingPlugin";

const PLAYER_SPEED = 200;
const PROJECTILE_SPEED = 400;
const PROJECTILE_COOLDOWN_MS = 150;

export type CreateProjectileOptions = {
  x: number;
  y: number;
  velocityX?: number;
  velocityY?: number;
  width?: number;
  height?: number;
  image?: string;
};

export type CreateProjectileContext = {
  networking?: { peerId: string } | null;
};

/** Creates a projectile in the scene and returns its id. Optionally pass velocity to have it move in gameUpdate. */
export function createProjectile(
  scene: ReturnType<typeof getScene>,
  options: CreateProjectileOptions,
  context?: CreateProjectileContext
): string {
  const id = crypto.randomUUID();
  const projectile = instantiateObject(
    [SpriteDefinition, NetworkedObjectDefinition],
    {
      __ownerId: context?.networking?.peerId ?? id,
      transform2D: { x: options.x, y: options.y },
      sprite: {
        image: options.image ?? "/src/typescript.svg",
        width: options.width ?? 16,
        height: options.height ?? 16,
      },
    }
  ) as Record<string, unknown>;
  if (options.velocityX !== undefined) projectile.velocityX = options.velocityX;
  if (options.velocityY !== undefined) projectile.velocityY = options.velocityY;
  scene[id] = projectile;
  return id;
}

await initializeGame({
  plugins: [inputPlugin(), render2DPlugin(), networkingPlugin()],
  main: (context) => {
    const scene = getScene();
    const playerId = crypto.randomUUID();
    const projectileIds = new Set<string>();
    let elapsedMs = 0;
    let lastProjectileTime = -PROJECTILE_COOLDOWN_MS;

    gameStart(() => {
      scene[playerId] = instantiateObject(
        [SpriteDefinition, NetworkedObjectDefinition],
        {
          __ownerId: context.networking?.peerId ?? playerId,
          transform2D: {
            x: 200,
            y: 200,
          },
          sprite: {
            image: "/src/typescript.svg",
            width: 32,
            height: 32,
          },
        }
      );
    });

    gameUpdate((deltaMs) => {
      elapsedMs += deltaMs;
      const player = scene[playerId] as any;
      if (!player) return;
      const d = (deltaMs / 1000) * PLAYER_SPEED;
      if (context.input.keyboard.isDown("KeyW")) player.transform2D.y += d;
      if (context.input.keyboard.isDown("KeyS")) player.transform2D.y -= d;
      if (context.input.keyboard.isDown("KeyA")) player.transform2D.x -= d;
      if (context.input.keyboard.isDown("KeyD")) player.transform2D.x += d;

      if (
        context.input.keyboard.isDown("Space") &&
        elapsedMs - lastProjectileTime >= PROJECTILE_COOLDOWN_MS
      ) {
        lastProjectileTime = elapsedMs;
        const id = createProjectile(scene, {
          x: player.transform2D.x,
          y: player.transform2D.y,
          velocityY: -PROJECTILE_SPEED,
        }, context);
        projectileIds.add(id);
      }

      const dt = deltaMs / 1000;
      const toRemove: string[] = [];
      for (const id of projectileIds) {
        const obj = scene[id] as Record<string, unknown> | undefined;
        if (!obj?.transform2D) {
          toRemove.push(id);
          continue;
        }
        const t = obj.transform2D as { x: number; y: number };
        const vx = (obj.velocityX as number) ?? 0;
        const vy = (obj.velocityY as number) ?? 0;
        t.x += vx * dt;
        t.y += vy * dt;
      }
      for (const id of toRemove) projectileIds.delete(id);
    });
  },
});
