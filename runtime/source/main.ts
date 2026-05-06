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
import playerScene from "./player.scene";

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

const isBouncyBallObject = implementsTrait([
  bouncyBallTrait,
  spriteTrait,
  collisionBodyTrait,
  circleColliderTrait,
  ownerTrait,
]);

type BouncyBallObject = typeof isBouncyBallObject extends (x: unknown) => x is infer R ? R : never;

let carriedBall: BouncyBallObject | null = null;

gameStart(() => {
  const { networking, planck } = gameContext;
  const scene = getScene();

  const peerPlayer = scene.createObject(
    networking.peerId,
    networking.withOwnership(playerScene),
  );
  if (isPlayerObject(peerPlayer)) {
    let floorSupportContacts = 0;
    void planck.onCollision(
      peerPlayer,
      (other: BaseSceneObject, event: PlanckCallbackEvent) => {
        if (!planck.isStatic(other) || !isFloorSupportContact(event)) return;
        floorSupportContacts += event.phase === "enter" ? 1 : -1;
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
  const horizontalAxis = input.axes.Horizontal;
  const clampedDeltaTime = Math.min(deltaTime, 0.1);
  const sharedGravity = playerTrait.playerGravityY * clampedDeltaTime;

  const player = scene.getObject(networking.peerId, isPlayerObject);
  const ball = scene.getObject("bouncy_ball", isBouncyBallObject);
  const heldBall = carriedBall === ball ? ball : null;

  if (heldBall && player) {
    heldBall.position.x = player.position.x;
    heldBall.position.y = player.position.y + BALL_HOLD_OFFSET_Y;

    if (input.buttons.Throw.pressed) {
      let throwDirectionX = 1;
      let throwDirectionY = 0;
      const mousePosition = input.mouse.position;
      if (mousePosition) {
        const { x: targetWorldX, y: targetWorldY } = pixi.viewport.screenToWorld(
          mousePosition.x,
          mousePosition.y,
        );
        const aimDeltaX = targetWorldX - heldBall.position.x;
        const aimDeltaY = targetWorldY - heldBall.position.y;
        const aimDistance = Math.hypot(aimDeltaX, aimDeltaY);
        if (aimDistance > 1e-3) {
          throwDirectionX = aimDeltaX / aimDistance;
          throwDirectionY = aimDeltaY / aimDistance;
        }
      }
      const playerVelocityX = player.collisionBody.velocity.x;
      const playerVelocityY = player.collisionBody.velocity.y;
      carriedBall = null;
      heldBall.collisionBody.disabled = false;
      heldBall.collisionBody.velocity = {
        x: throwDirectionX * THROW_SPEED + playerVelocityX * THROW_PLAYER_BLEND,
        y: throwDirectionY * THROW_SPEED + playerVelocityY * THROW_PLAYER_BLEND,
        angular: 0,
      };
    }
  }

  if (
    ball &&
    player &&
    input.buttons.Interact.pressed &&
    carriedBall !== ball
  ) {
    const pickupDeltaX = ball.position.x - player.position.x;
    const pickupDeltaY = ball.position.y - player.position.y;
    if (pickupDeltaX * pickupDeltaX + pickupDeltaY * pickupDeltaY <= PICKUP_RADIUS_SQ) {
      carriedBall = ball;
      ball.collisionBody.disabled = true;
      ball.collisionBody.velocity = { x: 0, y: 0, angular: 0 };
    }
  }

  if (player) {
    const gravityStep = player.playerGravityY * clampedDeltaTime;
    if (input.buttons.Jump.pressed && player.grounded) {
      player.collisionBody.velocity.y = player.jumpSpeed;
    }
    player.collisionBody.velocity.x = horizontalAxis * player.moveSpeed;
    player.collisionBody.velocity.y += gravityStep;
  }

  for (const bouncyBall of scene.query(isBouncyBallObject)) {
    if (!networking.isOwned(bouncyBall) || carriedBall === bouncyBall) continue;
    bouncyBall.collisionBody.velocity.y += sharedGravity;
  }
});
