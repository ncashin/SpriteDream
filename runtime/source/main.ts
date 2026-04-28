import {
  implementsTrait,
  defineTrait,
  gameObject,
  getScene,
  OWNER_ID,
  gameStart,
  gameUpdate,
  $string,
  withOwnership,
  spriteTrait,
  transformTrait,
  collisionBodyTrait,
  boxColliderTrait,
  circleColliderTrait,
  type ViewportState,
} from "gameide";
import type { MainContext } from "./gameConfig";
import typescriptSVGURL from "../assets/typescript.svg?url";

function screenToSceneWorld(
  clientX: number,
  clientY: number,
  rootRect: DOMRectReadOnly,
  v: Readonly<ViewportState>,
): { x: number; y: number } {
  const sx = clientX - rootRect.left;
  const sy = clientY - rootRect.top;
  const { width, height, centerX, centerY, scale } = v;
  const px = width / 2 - centerX * scale;
  const py = height / 2 + centerY * scale;
  return {
    x: (sx - px) / scale,
    y: (py - sy) / scale,
  };
}

const playerTrait = defineTrait({
  [OWNER_ID]: $string,
  moveSpeed: 260,
  jumpSpeed: 650,
  playerGravityY: -1500,
  grounded: false,
});

const bouncyBallTrait = defineTrait({
  [OWNER_ID]: $string,
  chaseAccel: 1550,
  maxSpeed: 740,
});

const PLAYER_SPRITE_TINT = "#ffffff";
const BALL_SPRITE_TINT = "#ff8c42";

export function main({
  input,
  networking,
  planck,
  pixi,
  rootElement,
}: MainContext): void {
  const scene = getScene();

  gameStart(() => {
    scene.createObject(
      "ground",
      gameObject([
        transformTrait,
        collisionBodyTrait,
        boxColliderTrait,
        {
          position: { x: 0, y: -420, z: 0 },
          boxCollider: {
            width: 2400,
            height: 40,
            isTrigger: false,
            offset: { x: 0, y: 0 },
          },
          collisionBody: { type: "static" },
        },
      ]),
    );

    const platforms: { x: number; y: number; w: number }[] = [
      { x: -280, y: -320, w: 180 },
      { x: 120, y: -260, w: 200 },
      { x: 420, y: -200, w: 160 },
      { x: -520, y: -200, w: 140 },
      { x: 640, y: -300, w: 220 },
    ];

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i]!;
      scene.createObject(
        `platform_${i}`,
        gameObject([
          transformTrait,
          collisionBodyTrait,
          boxColliderTrait,
          {
            position: { x: platform.x, y: platform.y, z: 0 },
            boxCollider: {
              width: platform.w,
              height: 24,
              isTrigger: false,
              offset: { x: 0, y: 0 },
            },
            collisionBody: { type: "static" },
          },
        ]),
      );
    }

    scene.createObject(
      networking.peerId,
      networking.withOwnership(
        gameObject([
          transformTrait,
          playerTrait,
          spriteTrait,
          collisionBodyTrait,
          boxColliderTrait,
          {
            position: { x: 0, y: -280, z: 0 },
            sprite: {
              asset: typescriptSVGURL,
              width: 32,
              height: 32,
              tint: PLAYER_SPRITE_TINT,
            },
            boxCollider: {
              width: 32,
              height: 32,
              isTrigger: false,
              offset: { x: 0, y: 0 },
            },
            collisionBody: {
              type: "dynamic",
              velocity: { x: 0, y: 0, angular: 0 },
              fixedRotation: true,
            },
          },
        ]),
      ),
    );

    for (const player of scene.query(
      implementsTrait([
        playerTrait,
        spriteTrait,
        collisionBodyTrait,
        boxColliderTrait,
      ]),
    )) {
      if (!networking.isOwned(player)) continue;
      void planck.onCollision(player, (other, e) => {
        if (!planck.isStatic(other)) return;
        player.grounded = e.phase === "enter";
      });
    }

    const bouncyBallOwnerId =
      [...new Set([networking.peerId, ...networking.getPeers()])].sort()[0] ??
      networking.peerId;

    scene.createObject(
      "bouncy_ball",
      withOwnership(
        gameObject([
          transformTrait,
          bouncyBallTrait,
          spriteTrait,
          collisionBodyTrait,
          circleColliderTrait,
          {
            position: { x: -140, y: -200, z: 0 },
            sprite: {
              asset: typescriptSVGURL,
              width: 36,
              height: 36,
              tint: BALL_SPRITE_TINT,
            },
            circleCollider: {
              radius: 18,
              isTrigger: false,
              restitution: 0.88,
              offset: { x: 0, y: 0 },
            },
            collisionBody: {
              type: "dynamic",
              velocity: { x: 0, y: 0, angular: 0 },
              fixedRotation: false,
            },
          },
        ]),
        bouncyBallOwnerId,
      ),
    );
  });

  gameUpdate((deltaTime) => {
    const horizontal = input.axes.Horizontal;
    const clampedDt = Math.min(deltaTime, 0.1);
    const sharedGravity = playerTrait.playerGravityY * clampedDt;

    for (const player of scene.query(
      implementsTrait([
        playerTrait,
        spriteTrait,
        collisionBodyTrait,
        boxColliderTrait,
      ]),
    )) {
      if (!networking.isOwned(player)) continue;

      const gravity = player.playerGravityY * clampedDt;
      if (input.buttons.Jump.pressed && player.grounded) {
        player.collisionBody.velocity.y = player.jumpSpeed;
      }

      player.collisionBody.velocity.x = horizontal * player.moveSpeed;
      player.collisionBody.velocity.y += gravity;
    }

    const mouse = input.mouse.position;
    const vp = pixi.viewport.state;
    const rootRect = rootElement.getBoundingClientRect();

    for (const ball of scene.query(
      implementsTrait([
        bouncyBallTrait,
        spriteTrait,
        collisionBodyTrait,
        circleColliderTrait,
      ]),
    )) {
      if (!networking.isOwned(ball)) continue;

      ball.collisionBody.velocity.y += sharedGravity;

      if (mouse) {
        const target = screenToSceneWorld(mouse.x, mouse.y, rootRect, vp);
        const dx = target.x - ball.position.x;
        const dy = target.y - ball.position.y;
        const len = Math.hypot(dx, dy);
        if (len > 8) {
          const nx = dx / len;
          const ny = dy / len;
          const push = ball.chaseAccel * clampedDt;
          ball.collisionBody.velocity.x += nx * push;
          ball.collisionBody.velocity.y += ny * push;
        }
      }

      const max = ball.maxSpeed;
      const spd = Math.hypot(
        ball.collisionBody.velocity.x,
        ball.collisionBody.velocity.y,
      );
      if (spd > max) {
        const s = max / spd;
        ball.collisionBody.velocity.x *= s;
        ball.collisionBody.velocity.y *= s;
      }
    }
  });
}
