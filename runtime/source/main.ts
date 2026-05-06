import {
  type BaseSceneObject,
  type PlanckCallbackEvent,
  gameStart,
  gameUpdate,
  getScene,
  implementsTrait,
  defineTrait,
  gameObject,
  ownerTrait,
  spriteTrait,
  collisionBodyTrait,
  boxColliderTrait,
  circleColliderTrait,
} from "gameide";
import { WorldManifold } from "planck";
import typescriptSVGURL from "../assets/typescript.svg?url";
import { gameContext } from "./gameConfig";
import playerPrefab from "./player.scene";

const playerTrait = defineTrait({
  moveSpeed: 260,
  jumpSpeed: 650,
  playerGravityY: -1500,
  grounded: false,
});

const isPlayerObject = implementsTrait([
  playerTrait,
  spriteTrait,
  collisionBodyTrait,
  boxColliderTrait,
]);

const floorContactWorldManifold = new WorldManifold();

function isFloorSupportContact(event: PlanckCallbackEvent): boolean {
  const worldManifold = event.contact.getWorldManifold(floorContactWorldManifold);
  if (!worldManifold) return false;
  const normalY = worldManifold.normal.y;
  const selfIsFixtureA = event.selfFixture === event.contact.getFixtureA();
  return (selfIsFixtureA ? -normalY : normalY) >= 0.5;
}

const bouncyBallTrait = defineTrait({});

const BALL_SPRITE_TINT = "#ff8c42";

const PICKUP_RADIUS_SQ = 96 * 96;
const BALL_HOLD_OFFSET_Y = 34;
const THROW_SPEED = 560;
const THROW_PLAYER_BLEND = 0.22;

function sceneObjectFromPlayerPrefab(spriteAsset: string): BaseSceneObject {
  const raw = playerPrefab as Record<string, unknown>;
  const { __metadata: _, ...body } = raw;
  const sprite = body.sprite;
  const spriteMerged =
    sprite && typeof sprite === "object" && !Array.isArray(sprite)
      ? { ...(sprite as Record<string, unknown>), asset: spriteAsset }
      : { asset: spriteAsset, width: 32, height: 32, tint: "#ffffff" };
  return { ...body, sprite: spriteMerged } as BaseSceneObject;
}

const isBouncyBallObject = implementsTrait([
  bouncyBallTrait,
  spriteTrait,
  collisionBodyTrait,
  circleColliderTrait,
]);

let carriedBall: BaseSceneObject | null = null;

gameStart(() => {
  const { networking, planck } = gameContext;
  const scene = getScene();

    scene.createObject(
      networking.peerId,
      networking.withOwnership(sceneObjectFromPlayerPrefab(typescriptSVGURL)),
    );

    const peerPlayer = scene[networking.peerId];
    if (peerPlayer && isPlayerObject(peerPlayer)) {
      let floorSupportContacts = 0;
      void planck.onCollision(
        peerPlayer,
        (other: BaseSceneObject, e: PlanckCallbackEvent) => {
          if (!planck.isStatic(other) || !isFloorSupportContact(e)) return;
          floorSupportContacts += e.phase === "enter" ? 1 : -1;
          floorSupportContacts = Math.max(0, floorSupportContacts);
          peerPlayer.grounded = floorSupportContacts > 0;
        },
      );
    }

    scene.createObject(
      "bouncy_ball",
      networking.withOwnership(
        gameObject([
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
            circleCollider: { radius: 18 },
            collisionBody: {
              type: "dynamic",
              restitution: 0.88,
            },
          },
        ]),
      ),
    );
});

gameUpdate((deltaTime) => {
  const { input, networking, pixi } = gameContext;
  const scene = getScene();
  const horizontal = input.axes.Horizontal;
    const clampedDt = Math.min(deltaTime, 0.1);
    const sharedGravity = playerTrait.playerGravityY * clampedDt;

    const localPlayer = scene[networking.peerId];
    const ballForPickup = scene.bouncy_ball;
    const canPickupBall =
      ballForPickup &&
      isBouncyBallObject(ballForPickup)

    if (
      canPickupBall &&
      carriedBall === ballForPickup &&
      localPlayer &&
      isPlayerObject(localPlayer)
    ) {
      ballForPickup.position.x = localPlayer.position.x;
      ballForPickup.position.y = localPlayer.position.y + BALL_HOLD_OFFSET_Y;
    }

    if (
      canPickupBall &&
      carriedBall === ballForPickup &&
      input.buttons.Throw.pressed &&
      localPlayer &&
      isPlayerObject(localPlayer)
    ) {
      const bx = ballForPickup.position.x;
      const by = ballForPickup.position.y;
      let nx = 1;
      let ny = 0;
      const mouse = input.mouse.position;
      if (mouse) {
        const { x: tx, y: ty } = pixi.viewport.screenToWorld(mouse.x, mouse.y);
        const dx = tx - bx;
        const dy = ty - by;
        const len = Math.hypot(dx, dy);
        if (len > 1e-3) {
          nx = dx / len;
          ny = dy / len;
        }
      }
      const pvx = localPlayer.collisionBody.velocity.x;
      const pvy = localPlayer.collisionBody.velocity.y;
      carriedBall = null;
      ballForPickup.collisionBody.disabled = false;
      ballForPickup.collisionBody.velocity = {
        x: nx * THROW_SPEED + pvx * THROW_PLAYER_BLEND,
        y: ny * THROW_SPEED + pvy * THROW_PLAYER_BLEND,
        angular: 0,
      };
    }

    if (
      canPickupBall &&
      input.buttons.Interact.pressed &&
      localPlayer &&
      isPlayerObject(localPlayer) &&
      carriedBall !== ballForPickup
    ) {
      const dx = ballForPickup.position.x - localPlayer.position.x;
      const dy = ballForPickup.position.y - localPlayer.position.y;
      if (dx * dx + dy * dy <= PICKUP_RADIUS_SQ) {
        carriedBall = ballForPickup;
        ballForPickup.collisionBody.disabled = true;
        ballForPickup.collisionBody.velocity = { x: 0, y: 0, angular: 0 };
      }
    }

    if (localPlayer && isPlayerObject(localPlayer)) {
      const gravity = localPlayer.playerGravityY * clampedDt;
      if (input.buttons.Jump.pressed && localPlayer.grounded) {
        localPlayer.collisionBody.velocity.y = localPlayer.jumpSpeed;
      }

      localPlayer.collisionBody.velocity.x = horizontal * localPlayer.moveSpeed;
      localPlayer.collisionBody.velocity.y += gravity;
    }

    for (const ball of scene.query(
      implementsTrait([
        bouncyBallTrait,
        spriteTrait,
        collisionBodyTrait,
        circleColliderTrait,
      ]),
    )) {
      if (!networking.isOwned(ball)) continue;
      if (carriedBall === ball) continue;
      ball.collisionBody.velocity.y += sharedGravity;
    }
});
