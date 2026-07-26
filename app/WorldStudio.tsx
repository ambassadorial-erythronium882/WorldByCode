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
  ArrowLeftRight,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  Download,
  FileImage,
  GitFork,
  LoaderCircle,
  MousePointer2,
  Orbit,
  Play,
  RefreshCcw,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  SAMPLE_WORLD,
  type WorldObject,
  type WorldSpec,
} from "../lib/worldspec";
import {
  verifyStaticWorld,
  type StaticVerification,
} from "../lib/physics-verifier";
import {
  WORLD_GENERATION_PROMPT,
  WORLD_PROMPT_VERSION,
} from "../lib/world-prompt";

type StageState = "done" | "active" | "waiting";
type DockTab = "spec" | "report" | "prompt";
type VerificationPhase = "verifying" | "passed" | "warning" | "paused";

interface ApiStatus {
  configured: boolean;
  model: string;
  promptVersion: string;
  mode: "live" | "example";
}

interface GenerationMetadata {
  provider: string;
  model: string;
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

function ObjectVisual({ object }: { object: WorldObject }) {
  if (object.kind === "table") return <TableVisual object={object} />;
  if (object.kind === "chair") return <ChairVisual object={object} />;
  if (object.kind === "bottle") return <BottleVisual object={object} />;
  if (object.kind === "bag") return <BagVisual object={object} />;

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
      radius={
        object.kind === "carton"
          ? Math.min(0.022, object.size[0] * 0.12)
          : Math.min(0.035, Math.min(...object.size) * 0.12)
      }
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
      </>
    );
  }

  if (object.kind === "cylinder" || object.kind === "bottle") {
    return <CylinderCollider args={[height / 2, width / 2]} />;
  }

  return <CuboidCollider args={[width / 2, height / 2, depth / 2]} />;
}

function CompiledBody({
  object,
  gravityOn,
  onRegister,
}: {
  object: WorldObject;
  gravityOn: boolean;
  onRegister: (id: string, body: RapierRigidBody | null) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const [dragging, setDragging] = useState(false);
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
      setDragging(true);
    },
    [object.body],
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
      setDragging(false);
    },
    [gravityOn, object.body],
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
          if (object.body === "dynamic") document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (!dragging) document.body.style.cursor = "default";
        }}
      >
        <ObjectVisual object={object} />
        {dragging && (
          <Html center position={[0, object.size[1] * 0.75, 0]}>
            <span className="object-label">moving · {object.label}</span>
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
        target={world.camera.target}
        minDistance={1.2}
        maxDistance={Math.max(10, maxGroundSpan * 1.8)}
        maxPolarAngle={Math.PI / 2.02}
        enableDamping
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
  const [world, setWorld] = useState<WorldSpec>(SAMPLE_WORLD);
  const [previewUrl, setPreviewUrl] = useState("/reference-5608.jpg");
  const [fileName, setFileName] = useState("IMG_5608.HEIC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [worldSource, setWorldSource] = useState<"example" | "generated">(
    "example",
  );
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [generation, setGeneration] = useState<GenerationMetadata | null>(null);
  const [currentStage, setCurrentStage] = useState(3);
  const [isBuilding, setIsBuilding] = useState(true);
  const [gravityOn, setGravityOn] = useState(true);
  const [showColliders, setShowColliders] = useState(false);
  const [compareOn, setCompareOn] = useState(true);
  const [sceneKey, setSceneKey] = useState(0);
  const [activeTab, setActiveTab] = useState<DockTab>("spec");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(() => createInitialReport(SAMPLE_WORLD));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/world")
      .then(async (response) => {
        if (!response.ok) throw new Error("API status unavailable.");
        return (await response.json()) as ApiStatus;
      })
      .then((status) => {
        if (!cancelled) setApiStatus(status);
      })
      .catch(() => {
        if (!cancelled) {
          setApiStatus({
            configured: false,
            model: "gpt-5.6",
            promptVersion: WORLD_PROMPT_VERSION,
            mode: "example",
          });
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

  const handleFile = useCallback(
    (file?: File) => {
      if (!file) return;
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
      setSelectedFile(file);
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
    if (!apiStatus?.configured) {
      setError(
        "This deployment is in honest example mode. Configure OPENAI_API_KEY on the server to generate a new world.",
      );
      return;
    }

    setIsBuilding(true);
    setCurrentStage(0);
    const formData = new FormData();
    formData.set("image", selectedFile);

    try {
      const response = await fetch("/api/world", {
        method: "POST",
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
  }, [apiStatus?.configured, gravityOn, resetVerification, selectedFile, world]);

  const stageState = (index: number): StageState => {
    if (index < currentStage) return "done";
    if (index === currentStage && currentStage < 4 && isBuilding) return "active";
    return "waiting";
  };

  const specText = useMemo(() => formatWorld(world), [world]);
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

  const buildButtonLabel = isBuilding
    ? currentStage < 2
      ? "Reading image with VLM…"
      : "Verifying physics…"
    : selectedFile
      ? apiStatus?.configured
        ? "Build this world"
        : "API key required for this image"
      : "Re-run verified example";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          worldbycode
        </div>
        <div className="topbar-actions">
          <span className="mini-chip">
            <Sparkles size={11} />
            zero 3d generators
          </span>
          <span
            className={`mini-chip ${apiStatus?.configured ? "live-chip" : ""}`}
            title={
              apiStatus?.configured
                ? "New uploads use the live model API."
                : "The included example is interactive; new images need a server API key."
            }
          >
            <span className="dot" />
            <strong>
              {apiStatus?.configured ? "live api" : "example mode"}
            </strong>
          </span>
          <button
            className="icon-button"
            aria-label="Repository link will be added before public launch"
            title="Repository link will be added before public launch"
            disabled
          >
            <GitFork size={15} />
          </button>
        </div>
      </header>

      <section className="studio">
        <aside className="sidebar">
          <div className="eyebrow">Executable scene reconstruction</div>
          <h1>
            One photo. A world that survives{" "}
            <span className="accent-word">gravity.</span>
          </h1>
          <p className="intro">
            A VLM writes strict WorldSpec. Deterministic code builds every
            primitive. Rapier decides whether the result is physically valid.
          </p>

          <div className="input-card">
            <div className="reference-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Current reference" />
              <span className="reference-label">
                {selectedFile ? "New reference" : "Verified example"}
              </span>
            </div>
            <div className="input-copy">
              <strong>{fileName}</strong>
              <span>
                {selectedFile
                  ? apiStatus?.configured
                    ? `${apiStatus.model} · original image detail`
                    : "Selected locally · not sent or generated"
                  : "Real vision snapshot · procedural compiler"}
              </span>
              <div className="input-actions">
                <input
                  ref={inputRef}
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <button
                  className="small-button"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload size={11} />
                  Replace
                </button>
                {selectedFile && (
                  <button
                    className="small-button"
                    onClick={() => {
                      if (previewUrl.startsWith("blob:")) {
                        URL.revokeObjectURL(previewUrl);
                      }
                      setPreviewUrl("/reference-5608.jpg");
                      setFileName("IMG_5608.HEIC");
                      setSelectedFile(null);
                      setWorld(SAMPLE_WORLD);
                      setWorldSource("example");
                      setGeneration(null);
                      setError(null);
                      resetVerification(SAMPLE_WORLD);
                    }}
                  >
                    <X size={11} />
                    Example
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            className="main-button"
            onClick={runBuild}
            disabled={isBuilding || Boolean(selectedFile && !apiStatus?.configured)}
          >
            {isBuilding ? (
              <LoaderCircle className="spinner" size={15} />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {buildButtonLabel}
            {!isBuilding && <ChevronRight size={14} />}
          </button>

          <div className="pipeline">
            <div className="section-label">
              <span>Build pipeline</span>
              <span>
                {generation?.model ||
                  apiStatus?.model ||
                  "checking model configuration"}
              </span>
            </div>
            <div className="stage-list">
              {stages.map(([name, detail], index) => {
                const state = stageState(index);
                return (
                  <div className={`stage ${state}`} key={name}>
                    <span className="stage-number">
                      {state === "done" ? <Check size={11} /> : `0${index + 1}`}
                    </span>
                    <span className="stage-name">
                      {name}
                      <span className="stage-detail">{detail}</span>
                    </span>
                    <span className="stage-state">
                      {state === "done"
                        ? "passed"
                        : state === "active"
                          ? "running"
                          : "queued"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="sidebar-foot">
            <span>Three.js + Rapier</span>
            <span>{WORLD_PROMPT_VERSION}</span>
          </footer>
        </aside>

        <section className="workspace" aria-label="Interactive physics viewport">
          <div className={`comparison-stage ${compareOn ? "split" : ""}`}>
            {compareOn && (
              <div className="reference-pane">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Reference for visual comparison" />
                <span className="pane-label">
                  Reference · {selectedFile ? "pending/new" : "source"}
                </span>
              </div>
            )}
            <div className="scene-pane">
              <WorldScene
                world={world}
                gravityOn={gravityOn}
                showColliders={showColliders}
                sceneKey={sceneKey}
                onReport={handleReport}
              />
              <span className="pane-label live-pane-label">
                Compiled world · live
              </span>
              {selectedFile && worldSource === "example" && (
                <div className="stale-scene-banner">
                  Still showing the included example — the new image has not
                  been generated.
                </div>
              )}
            </div>
          </div>

          <div className="viewport-header">
            <div className="viewport-title">
              <span
                className={`live-dot ${report.phase === "warning" ? "warning" : ""}`}
              />
              {world.id} ·{" "}
              {worldSource === "generated" ? "API generated" : "verified example"}
            </div>
            <div className="viewport-tools">
              <button
                className={`tool-button ${compareOn ? "active" : ""}`}
                onClick={() => setCompareOn((value) => !value)}
                aria-pressed={compareOn}
              >
                <ArrowLeftRight size={13} />
                <span>Compare</span>
              </button>
              <button
                className={`tool-button ${gravityOn ? "active" : ""}`}
                onClick={toggleGravity}
                aria-pressed={gravityOn}
                aria-label={`Turn gravity ${gravityOn ? "off" : "on"}`}
              >
                <Orbit size={13} />
                <span>Gravity {gravityOn ? "on" : "off"}</span>
              </button>
              <button
                className={`tool-button ${showColliders ? "active" : ""}`}
                onClick={() => setShowColliders((value) => !value)}
                aria-pressed={showColliders}
              >
                <Code2 size={13} />
                <span>Colliders</span>
              </button>
              <button
                className="icon-button"
                onClick={() => resetVerification()}
                aria-label="Reset and verify physics scene"
              >
                <RefreshCcw size={14} />
              </button>
            </div>
          </div>

          <aside className={`score-card ${report.phase}`}>
            <div className="score-top">
              <span>Measured physics</span>
              <strong>{report.score ?? "—"}</strong>
            </div>
            <div className="score-bar">
              <span style={{ width: `${report.score ?? 0}%` }} />
            </div>
            <div className="score-checks">
              <div>
                {report.settled ? <Check size={10} /> : <LoaderCircle size={10} />}
                {report.settleTime
                  ? `settled in ${report.settleTime.toFixed(2)}s`
                  : report.phase === "paused"
                    ? "verification paused"
                    : `measuring ${Math.min(report.elapsed, 5).toFixed(1)}/5.0s`}
              </div>
              <div>
                {report.initialOverlapCount === 0 ? (
                  <Check size={10} />
                ) : (
                  <AlertTriangle size={10} />
                )}
                {report.initialOverlapCount} initial AABB overlaps
              </div>
              <div>
                {report.supportValid === report.supportTotal ? (
                  <Check size={10} />
                ) : (
                  <AlertTriangle size={10} />
                )}
                {report.supportValid}/{report.supportTotal} dynamic supports valid
              </div>
            </div>
          </aside>

          <div className="code-dock">
            <div className="code-topbar">
              <div className="tabs">
                <button
                  className={`tab-button ${activeTab === "spec" ? "active" : ""}`}
                  onClick={() => setActiveTab("spec")}
                >
                  WorldSpec
                </button>
                <button
                  className={`tab-button ${activeTab === "report" ? "active" : ""}`}
                  onClick={() => setActiveTab("report")}
                >
                  Physics report
                </button>
                <button
                  className={`tab-button ${activeTab === "prompt" ? "active" : ""}`}
                  onClick={() => setActiveTab("prompt")}
                >
                  VLM prompt
                </button>
              </div>
              <div className="code-actions">
                <button onClick={copyDock} aria-label="Copy active output">
                  {copied ? <Check size={13} /> : <Clipboard size={13} />}
                </button>
                <button onClick={downloadSpec} aria-label="Download WorldSpec">
                  <Download size={13} />
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
                  <strong>
                    {generation?.model || apiStatus?.model || "checking"}
                  </strong>
                </div>
                <div>
                  rigid bodies <strong>{world.objects.length}</strong>
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
      </section>
    </main>
  );
}
