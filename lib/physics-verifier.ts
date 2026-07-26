import type { WorldObject, WorldSpec } from "./worldspec";

export interface StaticVerification {
  supportTotal: number;
  supportValid: number;
  invalidSupports: string[];
  initialOverlapCount: number;
  initialOverlaps: string[];
  dynamicBodies: number;
}

function halfSize(object: WorldObject): [number, number, number] {
  return [object.size[0] / 2, object.size[1] / 2, object.size[2] / 2];
}

function isSupportedBy(child: WorldObject, parent: WorldObject): boolean {
  const childHalf = halfSize(child);
  const parentHalf = halfSize(parent);
  const childBottom = child.position[1] - childHalf[1];
  const parentTop = parent.position[1] + parentHalf[1];
  const heightGap = childBottom - parentTop;
  const xInside =
    Math.abs(child.position[0] - parent.position[0]) <=
    parentHalf[0] + childHalf[0] * 0.25;
  const zInside =
    Math.abs(child.position[2] - parent.position[2]) <=
    parentHalf[2] + childHalf[2] * 0.25;

  return heightGap >= -0.035 && heightGap <= 0.09 && xInside && zInside;
}

function overlapDepth(a: WorldObject, b: WorldObject): [number, number, number] {
  const ah = halfSize(a);
  const bh = halfSize(b);
  return [
    ah[0] + bh[0] - Math.abs(a.position[0] - b.position[0]),
    ah[1] + bh[1] - Math.abs(a.position[1] - b.position[1]),
    ah[2] + bh[2] - Math.abs(a.position[2] - b.position[2]),
  ];
}

export function verifyStaticWorld(spec: WorldSpec): StaticVerification {
  const byId = new Map(spec.objects.map((object) => [object.id, object]));
  const supported = spec.objects.filter(
    (object) => object.body === "dynamic" && object.support,
  );
  const invalidSupports = supported
    .filter((object) => {
      const parent = object.support ? byId.get(object.support) : undefined;
      return !parent || !isSupportedBy(object, parent);
    })
    .map((object) => object.id);

  const initialOverlaps: string[] = [];
  const dynamicObjects = spec.objects.filter(
    (object) => object.body === "dynamic",
  );

  dynamicObjects.forEach((dynamicObject) => {
    spec.objects.forEach((other) => {
      if (
        dynamicObject.id === other.id ||
        (other.body === "dynamic" && dynamicObject.id > other.id) ||
        dynamicObject.support === other.id
      ) {
        return;
      }
      const depth = overlapDepth(dynamicObject, other);
      if (depth.every((value) => value > 0.012)) {
        initialOverlaps.push(`${dynamicObject.id} × ${other.id}`);
      }
    });
  });

  return {
    supportTotal: supported.length,
    supportValid: supported.length - invalidSupports.length,
    invalidSupports,
    initialOverlapCount: initialOverlaps.length,
    initialOverlaps,
    dynamicBodies: dynamicObjects.length,
  };
}
