/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Braces,
  Check,
  Code2,
  MousePointer2,
  Play,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DEMO_WORLDS } from "../lib/demo-worlds";

export const metadata: Metadata = {
  title: "Photo in. World out.",
  description:
    "Turn one image into an editable, inspectable Three.js and Rapier physics world—with a VLM and procedural code, not a 3D generator.",
};

const PIPELINE = [
  {
    number: "01",
    title: "See",
    copy: "A vision model reads objects, scale cues, occlusion, and support relations.",
    icon: ScanLine,
  },
  {
    number: "02",
    title: "Specify",
    copy: "The model returns a strict, confidence-aware WorldSpec—not executable code.",
    icon: Braces,
  },
  {
    number: "03",
    title: "Compile",
    copy: "Deterministic code builds procedural Three.js geometry and Rapier bodies.",
    icon: Code2,
  },
  {
    number: "04",
    title: "Verify",
    copy: "The live world must settle, preserve supports, and avoid initial overlaps.",
    icon: ShieldCheck,
  },
] as const;

const WORLD_SPEC_SAMPLE = `{
  "id": "chair_right",
  "kind": "chair",
  "size": [0.58, 0.96, 0.62],
  "position": [0.82, 0.48, 0.62],
  "body": "dynamic",
  "mass": 8.5,
  "support": "floor",
  "confidence": 0.91
}`;

export default function Home() {
  const demos = DEMO_WORLDS.slice(0, 4);

  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <a className="landing-brand" href="#" aria-label="WorldByCode home">
          <span className="brand-mark" aria-hidden="true" />
          <span>worldbycode</span>
          <small>OPEN SOURCE</small>
        </a>

        <nav className="landing-nav-links" aria-label="Primary navigation">
          <a href="#examples">Examples</a>
          <a href="#how-it-works">How it works</a>
          <a href="#worldspec">WorldSpec</a>
          <a href="#open-source">Open source</a>
          <a
            href="https://github.com/alvin528/WorldByCode"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>

        <a className="landing-nav-cta" href="/demo">
          Open demo
          <ArrowUpRight size={15} />
        </a>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker">
            <span className="landing-live-dot" />
            VLM-only Real2Sim · runs in your browser
          </div>
          <h1>
            Photo in.
            <br />
            <span>World out.</span>
          </h1>
          <p>
            Turn one RGB image into an editable, inspectable physics world.
            No mesh generator. No hidden 3D asset. Just a vision model,
            procedural code, and a world you can actually use.
          </p>

          <div className="landing-hero-actions">
            <a className="landing-button landing-button-primary" href="/demo">
              <Play size={16} fill="currentColor" />
              Try the live demo
              <ArrowRight size={16} />
            </a>
            <a className="landing-button landing-button-secondary" href="#examples">
              Explore worlds
            </a>
          </div>

          <div className="landing-proof">
            <span>
              <Check size={13} /> Strict JSON
            </span>
            <span>
              <Check size={13} /> Three.js + Rapier
            </span>
            <span>
              <Check size={13} /> MIT licensed
            </span>
          </div>
        </div>

        <div className="landing-hero-window" aria-label="Image to world preview">
          <div className="landing-window-bar">
            <div>
              <span />
              <span />
              <span />
            </div>
            <code>demo / dual-monitor-desk</code>
            <strong>LIVE</strong>
          </div>

          <div className="landing-compare">
            <div className="landing-compare-source">
              <img src="/demo-office.jpg" alt="Reference home office" />
              <span>01 · REFERENCE</span>
            </div>
            <div className="landing-compare-arrow" aria-hidden="true">
              <ArrowRight size={17} />
            </div>
            <div className="landing-compare-world">
              <img
                src="/og.png"
                alt="Procedural physics world with visible colliders"
              />
              <span>EXECUTABLE WORLD</span>
              <div className="landing-physics-score">
                <small>PHYSICS GATE</small>
                <strong>100</strong>
                <em>passed</em>
              </div>
            </div>
          </div>

          <div className="landing-code-strip">
            <span className="landing-code-prompt">&gt;</span>
            <code>
              WorldSpec <b>20 bodies</b> · 12 dynamic · 0 overlaps
            </code>
            <span className="landing-code-ready">ready</span>
          </div>
        </div>
      </section>

      <div className="landing-proof-strip" aria-label="Project capabilities">
        <span>NO 3D GENERATOR</span>
        <i />
        <span>VISIBLE WORLDSPEC</span>
        <i />
        <span>MOVABLE OBJECTS</span>
        <i />
        <span>REAL PHYSICS GATE</span>
        <i />
        <span>DOWNLOADABLE JSON</span>
      </div>

      <section className="landing-section landing-examples" id="examples">
        <div className="landing-section-heading">
          <div>
            <span className="landing-section-index">01 / SHOWCASE</span>
            <h2>
              Four photos.
              <br />
              Four executable worlds.
            </h2>
          </div>
          <p>
            Every example runs from local WorldSpec code. Open one, drag the
            furniture, toggle gravity, inspect its colliders, and copy the JSON.
          </p>
        </div>

        <div className="landing-case-grid">
          {demos.map((demo) => {
            const dynamic = demo.world.objects.filter(
              (object) => object.body === "dynamic",
            ).length;

            return (
              <a className="landing-case" href="/demo" key={demo.id}>
                <div className="landing-case-media">
                  <img src={demo.reference} alt={demo.title} />
                  <span className="landing-case-number">{demo.index}</span>
                  <span className="landing-case-open">
                    Open in studio <ArrowUpRight size={14} />
                  </span>
                </div>
                <div className="landing-case-copy">
                  <div>
                    <span>{demo.category.split("·")[0]}</span>
                    <h3>{demo.title}</h3>
                  </div>
                  <dl>
                    <div>
                      <dt>Bodies</dt>
                      <dd>{demo.world.objects.length}</dd>
                    </div>
                    <div>
                      <dt>Dynamic</dt>
                      <dd>{dynamic}</dd>
                    </div>
                    <div>
                      <dt>Gate</dt>
                      <dd>100</dd>
                    </div>
                  </dl>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="landing-dark-section" id="how-it-works">
        <div className="landing-dark-intro">
          <span className="landing-section-index">02 / PIPELINE</span>
          <h2>The model sees. The compiler builds. Physics decides.</h2>
          <p>
            The VLM never writes JavaScript and never calls a 3D generation
            model. It can only fill a strict scene contract. Everything after
            that is deterministic and inspectable.
          </p>
        </div>

        <div className="landing-pipeline">
          {PIPELINE.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.number}>
                <div className="landing-pipeline-top">
                  <span>{step.number}</span>
                  <Icon size={20} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-spec-section" id="worldspec">
        <div className="landing-spec-copy">
          <span className="landing-section-index">03 / WORLDSPEC</span>
          <h2>The world is the code.</h2>
          <p>
            The output is not an inert mesh. It is a small semantic program:
            named objects, metric dimensions, support relations, materials,
            body types, masses, confidence, and uncertainty.
          </p>

          <ul>
            <li>
              <Box size={17} />
              Procedural primitives remain editable.
            </li>
            <li>
              <MousePointer2 size={17} />
              Everyday furniture and props remain movable.
            </li>
            <li>
              <Sparkles size={17} />
              Copy the JSON into simulation, robotics, or synthetic-data tools.
            </li>
          </ul>

          <a className="landing-text-link" href="/demo">
            Inspect a complete WorldSpec
            <ArrowRight size={16} />
          </a>
        </div>

        <div className="landing-spec-terminal">
          <div className="landing-terminal-head">
            <span>worldspec.json</span>
            <span>v0.1 · validated</span>
          </div>
          <pre>
            <code>{WORLD_SPEC_SAMPLE}</code>
          </pre>
          <div className="landing-terminal-foot">
            <span>
              <Check size={13} /> schema
            </span>
            <span>
              <Check size={13} /> support
            </span>
            <span>
              <Check size={13} /> overlap
            </span>
          </div>
        </div>
      </section>

      <section className="landing-open-source" id="open-source">
        <div className="landing-open-source-copy">
          <span className="landing-section-index">04 / OPEN SOURCE</span>
          <h2>Fork the world, not a black box.</h2>
          <p>
            WorldByCode ships the prompt, JSON schema, compiler, physics
            verifier, four licensed examples, and the complete browser studio.
            Bring your own OpenAI-compatible workflow or extend the procedural
            vocabulary.
          </p>
          <div className="landing-stack">
            <span>Next.js</span>
            <span>React Three Fiber</span>
            <span>Rapier</span>
            <span>Structured Outputs</span>
            <span>MIT</span>
          </div>
        </div>

        <div className="landing-quickstart" id="quickstart">
          <div className="landing-quickstart-head">
            <span>QUICK START</span>
            <span>3 commands</span>
          </div>
          <code>
            <span>$</span> npm install
          </code>
          <code>
            <span>$</span> cp .env.example .env.local
          </code>
          <code>
            <span>$</span> npm run dev
          </code>
          <a href="/demo">
            Or try the browser demo first <ArrowUpRight size={14} />
          </a>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#" aria-label="WorldByCode home">
          <span className="brand-mark" aria-hidden="true" />
          <span>worldbycode</span>
        </a>
        <p>One image. One editable physics world. Zero 3D generators.</p>
        <div>
          <a href="/demo">Demo</a>
          <a href="#how-it-works">Pipeline</a>
          <a
            href="https://github.com/alvin528/WorldByCode"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
