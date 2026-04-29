import {
  type BaseSceneObject,
  type PlanckCallbackEvent,
  implementsTrait,
  defineTrait,
  gameObject,
  getScene,
  gameStart,
  gameUpdate,
  ownerTrait,
  spriteTrait,
  transformTrait,
  collisionBodyTrait,
  boxColliderTrait,
  circleColliderTrait,
  screenToSceneWorld,
  contactSupportsSelfFromBelow,
} from "gameide";
import type { MainContext } from "./gameConfig";
import typescriptSVGURL from "../assets/typescript.svg?url";

const playerTrait = defineTrait({
  moveSpeed: 260,
  jumpSpeed: 650,
  playerGravityY: -1500,
  grounded: false,
});

/** Local carry state (world has one authored bouncy ball). */
let bouncyBallCarriedByLocalPlayer = false;

const bouncyBallTrait = defineTrait({
  pickupReach: 92,
  throwSpeed: 720,
});

const HOLD_OFFSET = { x: 34, y: -22 };

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
          ownerTrait,
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
              offset: { x: 0, y: 0 },
            },
            collisionBody: {
              type: "dynamic",
              velocity: { x: 0, y: 0, angular: 0 },
              fixedRotation: true,
              isTrigger: false,
              restitution: 0,
              friction: 0,
              disabled: false,
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
      let floorSupportContacts = 0;
      void planck.onCollision(player, (other: BaseSceneObject, e: PlanckCallbackEvent) => {
        if (!planck.isStatic(other)) return;
        if (!contactSupportsSelfFromBelow(e.contact, e.selfFixture)) return;
        if (e.phase === "enter") floorSupportContacts++;
        else floorSupportContacts = Math.max(0, floorSupportContacts - 1);
        player.grounded = floorSupportContacts > 0;
      });
    }

    scene.createObject(
      "bouncy_ball",
      networking.withOwnership(
        gameObject([
          transformTrait,
          ownerTrait,
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
              offset: { x: 0, y: 0 },
            },
            collisionBody: {
              type: "dynamic",
              velocity: { x: 0, y: 0, angular: 0 },
              fixedRotation: false,
              isTrigger: false,
              restitution: 0.88,
              friction: 0.3,
              disabled: false,
            },
          },
        ]),
      ),
    );
  });

  gameUpdate((deltaTime) => {
    const horizontal = input.axes.Horizontal;
    const clampedDt = Math.min(deltaTime, 0.1);
    const sharedGravity = playerTrait.playerGravityY * clampedDt;

    let localOwnedPlayer: { position: { x: number; y: number } } | null =
      null;
    for (const player of scene.query(
      implementsTrait([
        playerTrait,
        spriteTrait,
        collisionBodyTrait,
        boxColliderTrait,
      ]),
    )) {
      if (!networking.isOwned(player)) continue;
      localOwnedPlayer = player as { position: { x: number; y: number } };

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

      if (
        !bouncyBallCarriedByLocalPlayer &&
        localOwnedPlayer &&
        input.buttons.GrabInteract.pressed
      ) {
        const dx = ball.position.x - localOwnedPlayer.position.x;
        const dy = ball.position.y - localOwnedPlayer.position.y;
        if (Math.hypot(dx, dy) <= ball.pickupReach) {
          bouncyBallCarriedByLocalPlayer = true;
        }
      }

      if (bouncyBallCarriedByLocalPlayer && localOwnedPlayer) {
        ball.collisionBody.disabled = true;
        ball.position.x = localOwnedPlayer.position.x + HOLD_OFFSET.x;
        ball.position.y = localOwnedPlayer.position.y + HOLD_OFFSET.y;
        ball.collisionBody.velocity.x = 0;
        ball.collisionBody.velocity.y = 0;
        ball.collisionBody.velocity.angular = 0;

        if (input.buttons.Throw.pressed && mouse) {
          const aim = screenToSceneWorld(mouse.x, mouse.y, rootRect, vp);
          let dx = aim.x - ball.position.x;
          let dy = aim.y - ball.position.y;
          const len = Math.hypot(dx, dy);
          if (len > 1e-4) {
            dx /= len;
            dy /= len;
          } else {
            dx = 0;
            dy = -1;
          }
          const sp = ball.throwSpeed;
          bouncyBallCarriedByLocalPlayer = false;
          ball.collisionBody.disabled = false;
          ball.collisionBody.type = "dynamic";
          ball.collisionBody.velocity.x = dx * sp;
          ball.collisionBody.velocity.y = dy * sp;
        }
        continue;
      }

      ball.collisionBody.disabled = false;
      ball.collisionBody.type = "dynamic";
      ball.collisionBody.velocity.y += sharedGravity;
    }
  });
}
