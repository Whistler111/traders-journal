// Original vector artwork for this journal. Regenerate with node scripts/create-feedback-art.mjs.
import { writeFileSync } from "node:fs";
import { URL } from "node:url";
const violet = [0.38, 0.35, 0.73, 1],
  green = [0.094, 0.478, 0.349, 1],
  soft = [0.93, 0.92, 0.98, 1];
const fixed = (k) => ({ a: 0, k });
const tween = (values, times) => ({
  a: 1,
  k: values.map((s, i) =>
    i === values.length - 1
      ? { t: times[i], s }
      : {
          t: times[i],
          s,
          e: values[i + 1],
          o: { x: 0.3, y: 0 },
          i: { x: 0.7, y: 1 },
        },
  ),
});
const path = (points, closed = false) => ({
  ty: "sh",
  ks: fixed({
    i: points.map(() => [0, 0]),
    o: points.map(() => [0, 0]),
    v: points,
    c: closed,
  }),
  nm: "Original journal line",
});
const stroke = (color = violet, width = 3) => ({
  ty: "st",
  c: fixed(color),
  o: fixed(100),
  w: fixed(width),
  lc: 2,
  lj: 2,
});
const fill = (color) => ({ ty: "fl", c: fixed(color), o: fixed(100), r: 1 });
const ellipse = (size, position = [0, 0]) => ({
  ty: "el",
  p: fixed(position),
  s: fixed([size, size]),
});
const layer = (
  name,
  shapes,
  {
    position = [32, 32, 0],
    scale = fixed([100, 100, 100]),
    opacity = fixed(100),
    rotation = fixed(0),
  } = {},
) => ({
  ddd: 0,
  ind: 1,
  ty: 4,
  nm: name,
  sr: 1,
  ks: {
    o: opacity,
    r: rotation,
    p: fixed(position),
    a: fixed([0, 0, 0]),
    s: scale,
  },
  ao: 0,
  shapes,
  ip: 0,
  op: 60,
  st: 0,
  bm: 0,
});
const pop = tween(
  [
    [82, 82, 100],
    [104, 104, 100],
    [100, 100, 100],
  ],
  [0, 15, 24],
);
const bg = () =>
  layer("Soft circle", [ellipse(54), fill(soft)], { scale: pop });
const compositions = {
  success: [
    bg(),
    layer(
      "A saved decision",
      [
        path([
          [-11, 0],
          [-3, 8],
          [13, -9],
        ]),
        stroke(),
      ],
      { scale: pop, opacity: tween([[0], [100], [100]], [0, 9, 60]) },
    ),
  ],
  profit: [
    bg(),
    layer(
      "A measured step forward",
      [
        path([
          [-11, 9],
          [10, -11],
        ]),
        path([
          [-1, -11],
          [10, -11],
          [10, 0],
        ]),
        stroke(green),
      ],
      { scale: pop },
    ),
    ...[-1, 1].map((side, i) =>
      layer("Small profit dot", [ellipse(3), fill(green)], {
        position: [32 + side * 22, 18 + i * 22, 0],
        opacity: tween([[0], [75], [0]], [0, 16, 48]),
        scale: tween(
          [
            [40, 40, 100],
            [100, 100, 100],
            [50, 50, 100],
          ],
          [0, 20, 52],
        ),
      }),
    ),
  ],
  loss: [
    layer("A quiet pause", [ellipse(44), stroke(violet, 2)], {
      scale: tween(
        [
          [90, 90, 100],
          [100, 100, 100],
          [96, 96, 100],
        ],
        [0, 35, 60],
      ),
      opacity: tween([[45], [85], [65]], [0, 35, 60]),
    }),
    layer("Room to reflect", [
      path([
        [-6, -5],
        [-6, 5],
      ]),
      path([
        [6, -5],
        [6, 5],
      ]),
      stroke(violet, 2.5),
    ]),
  ],
  milestone: [
    bg(),
    layer(
      "A small milestone",
      [
        path(
          Array.from({ length: 10 }, (_, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI) / 5,
              r = i % 2 ? 7 : 15;
            return [Math.cos(angle) * r, Math.sin(angle) * r];
          }),
          true,
        ),
        stroke(),
        fill([0.87, 0.85, 0.96, 1]),
      ],
      { scale: pop, rotation: tween([[-12], [3], [0]], [0, 18, 30]) },
    ),
  ],
  empty: [
    bg(),
    layer(
      "An open journal",
      [
        path([
          [0, -11],
          [-15, -15],
          [-15, 11],
          [0, 15],
          [15, 11],
          [15, -15],
          [0, -11],
          [0, 15],
        ]),
        path([
          [-10, -6],
          [-5, -5],
        ]),
        path([
          [5, -5],
          [10, -6],
        ]),
        stroke(violet, 2),
      ],
      { rotation: tween([[-2], [2], [-2]], [0, 30, 60]) },
    ),
  ],
  loading: [-1, 0, 1].map((x, i) =>
    layer("A patient dot", [ellipse(6), fill(violet)], {
      position: [32 + x * 13, 32, 0],
      opacity: tween(
        [[35], [100], [35], [35]],
        [0, 12 + i * 8, 30 + i * 8, 60],
      ),
      scale: tween(
        [
          [80, 80, 100],
          [110, 110, 100],
          [80, 80, 100],
        ],
        [0, 18 + i * 8, 60],
      ),
    }),
  ),
};
for (const [name, layers] of Object.entries(compositions)) {
  layers.forEach((item, i) => {
    item.ind = i + 1;
  });
  const data = {
    v: "5.12.2",
    fr: 30,
    ip: 0,
    op: 60,
    w: 64,
    h: 64,
    nm: `Trade Notes original ${name}`,
    ddd: 0,
    assets: [],
    layers,
    markers: [],
  };
  writeFileSync(
    new URL(`../public/lottie/${name}.json`, import.meta.url),
    JSON.stringify(data) + "\n",
  );
}
