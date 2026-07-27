"use client";

import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Grid,
  Html,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import {
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  Download,
  Eye,
  EyeOff,
  FileImage,
  GitFork,
  KeyRound,
  LoaderCircle,
  MousePointer2,
  Orbit,
  Play,
  RefreshCcw,
  ScanLine,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { type WorldObject, type WorldSpec } from "../lib/worldspec";
import {
  verifyStaticWorld,
  type StaticVerification,
} from "../lib/physics-verifier";
import {
  WORLD_GENERATION_PROMPT,
  WORLD_PROMPT_VERSION,
} from "../lib/world-prompt";
import { DEMO_WORLDS, type DemoWorld } from "../lib/demo-worlds";

type StageState = "done" | "active" | "waiting";
type DockTab = "spec" | "report" | "prompt";
type VerificationPhase = "verifying" | "passed" | "warning" | "paused";
type ConnectionState = "idle" | "testing" | "success" | "error";

const SESSION_API_KEY = "worldbycode:session-api-key";
const SESSION_MODEL = "worldbycode:session-model";

interface ApiStatus {
  configured: boolean;
  model: string;
  promptVersion: string;
  mode: "live" | "example";
  byokAllowed?: boolean;
}

interface GenerationMetadata {
  provider: string;
  model: string;
  credentialMode?: "server" | "session";
  responseId: string | null;
  promptVersion: string;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
}

interface RuntimeReport extends StaticVerification {
  phase: VerificationPhase;
  elapsed: number;
  settled: boolean;
  settleTime: number | null;
  fallenBodies: number;
  score: number | null;
}

const stages = [
  ["Observe", "image · objects · camera"],
  ["Blueprint", "strict WorldSpec JSON"],
  ["Compile", "deterministic scene code"],
  ["Verify", "5s local physics run"],
] as const;

const INITIAL_DEMO = DEMO_WORLDS[0]!;

function createInitialReport(
  world: WorldSpec,
  gravityOn = true,
): RuntimeReport {
  return {
    ...verifyStaticWorld(world),
    phase: gravityOn ? "verifying" : "paused",
    elapsed: 0,
    settled: false,
    settleTime: null,
    fallenBodies: 0,
    score: null,
  };
}

function scoreReport(
  verification: StaticVerification,
  settled: boolean,
  fallenBodies: number,
) {
  return Math.max(
    0,
    100 -
      verification.initialOverlapCount * 14 -
      verification.invalidSupports.length * 10 -
      fallenBodies * 25 -
      (settled ? 0 : 12),
  );
}

function materialProps(object: WorldObject) {
  return {
    color: object.material.color,
    roughness: object.material.roughness,
    metalness: object.material.metalness,
    transparent: object.material.opacity < 1,
    opacity: object.material.opacity,
  };
}

function TableVisual({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;
  const topThickness = Math.min(0.11, height * 0.16);
  const legHeight = Math.max(0.05, height - topThickness);
  const legWidth = Math.min(0.07, width * 0.08);
  const legDepth = Math.min(0.07, depth * 0.12);
  const legX = width / 2 - legWidth * 1.7;
  const legZ = depth / 2 - legDepth * 1.7;

  return (
    <group>
      <RoundedBox
        args={[width, topThickness, depth]}
        radius={Math.min(0.04, topThickness * 0.35)}
        smoothness={3}
        position={[0, height / 2 - topThickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      {[
        [-legX, -topThickness / 2, -legZ],
        [legX, -topThickness / 2, -legZ],
        [-legX, -topThickness / 2, legZ],
        [legX, -topThickness / 2, legZ],
      ].map((position, index) => (
        <RoundedBox
          key={index}
          args={[legWidth, legHeight, legDepth]}
          radius={Math.min(0.018, legWidth * 0.25)}
          smoothness={2}
          position={position as [number, number, number]}
          castShadow
        >
          <meshStandardMaterial
            color="#242824"
            roughness={0.72}
            metalness={0.04}
          />
        </RoundedBox>
      ))}
    </group>
  );
}

function ChairVisual({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;
  const seatThickness = Math.min(0.1, height * 0.12);
  const seatY = -height / 2 + height * 0.5;
  const backHeight = height * 0.5;
  const backY = height / 2 - backHeight / 2;
  const backDepth = Math.min(0.09, depth * 0.17);
  const legHeight = Math.max(0.08, seatY + height / 2);
  const legWidth = Math.min(0.04, width * 0.08);
  const legX = width / 2 - legWidth * 1.6;
  const legZ = depth / 2 - legWidth * 1.6;

  return (
    <group>
      <RoundedBox
        args={[width, seatThickness, depth * 0.9]}
        radius={Math.min(0.06, seatThickness * 0.48)}
        smoothness={3}
        position={[0, seatY, 0]}
        castShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      <RoundedBox
        args={[width, backHeight, backDepth]}
        radius={Math.min(0.07, backDepth * 0.7)}
        smoothness={3}
        position={[0, backY, depth / 2 - backDepth / 2]}
        rotation={[-0.08, 0, 0]}
        castShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      {[
        [-legX, -height / 2 + legHeight / 2, -legZ],
        [legX, -height / 2 + legHeight / 2, -legZ],
        [-legX, -height / 2 + legHeight / 2, legZ],
        [legX, -height / 2 + legHeight / 2, legZ],
      ].map((position, index) => (
        <mesh
          key={index}
          position={position as [number, number, number]}
          castShadow
        >
          <cylinderGeometry
            args={[legWidth * 0.42, legWidth * 0.58, legHeight, 10]}
          />
          <meshStandardMaterial color="#20241f" roughness={0.76} />
        </mesh>
      ))}
    </group>
  );
}

function MonitorVisual({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;
  const screenHeight = height * 0.72;
  const screenDepth = Math.max(0.035, depth * 0.54);
  const baseHeight = Math.max(0.018, height * 0.055);
  const standHeight = height * 0.22;

  return (
    <group>
      <RoundedBox
        args={[width, screenHeight, screenDepth]}
        radius={Math.min(0.035, height * 0.06)}
        smoothness={3}
        position={[0, height * 0.12, 0]}
        castShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      <mesh position={[0, height * 0.12, screenDepth / 2 + 0.001]}>
        <planeGeometry args={[width * 0.9, screenHeight * 0.84]} />
        <meshStandardMaterial color="#182127" roughness={0.28} metalness={0.08} />
      </mesh>
      <RoundedBox
        args={[width * 0.07, standHeight, Math.max(0.025, depth * 0.3)]}
        radius={0.012}
        smoothness={2}
        position={[0, -height * 0.32, 0]}
        castShadow
      >
        <meshStandardMaterial color="#222725" roughness={0.5} metalness={0.18} />
      </RoundedBox>
      <RoundedBox
        args={[width * 0.32, baseHeight, depth]}
        radius={Math.min(0.012, baseHeight * 0.4)}
        smoothness={2}
        position={[0, -height / 2 + baseHeight / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color="#222725" roughness={0.52} metalness={0.18} />
      </RoundedBox>
    </group>
  );
}

function PlantVisual({ object }: { object: WorldObject }) {
  const [width, height] = object.size;
  const potHeight = height * 0.3;
  const potRadius = width * 0.27;
  const potY = -height / 2 + potHeight / 2;
  const isCactus = object.notes.toLowerCase().includes("cactus");

  return (
    <group>
      <mesh position={[0, potY, 0]} castShadow>
        <cylinderGeometry args={[potRadius * 0.82, potRadius, potHeight, 20]} />
        <meshStandardMaterial {...materialProps(object)} />
      </mesh>
      {isCactus ? (
        <>
          <mesh position={[0, height * 0.13, 0]} castShadow>
            <capsuleGeometry args={[width * 0.13, height * 0.44, 7, 14]} />
            <meshStandardMaterial color="#4f7046" roughness={0.9} />
          </mesh>
          <mesh
            position={[width * 0.16, height * 0.12, 0]}
            rotation={[0, 0, -0.35]}
            castShadow
          >
            <capsuleGeometry args={[width * 0.08, height * 0.2, 6, 12]} />
            <meshStandardMaterial color="#587b4c" roughness={0.9} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, -height * 0.04, 0]} castShadow>
            <cylinderGeometry args={[width * 0.035, width * 0.045, height * 0.42, 10]} />
            <meshStandardMaterial color="#5a4a31" roughness={0.92} />
          </mesh>
          {[
            [-0.18, 0.07, 0.04, 0.56],
            [0.16, 0.15, -0.08, 0.5],
            [-0.04, 0.27, 0.08, 0.58],
            [0.04, 0.36, -0.02, 0.44],
          ].map(([x, y, z, scale], index) => (
            <mesh
              key={index}
              position={[width * x, height * y, width * z]}
              scale={[width * scale, height * scale * 0.64, width * scale]}
              castShadow
            >
              <icosahedronGeometry args={[0.5, 1]} />
              <meshStandardMaterial
                color={index % 2 === 0 ? "#476c3e" : "#5d7e4c"}
                roughness={0.93}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function LampVisual({ object }: { object: WorldObject }) {
  const [width, height] = object.size;
  const isPendant = object.notes.toLowerCase().includes("pendant");

  if (isPendant) {
    const shadeHeight = height * 0.34;
    const cordHeight = height - shadeHeight * 0.72;
    return (
      <group>
        <mesh position={[0, height / 2 - cordHeight / 2, 0]} castShadow>
          <cylinderGeometry args={[width * 0.018, width * 0.018, cordHeight, 10]} />
          <meshStandardMaterial color="#29251f" roughness={0.65} metalness={0.2} />
        </mesh>
        <mesh position={[0, -height / 2 + shadeHeight / 2, 0]} castShadow>
          <cylinderGeometry
            args={[width * 0.18, width * 0.48, shadeHeight, 28, 1, true]}
          />
          <meshStandardMaterial {...materialProps(object)} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -height / 2 + shadeHeight * 0.48, 0]}>
          <sphereGeometry args={[width * 0.07, 14, 10]} />
          <meshStandardMaterial color="#fff0b8" emissive="#d89832" emissiveIntensity={0.7} />
        </mesh>
      </group>
    );
  }

  const baseHeight = Math.max(0.025, height * 0.07);
  return (
    <group>
      <mesh position={[0, -height / 2 + baseHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[width * 0.36, width * 0.42, baseHeight, 20]} />
        <meshStandardMaterial color="#3b403b" roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh position={[-width * 0.08, -height * 0.12, 0]} rotation={[0, 0, -0.22]} castShadow>
        <cylinderGeometry args={[width * 0.035, width * 0.04, height * 0.58, 10]} />
        <meshStandardMaterial color="#3b403b" roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh position={[width * 0.08, height * 0.22, 0]} rotation={[0, 0, -0.28]} castShadow>
        <cylinderGeometry args={[width * 0.16, width * 0.3, height * 0.24, 20]} />
        <meshStandardMaterial {...materialProps(object)} />
      </mesh>
    </group>
  );
}

function SofaVisual({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;
  const baseHeight = height * 0.34;
  const backHeight = height * 0.64;
  const backDepth = depth * 0.2;
  const armWidth = Math.min(width * 0.12, 0.18);

  return (
    <group>
      <RoundedBox
        args={[width, baseHeight, depth]}
        radius={Math.min(0.08, baseHeight * 0.22)}
        smoothness={4}
        position={[0, -height / 2 + baseHeight / 2, 0]}
        castShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      <RoundedBox
        args={[width - armWidth * 2.1, height * 0.18, depth * 0.7]}
        radius={Math.min(0.08, height * 0.07)}
        smoothness={4}
        position={[0, -height * 0.18, -depth * 0.05]}
        castShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      <RoundedBox
        args={[width, backHeight, backDepth]}
        radius={Math.min(0.08, backDepth * 0.35)}
        smoothness={4}
        position={[0, height / 2 - backHeight / 2, depth / 2 - backDepth / 2]}
        castShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      {[-width / 2 + armWidth / 2, width / 2 - armWidth / 2].map((x) => (
        <RoundedBox
          key={x}
          args={[armWidth, height * 0.56, depth * 0.88]}
          radius={Math.min(0.07, armWidth * 0.28)}
          smoothness={3}
          position={[x, -height * 0.13, 0]}
          castShadow
        >
          <meshStandardMaterial {...materialProps(object)} />
        </RoundedBox>
      ))}
    </group>
  );
}

function BottleVisual({ object }: { object: WorldObject }) {
  const [width, height] = object.size;
  const capHeight = Math.min(height * 0.16, 0.05);
  const bodyHeight = height - capHeight;

  return (
    <group>
      <mesh position={[0, -capHeight / 2, 0]} castShadow>
        <cylinderGeometry
          args={[width * 0.42, width * 0.49, bodyHeight, 22]}
        />
        <meshStandardMaterial {...materialProps(object)} />
      </mesh>
      <mesh position={[0, height / 2 - capHeight / 2, 0]} castShadow>
        <cylinderGeometry
          args={[width * 0.29, width * 0.29, capHeight, 18]}
        />
        <meshStandardMaterial color="#eee7d8" roughness={0.62} />
      </mesh>
      <mesh position={[0, -height * 0.02, width * 0.49]}>
        <planeGeometry args={[width * 0.68, bodyHeight * 0.4]} />
        <meshStandardMaterial color="#f0e7ce" roughness={0.82} />
      </mesh>
    </group>
  );
}

function BagVisual({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;
  return (
    <group>
      <RoundedBox
        args={object.size}
        radius={Math.min(0.025, depth * 0.15)}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      {[-width * 0.24, width * 0.24].map((x) => (
        <mesh
          key={x}
          position={[x, height / 2 + Math.min(0.06, height * 0.13), 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry
            args={[
              Math.min(width * 0.18, 0.08),
              Math.min(0.009, depth * 0.05),
              8,
              18,
              Math.PI,
            ]}
          />
          <meshStandardMaterial color="#c8b28b" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function CartonVisual({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;
  const isOpen = object.notes.toLowerCase().includes("open carton");

  if (!isOpen) {
    return (
      <RoundedBox
        args={object.size}
        radius={Math.min(0.022, width * 0.12)}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
    );
  }

  const bodyHeight = height * 0.72;
  const bodyY = -height / 2 + bodyHeight / 2;
  const flapThickness = Math.max(0.012, height * 0.018);

  return (
    <group>
      <RoundedBox
        args={[width, bodyHeight, depth]}
        radius={Math.min(0.022, width * 0.08)}
        smoothness={3}
        position={[0, bodyY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...materialProps(object)} />
      </RoundedBox>
      {[-1, 1].map((direction) => (
        <mesh
          key={`z-${direction}`}
          position={[0, height * 0.27, direction * depth * 0.5]}
          rotation={[direction * -0.52, 0, 0]}
          castShadow
        >
          <boxGeometry args={[width * 0.96, flapThickness, depth * 0.48]} />
          <meshStandardMaterial {...materialProps(object)} />
        </mesh>
      ))}
      {[-1, 1].map((direction) => (
        <mesh
          key={`x-${direction}`}
          position={[direction * width * 0.5, height * 0.27, 0]}
          rotation={[0, 0, direction * 0.52]}
          castShadow
        >
          <boxGeometry args={[width * 0.48, flapThickness, depth * 0.92]} />
          <meshStandardMaterial {...materialProps(object)} />
        </mesh>
      ))}
    </group>
  );
}

function BookStackVisual({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;
  const layerHeight = height / 5;
  const layers = [
    { scale: 1, color: "#d8ddd8", yaw: -0.035 },
    { scale: 0.92, color: "#34413d", yaw: 0.025 },
    { scale: 0.98, color: "#eeeae0", yaw: -0.018 },
    { scale: 0.9, color: "#41524a", yaw: 0.032 },
    { scale: 0.8, color: "#9c6a4d", yaw: -0.04 },
  ];

  return (
    <group>
      {layers.map((layer, index) => (
        <RoundedBox
          key={layer.color}
          args={[
            width * layer.scale,
            layerHeight * 0.82,
            depth * (0.9 + layer.scale * 0.1),
          ]}
          radius={Math.min(0.012, layerHeight * 0.18)}
          smoothness={2}
          position={[0, -height / 2 + layerHeight * (index + 0.5), 0]}
          rotation={[0, layer.yaw, 0]}
          castShadow
        >
          <meshStandardMaterial color={layer.color} roughness={0.76} />
        </RoundedBox>
      ))}
    </group>
  );
}

function ObjectVisual({ object }: { object: WorldObject }) {
  if (object.kind === "table") return <TableVisual object={object} />;
  if (object.kind === "chair") return <ChairVisual object={object} />;
  if (object.kind === "monitor") return <MonitorVisual object={object} />;
  if (object.kind === "plant") return <PlantVisual object={object} />;
  if (object.kind === "lamp") return <LampVisual object={object} />;
  if (object.kind === "sofa") return <SofaVisual object={object} />;
  if (object.kind === "bottle") return <BottleVisual object={object} />;
  if (object.kind === "bag") return <BagVisual object={object} />;
  if (object.kind === "carton") return <CartonVisual object={object} />;
  if (object.notes.toLowerCase().includes("book stack")) {
    return <BookStackVisual object={object} />;
  }

  if (object.kind === "cylinder") {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[object.size[0] / 2, object.size[0] / 2, object.size[1], 22]}
        />
        <meshStandardMaterial {...materialProps(object)} />
      </mesh>
    );
  }

  return (
    <RoundedBox
      args={object.size}
      radius={Math.min(0.035, Math.min(...object.size) * 0.12)}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial {...materialProps(object)} />
    </RoundedBox>
  );
}

function ObjectColliders({ object }: { object: WorldObject }) {
  const [width, height, depth] = object.size;

  if (object.kind === "table") {
    const topThickness = Math.min(0.11, height * 0.16);
    const legHeight = Math.max(0.05, height - topThickness);
    const legWidth = Math.min(0.07, width * 0.08);
    const legDepth = Math.min(0.07, depth * 0.12);
    const legX = width / 2 - legWidth * 1.7;
    const legZ = depth / 2 - legDepth * 1.7;
    return (
      <>
        <CuboidCollider
          args={[width / 2, topThickness / 2, depth / 2]}
          position={[0, height / 2 - topThickness / 2, 0]}
        />
        {[
          [-legX, -topThickness / 2, -legZ],
          [legX, -topThickness / 2, -legZ],
          [-legX, -topThickness / 2, legZ],
          [legX, -topThickness / 2, legZ],
        ].map((position, index) => (
          <CuboidCollider
            key={index}
            args={[legWidth / 2, legHeight / 2, legDepth / 2]}
            position={position as [number, number, number]}
          />
        ))}
      </>
    );
  }

  if (object.kind === "chair") {
    const seatThickness = Math.min(0.1, height * 0.12);
    const seatY = -height / 2 + height * 0.5;
    const backHeight = height * 0.5;
    const backDepth = Math.min(0.09, depth * 0.17);
    const legHeight = Math.max(0.08, seatY + height / 2);
    const legWidth = Math.min(0.04, width * 0.08);
    const legX = width / 2 - legWidth * 1.6;
    const legZ = depth / 2 - legWidth * 1.6;
    return (
      <>
        <CuboidCollider
          args={[width / 2, seatThickness / 2, depth * 0.45]}
          position={[0, seatY, 0]}
        />
        <CuboidCollider
          args={[width / 2, backHeight / 2, backDepth / 2]}
          position={[0, height / 2 - backHeight / 2, depth / 2 - backDepth / 2]}
        />
        {[
          [-legX, -height / 2 + legHeight / 2, -legZ],
          [legX, -height / 2 + legHeight / 2, -legZ],
          [-legX, -height / 2 + legHeight / 2, legZ],
          [legX, -height / 2 + legHeight / 2, legZ],
        ].map((position, index) => (
          <CuboidCollider
            key={index}
            args={[legWidth / 2, legHeight / 2, legWidth / 2]}
            position={position as [number, number, number]}
          />
        ))}
      </>
    );
  }

  if (object.kind === "cylinder" || object.kind === "bottle") {
    return <CylinderCollider args={[height / 2, width / 2]} />;
  }

  if (object.kind === "monitor") {
    const screenHeight = height * 0.72;
    const screenDepth = Math.max(0.035, depth * 0.54);
    const baseHeight = Math.max(0.018, height * 0.055);
    const standHeight = height * 0.22;
    return (
      <>
        <CuboidCollider
          args={[width / 2, screenHeight / 2, screenDepth / 2]}
          position={[0, height * 0.12, 0]}
        />
        <CuboidCollider
          args={[width * 0.035, standHeight / 2, Math.max(0.025, depth * 0.3) / 2]}
          position={[0, -height * 0.32, 0]}
        />
        <CuboidCollider
          args={[width * 0.16, baseHeight / 2, depth / 2]}
          position={[0, -height / 2 + baseHeight / 2, 0]}
        />
      </>
    );
  }

  if (object.kind === "plant") {
    const potHeight = height * 0.3;
    return (
      <CylinderCollider
        args={[potHeight / 2, width * 0.27]}
        position={[0, -height / 2 + potHeight / 2, 0]}
      />
    );
  }

  if (object.kind === "sofa") {
    const baseHeight = height * 0.34;
    const backHeight = height * 0.64;
    const backDepth = depth * 0.2;
    const armWidth = Math.min(width * 0.12, 0.18);
    return (
      <>
        <CuboidCollider
          args={[width / 2, baseHeight / 2, depth / 2]}
          position={[0, -height / 2 + baseHeight / 2, 0]}
        />
        <CuboidCollider
          args={[width / 2, backHeight / 2, backDepth / 2]}
          position={[0, height / 2 - backHeight / 2, depth / 2 - backDepth / 2]}
        />
        {[-width / 2 + armWidth / 2, width / 2 - armWidth / 2].map((x) => (
          <CuboidCollider
            key={x}
            args={[armWidth / 2, height * 0.28, depth * 0.44]}
            position={[x, -height * 0.13, 0]}
          />
        ))}
      </>
    );
  }

  return <CuboidCollider args={[width / 2, height / 2, depth / 2]} />;
}

function CompiledBody({
  object,
  gravityOn,
  onRegister,
  onInteractionChange,
}: {
  object: WorldObject;
  gravityOn: boolean;
  onRegister: (id: string, body: RapierRigidBody | null) => void;
  onInteractionChange: (active: boolean) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragHeight = useRef(object.position[1]);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const register = useCallback(
    (instance: RapierRigidBody | null) => {
      body.current = instance;
      if (object.body === "dynamic") onRegister(object.id, instance);
    },
    [object.body, object.id, onRegister],
  );

  const beginDrag = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (object.body !== "dynamic" || !body.current) return;
      event.stopPropagation();
      const translation = body.current.translation();
      dragHeight.current = translation.y;
      dragPlane.current.set(new THREE.Vector3(0, 1, 0), -translation.y);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.current.setGravityScale(0, true);
      (event.target as Element).setPointerCapture?.(event.pointerId);
      document.body.style.cursor = "grabbing";
      onInteractionChange(true);
      setDragging(true);
    },
    [object.body, onInteractionChange],
  );

  const moveDrag = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragging || !body.current) return;
      event.stopPropagation();
      if (event.ray.intersectPlane(dragPlane.current, hit)) {
        body.current.setTranslation(
          { x: hit.x, y: dragHeight.current, z: hit.z },
          true,
        );
      }
    },
    [dragging, hit],
  );

  const endDrag = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!body.current || object.body !== "dynamic") return;
      event.stopPropagation();
      body.current.setGravityScale(gravityOn ? 1 : 0, true);
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      document.body.style.cursor = hovered ? "grab" : "default";
      onInteractionChange(false);
      setDragging(false);
    },
    [gravityOn, hovered, object.body, onInteractionChange],
  );

  useEffect(
    () => () => {
      document.body.style.cursor = "default";
      onInteractionChange(false);
    },
    [onInteractionChange],
  );

  return (
    <RigidBody
      ref={register}
      type={object.body}
      position={object.position}
      rotation={object.rotation}
      colliders={false}
      mass={object.body === "dynamic" ? object.mass : undefined}
      restitution={0.08}
      friction={0.76}
      linearDamping={0.48}
      angularDamping={0.58}
      canSleep
    >
      <ObjectColliders object={object} />
      <group
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={() => {
          if (object.body === "dynamic") {
            setHovered(true);
            document.body.style.cursor = dragging ? "grabbing" : "grab";
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          if (!dragging) {
            document.body.style.cursor = "default";
          }
        }}
      >
        <ObjectVisual object={object} />
        {(hovered || dragging) && object.body === "dynamic" && (
          <Html
            center
            position={[0, object.size[1] * 0.78, 0]}
            style={{ pointerEvents: "none" }}
            zIndexRange={[30, 0]}
          >
            <span className={`object-label ${dragging ? "dragging" : ""}`}>
              <span className="object-label-dot" />
              {dragging ? "Moving" : "Drag"} · {object.label}
            </span>
          </Html>
        )}
      </group>
    </RigidBody>
  );
}

function RuntimeVerifier({
  world,
  gravityOn,
  bodies,
  onReport,
}: {
  world: WorldSpec;
  gravityOn: boolean;
  bodies: MutableRefObject<Map<string, RapierRigidBody>>;
  onReport: (report: RuntimeReport) => void;
}) {
  const staticReport = useMemo(() => verifyStaticWorld(world), [world]);
  const startTime = useRef(0);
  const stableSince = useRef<number | null>(null);
  const settleTime = useRef<number | null>(null);
  const lastPublish = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    startTime.current = performance.now();
    stableSince.current = null;
    settleTime.current = null;
    lastPublish.current = 0;
    finished.current = false;
    onReport(createInitialReport(world, gravityOn));
  }, [gravityOn, onReport, world]);

  useFrame(() => {
    const now = performance.now();
    if (now - lastPublish.current < 220 || finished.current) return;
    lastPublish.current = now;

    const elapsed = (now - startTime.current) / 1000;
    const dynamicBodies = [...bodies.current.values()];
    const isMoving = dynamicBodies.some((body) => {
      const linear = body.linvel();
      const angular = body.angvel();
      return (
        Math.hypot(linear.x, linear.y, linear.z) > 0.045 ||
        Math.hypot(angular.x, angular.y, angular.z) > 0.09
      );
    });
    const fallenBodies = dynamicBodies.filter(
      (body) => body.translation().y < -0.2,
    ).length;

    if (!gravityOn) {
      onReport({
        ...staticReport,
        phase: "paused",
        elapsed,
        settled: false,
        settleTime: null,
        fallenBodies,
        score: null,
      });
      return;
    }

    if (!isMoving && dynamicBodies.length === staticReport.dynamicBodies) {
      stableSince.current ??= now;
      if (
        settleTime.current === null &&
        now - stableSince.current >= 700 &&
        elapsed >= 0.8
      ) {
        settleTime.current = elapsed;
      }
    } else {
      stableSince.current = null;
    }

    const reachedGate = elapsed >= 5;
    const settled =
      settleTime.current !== null ||
      (staticReport.dynamicBodies === 0 && reachedGate);
    const score = reachedGate
      ? scoreReport(staticReport, settled, fallenBodies)
      : null;
    const passed =
      score !== null &&
      score >= 85 &&
      staticReport.initialOverlapCount === 0 &&
      staticReport.invalidSupports.length === 0 &&
      fallenBodies === 0 &&
      settled;

    onReport({
      ...staticReport,
      phase: reachedGate ? (passed ? "passed" : "warning") : "verifying",
      elapsed,
      settled,
      settleTime: settleTime.current,
      fallenBodies,
      score,
    });

    if (reachedGate) finished.current = true;
  });

  return null;
}

function WorldScene({
  world,
  gravityOn,
  showColliders,
  sceneKey,
  onReport,
}: {
  world: WorldSpec;
  gravityOn: boolean;
  showColliders: boolean;
  sceneKey: number;
  onReport: (report: RuntimeReport) => void;
}) {
  const bodies = useRef(new Map<string, RapierRigidBody>());
  const [interactionLocked, setInteractionLocked] = useState(false);
  const maxGroundSpan = Math.max(world.bounds[0], world.bounds[2], 4);
  const registerBody = useCallback(
    (id: string, body: RapierRigidBody | null) => {
      if (body) bodies.current.set(id, body);
      else bodies.current.delete(id);
    },
    [],
  );

  return (
    <Canvas
      key={`${world.id}-${sceneKey}`}
      shadows
      camera={{ position: world.camera.position, fov: world.camera.fov }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={[1, 1.6]}
    >
      <color attach="background" args={["#e8e7e1"]} />
      <fog
        attach="fog"
        args={["#e8e7e1", maxGroundSpan * 0.95, maxGroundSpan * 2.1]}
      />
      <ambientLight intensity={2.15} />
      <directionalLight
        position={[-2, 6, 4]}
        intensity={2.3}
        color="#fff6df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <Physics
        gravity={gravityOn ? world.gravity : [0, 0, 0]}
        debug={showColliders}
      >
        {world.objects.map((object) => (
          <CompiledBody
            key={object.id}
            object={object}
            gravityOn={gravityOn}
            onRegister={registerBody}
            onInteractionChange={setInteractionLocked}
          />
        ))}
        <RuntimeVerifier
          world={world}
          gravityOn={gravityOn}
          bodies={bodies}
          onReport={onReport}
        />
      </Physics>
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.3}
        scale={maxGroundSpan * 1.2}
        blur={2.7}
        far={Math.max(3, world.bounds[1])}
      />
      <Grid
        position={[0, 0.006, 0]}
        args={[maxGroundSpan, maxGroundSpan]}
        cellSize={0.5}
        cellThickness={0.35}
        cellColor="#7d7b73"
        sectionSize={2.5}
        sectionThickness={0.65}
        sectionColor="#7d7b73"
        fadeDistance={maxGroundSpan * 1.3}
        fadeStrength={1}
      />
      <OrbitControls
        makeDefault
        enabled={!interactionLocked}
        target={world.camera.target}
        minDistance={1.2}
        maxDistance={Math.max(10, maxGroundSpan * 1.8)}
        maxPolarAngle={Math.PI / 2.02}
        enableDamping
      />
    </Canvas>
  );
}

function MiniWorldPreview({ world }: { world: WorldSpec }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={1}
      camera={{
        position: world.camera.position,
        fov: world.camera.fov,
        near: 0.1,
        far: 60,
      }}
    >
      <color attach="background" args={["#d9d9d3"]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[4, 7, 5]} intensity={2.1} />
      {world.objects
        .filter((object) => !object.id.includes("wall"))
        .map((object) => (
          <group
            key={object.id}
            position={object.position}
            rotation={object.rotation}
          >
            <ObjectVisual object={object} />
          </group>
        ))}
      <OrbitControls
        target={world.camera.target}
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
      />
    </Canvas>
  );
}

function reportText(report: RuntimeReport, world: WorldSpec) {
  const status =
    report.phase === "verifying"
      ? `RUN   physics_gate ............ ${report.elapsed.toFixed(1)} / 5.0 s`
      : report.phase === "paused"
        ? "PAUSE physics_gate ............ gravity disabled"
        : `${report.phase === "passed" ? "PASS" : "WARN"}  physics_gate ............ ${report.score ?? 0} / 100`;
  const settle =
    report.settleTime === null
      ? report.phase === "verifying"
        ? "RUN   settle_time ............. measuring"
        : "WARN  settle_time ............. not settled"
      : `PASS  settle_time ............. ${report.settleTime.toFixed(2)} s`;
  const support =
    report.supportTotal === report.supportValid
      ? `PASS  support_geometry ........ ${report.supportValid} / ${report.supportTotal}`
      : `WARN  support_geometry ........ ${report.supportValid} / ${report.supportTotal}`;
  const overlap =
    report.initialOverlapCount === 0
      ? "PASS  initial_aabb_overlap .... 0"
      : `WARN  initial_aabb_overlap .... ${report.initialOverlapCount}`;
  const fallen =
    report.fallenBodies === 0
      ? "PASS  fallen_bodies ........... 0"
      : `WARN  fallen_bodies ........... ${report.fallenBodies}`;

  return `${status}
${settle}
${support}
${overlap}
${fallen}
INFO  dynamic_bodies .......... ${report.dynamicBodies}
INFO  source_uncertainty ...... ${world.uncertainties.length} notes

${
  report.phase === "passed"
    ? "World accepted: local physics checks passed."
    : report.phase === "warning"
      ? "World needs repair: inspect the warnings above."
      : "Verification is based on the running Rapier scene; no score is shown before the gate completes."
}`;
}

function formatWorld(world: WorldSpec) {
  return JSON.stringify(world, null, 2);
}

export function WorldStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsKeyInputRef = useRef<HTMLInputElement>(null);
  const [world, setWorld] = useState<WorldSpec>(INITIAL_DEMO.world);
  const [previewUrl, setPreviewUrl] = useState(INITIAL_DEMO.reference);
  const [fileName, setFileName] = useState(INITIAL_DEMO.referenceName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [worldSource, setWorldSource] = useState<"example" | "generated">(
    "example",
  );
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [sessionApiKey, setSessionApiKey] = useState("");
  const [sessionModel, setSessionModel] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState("");
  const [settingsModel, setSettingsModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [generation, setGeneration] = useState<GenerationMetadata | null>(null);
  const [currentStage, setCurrentStage] = useState(3);
  const [isBuilding, setIsBuilding] = useState(true);
  const [gravityOn, setGravityOn] = useState(true);
  const [showColliders, setShowColliders] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [activeTab, setActiveTab] = useState<DockTab>("spec");
  const [activeDemoId, setActiveDemoId] = useState<string | null>(
    INITIAL_DEMO.id,
  );
  const [dockOpen, setDockOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(() =>
    createInitialReport(INITIAL_DEMO.world),
  );

  useEffect(() => {
    let cancelled = false;
    const savedKey = window.sessionStorage.getItem(SESSION_API_KEY) ?? "";
    const savedModel = window.sessionStorage.getItem(SESSION_MODEL) ?? "";
    window.queueMicrotask(() => {
      if (cancelled) return;
      setSessionApiKey(savedKey);
      setSettingsKey(savedKey);
      if (savedModel) {
        setSessionModel(savedModel);
        setSettingsModel(savedModel);
      }
    });

    fetch("/api/world")
      .then(async (response) => {
        if (!response.ok) throw new Error("API status unavailable.");
        return (await response.json()) as ApiStatus;
      })
      .then((status) => {
        if (!cancelled) {
          setApiStatus(status);
          if (!savedModel) {
            setSessionModel(status.model);
            setSettingsModel(status.model);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiStatus({
            configured: false,
            model: "gpt-5.6",
            promptVersion: WORLD_PROMPT_VERSION,
            mode: "example",
            byokAllowed: true,
          });
          if (!savedModel) {
            setSessionModel("gpt-5.6");
            setSettingsModel("gpt-5.6");
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    if (!settingsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () => settingsKeyInputRef.current?.focus(),
      80,
    );
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);

  const effectiveModel =
    sessionModel.trim() || apiStatus?.model || "gpt-5.6";
  const effectiveApiConfigured = Boolean(
    sessionApiKey.trim() || apiStatus?.configured,
  );
  const activeCredentialMode = sessionApiKey.trim()
    ? "session"
    : apiStatus?.configured
      ? "server"
      : "none";

  const openSettings = useCallback(() => {
    setSettingsKey(sessionApiKey);
    setSettingsModel(sessionModel || apiStatus?.model || "gpt-5.6");
    setConnectionState("idle");
    setConnectionMessage("");
    setShowApiKey(false);
    setSettingsOpen(true);
  }, [apiStatus?.model, sessionApiKey, sessionModel]);

  const saveApiSettings = () => {
    const nextKey = settingsKey.trim();
    const nextModel =
      settingsModel.trim() || apiStatus?.model || "gpt-5.6";
    setSessionApiKey(nextKey);
    setSessionModel(nextModel);
    if (nextKey) window.sessionStorage.setItem(SESSION_API_KEY, nextKey);
    else window.sessionStorage.removeItem(SESSION_API_KEY);
    window.sessionStorage.setItem(SESSION_MODEL, nextModel);
    setError(null);
    setSettingsOpen(false);
  };

  const clearSessionKey = () => {
    setSettingsKey("");
    setSessionApiKey("");
    window.sessionStorage.removeItem(SESSION_API_KEY);
    setConnectionState("idle");
    setConnectionMessage("");
  };

  const testApiConnection = async () => {
    if (!settingsKey.trim() && !apiStatus?.configured) {
      setConnectionState("error");
      setConnectionMessage("Enter an API key to test this connection.");
      return;
    }
    setConnectionState("testing");
    setConnectionMessage("Checking OpenAI access…");
    const headers = new Headers();
    if (settingsKey.trim()) {
      headers.set("x-worldbycode-api-key", settingsKey.trim());
    }
    if (settingsModel.trim()) {
      headers.set("x-worldbycode-model", settingsModel.trim());
    }
    try {
      const response = await fetch("/api/world", { method: "PUT", headers });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        credentialMode?: "server" | "session";
        model?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "The connection could not be verified.");
      }
      setConnectionState("success");
      setConnectionMessage(
        `${payload.credentialMode === "session" ? "Session" : "Server"} key connected. ${payload.model || settingsModel} is selected.`,
      );
    } catch (connectionError) {
      setConnectionState("error");
      setConnectionMessage(
        connectionError instanceof Error
          ? connectionError.message
          : "The connection could not be verified.",
      );
    }
  };

  const handleReport = useCallback((nextReport: RuntimeReport) => {
    setReport(nextReport);
    if (nextReport.phase === "passed" || nextReport.phase === "warning") {
      setCurrentStage(4);
      setIsBuilding(false);
    }
  }, []);

  const resetVerification = useCallback(
    (nextWorld = world) => {
      setReport(createInitialReport(nextWorld, gravityOn));
      setCurrentStage(3);
      setIsBuilding(gravityOn);
      setSceneKey((value) => value + 1);
    },
    [gravityOn, world],
  );

  const selectDemo = useCallback(
    (demo: DemoWorld) => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setWorld(demo.world);
      setPreviewUrl(demo.reference ?? "");
      setFileName(demo.referenceName);
      setSelectedFile(null);
      setWorldSource("example");
      setGeneration(null);
      setError(null);
      setActiveDemoId(demo.id);
      resetVerification(demo.world);
    },
    [previewUrl, resetVerification],
  );

  const handleFile = useCallback(
    (file?: File) => {
      if (!file) return;
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
      setSelectedFile(file);
      setActiveDemoId(null);
      setGeneration(null);
      setError(null);
      setCurrentStage(0);
      setIsBuilding(false);
    },
    [previewUrl],
  );

  const runBuild = useCallback(async () => {
    setError(null);

    if (!selectedFile) {
      resetVerification(world);
      return;
    }
    if (!effectiveApiConfigured) {
      openSettings();
      return;
    }

    setIsBuilding(true);
    setCurrentStage(0);
    const formData = new FormData();
    formData.set("image", selectedFile);
    const headers = new Headers();
    if (sessionApiKey.trim()) {
      headers.set("x-worldbycode-api-key", sessionApiKey.trim());
    }
    headers.set("x-worldbycode-model", effectiveModel);

    try {
      const response = await fetch("/api/world", {
        method: "POST",
        headers,
        body: formData,
      });
      const payload = (await response.json()) as {
        world?: WorldSpec;
        generation?: GenerationMetadata;
        error?: string;
        details?: string[];
      };

      if (!response.ok || !payload.world) {
        throw new Error(
          [payload.error, ...(payload.details ?? [])].filter(Boolean).join(" "),
        );
      }

      setCurrentStage(2);
      setWorld(payload.world);
      setGeneration(payload.generation ?? null);
      setWorldSource("generated");
      setActiveDemoId(null);
      setReport(createInitialReport(payload.world, gravityOn));
      setSceneKey((value) => value + 1);
      window.requestAnimationFrame(() => setCurrentStage(3));
    } catch (buildError) {
      setError(
        buildError instanceof Error
          ? buildError.message
          : "The world could not be generated.",
      );
      setCurrentStage(0);
      setIsBuilding(false);
    }
  }, [
    effectiveApiConfigured,
    effectiveModel,
    gravityOn,
    openSettings,
    resetVerification,
    selectedFile,
    sessionApiKey,
    world,
  ]);

  const stageState = (index: number): StageState => {
    if (index < currentStage) return "done";
    if (index === currentStage && currentStage < 4 && isBuilding) return "active";
    return "waiting";
  };

  const specText = useMemo(() => formatWorld(world), [world]);
  const activeDemo = useMemo(
    () => DEMO_WORLDS.find((demo) => demo.id === activeDemoId) ?? null,
    [activeDemoId],
  );
  const currentDockText =
    activeTab === "spec"
      ? specText
      : activeTab === "report"
        ? reportText(report, world)
        : WORLD_GENERATION_PROMPT;

  const downloadSpec = () => {
    const blob = new Blob([specText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${world.id}.world.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyDock = async () => {
    await navigator.clipboard.writeText(currentDockText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const toggleGravity = () => {
    const next = !gravityOn;
    setGravityOn(next);
    setReport((current) => ({
      ...current,
      phase: next ? "verifying" : "paused",
      score: next ? null : current.score,
    }));
    if (next) {
      setCurrentStage(3);
      setIsBuilding(true);
      setSceneKey((value) => value + 1);
    } else {
      setIsBuilding(false);
    }
  };

  const openDock = (tab: DockTab) => {
    setActiveTab(tab);
    setDockOpen(true);
  };

  const triggerUpload = () => {
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  };

  const buildButtonLabel = isBuilding
    ? currentStage < 2
      ? "Reading image with VLM…"
      : "Verifying physics…"
    : selectedFile
      ? effectiveApiConfigured
        ? "Build this world"
        : "Connect API"
      : "Run demo";

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand studio-brand" href="/" aria-label="WorldByCode home">
          <span className="brand-mark" aria-hidden="true" />
          worldbycode
        </Link>
        <div className="topbar-process" aria-label="Generation pipeline">
          <span>IMAGE</span>
          <ChevronRight size={11} />
          <span>WORLDSPEC</span>
          <ChevronRight size={11} />
          <span>PHYSICS</span>
        </div>
        <div className="topbar-actions">
          <span className="mini-chip desktop-chip">
            <Sparkles size={11} />
            zero 3d generators
          </span>
          <button
            className={`mini-chip api-chip ${effectiveApiConfigured ? "live-chip" : ""}`}
            onClick={openSettings}
            title={
              activeCredentialMode === "session"
                ? "Using a temporary key saved for this browser tab."
                : activeCredentialMode === "server"
                  ? "Using the API key configured on the server."
                  : "Connect an API key to generate worlds from new images."
            }
          >
            <span className="dot" />
            <strong>
              {activeCredentialMode === "session"
                ? "session api"
                : activeCredentialMode === "server"
                  ? "live api"
                  : "connect api"}
            </strong>
            <Settings2 size={12} />
          </button>
          <a
            className="icon-button"
            href="https://github.com/alvin528/WorldByCode"
            target="_blank"
            rel="noreferrer"
            aria-label="Open WorldByCode on GitHub"
            title="Open WorldByCode on GitHub"
          >
            <GitFork size={15} />
          </a>
        </div>
      </header>

      <section
        className={`experience ${dockOpen ? "with-code" : ""}`}
        aria-label="Interactive physics studio"
      >
        <div className="stage-area">
          <div className="scene-layer">
          <WorldScene
            key={`${world.id}-${sceneKey}`}
            world={world}
            gravityOn={gravityOn}
            showColliders={showColliders}
            sceneKey={sceneKey}
            onReport={handleReport}
          />
          </div>
          <div className="stage-shade" aria-hidden="true" />

          <aside className="hero-card">
          <div className="hero-copy">
            <div className="eyebrow">Image-conditioned simulator</div>
            <h1>
              Photo in.
              <br />
              <span className="accent-word">World out.</span>
            </h1>
            <p className="intro">
              An editable 3D physics scene, built entirely from code.
            </p>
          </div>

          <div className="source-card">
            <div className="source-preview">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Current source image" />
              ) : (
                <MiniWorldPreview world={world} />
              )}
              <span className="source-kind">
                {selectedFile ? "NEW" : activeDemo?.reference ? "PHOTO" : "DEMO"}
              </span>
              {!selectedFile && activeDemo?.sourceUrl && (
                <a
                  className="source-credit"
                  href={activeDemo.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open original source · ${activeDemo.credit}`}
                >
                  {activeDemo.credit}
                </a>
              )}
            </div>
            <div className="source-copy">
              <span>Current source</span>
              <strong>{fileName}</strong>
              <small>
                {selectedFile
                  ? effectiveApiConfigured
                    ? `${effectiveModel} ready`
                    : "Connect API to build"
                  : `${world.objects.length} bodies · ${report.dynamicBodies} dynamic`}
              </small>
            </div>
            <button
              className="source-replace"
              onClick={triggerUpload}
              aria-label="Choose a new source image"
            >
              <Upload size={14} />
            </button>
            <input
              ref={inputRef}
              className="file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,.heic,.heif"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>

          <div className="hero-actions">
            <button
              className="main-button"
              onClick={runBuild}
              disabled={isBuilding}
            >
              {isBuilding ? (
                <LoaderCircle className="spinner" size={15} />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              <span>{buildButtonLabel}</span>
              {!isBuilding && <ChevronRight size={14} />}
            </button>

            <div className="pipeline-inline" aria-label="Build progress">
              {stages.map(([name], index) => {
                const state = stageState(index);
                return (
                  <div className={`pipeline-step ${state}`} key={name}>
                    <span>
                      {state === "done" ? <Check size={9} /> : index + 1}
                    </span>
                    <small>{name}</small>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <AlertTriangle size={13} />
                <span>{error}</span>
              </div>
            )}
          </div>
          </aside>

          <div className="viewport-tools">
          <button
            className={`tool-button ${gravityOn ? "active" : ""}`}
            onClick={toggleGravity}
            aria-pressed={gravityOn}
            aria-label={`Turn gravity ${gravityOn ? "off" : "on"}`}
          >
            <Orbit size={14} />
            <span>Gravity</span>
          </button>
          <button
            className={`tool-button ${showColliders ? "active" : ""}`}
            onClick={() => setShowColliders((value) => !value)}
            aria-pressed={showColliders}
            aria-label="Toggle collider visualization"
          >
            <Code2 size={14} />
            <span>Colliders</span>
          </button>
          <button
            className="tool-button"
            onClick={() => resetVerification()}
            aria-label="Reset and verify physics scene"
          >
            <RefreshCcw size={14} />
            <span>Reset</span>
          </button>
          <button
            className={`tool-button ${dockOpen ? "active" : ""}`}
            onClick={() => (dockOpen ? setDockOpen(false) : openDock("spec"))}
            aria-expanded={dockOpen}
            aria-label="Open WorldSpec panel"
          >
            <Code2 size={14} />
            <span>WorldSpec</span>
          </button>
          </div>

          <aside className={`physics-card ${report.phase}`}>
          <div className="physics-score">
            <span>PHYSICS</span>
            <strong>{report.score ?? "··"}</strong>
          </div>
          <div className="physics-state">
            <span className="live-dot" />
            {report.phase === "verifying"
              ? `${Math.min(report.elapsed, 5).toFixed(1)}s test`
              : report.phase === "paused"
                ? "paused"
                : report.phase}
          </div>
          <div className="physics-meter">
            <span style={{ width: `${report.score ?? report.elapsed * 18}%` }} />
          </div>
          <div className="physics-meta">
            <span>{report.fallenBodies} fallen</span>
            <span>
              {report.supportValid}/{report.supportTotal} supports
            </span>
          </div>
          </aside>

          <div className="scene-caption">
          <span className="live-dot" />
          <strong>{world.id.replaceAll("_", " ")}</strong>
          <span>
            {worldSource === "generated" ? "API generated" : "live compiled"}
          </span>
          </div>

          {selectedFile && worldSource === "example" && (
            <div className="stale-scene-banner">
              Preview selected. Build it to replace the current world.
            </div>
          )}

          <div className="demo-rail" aria-label="Showcase worlds">
          <div className="demo-rail-label">
            <span>LIVE WORLDS</span>
            <strong>Choose a scene</strong>
          </div>
          <div className="demo-track">
            {DEMO_WORLDS.map((demo) => (
              <button
                className={`demo-card ${activeDemoId === demo.id ? "active" : ""}`}
                key={demo.id}
                onClick={() => selectDemo(demo)}
                style={
                  activeDemoId === demo.id
                    ? { borderColor: demo.accent }
                    : undefined
                }
              >
                <div className="demo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={demo.reference} alt="" />
                </div>
                <span
                  className="demo-accent"
                  style={{ backgroundColor: demo.accent }}
                />
                <span className="demo-index">{demo.index}</span>
                <span className="demo-title">{demo.title}</span>
                <span className="demo-category">{demo.category}</span>
              </button>
            ))}
            <button className="demo-card upload-card" onClick={triggerUpload}>
              <span className="upload-icon">
                <Upload size={16} />
              </span>
              <span className="demo-index">05</span>
              <span className="demo-title">Your image</span>
              <span className="demo-category">Build a new world</span>
            </button>
          </div>
          </div>
        </div>

        <div className={`code-drawer ${dockOpen ? "open" : ""}`}>
          <div className="code-topbar">
            <div className="tabs">
              <button
                className={`tab-button ${activeTab === "spec" ? "active" : ""}`}
                onClick={() => openDock("spec")}
              >
                WorldSpec
              </button>
              <button
                className={`tab-button ${activeTab === "report" ? "active" : ""}`}
                onClick={() => openDock("report")}
              >
                Physics report
              </button>
              <button
                className={`tab-button ${activeTab === "prompt" ? "active" : ""}`}
                onClick={() => openDock("prompt")}
              >
                VLM prompt
              </button>
            </div>
            <div className="code-actions">
              <button
                className="copy-action"
                onClick={copyDock}
                aria-label="Copy active output"
              >
                {copied ? <Check size={13} /> : <Clipboard size={13} />}
                <span>
                  {copied
                    ? "Copied"
                    : activeTab === "spec"
                      ? "Copy JSON"
                      : "Copy"}
                </span>
              </button>
              <button onClick={downloadSpec} aria-label="Download WorldSpec">
                <Download size={13} />
              </button>
              <button
                onClick={() => setDockOpen(false)}
                aria-label="Close source panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="code-body">
            <pre>{currentDockText}</pre>
            <div className="report-summary">
              <div>
                source <strong>{worldSource}</strong>
              </div>
              <div>
                model{" "}
                <strong>{generation?.model || effectiveModel}</strong>
              </div>
              <div>
                bodies <strong>{world.objects.length}</strong>
              </div>
              <div>
                dynamic <strong>{report.dynamicBodies}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="sr-only">
          <MousePointer2 size={12} />
          Drag dynamic objects to test physics.
          <FileImage size={12} />
          New uploads never change the scene until generation succeeds.
          <ScanLine size={12} />
        </div>
      </section>

      {settingsOpen && (
        <div
          className="settings-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-settings-title"
          >
            <header className="settings-header">
              <div className="settings-title">
                <span className="settings-icon">
                  <Settings2 size={17} />
                </span>
                <div>
                  <span>SETTINGS</span>
                  <h2 id="api-settings-title">Connect the vision API</h2>
                </div>
              </div>
              <button
                className="settings-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close API settings"
              >
                <X size={16} />
              </button>
            </header>

            <p className="settings-intro">
              Use the project&apos;s server connection, or bring a temporary
              OpenAI key for this browser tab.
            </p>

            <div
              className={`server-connection ${apiStatus?.configured ? "connected" : ""}`}
            >
              <span className="server-icon">
                <Server size={16} />
              </span>
              <div>
                <span>Server environment</span>
                <strong>
                  {apiStatus?.configured
                    ? "OPENAI_API_KEY is connected"
                    : "No server key configured"}
                </strong>
              </div>
              <span className="connection-badge">
                {apiStatus?.configured ? (
                  <>
                    <Check size={11} />
                    ready
                  </>
                ) : (
                  "optional"
                )}
              </span>
            </div>

            <div className="settings-divider">
              <span>SESSION OVERRIDE</span>
            </div>

            <label className="settings-field">
              <span className="settings-label">
                <KeyRound size={13} />
                OpenAI API key
              </span>
              <div className="secret-input">
                <input
                  ref={settingsKeyInputRef}
                  type={showApiKey ? "text" : "password"}
                  value={settingsKey}
                  onChange={(event) => {
                    setSettingsKey(event.target.value);
                    setConnectionState("idle");
                    setConnectionMessage("");
                  }}
                  placeholder={
                    apiStatus?.configured
                      ? "Leave blank to use the server key"
                      : "sk-..."
                  }
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Temporary OpenAI API key"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((value) => !value)}
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <small>
                Saved only for this tab and sent through the same-origin API
                proxy. It is never added to WorldSpec.
              </small>
            </label>

            <label className="settings-field">
              <span className="settings-label">
                <Sparkles size={13} />
                Vision model
              </span>
              <input
                className="model-input"
                value={settingsModel}
                onChange={(event) => {
                  setSettingsModel(event.target.value);
                  setConnectionState("idle");
                  setConnectionMessage("");
                }}
                placeholder={apiStatus?.model || "gpt-5.6"}
                autoComplete="off"
                spellCheck={false}
              />
              <small>
                Defaults to the project model. Custom compatible model aliases
                are supported.
              </small>
            </label>

            <div className="security-note">
              <ShieldCheck size={15} />
              <span>
                For a public deployment, a server-side key is still the safest
                default. Session mode is intended for local and self-hosted use.
              </span>
            </div>

            {connectionMessage && (
              <div
                className={`connection-feedback ${connectionState}`}
                aria-live="polite"
              >
                {connectionState === "testing" ? (
                  <LoaderCircle className="spinner" size={14} />
                ) : connectionState === "success" ? (
                  <Check size={14} />
                ) : (
                  <AlertTriangle size={14} />
                )}
                <span>{connectionMessage}</span>
              </div>
            )}

            <footer className="settings-actions">
              <div>
                {sessionApiKey && (
                  <button
                    className="clear-key-button"
                    onClick={clearSessionKey}
                  >
                    Clear session key
                  </button>
                )}
              </div>
              <div className="settings-primary-actions">
                <button
                  className="test-connection-button"
                  onClick={testApiConnection}
                  disabled={connectionState === "testing"}
                >
                  {connectionState === "testing"
                    ? "Testing…"
                    : "Test connection"}
                </button>
                <button
                  className="save-connection-button"
                  onClick={saveApiSettings}
                  disabled={!settingsKey.trim() && !apiStatus?.configured}
                >
                  Use connection
                  <ChevronRight size={14} />
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
