import {
  implementsTrait,
  defineTrait,
  getScene,
  OWNER_ID,
  gameStart,
  gameUpdate,
  $string,
  spriteTrait,
  transformTrait,
  collisionBodyTrait,
} from "gameide";
import type { MainContext } from "./gameConfig";
import { loadAssets } from "virtual:gameide-assets";

const playerTrait = defineTrait([
  spriteTrait,
  collisionBodyTrait,
  {
    [OWNER_ID]: $string,
    boxCollider: {
      width: 32,
      height: 32,
      isTrigger: false,
      offset: { x: 0, y: 0 },
    },
    moveSpeed: 260,
    jumpSpeed: 650,
    playerGravityY: -1500,
    grounded: false,
  },
]);

const PLAYER_SPRITE_TINT = "#ffffff";

export function main({ input, networking, planck }: MainContext): void {
  const scene = getScene();

  gameStart(() => {
    scene.createObject("ground", {
      ...transformTrait,
      position: { x: 0, y: -420, z: 0 },
      boxCollider: {
        width: 2400,
        height: 40,
        isTrigger: false,
        offset: { x: 0, y: 0 },
      },
      collisionBody: { type: "static" },
    });

    const platforms: { x: number; y: number; w: number }[] = [
      { x: -280, y: -320, w: 180 },
      { x: 120, y: -260, w: 200 },
      { x: 420, y: -200, w: 160 },
      { x: -520, y: -200, w: 140 },
      { x: 640, y: -300, w: 220 },
    ];

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i]!;
      scene.createObject(`platform_${i}`, {
        ...transformTrait,
        position: { x: p.x, y: p.y, z: 0 },
        boxCollider: {
          width: p.w,
          height: 24,
          isTrigger: false,
          offset: { x: 0, y: 0 },
        },
        collisionBody: { type: "static" },
      });
    }

    scene.createObject(
      networking.peerId,
      networking.withOwnership({
        ...transformTrait,
        position: { x: 0, y: -280, z: 0 },
        sprite: {
          asset: loadAssets()["assets/typescript.svg"],
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
          velocity: { x: 0, y: 0 },
          fixedRotation: true,
        },
        moveSpeed: playerTrait.moveSpeed,
        jumpSpeed: playerTrait.jumpSpeed,
        playerGravityY: playerTrait.playerGravityY,
        grounded: playerTrait.grounded,
      }),
    );

    for (const player of scene.query(implementsTrait(playerTrait))) {
      if (!networking.isOwned(player)) continue;
      void planck.onCollision(player, (other, e) => {
        if (!planck.isStatic(other)) return;
        player.grounded = e.phase === "enter";
      });
    }
  });

  gameUpdate((deltaTime) => {
    const horizontal = input.axes.Horizontal;
    for (const player of scene.query(implementsTrait(playerTrait))) {
      if (!networking.isOwned(player)) continue;

      const gravity = player.playerGravityY * Math.min(deltaTime, 0.1);
      if (input.buttons.Jump.pressed && player.grounded) {
        player.collisionBody.velocity.y = player.jumpSpeed;
      }

      player.collisionBody.velocity.x = horizontal * player.moveSpeed;
      player.collisionBody.velocity.y += gravity;
    }
  });
}
