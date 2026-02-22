import "./style.css";
import "./root";

import { getScene } from "./scene/scene";
import { defineObject, instantiateObject, match } from "./scene/objectDefinition";
import { $string, $number, $boolean } from "./scene/typeSymbol";

const ENTITY_COUNT = 1000;
const LISTENER_COUNT = 1000;
const MUTATION_ROUNDS = 10000;

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
        },
      },
    });
  }
}

function registerMassListeners(): (() => void)[] {
  const unsub: (() => void)[] = [];
  for (let i = 0; i < LISTENER_COUNT; i++) {
    unsub.push(scene.onQueryChange(DeepDef, () => {}));
    unsub.push(scene.onQueryChange(AltDef, () => {}));
  }
  return unsub;
}

function hammer() {
  for (let round = 0; round < MUTATION_ROUNDS; round++) {
    const idx = round % ENTITY_COUNT;
    const key = `entity_${idx}`;

    scene[key].meta.nested.flag = Math.random() < 0.5;
    scene[key].meta.score = Math.random() * 10000;
    scene[key].active = Math.random() < 0.5;

    if (round % 50 === 0) {
      const tempKey = `temp_${round}`;
      scene[tempKey] = instantiateObject(DeepDef, {
        level: -1,
        active: true,
        meta: { tag: "temp", score: 0, nested: { value: 0, flag: true } },
      });
      delete scene[tempKey];
    }

    if (round % 100 === 0) {
      const r1 = scene.query(DeepDef);
      const r2 = scene.query(AltDef);
      if (Object.keys(r1).length < 0 || Object.keys(r2).length < 0) throw new Error("impossible");
    }
  }
}

function concurrentQueryStress() {
  for (let i = 0; i < 200; i++) {
    const key = `entity_${i % ENTITY_COUNT}`;
    const before = scene.query(DeepDef);
    scene[key].level = i * 999;
    const after = scene.query(DeepDef);
    if (Object.keys(before).length < 0 || Object.keys(after).length < 0) throw new Error("impossible");
  }
}

function deepNestedMutationStorm() {
  for (let round = 0; round < 500; round++) {
    const idx = round % ENTITY_COUNT;
    scene[`entity_${idx}`].meta.nested.value = round;
    scene[`entity_${idx}`].meta.nested.flag = round % 2 === 0;
    scene[`entity_${idx}`].meta.tag = `mutated_${round}`;
  }
}

function rapidListenerChurn() {
  for (let i = 0; i < 300; i++) {
    const unsub = scene.onQueryChange(DeepDef, () => {});
    scene[`entity_${i % ENTITY_COUNT}`].meta.score = i;
    unsub();
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
        nested: { value: i, flag: true },
      },
    });
  }
}

function verifyDeepDefMatches() {
  const results = scene.query(DeepDef);
  for (const obj of Object.values(results as Record<string, any>)) {
    if (obj.type !== "entity") throw new Error("DeepDef violation: type");
  }
}

function verifyAltDefMatches() {
  const results = scene.query(AltDef);
  for (const obj of Object.values(results as Record<string, any>)) {
    if (!obj.active) throw new Error("AltDef violation: active");
    if (!obj.meta?.nested?.flag) throw new Error("AltDef violation: nested.flag");
  }
}

function verifyAllQueries() {
  verifyDeepDefMatches();
  verifyAltDefMatches();
}

function run() {
  console.time("total");
  console.time("seed");
  seedEntities();
  console.timeEnd("seed");

  console.time("initial queries");
  const q1 = scene.query(DeepDef);
  const q2 = scene.query(AltDef);
  console.log(`Initial DeepDef matches: ${Object.keys(q1).length}`);
  console.log(`Initial AltDef matches: ${Object.keys(q2).length}`);
  console.timeEnd("initial queries");

  console.time("register listeners");
  const unsubscribers = registerMassListeners();
  console.timeEnd("register listeners");

  console.time("hammer mutations");
  hammer();
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
  const q3 = scene.query(DeepDef);
  const q4 = scene.query(AltDef);
  console.log(`Post-deletion DeepDef matches: ${Object.keys(q3).length}`);
  console.log(`Post-deletion AltDef matches: ${Object.keys(q4).length}`);
  console.timeEnd("queries after deletion");

  console.time("mass readd");
  massReaddition();
  console.timeEnd("mass readd");

  console.time("verify consistency");
  verifyAllQueries();
  console.timeEnd("verify consistency");

  console.time("unsubscribe all");
  for (const unsub of unsubscribers) unsub();
  console.timeEnd("unsubscribe all");

  console.time("post-unsub mutation");
  for (let i = 0; i < 200; i++) {
    scene[`entity_${i % ENTITY_COUNT}`].active = i % 2 === 0;
  }
  console.timeEnd("post-unsub mutation");

  console.time("final queries");
  const q5 = scene.query(DeepDef);
  const q6 = scene.query(AltDef);
  console.log(`Final DeepDef matches: ${Object.keys(q5).length}`);
  console.log(`Final AltDef matches: ${Object.keys(q6).length}`);
  console.timeEnd("final queries");

  console.timeEnd("total");
}

run();