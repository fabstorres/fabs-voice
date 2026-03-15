import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import { Effect, Layer } from "effect";
import { getLlama, LlamaCompletion, LlamaLogLevel } from "node-llama-cpp";

import {
  TranscriptCleaner,
  TranscriptCleanerInferenceError,
  TranscriptCleanerInitializationError,
  TranscriptCleanerModelNotFound,
} from "./service";

const modelFileName = "GRMR-2B-Instruct-Q4_K_M.gguf";

const promptTemplate = (
  transcript: string,
) => `Task: rewrite the transcript as clear natural English.

Rules:
- Fix grammar and punctuation.
- Remove filler words.
- Preserve meaning.
- Return only the cleaned text.
- If the transcript is already good, return it with normal punctuation.

Transcript:
${transcript}

Answer:
`;

const suspiciousResponsePatterns = [
  /^(clean|cleaned|answer|output)$/i,
  /^task:/i,
  /^rules:/i,
  /^transcript:/i,
  /^[{[]/,
  /^```/,
];

const sanitizeResponse = (transcript: string, response: string): string => {
  const trimmed = response.trim();

  if (trimmed.length === 0) {
    return transcript.trim();
  }

  const answerIndex = trimmed.lastIndexOf("Answer:");
  const extracted = answerIndex >= 0 ? trimmed.slice(answerIndex + "Answer:".length).trim() : trimmed;

  const normalized = extracted
    .replace(/^['"`]+/, "")
    .replace(/['"`]+$/, "")
    .replace(/^```[a-zA-Z0-9_-]*\s*/, "")
    .replace(/```$/, "")
    .trim();

  if (
    normalized.length === 0 ||
    suspiciousResponsePatterns.some((pattern) => pattern.test(normalized))
  ) {
    return transcript.trim();
  }

  return normalized;
};

const isNotFoundError = (
  error: unknown,
): error is {
  readonly _tag: "SystemError";
  readonly reason: "NotFound";
} =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "SystemError" &&
  "reason" in error &&
  error.reason === "NotFound";

export const TranscriptCleanerLive = Layer.effect(
  TranscriptCleaner,
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const modelPath = path.resolve("./model", modelFileName);

    yield* fileSystem.access(modelPath).pipe(
      Effect.mapError((error) => {
        if (isNotFoundError(error)) {
          return new TranscriptCleanerModelNotFound({ path: modelPath });
        }

        return new TranscriptCleanerInitializationError({ cause: error });
      }),
    );

    const model = yield* Effect.tryPromise({
      try: async () => {
        const llama = await getLlama({ logLevel: LlamaLogLevel.error });
        return await llama.loadModel({ modelPath });
      },
      catch: (error) =>
        new TranscriptCleanerInitializationError({ cause: error }),
    });

    return {
      cleanTranscript: (transcript: string) =>
        Effect.tryPromise({
          try: async () => {
            const context = await model.createContext({ contextSize: 2048 });
            const completion = new LlamaCompletion({
              contextSequence: context.getSequence(),
              autoDisposeSequence: true,
            });
            const output = await completion.generateCompletion(
              promptTemplate(transcript),
              {
                temperature: 0,
                maxTokens: 96,
                customStopTriggers: ["\nTranscript:", "\nRules:", "\nTask:"],
              },
            );

            return sanitizeResponse(transcript, output);
          },
          catch: (error) =>
            new TranscriptCleanerInferenceError({ cause: error }),
        }).pipe(
          Effect.filterOrFail(
            (text) => text.length > 0,
            () =>
              new TranscriptCleanerInferenceError({
                cause: "Transcript cleaner returned empty output",
              }),
          ),
        ),
    };
  }),
);
