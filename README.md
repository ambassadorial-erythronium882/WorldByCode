# WorldByCode

![WorldByCode — one image to an editable physics world](public/og.png)

**One photo. One editable physics world. Zero 3D generators.**

WorldByCode turns an indoor reference image into a compact `WorldSpec`. A
vision-language model infers task-relevant objects, approximate scale, support
relations, and a reference camera. Deterministic React Three Fiber code then
compiles that JSON into procedural geometry and Rapier rigid bodies.

The output is a program rather than a baked mesh: editable, diffable,
downloadable, and measurable.

## What works now

- A real server-side image-to-`WorldSpec` API using OpenAI Responses.
- Strict Structured Outputs plus a second local validation pass.
- A deterministic compiler for boxes, cylinders, tables, chairs, bottles,
  cartons, and bags.
- Side-by-side source image and live 3D comparison.
- Drag, gravity, collider inspection, reset, and a five-second Rapier run.
- Measured settle time and fallen-body count from the live simulation.
- Computed support geometry and initial AABB overlap checks.
- A downloadable `WorldSpec`, visible versioned VLM prompt, and transparent
  model metadata.
- An included verified example that works without an API key.

The interface never pretends that a newly selected image has been generated.
Without a server API key it stays in **example mode**, labels the current scene
as unchanged, and disables live generation.

## Deliberate scope

Version 0.1 targets indoor tabletop and manipulation scenes containing roughly
5–20 rigid objects. It does not attempt people, animals, deformable objects,
liquids, articulated mechanisms, or photorealistic mesh reconstruction.

Single-view metric scale and occluded geometry are fundamentally ambiguous.
`WorldSpec` therefore records confidence and uncertainty instead of hiding
those limits.

## Pipeline

```text
reference image
      │
      ▼
OpenAI vision model
objects · camera · scale · support
      │  strict JSON Schema
      ▼
WorldSpec v0.1
procedural kind · transform · material · body
      │  local validation
      ▼
deterministic compiler
Three.js visuals + Rapier colliders
      │
      ▼
five-second verifier
settling · falls · support geometry · initial overlap
```

No 3D generation model is called anywhere in this pipeline.

## Model and prompt

The default is `gpt-5.6`, the quality-first alias. Set
`OPENAI_WORLD_MODEL=gpt-5.6-terra` when cost and latency matter more. The app
uses the Responses API with:

- the image at `original` detail;
- medium reasoning effort;
- strict `text.format` JSON Schema output;
- `store: false`;
- a versioned prompt in [`lib/world-prompt.ts`](lib/world-prompt.ts);
- the full schema and local validator in
  [`lib/worldspec.ts`](lib/worldspec.ts).

This makes the exact model request, prompt, schema, and compiler inspectable by
other developers.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add an OpenAI API key to `.env.local` to enable new-image generation:

```dotenv
OPENAI_API_KEY=your_server_side_key
OPENAI_WORLD_MODEL=gpt-5.6
```

Then open `http://localhost:3000`.

Quality checks:

```bash
npm test
npm run lint
```

## WorldSpec contract

Every object contains:

- a unique id and human-readable label;
- one supported procedural kind;
- dimensions, center position, and Euler rotation in meters/radians;
- fixed or dynamic physics plus mass;
- compact PBR material values;
- an optional support object id;
- confidence and notes.

The browser receives JSON only. The model never writes or executes TypeScript,
JavaScript, shaders, or arbitrary Three.js code.

## Verification semantics

The score is not a marketing constant. It appears only after a real five-second
local physics run.

- **Settle time** and **fallen bodies** come from live Rapier body state.
- **Support geometry** checks whether a dynamic object's lower face is near and
  horizontally contained by its declared support.
- **Initial overlap** is a conservative AABB preflight check. It is explicitly
  labeled AABB rather than claimed as exact collider penetration depth.

The current verifier is a first gate, not proof of real-world equivalence.

## Next research milestones

1. Add render-to-reference keypoint and silhouette alignment metrics.
2. Feed structured verifier failures back into a bounded JSON Patch repair loop.
3. Publish a 20–50 image benchmark with prompts, outputs, metrics, latency, and
   token usage.
4. Export MJCF/SDF and evaluate pick-and-place or navigation task success.
5. Add domain randomization and synthetic-data capture after task validity is
   established.

## License

[MIT](LICENSE)
