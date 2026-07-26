import {
  validateWorldSpec,
  WORLD_SPEC_JSON_SCHEMA,
  type WorldSpec,
} from "../../../lib/worldspec";
import {
  WORLD_GENERATION_PROMPT,
  WORLD_PROMPT_VERSION,
} from "../../../lib/world-prompt";

const DEFAULT_MODEL = "gpt-5.6";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface OpenAIResponse {
  id?: string;
  model?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

function configuredModel() {
  return process.env.OPENAI_WORLD_MODEL?.trim() || DEFAULT_MODEL;
}

function extractOutputText(response: OpenAIResponse): string | null {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
      if (content.type === "refusal" && typeof content.refusal === "string") {
        throw new Error(`The model refused this image: ${content.refusal}`);
      }
    }
  }
  return null;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: configuredModel(),
    promptVersion: WORLD_PROMPT_VERSION,
    mode: process.env.OPENAI_API_KEY ? "live" : "example",
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Live generation is not configured. Add OPENAI_API_KEY on the server or keep using the included verified example.",
        code: "API_KEY_MISSING",
      },
      { status: 503 },
    );
  }

  let file: File;
  try {
    const formData = await request.formData();
    const candidate = formData.get("image");
    if (!(candidate instanceof File)) {
      return Response.json(
        { error: "Choose an image before building.", code: "IMAGE_MISSING" },
        { status: 400 },
      );
    }
    file = candidate;
  } catch {
    return Response.json(
      { error: "The upload could not be read.", code: "INVALID_FORM_DATA" },
      { status: 400 },
    );
  }

  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return Response.json(
      {
        error: "Use a JPEG, PNG, or WebP image. Convert HEIC before upload.",
        code: "UNSUPPORTED_IMAGE",
      },
      { status: 415 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json(
      { error: "The image must be 10 MB or smaller.", code: "IMAGE_TOO_LARGE" },
      { status: 413 },
    );
  }

  const model = configuredModel();
  const base64 = bufferToBase64(await file.arrayBuffer());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "medium" },
        input: [
          {
            role: "system",
            content: WORLD_GENERATION_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Compile this image into WorldSpec. Prefer physical usefulness and honest uncertainty over decorative detail.",
              },
              {
                type: "input_image",
                image_url: `data:${file.type};base64,${base64}`,
                detail: "original",
              },
            ],
          },
        ],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "world_spec",
            description:
              "A compact procedural scene that can be compiled into Three.js and Rapier.",
            strict: true,
            schema: WORLD_SPEC_JSON_SCHEMA,
          },
        },
      }),
    });

    const payload = (await response.json()) as OpenAIResponse;
    if (!response.ok) {
      return Response.json(
        {
          error:
            payload.error?.message ||
            `The model request failed with status ${response.status}.`,
          code: "MODEL_REQUEST_FAILED",
        },
        { status: response.status },
      );
    }

    const outputText = extractOutputText(payload);
    if (!outputText) {
      return Response.json(
        {
          error: "The model returned no WorldSpec.",
          code: "EMPTY_MODEL_OUTPUT",
        },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return Response.json(
        {
          error: "The model output was not valid JSON.",
          code: "INVALID_MODEL_JSON",
        },
        { status: 502 },
      );
    }

    const validated = validateWorldSpec(parsed);
    if (!validated.ok) {
      return Response.json(
        {
          error: "The generated WorldSpec failed local validation.",
          code: "WORLD_SPEC_INVALID",
          details: validated.errors.slice(0, 8),
        },
        { status: 502 },
      );
    }

    const world: WorldSpec = validated.data;
    if (world.refusal) {
      return Response.json(
        {
          error: world.refusal,
          code: "IMAGE_OUT_OF_SCOPE",
          world,
        },
        { status: 422 },
      );
    }

    return Response.json({
      world,
      generation: {
        provider: "openai",
        model: payload.model || model,
        responseId: payload.id || null,
        promptVersion: WORLD_PROMPT_VERSION,
        usage: payload.usage || null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The model request timed out after 120 seconds."
        : error instanceof Error
          ? error.message
          : "Unknown generation failure.";
    return Response.json(
      { error: message, code: "GENERATION_FAILED" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
