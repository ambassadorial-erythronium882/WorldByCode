import {
  SAMPLE_WORLD,
  type WorldMaterial,
  type WorldObject,
  type WorldSpec,
} from "./worldspec";

export interface DemoWorld {
  id: string;
  index: string;
  title: string;
  category: string;
  accent: string;
  world: WorldSpec;
  reference: string | null;
  referenceName: string;
}

const material = (
  color: string,
  roughness = 0.72,
  metalness = 0,
  opacity = 1,
): WorldMaterial => ({ color, roughness, metalness, opacity });

function object(
  value: Omit<WorldObject, "rotation" | "mass" | "confidence" | "notes"> &
    Partial<Pick<WorldObject, "rotation" | "mass" | "confidence" | "notes">>,
): WorldObject {
  return {
    rotation: [0, 0, 0],
    mass: value.body === "dynamic" ? 0.5 : 0,
    confidence: 0.82,
    notes: "Curated deterministic showcase scene.",
    ...value,
  };
}

const packingStation: WorldSpec = {
  version: "0.1",
  id: "packing_station",
  summary: "A compact robot packing bench with movable parcels.",
  units: "meters",
  gravity: [0, -9.81, 0],
  bounds: [7.5, 3.4, 5.8],
  camera: {
    position: [4.2, 2.8, 5.4],
    target: [0, 0.8, 0],
    fov: 43,
    confidence: 0.92,
  },
  objects: [
    object({
      id: "floor",
      label: "warehouse floor",
      kind: "box",
      size: [7.5, 0.1, 5.8],
      position: [0, -0.05, 0],
      body: "fixed",
      material: material("#a7aaa6", 0.82, 0.06),
      support: null,
    }),
    object({
      id: "back_wall",
      label: "packing wall",
      kind: "box",
      size: [7.5, 3.4, 0.1],
      position: [0, 1.7, -2.85],
      body: "fixed",
      material: material("#e7e8e1", 0.94),
      support: null,
    }),
    object({
      id: "bench",
      label: "packing bench",
      kind: "table",
      size: [2.8, 0.9, 1.15],
      position: [0, 0.45, 0],
      body: "fixed",
      material: material("#c9d2d1", 0.45, 0.12),
      support: "floor",
    }),
    ...[
      [-0.86, 1.08, 0.12, "#ff795d"],
      [-0.38, 1.07, -0.1, "#f6c555"],
      [0.1, 1.1, 0.08, "#8bb8ff"],
      [0.62, 1.06, -0.12, "#d5a6ff"],
      [1.08, 1.04, 0.16, "#8ed69c"],
    ].map(
      ([x, y, z, color], index) =>
        object({
          id: `parcel_${index + 1}`,
          label: `parcel ${index + 1}`,
          kind: index % 2 ? "carton" : "box",
          size: [0.34 + index * 0.025, 0.28 + (index % 2) * 0.08, 0.3],
          position: [x as number, y as number, z as number],
          rotation: [0, (index - 2) * 0.08, 0],
          body: "dynamic",
          mass: 0.45 + index * 0.08,
          material: material(color as string, 0.68),
          support: "bench",
        }),
    ),
    object({
      id: "side_rack",
      label: "supply rack",
      kind: "box",
      size: [0.42, 1.75, 1.35],
      position: [-2.15, 0.875, -0.3],
      body: "fixed",
      material: material("#252a29", 0.52, 0.3),
      support: "floor",
    }),
    object({
      id: "tape_roll",
      label: "packing tape",
      kind: "cylinder",
      size: [0.22, 0.1, 0.22],
      position: [1.16, 1.0, -0.32],
      rotation: [Math.PI / 2, 0, 0],
      body: "dynamic",
      mass: 0.24,
      material: material("#d8ff3e", 0.45),
      support: "bench",
    }),
  ],
  uncertainties: [
    "Parcel contents and exact mass are unknown.",
    "The shelf is represented by one conservative collider.",
  ],
  refusal: null,
};

const cafeReset: WorldSpec = {
  version: "0.1",
  id: "cafe_reset",
  summary: "A compact café table reset scene for manipulation policies.",
  units: "meters",
  gravity: [0, -9.81, 0],
  bounds: [5.8, 3.1, 5.8],
  camera: {
    position: [3.6, 2.45, 4.8],
    target: [0, 0.7, 0],
    fov: 45,
    confidence: 0.9,
  },
  objects: [
    object({
      id: "floor",
      label: "café floor",
      kind: "box",
      size: [5.8, 0.1, 5.8],
      position: [0, -0.05, 0],
      body: "fixed",
      material: material("#b99d7c", 0.8),
      support: null,
    }),
    object({
      id: "wall",
      label: "warm plaster wall",
      kind: "box",
      size: [5.8, 3.1, 0.1],
      position: [0, 1.55, -2.85],
      body: "fixed",
      material: material("#efe1cb", 0.98),
      support: null,
    }),
    object({
      id: "table",
      label: "café table",
      kind: "table",
      size: [1.5, 0.76, 1.0],
      position: [0, 0.38, 0],
      body: "dynamic",
      mass: 15,
      material: material("#784b33", 0.52),
      support: "floor",
    }),
    ...[
      [-0.95, 0.46, 0.16, Math.PI / 2],
      [0.94, 0.46, -0.12, -Math.PI / 2],
      [0.1, 0.46, -0.92, Math.PI],
    ].map(([x, y, z, yaw], index) =>
      object({
        id: `chair_${index + 1}`,
        label: `café chair ${index + 1}`,
        kind: "chair",
        size: [0.5, 0.92, 0.5],
        position: [x as number, y as number, z as number],
        rotation: [0, yaw, 0],
        body: "dynamic",
        mass: 4.5,
        material: material("#31505a", 0.76),
        support: "floor",
      }),
    ),
    ...[
      [-0.28, 0.89, 0.08, "#ef6a5b"],
      [0.05, 0.88, -0.08, "#f5d16f"],
      [0.32, 0.9, 0.12, "#86bcd2"],
    ].map(([x, y, z, color], index) =>
      object({
        id: `cup_${index + 1}`,
        label: `drink cup ${index + 1}`,
        kind: "cylinder",
        size: [0.15, 0.26, 0.15],
        position: [x as number, y as number, z as number],
        body: "dynamic",
        mass: 0.28,
        material: material(color as string, 0.48),
        support: "table",
      }),
    ),
    object({
      id: "menu",
      label: "table menu",
      kind: "box",
      size: [0.28, 0.36, 0.07],
      position: [0.52, 0.95, -0.12],
      rotation: [0, -0.18, 0],
      body: "dynamic",
      mass: 0.16,
      material: material("#f4efe3", 0.82),
      support: "table",
    }),
  ],
  uncertainties: [
    "Cup fill levels are not represented.",
    "Chair articulation is outside the current rigid-scene scope.",
  ],
  refusal: null,
};

const fulfillmentLane: WorldSpec = {
  version: "0.1",
  id: "fulfillment_lane",
  summary: "A colorful parcel transfer lane with two physical work surfaces.",
  units: "meters",
  gravity: [0, -9.81, 0],
  bounds: [8.2, 3.5, 6.2],
  camera: {
    position: [5.5, 3.4, 6.8],
    target: [0, 0.75, -0.1],
    fov: 42,
    confidence: 0.9,
  },
  objects: [
    object({
      id: "floor",
      label: "factory floor",
      kind: "box",
      size: [8.2, 0.1, 6.2],
      position: [0, -0.05, 0],
      body: "fixed",
      material: material("#777d82", 0.76, 0.16),
      support: null,
    }),
    object({
      id: "back_wall",
      label: "blue factory wall",
      kind: "box",
      size: [8.2, 3.5, 0.1],
      position: [0, 1.75, -3.05],
      body: "fixed",
      material: material("#cbdde3", 0.9),
      support: null,
    }),
    object({
      id: "inspection_bench",
      label: "inspection bench",
      kind: "table",
      size: [2.2, 0.86, 1.0],
      position: [-1.35, 0.43, 0.15],
      body: "fixed",
      material: material("#dce3df", 0.42, 0.15),
      support: "floor",
    }),
    object({
      id: "transfer_lane",
      label: "transfer lane",
      kind: "table",
      size: [2.6, 0.66, 0.72],
      position: [1.25, 0.33, -0.34],
      body: "fixed",
      material: material("#23282b", 0.36, 0.36),
      support: "floor",
    }),
    ...[
      [-1.78, 1.04, 0.12, "#ff6b54", "inspection_bench"],
      [-1.3, 1.05, -0.08, "#ffc650", "inspection_bench"],
      [-0.82, 1.03, 0.13, "#9cd6a8", "inspection_bench"],
      [0.55, 0.83, -0.32, "#8eb7ff", "transfer_lane"],
      [1.22, 0.84, -0.34, "#d699ff", "transfer_lane"],
      [1.9, 0.82, -0.31, "#ff8fbd", "transfer_lane"],
    ].map(([x, y, z, color, support], index) =>
      object({
        id: `load_${index + 1}`,
        label: `transfer parcel ${index + 1}`,
        kind: index % 2 ? "carton" : "box",
        size: [0.38, 0.34, 0.34],
        position: [x as number, y as number, z as number],
        rotation: [0, (index % 3) * 0.08, 0],
        body: "dynamic",
        mass: 0.56,
        material: material(color as string, 0.64),
        support: support as string,
      }),
    ),
    object({
      id: "safety_block",
      label: "safety bollard",
      kind: "cylinder",
      size: [0.24, 1.0, 0.24],
      position: [2.8, 0.5, 0.75],
      body: "fixed",
      material: material("#d8ff3e", 0.44, 0.08),
      support: "floor",
    }),
  ],
  uncertainties: [
    "The transfer lane is static in v0.1.",
    "Parcel labels are intentionally omitted from physics geometry.",
  ],
  refusal: null,
};

export const DEMO_WORLDS: DemoWorld[] = [
  {
    id: "dining",
    index: "01",
    title: "Dining corner · v2",
    category: "Vision rerun",
    accent: "#d8ff3e",
    world: SAMPLE_WORLD,
    reference: "/reference-5608.jpg",
    referenceName: "IMG_5608.HEIC",
  },
  {
    id: "packing",
    index: "02",
    title: "Packing station",
    category: "Manipulation",
    accent: "#ff795d",
    world: packingStation,
    reference: null,
    referenceName: "curated_packing.world",
  },
  {
    id: "cafe",
    index: "03",
    title: "Café reset",
    category: "Tabletop policy",
    accent: "#8eb7ff",
    world: cafeReset,
    reference: null,
    referenceName: "curated_cafe.world",
  },
  {
    id: "fulfillment",
    index: "04",
    title: "Fulfillment lane",
    category: "Robot workcell",
    accent: "#d699ff",
    world: fulfillmentLane,
    reference: null,
    referenceName: "curated_fulfillment.world",
  },
];
