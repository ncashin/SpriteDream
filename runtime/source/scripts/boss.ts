import { addUpdateCallback } from "../core/gameloop";
import {
  PositionComponentDefinition,
  VelocityComponentDefinition,
  ColliderComponentDefinition,
  defineComponent,
  type PositionComponent,
  type VelocityComponent,
} from "../core/ecs/component";
import type { Component } from "../core/ecs/ecs";
import type { RequirePlugin } from "../core/gameContext";
import { ecsPlugin } from "../core/scene/ecsAdapter";
import { spritePlugin, SpriteComponentDefinition } from "../core/sprite";
import { registerResolver } from "../core/sat";
import type { ResolverDefinition } from "../core/sat";
import { destroyEntity } from "../core/ecs/ecs";
import { createDamageNumber } from "./damageNumber";
import { damageEntity, type HealthComponent } from "./health";
import { ProjectileComponentDefinition } from "./projectile";

export type BossComponent = Component & {
  type: "boss";
  floatSpeed: number;
  floatAmplitude: number;
  horizontalAmplitude: number;
  startX: number;
  startY: number;
  time: number;
  hitFlashTime: number;
  shootCooldown: number;
  patternTime: number;
  currentPhase: number;
};

export type HitFlashComponent = Component & {
  type: "hitFlash";
  flashTime: number;
  maxFlashTime: number;
};

export const BossComponentDefinition: BossComponent = defineComponent(
  {
    type: "boss",
    floatSpeed: 0.3, // cycles per second (slower)
    floatAmplitude: 50, // pixels for vertical
    horizontalAmplitude: 100, // pixels for horizontal (more left/right movement)
    startX: 0,
    startY: 0,
    time: 0,
    hitFlashTime: 0,
    shootCooldown: 0,
    patternTime: 0,
    currentPhase: 1,
  },
  {
    displayName: "Boss",
    description: "Boss entity that floats up, down, left, and right",
  }
);

export const HitFlashComponentDefinition: HitFlashComponent = defineComponent(
  {
    type: "hitFlash",
    flashTime: 0,
    maxFlashTime: 0.2, // seconds
  },
  {
    displayName: "Hit Flash",
    description: "Visual flash effect when entity is hit",
  }
);

export function initializeBoss(
  gameContext: RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
) {
  // Register resolver for projectile-boss collisions
  const PROJECTILE_BOSS_RESOLVER: ResolverDefinition = {
    name: "projectileBoss",
    resolveCollision: (ecs, entity, other, _overlapAmount, _overlapNormal) => {
      if (entity === other) return;

      const entityComponents = gameContext.ecs.getEntity(entity);
      const otherComponents = gameContext.ecs.getEntity(other);

      const entityProjectile = entityComponents.projectile;
      const otherProjectile = otherComponents.projectile;
      const entityBoss = entityComponents.boss;
      const otherBoss = otherComponents.boss;

      // Get colliders to check resolver names
      const entityCollider = entityComponents.collider;
      const otherCollider = otherComponents.collider;

      // Ignore boss projectiles - only handle player projectiles
      // Boss projectiles have resolverName "bossProjectilePlayer"
      if (
        entityProjectile &&
        entityCollider &&
        entityCollider.resolverName === "bossProjectilePlayer"
      ) {
        return; // This is a boss projectile, ignore it
      }
      if (
        otherProjectile &&
        otherCollider &&
        otherCollider.resolverName === "bossProjectilePlayer"
      ) {
        return; // This is a boss projectile, ignore it
      }

      // Check if projectile hits a static platform
      if (
        entityProjectile &&
        otherCollider &&
        otherCollider.resolverName === "static"
      ) {
        // Despawn the projectile when it hits a platform
        destroyEntity(ecs, entity);
        return;
      }
      if (
        otherProjectile &&
        entityCollider &&
        entityCollider.resolverName === "static"
      ) {
        // Despawn the projectile when it hits a platform
        destroyEntity(ecs, other);
        return;
      }

      // Check if one is a projectile and the other is a boss
      if (entityProjectile && otherBoss) {
        // Projectile hit boss
        const bossPosition = otherComponents.position as
          | PositionComponent
          | undefined;
        const damageAmount = 10; // Base damage per projectile

        // Deal damage to boss
        const isDead = damageEntity(otherComponents, damageAmount);

        // Spawn damage number
        if (bossPosition) {
          createDamageNumber(
            gameContext,
            bossPosition.x + (Math.random() - 0.5) * 20, // Slight random offset
            bossPosition.y - 50, // Above boss
            damageAmount
          );
        }

        destroyEntity(ecs, entity);

        // Trigger hit flash on boss
        if (!otherComponents.hitFlash) {
          gameContext.ecs.addComponent(other, HitFlashComponentDefinition);
        } else {
          const hitFlash = otherComponents.hitFlash as HitFlashComponent;
          hitFlash.flashTime = 0; // Reset flash timer
        }

        // Destroy boss if dead
        if (isDead) {
          destroyEntity(ecs, other);
        }
      } else if (otherProjectile && entityBoss) {
        // Boss hit by projectile
        const bossPosition = entityComponents.position as
          | PositionComponent
          | undefined;
        const damageAmount = 10; // Base damage per projectile

        // Deal damage to boss
        const isDead = damageEntity(entityComponents, damageAmount);

        // Spawn damage number
        if (bossPosition) {
          createDamageNumber(
            gameContext,
            bossPosition.x + (Math.random() - 0.5) * 20, // Slight random offset
            bossPosition.y - 50, // Above boss
            damageAmount
          );
        }

        destroyEntity(ecs, other);

        // Trigger hit flash on boss
        if (!entityComponents.hitFlash) {
          gameContext.ecs.addComponent(entity, HitFlashComponentDefinition);
        } else {
          const hitFlash = entityComponents.hitFlash as HitFlashComponent;
          hitFlash.flashTime = 0; // Reset flash timer
        }

        // Destroy boss if dead
        if (isDead) {
          destroyEntity(ecs, entity);
        }
      }
    },
  };

  registerResolver(PROJECTILE_BOSS_RESOLVER);

  // Register resolver for boss projectiles hitting player
  const BOSS_PROJECTILE_PLAYER_RESOLVER: ResolverDefinition = {
    name: "bossProjectilePlayer",
    resolveCollision: (ecs, entity, other, _overlapAmount, _overlapNormal) => {
      if (entity === other) return;

      const entityComponents = gameContext.ecs.getEntity(entity);
      const otherComponents = gameContext.ecs.getEntity(other);

      const entityProjectile = entityComponents.projectile;
      const otherProjectile = otherComponents.projectile;
      const entityPlayer = entityComponents.player;
      const otherPlayer = otherComponents.player;

      // Check if one is a projectile and the other is a player
      if (entityProjectile && otherPlayer) {
        // Boss projectile hit player
        const damageAmount = 5; // Damage from boss projectiles
        const isDead = damageEntity(otherComponents, damageAmount);

        destroyEntity(ecs, entity);

        // Destroy player if dead
        if (isDead) {
          destroyEntity(ecs, other);
        }
      } else if (otherProjectile && entityPlayer) {
        // Boss projectile hit player
        const damageAmount = 5; // Damage from boss projectiles
        const isDead = damageEntity(entityComponents, damageAmount);

        destroyEntity(ecs, other);

        // Destroy player if dead
        if (isDead) {
          destroyEntity(ecs, entity);
        }
      }
    },
  };

  registerResolver(BOSS_PROJECTILE_PLAYER_RESOLVER);

  // Helper function to spawn a boss projectile
  function spawnBossProjectile(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number
  ) {
    const projectileEntity = gameContext.ecs.createEntity();

    gameContext.ecs.addComponent(projectileEntity, PositionComponentDefinition);
    const projectilePos = gameContext.ecs.getComponent(
      projectileEntity,
      PositionComponentDefinition
    );
    if (projectilePos) {
      projectilePos.x = x;
      projectilePos.y = y;
    }

    gameContext.ecs.addComponent(projectileEntity, VelocityComponentDefinition);
    const projectileVel = gameContext.ecs.getComponent(
      projectileEntity,
      VelocityComponentDefinition
    );
    if (projectileVel) {
      projectileVel.x = velocityX;
      projectileVel.y = velocityY;
    }

    gameContext.ecs.addComponent(
      projectileEntity,
      ProjectileComponentDefinition
    );

    gameContext.ecs.addComponent(projectileEntity, SpriteComponentDefinition);
    const projectileSprite = gameContext.ecs.getComponent(
      projectileEntity,
      SpriteComponentDefinition
    );
    if (projectileSprite) {
      projectileSprite.width = 32;
      projectileSprite.height = 32;
      projectileSprite.color = "#ff0000";
      projectileSprite.image = "/fireball.png";
    }

    gameContext.ecs.addComponent(projectileEntity, ColliderComponentDefinition);
    const projectileCollider = gameContext.ecs.getComponent(
      projectileEntity,
      ColliderComponentDefinition
    );
    if (projectileCollider) {
      projectileCollider.colliderName = "circle";
      projectileCollider.resolverName = "bossProjectilePlayer";
      projectileCollider.collisionEnabled = true;
      projectileCollider.radius = 12;
    }
  }

  // Helper function to get player position
  function getPlayerPosition(): PositionComponent | null {
    const playerEntity = gameContext.ecs.getEntity("player");
    return (playerEntity?.position as PositionComponent) || null;
  }

  // Shooting pattern functions
  function shootAtPlayer(
    bossX: number,
    bossY: number,
    playerX: number,
    playerY: number,
    speed: number = 400
  ) {
    const dx = playerX - bossX;
    const dy = playerY - bossY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    const normalizedX = dx / distance;
    const normalizedY = dy / distance;

    spawnBossProjectile(bossX, bossY, normalizedX * speed, normalizedY * speed);
  }

  function shootSpread(
    bossX: number,
    bossY: number,
    playerX: number,
    playerY: number,
    speed: number = 400,
    spreadAngle: number = Math.PI / 6 // 30 degrees
  ) {
    const dx = playerX - bossX;
    const dy = playerY - bossY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    const baseAngle = Math.atan2(dy, dx);

    // Shoot 3 projectiles: center, left, right
    for (let i = -1; i <= 1; i++) {
      const angle = baseAngle + i * spreadAngle;
      spawnBossProjectile(
        bossX,
        bossY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  }

  function shootCircular(
    bossX: number,
    bossY: number,
    speed: number = 350,
    count: number = 8
  ) {
    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      spawnBossProjectile(
        bossX,
        bossY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  }

  function shootSpiral(
    bossX: number,
    bossY: number,
    patternTime: number,
    speed: number = 350,
    count: number = 6
  ) {
    const baseAngle = (patternTime * 2) % (Math.PI * 2); // Rotating base angle
    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + i * angleStep;
      spawnBossProjectile(
        bossX,
        bossY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  }

  addUpdateCallback((deltaTime: number) => {
    // Update boss floating and shooting
    gameContext.ecs.runQuery(
      [
        PositionComponentDefinition,
        VelocityComponentDefinition,
        BossComponentDefinition,
      ],
      (bossEntity, components) => {
        const [position, velocity, boss] = components as [
          PositionComponent,
          VelocityComponent,
          BossComponent
        ];

        // Get boss health to determine phase
        const bossEntityData = gameContext.ecs.getEntity(bossEntity);
        const health = bossEntityData?.health as HealthComponent | undefined;
        const healthPercent = health
          ? health.currentHealth / health.maxHealth
          : 1.0;

        // Determine phase based on health
        let phase = 1;
        if (healthPercent <= 0.25) {
          phase = 4; // < 25% HP - Spiral pattern
        } else if (healthPercent <= 0.5) {
          phase = 3; // 25-50% HP - Circular pattern
        } else if (healthPercent <= 0.75) {
          phase = 2; // 50-75% HP - Spread shots
        } else {
          phase = 1; // 75-100% HP - Single shots
        }

        boss.currentPhase = phase;

        // Initialize start positions on first update
        if (boss.startX === 0 && boss.startY === 0) {
          boss.startX = position.x;
          boss.startY = position.y;
        }

        // Initialize shooting properties if missing (for scene file compatibility)
        if (boss.shootCooldown === undefined || boss.shootCooldown === null) {
          boss.shootCooldown = 0;
        }
        if (boss.patternTime === undefined || boss.patternTime === null) {
          boss.patternTime = 0;
        }
        if (boss.currentPhase === undefined || boss.currentPhase === null) {
          boss.currentPhase = 1;
        }

        // Update time
        boss.time += deltaTime;
        boss.patternTime += deltaTime;

        // Calculate floating position using separate sine waves with different speeds
        // This makes X and Y movements independent (not synchronized)
        const verticalOffset =
          Math.sin(boss.time * boss.floatSpeed * Math.PI * 2) *
          boss.floatAmplitude;
        const horizontalOffset =
          Math.sin(boss.time * boss.floatSpeed * 0.7 * Math.PI * 2) *
          boss.horizontalAmplitude;

        position.x = boss.startX + horizontalOffset;
        position.y = boss.startY + verticalOffset;

        // Keep velocity at 0 (position is directly set)
        velocity.x = 0;
        velocity.y = 0;

        // Update shoot cooldown
        boss.shootCooldown -= deltaTime;

        // Get player position for targeting
        const playerPos = getPlayerPosition();

        if (playerPos) {
          // Phase-based shooting patterns
          let shootInterval = 2.0; // Default interval
          let shouldShoot = false;

          switch (phase) {
            case 1: // Single shots at player
              shootInterval = 2.0;
              if (boss.shootCooldown <= 0) {
                shouldShoot = true;
                shootAtPlayer(position.x, position.y, playerPos.x, playerPos.y);
              }
              break;

            case 2: // Spread shots (3 projectiles in a cone)
              shootInterval = 1.5;
              if (boss.shootCooldown <= 0) {
                shouldShoot = true;
                shootSpread(
                  position.x,
                  position.y,
                  playerPos.x,
                  playerPos.y,
                  400,
                  Math.PI / 6
                );
              }
              break;

            case 3: // Circular pattern (8 projectiles)
              shootInterval = 1.2;
              if (boss.shootCooldown <= 0) {
                shouldShoot = true;
                shootCircular(position.x, position.y, 350, 8);
              }
              break;

            case 4: // Spiral pattern (rotating shots)
              shootInterval = 0.8;
              if (boss.shootCooldown <= 0) {
                shouldShoot = true;
                shootSpiral(position.x, position.y, boss.patternTime, 350, 6);
              }
              break;
          }

          if (shouldShoot) {
            boss.shootCooldown = shootInterval;
          }
        }
      }
    );

    // Update hit flash timers
    gameContext.ecs.runQuery(
      [HitFlashComponentDefinition],
      (entity, components) => {
        const [hitFlash] = components as [HitFlashComponent];

        hitFlash.flashTime += deltaTime;

        // Remove flash component when done
        if (hitFlash.flashTime >= hitFlash.maxFlashTime) {
          gameContext.ecs.removeComponent(entity, HitFlashComponentDefinition);
        }
      }
    );
  });
}
