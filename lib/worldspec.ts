export type Vec3 = [number, number, number];

export type WorldObjectKind =
  | "box"
  | "cylinder"
  | "table"
  | "chair"
  | "bottle"
  | "carton"
  | "bag";

export interface WorldMaterial {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
}

export interface WorldObject {
  id: string;
  label: string;
  kind: WorldObjectKind;
  size: Vec3;
  position: Vec3;
  rotation: Vec3;
  body: "fixed" | "dynamic";
  mass: number;
  material: WorldMaterial;
  support: string | null;
  confidence: number;
  notes: string;
}

export interface WorldSpec {
  version: "0.1";
  id: string;
  summary: string;
  units: "meters";
  gravity: Vec3;
  bounds: Vec3;
  camera: {
    position: Vec3;
    target: Vec3;
    fov: number;
    confidence: number;
  };
  objects: WorldObject[];
  uncertainties: string[];
  refusal: string | null;
}

const numberSchema = { type: "number" } as const;
const vec3Schema = {
  type: "array",
  minItems: 3,
  maxItems: 3,
  items: numberSchema,
} as const;

export const WORLD_SPEC_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "id",
    "summary",
    "units",
    "gravity",
    "bounds",
    "camera",
    "objects",
    "uncertainties",
    "refusal",
  ],
  properties: {
    version: { type: "string", enum: ["0.1"] },
    id: {
      type: "string",
      pattern: "^[a-z][a-z0-9_]{2,47}$",
    },
    summary: { type: "string" },
    units: { type: "string", enum: ["meters"] },
    gravity: vec3Schema,
    bounds: vec3Schema,
    camera: {
      type: "object",
      additionalProperties: false,
      required: ["position", "target", "fov", "confidence"],
      properties: {
        position: vec3Schema,
        target: vec3Schema,
        fov: { type: "number", minimum: 20, maximum: 100 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    objects: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "label",
          "kind",
          "size",
          "position",
          "rotation",
          "body",
          "mass",
          "material",
          "support",
          "confidence",
          "notes",
        ],
        properties: {
          id: {
            type: "string",
            pattern: "^[a-z][a-z0-9_]{1,47}$",
          },
          label: { type: "string" },
          kind: {
            type: "string",
            enum: [
              "box",
              "cylinder",
              "table",
              "chair",
              "bottle",
              "carton",
              "bag",
            ],
          },
          size: vec3Schema,
          position: vec3Schema,
          rotation: vec3Schema,
          body: { type: "string", enum: ["fixed", "dynamic"] },
          mass: { type: "number", minimum: 0, maximum: 1000 },
          material: {
            type: "object",
            additionalProperties: false,
            required: ["color", "roughness", "metalness", "opacity"],
            properties: {
              color: {
                type: "string",
                pattern: "^#[0-9a-fA-F]{6}$",
              },
              roughness: { type: "number", minimum: 0, maximum: 1 },
              metalness: { type: "number", minimum: 0, maximum: 1 },
              opacity: { type: "number", minimum: 0.05, maximum: 1 },
            },
          },
          support: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          notes: { type: "string" },
        },
      },
    },
    uncertainties: {
      type: "array",
      maxItems: 20,
      items: { type: "string" },
    },
    refusal: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
} as const;

const kinds = new Set<WorldObjectKind>([
  "box",
  "cylinder",
  "table",
  "chair",
  "bottle",
  "carton",
  "bag",
]);

function isFiniteVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function inUnitRange(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

export function validateWorldSpec(
  value: unknown,
): { ok: true; data: WorldSpec } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["WorldSpec must be an object."] };
  }

  const spec = value as Partial<WorldSpec>;
  if (spec.version !== "0.1") errors.push("version must be 0.1.");
  if (!spec.id || !/^[a-z][a-z0-9_]{2,47}$/.test(spec.id)) {
    errors.push("id must be a lowercase snake_case identifier.");
  }
  if (typeof spec.summary !== "string" || !spec.summary.trim()) {
    errors.push("summary is required.");
  }
  if (spec.units !== "meters") errors.push("units must be meters.");
  if (!isFiniteVec3(spec.gravity)) errors.push("gravity must be a Vec3.");
  if (
    !isFiniteVec3(spec.bounds) ||
    spec.bounds.some((item) => item < 0.5 || item > 30)
  ) {
    errors.push("bounds must contain three values between 0.5m and 30m.");
  }

  if (!spec.camera || typeof spec.camera !== "object") {
    errors.push("camera is required.");
  } else {
    if (!isFiniteVec3(spec.camera.position)) {
      errors.push("camera.position must be a Vec3.");
    }
    if (!isFiniteVec3(spec.camera.target)) {
      errors.push("camera.target must be a Vec3.");
    }
    if (
      typeof spec.camera.fov !== "number" ||
      spec.camera.fov < 20 ||
      spec.camera.fov > 100
    ) {
      errors.push("camera.fov must be between 20 and 100.");
    }
    if (!inUnitRange(spec.camera.confidence)) {
      errors.push("camera.confidence must be between 0 and 1.");
    }
  }

  if (!Array.isArray(spec.objects) || spec.objects.length > 40) {
    errors.push("objects must be an array with at most 40 entries.");
  } else {
    const ids = new Set<string>();
    spec.objects.forEach((object, index) => {
      const path = `objects[${index}]`;
      if (!object || typeof object !== "object") {
        errors.push(`${path} must be an object.`);
        return;
      }
      if (!/^[a-z][a-z0-9_]{1,47}$/.test(object.id)) {
        errors.push(`${path}.id is invalid.`);
      } else if (ids.has(object.id)) {
        errors.push(`${path}.id must be unique.`);
      } else {
        ids.add(object.id);
      }
      if (!kinds.has(object.kind)) errors.push(`${path}.kind is unsupported.`);
      if (
        !isFiniteVec3(object.size) ||
        object.size.some((item) => item < 0.015 || item > 20)
      ) {
        errors.push(`${path}.size is outside the supported range.`);
      }
      if (!isFiniteVec3(object.position)) {
        errors.push(`${path}.position must be a Vec3.`);
      }
      if (!isFiniteVec3(object.rotation)) {
        errors.push(`${path}.rotation must be a Vec3.`);
      }
      if (object.body !== "fixed" && object.body !== "dynamic") {
        errors.push(`${path}.body is invalid.`);
      }
      if (
        typeof object.mass !== "number" ||
        object.mass < 0 ||
        object.mass > 1000
      ) {
        errors.push(`${path}.mass is invalid.`);
      }
      if (object.body === "dynamic" && object.mass <= 0) {
        errors.push(`${path}.mass must be positive for a dynamic body.`);
      }
      if (
        !object.material ||
        !/^#[0-9a-fA-F]{6}$/.test(object.material.color) ||
        !inUnitRange(object.material.roughness) ||
        !inUnitRange(object.material.metalness) ||
        typeof object.material.opacity !== "number" ||
        object.material.opacity < 0.05 ||
        object.material.opacity > 1
      ) {
        errors.push(`${path}.material is invalid.`);
      }
      if (!inUnitRange(object.confidence)) {
        errors.push(`${path}.confidence must be between 0 and 1.`);
      }
    });

    spec.objects.forEach((object, index) => {
      if (
        object.support !== null &&
        (!ids.has(object.support) || object.support === object.id)
      ) {
        errors.push(`objects[${index}].support does not reference another object.`);
      }
    });
  }

  if (
    !Array.isArray(spec.uncertainties) ||
    !spec.uncertainties.every((item) => typeof item === "string")
  ) {
    errors.push("uncertainties must be a string array.");
  }
  if (spec.refusal !== null && typeof spec.refusal !== "string") {
    errors.push("refusal must be a string or null.");
  }
  if (spec.refusal === null && Array.isArray(spec.objects) && spec.objects.length < 2) {
    errors.push("A non-refused scene must contain at least two objects.");
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, data: spec as WorldSpec };
}

const material = (
  color: string,
  roughness = 0.7,
  metalness = 0,
  opacity = 1,
): WorldMaterial => ({ color, roughness, metalness, opacity });

export const SAMPLE_WORLD: WorldSpec = {
  version: "0.1",
  id: "dining_corner_5608",
  summary:
    "Dining corner reconstructed from one handheld photo as reusable procedural primitives.",
  units: "meters",
  gravity: [0, -9.81, 0],
  bounds: [6.2, 3.2, 6.2],
  camera: {
    position: [3.4, 2.65, 5.2],
    target: [0, 0.8, 0],
    fov: 46,
    confidence: 0.76,
  },
  objects: [
    {
      id: "floor",
      label: "stone tile floor",
      kind: "box",
      size: [6.2, 0.1, 6.2],
      position: [0, -0.05, 0],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#b7b4aa", 0.78, 0.04),
      support: null,
      confidence: 0.88,
      notes: "Primary world support surface.",
    },
    {
      id: "wall_back",
      label: "back wall",
      kind: "box",
      size: [6.2, 3.2, 0.1],
      position: [0, 1.6, -3.05],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#eeede7", 0.98),
      support: null,
      confidence: 0.82,
      notes: "Estimated room boundary.",
    },
    {
      id: "wall_left",
      label: "left wall",
      kind: "box",
      size: [0.1, 3.2, 6.2],
      position: [-3.05, 1.6, 0],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#e9e8e2", 0.98),
      support: null,
      confidence: 0.79,
      notes: "Estimated room boundary.",
    },
    {
      id: "table",
      label: "dining table",
      kind: "table",
      size: [1.7, 0.76, 0.92],
      position: [0, 0.38, 0],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#dedbd0", 0.44),
      support: "floor",
      confidence: 0.86,
      notes: "Procedural top and four legs.",
    },
    ...[
      [-0.42, 0.46, 1.12, 0.05],
      [-1.02, 0.46, 0.54, 0.42],
      [-0.62, 0.46, -0.68, Math.PI],
      [0.48, 0.46, -0.7, Math.PI],
      [1.05, 0.46, 0.05, -Math.PI / 2],
    ].map(
      ([x, y, z, yaw], index): WorldObject => ({
        id: `chair_${index + 1}`,
        label: `upholstered chair ${index + 1}`,
        kind: "chair",
        size: [0.5, 0.92, 0.5],
        position: [x, y, z],
        rotation: [0, yaw, 0],
        body: "fixed",
        mass: 0,
        material: material("#505651", 0.8),
        support: "floor",
        confidence: index === 4 ? 0.62 : 0.78,
        notes: "Repeated procedural chair template.",
      }),
    ),
    {
      id: "clear_bottle",
      label: "clear water bottle",
      kind: "bottle",
      size: [0.12, 0.34, 0.12],
      position: [-0.46, 0.94, 0.02],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.42,
      material: material("#d7e5dd", 0.32, 0, 0.68),
      support: "table",
      confidence: 0.77,
      notes: "Identity is uncertain; geometry is task-relevant.",
    },
    {
      id: "red_bottle",
      label: "red drink bottle",
      kind: "bottle",
      size: [0.12, 0.3, 0.12],
      position: [-0.2, 0.92, -0.03],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.38,
      material: material("#f05668", 0.38),
      support: "table",
      confidence: 0.73,
      notes: "Approximate capped-cylinder reconstruction.",
    },
    {
      id: "purple_bottle",
      label: "purple drink bottle",
      kind: "bottle",
      size: [0.12, 0.28, 0.12],
      position: [0.03, 0.91, -0.05],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.36,
      material: material("#76505b", 0.42),
      support: "table",
      confidence: 0.69,
      notes: "Approximate capped-cylinder reconstruction.",
    },
    {
      id: "red_carton",
      label: "red drink carton",
      kind: "carton",
      size: [0.16, 0.28, 0.11],
      position: [-0.7, 0.91, 0.05],
      rotation: [0, 0.12, 0],
      body: "dynamic",
      mass: 0.3,
      material: material("#d84848", 0.58),
      support: "table",
      confidence: 0.7,
      notes: "Simple rounded carton proxy.",
    },
    {
      id: "tea_carton",
      label: "tea carton",
      kind: "carton",
      size: [0.16, 0.28, 0.11],
      position: [-0.84, 0.91, -0.12],
      rotation: [0, -0.16, 0],
      body: "dynamic",
      mass: 0.3,
      material: material("#a77955", 0.6),
      support: "table",
      confidence: 0.66,
      notes: "Simple rounded carton proxy.",
    },
    {
      id: "gift_bag",
      label: "paper gift bag",
      kind: "bag",
      size: [0.42, 0.44, 0.14],
      position: [0.55, 0.99, -0.11],
      rotation: [0, -0.05, 0],
      body: "dynamic",
      mass: 0.18,
      material: material("#eee9d8", 0.84),
      support: "table",
      confidence: 0.81,
      notes: "Thin box proxy; handles are visual only.",
    },
    {
      id: "shoe_box",
      label: "black shoe box",
      kind: "box",
      size: [0.62, 0.26, 0.42],
      position: [1.68, 0.13, 0.8],
      rotation: [0, 0.1, 0],
      body: "fixed",
      mass: 0,
      material: material("#171a17", 0.72),
      support: "floor",
      confidence: 0.71,
      notes: "Static because contents and mass are unknown.",
    },
  ],
  uncertainties: [
    "Metric scale is inferred from furniture priors, not measured.",
    "The far-side chair count is partially occluded.",
    "Small-object identity is less certain than geometry and support.",
  ],
  refusal: null,
};
