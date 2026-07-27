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
  id: "dining_corner_5608_v2",
  summary:
    "Vision-rerun reconstruction of a four-chair dining corner with image-matched occlusion and tabletop layout.",
  units: "meters",
  gravity: [0, -9.81, 0],
  bounds: [5.8, 3.2, 5.4],
  camera: {
    position: [3, 1.85, 4],
    target: [-0.15, 0.72, -0.55],
    fov: 44,
    confidence: 0.82,
  },
  objects: [
    {
      id: "floor",
      label: "glossy gray tile floor",
      kind: "box",
      size: [5.8, 0.1, 5.4],
      position: [0, -0.05, 0.3],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#aaa79e", 0.42, 0.08),
      support: null,
      confidence: 0.94,
      notes: "Primary support surface; tile seams are rendered by the scene grid.",
    },
    {
      id: "wall_back",
      label: "right white wall",
      kind: "box",
      size: [5.8, 3.2, 0.1],
      position: [0, 1.6, -2.35],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#f3f1ea", 0.96),
      support: null,
      confidence: 0.91,
      notes: "Visible wall carrying the small black control display.",
    },
    {
      id: "wall_left",
      label: "left wall",
      kind: "box",
      size: [0.1, 3.2, 5.4],
      position: [-2.85, 1.6, 0.3],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#eeece5", 0.97),
      support: null,
      confidence: 0.88,
      notes: "Second visible wall defining the photographed room corner.",
    },
    {
      id: "control_panel",
      label: "wall control display",
      kind: "box",
      size: [0.48, 0.27, 0.06],
      position: [1.75, 1.72, -2.28],
      rotation: [0, 0, 0],
      body: "fixed",
      mass: 0,
      material: material("#171b1b", 0.34, 0.12),
      support: null,
      confidence: 0.84,
      notes: "Thin fixed proxy for the black display visible high on the right wall.",
    },
    {
      id: "table",
      label: "dining table",
      kind: "table",
      size: [1.7, 0.78, 0.86],
      position: [0, 0.39, -0.65],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 18,
      material: material("#e4e1d7", 0.38),
      support: "floor",
      confidence: 0.92,
      notes: "White rounded tabletop with dark procedural legs.",
    },
    ...[
      ["front", 0.28, 0.48, 0.83, -0.08, 0.94],
      ["left", -0.82, 0.48, 0.48, -0.3, 0.9],
      ["back", 0.48, 0.48, -1.48, Math.PI, 0.78],
      ["right", 1.2, 0.48, -0.55, Math.PI / 2, 0.86],
    ].map(
      ([name, x, y, z, yaw, confidence]): WorldObject => ({
        id: `chair_${name}`,
        label: `${name} upholstered chair`,
        kind: "chair",
        size: [0.56, 0.96, 0.58],
        position: [x as number, y as number, z as number],
        rotation: [0, yaw as number, 0],
        body: "dynamic",
        mass: 5.4,
        material: material("#4b514c", 0.82),
        support: "floor",
        confidence: confidence as number,
        notes: "Movable chair placed from visible image evidence, not symmetry completion.",
      }),
    ),
    {
      id: "blue_bag_tall",
      label: "tall blue gift bag",
      kind: "bag",
      size: [0.3, 0.46, 0.13],
      position: [-0.55, 1.01, -0.92],
      rotation: [0, -0.04, 0],
      body: "dynamic",
      mass: 0.16,
      material: material("#4ba6d7", 0.8),
      support: "table",
      confidence: 0.88,
      notes: "Left-back member of the visible blue bag cluster.",
    },
    {
      id: "blue_bag_small",
      label: "small blue gift bag",
      kind: "bag",
      size: [0.25, 0.36, 0.12],
      position: [-0.25, 0.96, -0.92],
      rotation: [0, 0.06, 0],
      body: "dynamic",
      mass: 0.13,
      material: material("#74bde3", 0.82),
      support: "table",
      confidence: 0.83,
      notes: "Second visible blue bag; hidden handles are not used as colliders.",
    },
    {
      id: "white_gift_bag",
      label: "large white gift bag",
      kind: "bag",
      size: [0.38, 0.46, 0.14],
      position: [0.56, 1.01, -0.91],
      rotation: [0, -0.02, 0],
      body: "dynamic",
      mass: 0.2,
      material: material("#f2eee1", 0.86),
      support: "table",
      confidence: 0.93,
      notes: "Dominant white paper bag on the right side of the tabletop.",
    },
    {
      id: "clear_water_bottle",
      label: "clear water bottle",
      kind: "bottle",
      size: [0.11, 0.35, 0.11],
      position: [-0.43, 0.955, -0.5],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.42,
      material: material("#d7e5dd", 0.32, 0, 0.68),
      support: "table",
      confidence: 0.9,
      notes: "Transparent bottle at the center-left of the tabletop.",
    },
    {
      id: "left_drink_carton",
      label: "left drink carton",
      kind: "carton",
      size: [0.13, 0.3, 0.11],
      position: [-0.65, 0.93, -0.49],
      rotation: [0, 0.05, 0],
      body: "dynamic",
      mass: 0.31,
      material: material("#b4a487", 0.62),
      support: "table",
      confidence: 0.72,
      notes: "Muted carton-like package in front of the blue bags.",
    },
    {
      id: "clear_tumbler",
      label: "clear glass tumbler",
      kind: "cylinder",
      size: [0.13, 0.16, 0.13],
      position: [-0.22, 0.86, -0.49],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.24,
      material: material("#e8ddd0", 0.25, 0, 0.62),
      support: "table",
      confidence: 0.77,
      notes: "Short transparent drinking vessel near the center.",
    },
    {
      id: "pink_bottle",
      label: "pink drink bottle",
      kind: "bottle",
      size: [0.14, 0.32, 0.12],
      position: [0.03, 0.94, -0.5],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.4,
      material: material("#ef315f", 0.4),
      support: "table",
      confidence: 0.86,
      notes: "First vivid bottle in the image-matched central row.",
    },
    {
      id: "magenta_bottle",
      label: "magenta drink bottle",
      kind: "bottle",
      size: [0.13, 0.29, 0.12],
      position: [0.24, 0.925, -0.5],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.37,
      material: material("#ca4c72", 0.42),
      support: "table",
      confidence: 0.84,
      notes: "Second vivid bottle in the image-matched central row.",
    },
    {
      id: "purple_bottle",
      label: "purple drink bottle",
      kind: "bottle",
      size: [0.12, 0.27, 0.11],
      position: [0.44, 0.915, -0.49],
      rotation: [0, 0, 0],
      body: "dynamic",
      mass: 0.34,
      material: material("#76505b", 0.42),
      support: "table",
      confidence: 0.76,
      notes: "Third bottle terminating the central color row.",
    },
    {
      id: "diffuser_base",
      label: "small diffuser bottle",
      kind: "carton",
      size: [0.12, 0.15, 0.1],
      position: [0.65, 0.855, -0.48],
      rotation: [0, 0.08, 0],
      body: "dynamic",
      mass: 0.2,
      material: material("#d9d5c7", 0.46),
      support: "table",
      confidence: 0.65,
      notes: "Task-relevant base only; thin reeds and flowers are omitted.",
    },
    {
      id: "shoe_box",
      label: "black shoe box",
      kind: "box",
      size: [0.64, 0.28, 0.42],
      position: [1.72, 0.14, 0.45],
      rotation: [0, -0.04, 0],
      body: "dynamic",
      mass: 1.8,
      material: material("#151918", 0.7),
      support: "floor",
      confidence: 0.88,
      notes: "Black striped shoe box at floor level on the far right.",
    },
  ],
  uncertainties: [
    "Metric scale is inferred from furniture priors, not measured.",
    "Four chairs are directly supported by visible seat, back, or leg evidence; no hidden fifth chair is inferred.",
    "Thin bag handles, diffuser reeds, printed text, and the soft cloth on the shoe box are visual details outside the rigid primitive schema.",
    "Small-product identity is less certain than silhouette, ordering, and support.",
  ],
  refusal: null,
};
