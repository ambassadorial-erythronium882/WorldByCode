"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import {
  ContactShadows,
  Grid,
  Html,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
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
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

type StageState = "done" | "active" | "waiting";

const stages = [
  ["Observe", "objects · camera · support graph"],
  ["Blueprint", "constrained WorldSpec"],
  ["Build", "procedural geometry · materials"],
  ["Verify", "gravity · collision · stability"],
] as const;

const worldSpec = `{
  "world": "desk_study_01",
  "representation": "procedural-code",
  "camera": { "fov": 38, "position": [6.8, 5.1, 7.4] },
  "surfaces": [
    { "id": "desk", "primitive": "beveled_box", "physics": "fixed" }
  ],
  "objects": [
    { "id": "mug", "construct": "lathe_with_handle", "support": "desk",
      "body": "dynamic", "density": 2400, "friction": 0.54 },
    { "id": "books", "construct": "repeated_beveled_boxes",
      "body": "dynamic", "support": "desk" },
    { "id": "ball", "primitive": "sphere", "body": "dynamic" }
  ],
  "qualityGates": ["visual-alignment", "no-penetration", "stable-5s"]
}`;

function DraggableBody({
  children,
  position,
  rotation,
  colliders = "cuboid",
  label,
}: {
  children: ReactNode;
  position: [number, number, number];
  rotation?: [number, number, number];
  colliders?: "cuboid" | "ball" | "hull" | false;
  label: string;
}) {
  const body = useRef<RapierRigidBody>(null);
  const [dragging, setDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragHeight = useRef(position[1]);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const beginDrag = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!body.current) return;
    event.stopPropagation();
    const translation = body.current.translation();
    dragHeight.current = translation.y;
    dragPlane.current.set(new THREE.Vector3(0, 1, 0), -translation.y);
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.current.setGravityScale(0, true);
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDragging(true);
  }, []);

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

  const endDrag = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!body.current) return;
    event.stopPropagation();
    body.current.setGravityScale(1, true);
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    setDragging(false);
  }, []);

  return (
    <RigidBody
      ref={body}
      position={position}
      rotation={rotation}
      colliders={colliders}
      restitution={0.16}
      friction={0.7}
      linearDamping={0.35}
      angularDamping={0.45}
    >
      <group
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={() => {
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (!dragging) document.body.style.cursor = "default";
        }}
      >
        {children}
        {dragging && (
          <Html center position={[0, 0.7, 0]} className="object-label">
            moving · {label}
          </Html>
        )}
      </group>
    </RigidBody>
  );
}

function Desk() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[2.85, 0.12, 1.7]} position={[0, 1.38, 0]} />
      <RoundedBox
        args={[5.7, 0.24, 3.4]}
        radius={0.08}
        smoothness={4}
        position={[0, 1.38, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#a9653f" roughness={0.56} />
      </RoundedBox>
      {[
        [-2.35, 0.68, -1.18],
        [2.35, 0.68, -1.18],
        [-2.35, 0.68, 1.18],
        [2.35, 0.68, 1.18],
      ].map((position, index) => (
        <RoundedBox
          key={index}
          args={[0.19, 1.38, 0.19]}
          radius={0.04}
          smoothness={2}
          position={position as [number, number, number]}
          castShadow
        >
          <meshStandardMaterial color="#333630" roughness={0.72} />
        </RoundedBox>
      ))}
    </RigidBody>
  );
}

function Monitor() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[0.88, 0.56, 0.07]} position={[0.5, 2.32, -0.82]} />
      <RoundedBox
        args={[1.76, 1.12, 0.14]}
        radius={0.07}
        smoothness={4}
        position={[0.5, 2.32, -0.82]}
        castShadow
      >
        <meshStandardMaterial color="#23251f" roughness={0.35} />
      </RoundedBox>
      <mesh position={[0.5, 2.32, -0.735]}>
        <planeGeometry args={[1.57, 0.91]} />
        <meshStandardMaterial
          color="#9ec4bf"
          emissive="#31525b"
          emissiveIntensity={0.4}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0.5, 1.7, -0.83]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.55, 20]} />
        <meshStandardMaterial color="#30312c" />
      </mesh>
      <mesh position={[0.5, 1.45, -0.72]} castShadow>
        <boxGeometry args={[0.7, 0.06, 0.46]} />
        <meshStandardMaterial color="#30312c" />
      </mesh>
    </RigidBody>
  );
}

function Mug() {
  return (
    <DraggableBody
      position={[-1.45, 1.82, -0.18]}
      colliders={false}
      label="ceramic mug"
    >
      <CylinderCollider args={[0.31, 0.27]} />
      <mesh castShadow>
        <cylinderGeometry args={[0.27, 0.23, 0.62, 32]} />
        <meshStandardMaterial color="#f4efe0" roughness={0.32} />
      </mesh>
      <mesh position={[0.28, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.19, 0.047, 10, 26, Math.PI * 1.58]} />
        <meshStandardMaterial color="#f4efe0" roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.313, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.008, 32]} />
        <meshStandardMaterial color="#4a2d20" roughness={0.15} />
      </mesh>
    </DraggableBody>
  );
}

function Book({
  position,
  rotation,
  color,
  label,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  label: string;
}) {
  return (
    <DraggableBody position={position} rotation={rotation} label={label}>
      <RoundedBox args={[1.05, 0.16, 0.72]} radius={0.045} smoothness={3} castShadow>
        <meshStandardMaterial color={color} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.365]}>
        <planeGeometry args={[0.8, 0.08]} />
        <meshStandardMaterial color="#f0ddad" />
      </mesh>
    </DraggableBody>
  );
}

function Ball() {
  return (
    <DraggableBody position={[1.9, 2.25, 0.38]} colliders={false} label="rubber ball">
      <BallCollider args={[0.29]} restitution={0.72} />
      <mesh castShadow>
        <sphereGeometry args={[0.29, 32, 22]} />
        <meshStandardMaterial color="#ff6a4a" roughness={0.48} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.286, 0.012, 8, 32]} />
        <meshStandardMaterial color="#762e23" />
      </mesh>
    </DraggableBody>
  );
}

function Lamp() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[0.04, 0.3]} position={[-2.2, 1.52, -0.82]} />
      <mesh position={[-2.2, 1.48, -0.82]} castShadow>
        <cylinderGeometry args={[0.31, 0.36, 0.08, 30]} />
        <meshStandardMaterial color="#272922" roughness={0.58} />
      </mesh>
      <mesh position={[-2.2, 2.15, -0.82]} rotation={[0, 0, -0.24]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 1.35, 18]} />
        <meshStandardMaterial color="#30332b" />
      </mesh>
      <mesh position={[-1.96, 2.75, -0.82]} rotation={[0, 0, -0.46]} castShadow>
        <coneGeometry args={[0.38, 0.55, 30, 1, true]} />
        <meshStandardMaterial color="#d8ff3e" roughness={0.46} side={THREE.DoubleSide} />
      </mesh>
      <pointLight
        position={[-1.78, 2.55, -0.75]}
        intensity={13}
        distance={5}
        color="#fff1bd"
        castShadow
      />
    </RigidBody>
  );
}

function WorldScene({
  gravityOn,
  showColliders,
  sceneKey,
}: {
  gravityOn: boolean;
  showColliders: boolean;
  sceneKey: number;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [6.8, 5.05, 7.4], fov: 38 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={[1, 1.6]}
    >
      <color attach="background" args={["#d8d9d1"]} />
      <fog attach="fog" args={["#d8d9d1", 9, 17]} />
      <ambientLight intensity={1.8} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={3.1}
        color="#fff6df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <Physics
        key={sceneKey}
        gravity={[0, gravityOn ? -9.81 : 0, 0]}
        debug={showColliders}
      >
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[9, 0.08, 9]} position={[0, -0.08, 0]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[18, 18]} />
            <meshStandardMaterial color="#cac8bd" roughness={0.92} />
          </mesh>
        </RigidBody>
        <Desk />
        <Monitor />
        <Lamp />
        <Mug />
        <Book
          position={[0.78, 1.62, 0.48]}
          rotation={[0, -0.08, 0]}
          color="#e0b74f"
          label="yellow book"
        />
        <Book
          position={[0.72, 1.8, 0.46]}
          rotation={[0.01, 0.05, -0.01]}
          color="#d9543d"
          label="coral book"
        />
        <Ball />
      </Physics>
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.32}
        scale={15}
        blur={2.7}
        far={5}
      />
      <Grid
        position={[0, 0.006, 0]}
        args={[18, 18]}
        cellSize={0.5}
        cellThickness={0.35}
        cellColor="#8b8a82"
        sectionSize={2}
        sectionThickness={0.6}
        sectionColor="#8b8a82"
        fadeDistance={11}
        fadeStrength={1}
        infiniteGrid
      />
      <OrbitControls
        makeDefault
        target={[0, 1.35, 0]}
        minDistance={4.5}
        maxDistance={13}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
      />
    </Canvas>
  );
}

export function WorldStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("desk-study.jpg");
  const [currentStage, setCurrentStage] = useState(4);
  const [isBuilding, setIsBuilding] = useState(false);
  const [gravityOn, setGravityOn] = useState(true);
  const [showColliders, setShowColliders] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"spec" | "report">("spec");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(window.clearTimeout);
    };
  }, []);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const runBuild = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    setIsBuilding(true);
    setCurrentStage(0);
    [1, 2, 3, 4].forEach((nextStage, index) => {
      const timer = window.setTimeout(() => {
        setCurrentStage(nextStage);
        if (nextStage === 4) {
          setIsBuilding(false);
          setSceneKey((value) => value + 1);
        }
      }, 720 * (index + 1));
      timers.current.push(timer);
    });
  }, []);

  const handleFile = useCallback(
    (file?: File) => {
      if (!file) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
      runBuild();
    },
    [previewUrl, runBuild],
  );

  const stageState = (index: number): StageState => {
    if (index < currentStage) return "done";
    if (index === currentStage && currentStage < 4) return "active";
    return "waiting";
  };

  const downloadSpec = () => {
    const blob = new Blob([worldSpec], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "world.spec.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySpec = async () => {
    await navigator.clipboard.writeText(worldSpec);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

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
          <span className="mini-chip">
            <span className="dot" />
            <strong>alpha 0.1</strong>
          </span>
          <button
            className="icon-button"
            aria-label="Repository link coming soon"
            title="Repository link coming soon"
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
            From one image to a world that survives{" "}
            <span className="accent-word">gravity.</span>
          </h1>
          <p className="intro">
            A VLM observes. An LLM writes constrained scene code. The physics
            engine decides whether it is real enough to stand.
          </p>

          <div className="input-card">
            <div className="reference-frame">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Uploaded reference" />
              ) : (
                <div className="reference-art" aria-label="Demo desk reference" />
              )}
              <span className="reference-label">Reference</span>
            </div>
            <div className="input-copy">
              <strong>{fileName}</strong>
              <span>
                {previewUrl
                  ? "Local preview · ready for blueprint"
                  : "Demo scene · 1600 × 1067 · clear support plane"}
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
                <button className="small-button" onClick={runBuild}>
                  <ScanLine size={11} />
                  Rebuild
                </button>
              </div>
            </div>
          </div>

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
            {isBuilding ? "Building executable world…" : "Build this world"}
            {!isBuilding && <ChevronRight size={14} />}
          </button>

          <div className="pipeline">
            <div className="section-label">
              <span>Build pipeline</span>
              <span>mock-vlm · code-only</span>
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
            <span>text output · local physics</span>
          </footer>
        </aside>

        <section className="workspace" aria-label="Interactive physics viewport">
          <div className="canvas-wrap">
            <WorldScene
              gravityOn={gravityOn}
              showColliders={showColliders}
              sceneKey={sceneKey}
            />
          </div>

          <div className="viewport-header">
            <div className="viewport-title">
              <span className="live-dot" />
              desk_study_01 · live simulation
            </div>
            <div className="viewport-tools">
              <button
                className={`tool-button ${gravityOn ? "active" : ""}`}
                onClick={() => setGravityOn((value) => !value)}
                aria-pressed={gravityOn}
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
                onClick={() => setSceneKey((value) => value + 1)}
                aria-label="Reset physics scene"
              >
                <RefreshCcw size={14} />
              </button>
            </div>
          </div>

          <aside className="score-card">
            <div className="score-top">
              <span>Physics score</span>
              <strong>96</strong>
            </div>
            <div className="score-bar">
              <span />
            </div>
            <div className="score-checks">
              <div>
                <Check size={10} /> stable after 5.0s
              </div>
              <div>
                <Check size={10} /> no penetrations
              </div>
              <div>
                <Check size={10} /> 4/4 supports valid
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
              </div>
              <div className="code-actions">
                <button onClick={copySpec} aria-label="Copy world specification">
                  {copied ? <Check size={13} /> : <Clipboard size={13} />}
                </button>
                <button onClick={downloadSpec} aria-label="Download world specification">
                  <Download size={13} />
                </button>
              </div>
            </div>
            <div className="code-body">
              <pre>
                {activeTab === "spec"
                  ? worldSpec
                  : `PASS  support_graph .......... 4 / 4\nPASS  penetration_depth ..... 0.000 m\nPASS  settle_time ........... 1.83 s\nPASS  dynamic_bodies ........ 4\nPASS  reference_camera ...... aligned\n\nWorld accepted: safe to interact.`}
              </pre>
              <div className="report-summary">
                <div>
                  representation <strong>code</strong>
                </div>
                <div>
                  binary meshes <strong>0</strong>
                </div>
                <div>
                  rigid bodies <strong>4</strong>
                </div>
                <div>
                  scene nodes <strong>17</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="sr-only">
            <MousePointer2 size={12} />
            Drag objects in the scene to test physics.
            <FileImage size={12} />
          </div>
        </section>
      </section>
    </main>
  );
}
