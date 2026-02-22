import "./style.css";
import "./root";

import { getScene } from "./scene/scene";
import { defineObject, instantiateObject, match } from "./scene/objectDefinition";
import { $string, $number, $boolean } from "./scene/typeSymbol";

const ENTITY_COUNT = 5000;
const LISTENER_COUNT = 2000;
const MUTATION_ROUNDS = 20000;

const DeepDef = defineObject({
  type: match("entity"),
  level: $number,
  active: $boolean,
  meta: {
    tag: $string,
    score: $number,
    nested: {
      value: $number,
      flag: $boolean,
      deeper: {
        timestamp: $number,
        status: $boolean,
        ultra: {
          code: $string,
          value: $number,
        },
      },
    },
  },
});

const AltDef = defineObject({
  type: match("entity"),
  active: match(true),
  level: $number,
  meta: {
    score: $number,
    nested: {
      flag: match(true),
      deeper: {
        ultra: {
          value: match(0),
        },
      },
    },
  },
});

const AltDef2 = defineObject({
  type: match("entity"),
  active: match(true),
  level: (v: number) => v > 1000,
  meta: {
    nested: {
      deeper: {
        ultra: {
          value: (v: number) => v % 2 === 0,
        },
      },
    },
  },
});

const scene = getScene() as any;

function seedEntities() {
  for (let i = 0; i < ENTITY_COUNT; i++) {
    scene[`entity_${i}`] = instantiateObject(DeepDef, {
      level: i,
      active: i % 2 === 0,
      meta: {
        tag: `tag_${i}`,
        score: i * 1.5,
        nested: {
          value: i * 10,
          flag: i % 3 === 0,
          deeper: {
            timestamp: Date.now(),
            status: i % 5 === 0,
            ultra: { code: `code_${i}`, value: i },
          },
        },
      },
    });
  }
}

function registerMassListeners(): (() => void)[] {
  const unsubscribers: (() => void)[] = [];
  for (let i = 0; i < LISTENER_COUNT; i++) {
    unsubscribers.push(scene.onQueryChange(DeepDef, () => {}));
    unsubscribers.push(scene.onQueryChange(AltDef, () => {}));
    unsubscribers.push(scene.onQueryChange(AltDef2, () => {}));
  }
  return unsubscribers;
}

function hammerRandom() {
  for (let round = 0; round < MUTATION_ROUNDS; round++) {
    const idx = Math.floor(Math.random() * ENTITY_COUNT);
    const entity = scene[`entity_${idx}`];
    entity.level = Math.floor(Math.random() * 10000);
    entity.active = Math.random() < 0.5;
    entity.meta.score = Math.random() * 10000;
    entity.meta.nested.value = Math.floor(Math.random() * 5000);
    entity.meta.nested.flag = Math.random() < 0.5;
    entity.meta.nested.deeper.timestamp = Date.now();
    entity.meta.nested.deeper.status = Math.random() < 0.5;
    entity.meta.nested.deeper.ultra.code = `code_${Math.random() * 1000}`;
    entity.meta.nested.deeper.ultra.value = Math.floor(Math.random() * 1000);
    if (round % 100 === 0) {
      const tempKey = `temp_${round}`;
      scene[tempKey] = instantiateObject(DeepDef, {
        level: -1,
        active: true,
        meta: {
          tag: "temp",
          score: 0,
          nested: {
            value: 0,
            flag: true,
            deeper: { timestamp: 0, status: true, ultra: { code: "temp", value: 0 } },
          },
        },
      });
      delete scene[tempKey];
    }
  }
}

function concurrentQueryStress() {
  for (let i = 0; i < 1000; i++) {
    const idx = Math.floor(Math.random() * ENTITY_COUNT);
    scene.query(DeepDef);
    scene.query(AltDef);
    scene.query(AltDef2);
    scene[`entity_${idx}`].level = Math.random() * 10000;
  }
}

function massDeletion() {
  for (let i = 0; i < ENTITY_COUNT / 2; i++) {
    delete scene[`entity_${i * 2}`];
  }
}

function massReaddition() {
  for (let i = 0; i < ENTITY_COUNT / 2; i++) {
    scene[`entity_${i * 2}`] = instantiateObject(DeepDef, {
      level: i,
      active: true,
      meta: {
        tag: `readded_${i}`,
        score: i,
        nested: {
          value: i,
          flag: true,
          deeper: { timestamp: Date.now(), status: true, ultra: { code: `re_${i}`, value: i } },
        },
      },
    });
  }
}

function rapidListenerChurn() {
  for (let i = 0; i < 3000; i++) {
    const unsub = scene.onQueryChange(DeepDef, () => {});
    const idx = Math.floor(Math.random() * ENTITY_COUNT);
    scene[`entity_${idx}`].meta.score = i;
    unsub();
  }
}

function deepNestedMutationStorm() {
  for (let round = 0; round < 1000; round++) {
    const idx = round % ENTITY_COUNT;
    scene[`entity_${idx}`].meta.nested.value = round;
    scene[`entity_${idx}`].meta.nested.flag = round % 2 === 0;
    scene[`entity_${idx}`].meta.tag = `mutated_${round}`;
    scene[`entity_${idx}`].meta.nested.deeper.ultra.value = round * 2;
  }
}

function verifyConsistency() {
  const results = scene.query(DeepDef);
  const altResults = scene.query(AltDef);
  const alt2Results = scene.query(AltDef2);
  for (const [key, obj] of Object.entries(results as Record<string, any>)) {
    if (obj.type !== "entity") throw new Error(`Consistency violation: ${key} type`);
  }
  for (const [key, obj] of Object.entries(altResults as Record<string, any>)) {
    if (!obj.active) throw new Error(`AltDef violation: ${key} active`);
    if (!obj.meta?.nested?.flag) throw new Error(`AltDef violation: ${key} nested.flag`);
  }
  for (const [key, obj] of Object.entries(alt2Results as Record<string, any>)) {
    if (!obj.active || obj.level <= 1000) throw new Error(`AltDef2 violation: ${key}`);
    if (obj.meta.nested.deeper.ultra.value % 2 !== 0)
      throw new Error(`AltDef2 violation: ${key} ultra.value`);
  }
}

function run() {
  console.time("total");
  console.time("seed");
  seedEntities();
  console.timeEnd("seed");
  console.time("initial queries");
  scene.query(DeepDef);
  scene.query(AltDef);
  scene.query(AltDef2);
  console.timeEnd("initial queries");
  console.time("register listeners");
  const unsubscribers = registerMassListeners();
  console.timeEnd("register listeners");
  console.time("hammer mutations");
  hammerRandom();
  console.timeEnd("hammer mutations");
  console.time("concurrent query stress");
  concurrentQueryStress();
  console.timeEnd("concurrent query stress");
  console.time("deep nested mutation storm");
  deepNestedMutationStorm();
  console.timeEnd("deep nested mutation storm");
  console.time("rapid listener churn");
  rapidListenerChurn();
  console.timeEnd("rapid listener churn");
  console.time("mass deletion");
  massDeletion();
  console.timeEnd("mass deletion");
  console.time("queries after deletion");
  scene.query(DeepDef);
  scene.query(AltDef);
  scene.query(AltDef2);
  console.timeEnd("queries after deletion");
  console.time("mass readd");
  massReaddition();
  console.timeEnd("mass readd");
  console.time("verify consistency");
  verifyConsistency();
  console.timeEnd("verify consistency");
  console.time("unsubscribe all");
  for (const unsub of unsubscribers) unsub();
  console.timeEnd("unsubscribe all");
  console.time("post-unsub mutation");
  for (let i = 0; i < 500; i++) {
    scene[`entity_${i % ENTITY_COUNT}`].active = i % 2 === 0;
  }
  console.timeEnd("post-unsub mutation");
  console.time("final queries");
  scene.query(DeepDef);
  scene.query(AltDef);
  scene.query(AltDef2);
  console.timeEnd("final queries");
  console.timeEnd("total");
}

run();