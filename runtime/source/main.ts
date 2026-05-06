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

  const player = scene.getObject(networking.peerId, isPlayerObject);

  const ball = scene.getObject("bouncy_ball", isBouncyBallObject);
  const heldBall = ball && carriedBall === ball ? ball : null;

  if (heldBall && player) {
    heldBall.position.x = player.position.x;
    heldBall.position.y = player.position.y + BALL_HOLD_OFFSET_Y;
  }

  if (heldBall && player && input.buttons.Throw.pressed) {
    const bx = heldBall.position.x;
    const by = heldBall.position.y;
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
    const pvx = player.collisionBody.velocity.x;
    const pvy = player.collisionBody.velocity.y;
    carriedBall = null;
    heldBall.collisionBody.disabled = false;
    heldBall.collisionBody.velocity = {
      x: nx * THROW_SPEED + pvx * THROW_PLAYER_BLEND,
      y: ny * THROW_SPEED + pvy * THROW_PLAYER_BLEND,
      angular: 0,
    };
  }

  if (
    ball &&
    player &&
    input.buttons.Interact.pressed &&
    carriedBall !== ball
  ) {
    const dx = ball.position.x - player.position.x;
    const dy = ball.position.y - player.position.y;
    if (dx * dx + dy * dy <= PICKUP_RADIUS_SQ) {
      carriedBall = ball;
      ball.collisionBody.disabled = true;
      ball.collisionBody.velocity = { x: 0, y: 0, angular: 0 };
    }
  }

  if (player) {
    const gravity = player.playerGravityY * clampedDt;
    if (input.buttons.Jump.pressed && player.grounded) {
      player.collisionBody.velocity.y = player.jumpSpeed;
    }
    player.collisionBody.velocity.x = horizontal * player.moveSpeed;
    player.collisionBody.velocity.y += gravity;
  }

  for (const b of scene.query(isBouncyBallObject)) {
    if (!networking.isOwned(b) || carriedBall === b) continue;
    b.collisionBody.velocity.y += sharedGravity;
  }
});
