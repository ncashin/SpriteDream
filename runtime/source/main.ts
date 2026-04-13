import {
  getScene,
  getSceneObjectPath,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  editorPlugin,
  getGameIDESignalingURL,
  networkingPlugin,
  SCENE_OWNER_ID,
  gameStart,
  gameUpdate,
  update,
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
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
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

initializeGame({
  rootElement,
  initialContext: {},
  initialScene: sampleScene,
  plugins: initializePlugins([
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    networkingPlugin({
      roomId: "default",
      signalingURL: getGameIDESignalingURL(),
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
  main({ input, networking }) {
    const scene = getScene();

    gameStart(() => {
      scene.createObject(
        networking.peerId,
        networking.withOwnership({
          x: 0,
          y: 0,
          speed: 200,
        }),
      );
    });

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.width = rootElement.clientWidth;
    canvas.height = rootElement.clientHeight;
    canvas.style.display = "block";
    rootElement.appendChild(canvas);

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

    update(() => {
      context.fillStyle = "#0f1419";
      context.fillRect(0, 0, canvas.width, canvas.height);

      for (const player of scene.query(isPlayer)) {
        const px = canvas.width / 2 + player.x;
        const py = canvas.height / 2 - player.y;
        context.fillStyle = playerColor(player[SCENE_OWNER_ID] ?? "");
        context.fillRect(px - half, py - half, playerSize, playerSize);
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
      context.fillText("WASD move, Space/F fire — each peer owns their shots (`withOwnership`).", 12, 22);
      context.fillText("Open two tabs to see both players and projectiles.", 12, 40);
    });

    gameUpdate((deltaTime) => {
      for (const player of scene.query(isPlayer)) {
        if (!networking.isOwned(player)) {
          continue;
        }
        const h = input.axes.Horizontal;
        const v = input.axes.Vertical;
        player.x += h * player.speed * deltaTime;
        player.y += v * player.speed * deltaTime;

        if (input.buttons.Fire.pressed) {
          const len = Math.hypot(h, v);
          const ax = len > 0.08 ? h / len : 1;
          const ay = len > 0.08 ? v / len : 0;
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
        const out =
          Math.abs(proj.x) > worldHalfExtent || Math.abs(proj.y) > worldHalfExtent;
        if (proj.lifetime <= 0 || out) {
          const path = getSceneObjectPath(proj);
          const key = path?.[0];
          if (key !== undefined) {
            Reflect.deleteProperty(scene, key);
          }
        }
      }
    });
  },
});
