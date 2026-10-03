export const PHOTOSYNTHESIS_LESSON = `---
pavo: adaptive-lesson
schemaVersion: 1
lessonId: plants-food
title: How plants make food
gradeLevel: 5
subject: Science
competencies: S5LT-IIa-1, S5LT-IIa-2
estimatedMinutes: 20
language: en
---

# How plants make food

::: objective {id="obj-1"}
Explain how leaves use sunlight, water, and carbon dioxide to make food.
:::

::: concept {id="photosynthesis" concept="photosynthesis"}
Leaves capture **sunlight**. Roots bring water, and air gives carbon dioxide.
:::

::: worked-example {id="example-1" concept="photosynthesis"}
A bean plant kept in a dark box turns pale because its leaves cannot make food.
:::

::: visual {id="leaf-visual" image="images/leaf.png" alt="Leaf with arrows for sunlight and water" caption="Inputs a leaf needs"}
:::

::: read-aloud {id="read-1"}
Plants make their own food in their leaves.
:::

::: guided-practice {id="guided-1" concept="photosynthesis"}
Point to the part of the plant that catches sunlight.
:::

::: hints {id="hints-1" concept="photosynthesis"}
1. Look at the green parts.
2. The part is flat and wide.
3. It is the leaf.
:::

::: check {id="check-1" concept="photosynthesis" explain="Leaves hold chlorophyll."}
Which part makes food?

- [ ] Root
- [x] Leaf
- [ ] Stem
:::

::: check {id="check-2" concept="photosynthesis" answer="carbon dioxide"}
Which gas do plants take in?
:::

::: practice {id="practice-1"}
List three plants near your home and where their leaves face.
:::

::: reflection {id="reflect-1"}
What would happen to a plant kept in the dark for a week?
:::

::: remediation {id="remedy-1" for="photosynthesis"}
Watch a leaf in sunlight and in shade. Which looks healthier?
:::

::: extension {id="extend-1"}
Find out why some leaves are red but still make food.
:::

::: checkpoint {id="done"}
- [ ] I can name what a plant needs to make food.
- [ ] I can point to where food is made.
:::
`;

/** A 1×1 transparent PNG. */
export const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  (character) => character.charCodeAt(0),
);
