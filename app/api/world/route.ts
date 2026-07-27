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
const API_KEY_HEADER = "x-worldbycode-api-key";
const MODEL_HEADER = "x-worldbycode-model";
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,79}$/;
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

function requestApiKey(request: Request) {
  const sessionKey = request.headers.get(API_KEY_HEADER)?.trim();
  const serverKey = process.env.OPENAI_API_KEY?.trim();
  return {
    apiKey: sessionKey || serverKey || "",
    credentialMode: sessionKey ? "session" : serverKey ? "server" : "none",
  };
}

function requestModel(request: Request) {
  const candidate = request.headers.get(MODEL_HEADER)?.trim();
  if (!candidate) return configuredModel();
  if (!MODEL_PATTERN.test(candidate)) {
    throw new Error(
      "Model names may contain letters, numbers, dots, colons, underscores, and hyphens.",
    );
  }
  return candidate;
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
    byokAllowed: true,
  });
}

export async function PUT(request: Request) {
  const { apiKey, credentialMode } = requestApiKey(request);
  if (!apiKey) {
    return Response.json(
      {
        error:
          "No API key is available. Add a session key or configure OPENAI_API_KEY on the server.",
        code: "API_KEY_MISSING",
      },
      { status: 400 },
    );
  }

  let model: string;
  try {
    model = requestModel(request);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid model name.",
        code: "MODEL_INVALID",
      },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as OpenAIResponse;
    if (!response.ok) {
      return Response.json(
        {
          error:
            payload.error?.message ||
            `OpenAI rejected the connection with status ${response.status}.`,
          code: "CONNECTION_REJECTED",
        },
        { status: response.status },
      );
    }
    return Response.json({
      ok: true,
      credentialMode,
      model,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The connection test timed out."
        : "OpenAI could not be reached from this server.";
    return Response.json(
      { error: message, code: "CONNECTION_FAILED" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const { apiKey, credentialMode } = requestApiKey(request);
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Live generation is not configured. Connect a temporary key in Settings or add OPENAI_API_KEY on the server.",
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

  let model: string;
  try {
    model = requestModel(request);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid model name.",
        code: "MODEL_INVALID",
      },
      { status: 400 },
    );
  }
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
        credentialMode,
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
