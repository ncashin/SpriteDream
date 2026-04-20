import {
  getScene,
  getSceneObjectPath,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  editorPlugin,
  networkingPlugin,
  SCENE_OWNER_ID,
  gameStart,
  gameUpdate,
  update,
  type SceneObject,
  type SceneObjectData,
} from "gameide";
import sampleScene from "./sample.scene";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

const rootElement = document.getElementById("app");
invariant(rootElement);

type PlayerBody = SceneObjectData & {
  x: number;
  y: number;
  speed: number;
  health: number;
  maxHealth: number;
} & Partial<Record<typeof SCENE_OWNER_ID, string>>;

type ProjectileBody = SceneObjectData & {
  kind: "projectile";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lifetime: number;
} & Partial<Record<typeof SCENE_OWNER_ID, string>>;

const isPlayer = (gameObject: SceneObjectData): gameObject is PlayerBody =>
  typeof gameObject.x === "number" &&
  typeof gameObject.y === "number" &&
  typeof gameObject.speed === "number" &&
  typeof (gameObject as PlayerBody).health === "number" &&
  typeof (gameObject as PlayerBody).maxHealth === "number" &&
  (gameObject as { kind?: unknown }).kind !== "projectile";

const isProjectile = (gameObject: SceneObjectData): gameObject is ProjectileBody =>
  (gameObject as { kind?: unknown }).kind === "projectile" &&
  typeof gameObject.x === "number" &&
  typeof gameObject.y === "number" &&
  typeof gameObject.vx === "number" &&
  typeof gameObject.vy === "number" &&
  typeof gameObject.radius === "number" &&
  typeof gameObject.lifetime === "number";

function hashHue(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}

function playerColor(id: string): string {
  return `hsl(${hashHue(id)} 55% 52%)`;
}

function newProjectileId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `proj-${crypto.randomUUID()}`;
  }
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function playerObjectKey(peerId: string): string {
  return `player-${peerId}`;
}

const PLAYER_MAX_HEALTH = 100;
const PROJECTILE_DAMAGE = 20;

function circleRectOverlap(
  cx: number,
  cy: number,
  radius: number,
  px: number,
  py: number,
  halfExtent: number,
): boolean {
  const closestX = Math.max(px - halfExtent, Math.min(cx, px + halfExtent));
  const closestY = Math.max(py - halfExtent, Math.min(cy, py + halfExtent));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function projectileOverlapsPlayer(
  proj: ProjectileBody,
  player: PlayerBody,
  playerHalfExtent: number,
): boolean {
  return circleRectOverlap(
    proj.x,
    proj.y,
    proj.radius,
    player.x,
    player.y,
    playerHalfExtent,
  );
}

/** Remove a root-level scene object (players, projectiles); must use delete so scene sync runs. */
function deleteRootSceneChild(root: SceneObject, path: PropertyKey[] | undefined): void {
  if (path === undefined || path.length !== 1) {
    return;
  }
  Reflect.deleteProperty(root as object, path[0]!);
}

function aimFromMouse(
  canvas: HTMLCanvasElement,
  mouse: { x: number; y: number } | null,
  player: PlayerBody,
): { ax: number; ay: number } {
  if (!mouse) {
    return { ax: 1, ay: 0 };
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (mouse.x - rect.left) * scaleX;
  const my = (mouse.y - rect.top) * scaleY;
  const aimWorldX = mx - canvas.width / 2;
  const aimWorldY = canvas.height / 2 - my;
  let dx = aimWorldX - player.x;
  let dy = aimWorldY - player.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) {
    return { ax: 1, ay: 0 };
  }
  return { ax: dx / len, ay: dy / len };
}

initializeGame({
  rootElement,
  initialContext: {},
  initialScene: sampleScene,
  plugins: initializePlugins([
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    networkingPlugin({
      room: "default",
      url: "ws://localhost:5173/room?room=default",
    }),
    inputPlugin({
      axes: {
        Horizontal: {
          negative: ["KeyA", "KeyArrowLeft"],
          positive: ["KeyD", "KeyArrowRight"],
        },
        Vertical: {
          negative: ["KeyS", "KeyArrowDown"],
          positive: ["KeyW", "KeyArrowUp"],
        },
      },
      buttons: {
        Fire: ["KeyF", "KeySpace"],
      },
    }),
  ]),
  main({ input, networking, rootElement }) {
    const scene = getScene();

    gameStart(() => {
      scene.createObject(
        playerObjectKey(networking.peerId),
        networking.withOwnership({
          x: 0,
          y: 0,
          speed: 200,
          health: PLAYER_MAX_HEALTH,
          maxHealth: PLAYER_MAX_HEALTH,
        }),
      );
    });

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.width = rootElement.clientWidth;
    canvas.height = rootElement.clientHeight;
    canvas.style.display = "block";
    rootElement.prepend(canvas);

    const context = canvas.getContext("2d");
    invariant(context);

    window.addEventListener("resize", () => {
      canvas.width = rootElement.clientWidth;
      canvas.height = rootElement.clientHeight;
    });

    const playerSize = 32;
    const half = playerSize / 2;
    const projectileSpeed = 420;
    const worldHalfExtent = 2800;
    const damagedByProjectileKey = new Set<string>();

    update(() => {
      context.fillStyle = "#0f1419";
      context.fillRect(0, 0, canvas.width, canvas.height);

      for (const player of scene.query(isPlayer)) {
        const px = canvas.width / 2 + player.x;
        const py = canvas.height / 2 - player.y;
        context.fillStyle = playerColor(player[SCENE_OWNER_ID] ?? "");
        context.fillRect(px - half, py - half, playerSize, playerSize);

        if (!networking.isOwned(player)) {
          continue;
        }
        const barW = 200;
        const barH = 10;
        const bx = (canvas.width - barW) / 2;
        const by = canvas.height - 36;
        const ratio = Math.max(0, Math.min(1, player.health / player.maxHealth));
        context.fillStyle = "rgba(15, 20, 25, 0.85)";
        context.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
        context.fillStyle = "#334155";
        context.fillRect(bx, by, barW, barH);
        context.fillStyle = ratio > 0.25 ? "#22c55e" : "#ef4444";
        context.fillRect(bx, by, barW * ratio, barH);
        context.fillStyle = "#e2e8f0";
        context.font = "12px system-ui, sans-serif";
        context.fillText(
          `HP ${Math.ceil(player.health)} / ${player.maxHealth}`,
          bx,
          by - 6,
        );
      }

      for (const proj of scene.query(isProjectile)) {
        const px = canvas.width / 2 + proj.x;
        const py = canvas.height / 2 - proj.y;
        context.beginPath();
        context.arc(px, py, proj.radius, 0, Math.PI * 2);
        context.fillStyle = "#f5a524";
        context.fill();
      }

      context.fillStyle = "#94a3b8";
      context.font = "13px system-ui, sans-serif";
      context.fillText(
        "WASD move, Space/F fire toward mouse — each peer owns their shots (`withOwnership`).",
        12,
        22,
      );
      context.fillText("Open two tabs to test multiplayer damage.", 12, 40);
    });

    gameUpdate((deltaTime) => {
      for (const player of scene.query(isPlayer)) {
        if (!networking.isOwned(player)) {
          continue;
        }
        const horizontal = input.axes.Horizontal;
        const vertical = input.axes.Vertical;
        player.x += horizontal * player.speed * deltaTime;
        player.y += vertical * player.speed * deltaTime;

        if (input.buttons.Fire.pressed) {
          const { ax, ay } = aimFromMouse(canvas, input.mouse.position, player);
          scene.createObject(
            newProjectileId(),
            networking.withOwnership({
              kind: "projectile",
              x: player.x,
              y: player.y,
              vx: ax * projectileSpeed,
              vy: ay * projectileSpeed,
              radius: 7,
              lifetime: 2.6,
            }),
          );
        }
      }

      for (const proj of scene.query(isProjectile)) {
        if (!networking.isOwned(proj)) {
          continue;
        }
        proj.x += proj.vx * deltaTime;
        proj.y += proj.vy * deltaTime;
        proj.lifetime -= deltaTime;

        const path = getSceneObjectPath(proj);
        const projKey = path?.join(".") ?? "";
        const shooterId = proj[SCENE_OWNER_ID];
        const out =
          Math.abs(proj.x) > worldHalfExtent || Math.abs(proj.y) > worldHalfExtent;
        let hitEnemy = false;
        if (!out && proj.lifetime > 0) {
          for (const target of scene.query(isPlayer)) {
            const victimSceneKey = getSceneObjectPath(target)?.[0];
            if (
              victimSceneKey === undefined ||
              String(target[SCENE_OWNER_ID]) === String(shooterId)
            ) {
              continue;
            }
            if (!projectileOverlapsPlayer(proj, target, half)) {
              continue;
            }
            if (damagedByProjectileKey.has(projKey)) {
              continue;
            }
            damagedByProjectileKey.add(projKey);
            target.health = Math.max(0, target.health - PROJECTILE_DAMAGE);
            hitEnemy = true;
            break;
          }
        }
        if (proj.lifetime <= 0 || out || hitEnemy) {
          deleteRootSceneChild(scene, path);
          if (path !== undefined) {
            damagedByProjectileKey.delete(path.join("."));
          }
        }
      }
    });
  },
});
