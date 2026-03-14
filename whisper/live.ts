import * as Command from "@effect/platform/Command";
import * as CommandExecutor from "@effect/platform/CommandExecutor";
import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import { Effect, Layer } from "effect";

import {
  Whisper,
  WhisperCommandNotFound,
  WhisperUnknownError,
  WhisperWavNotFound,
} from "./service";

const isNotFoundError = (
  error: unknown,
): error is {
  readonly _tag: "SystemError";
  readonly reason: "NotFound";
  readonly module?: string;
  readonly method?: string;
} =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "SystemError" &&
  "reason" in error &&
  error.reason === "NotFound";

export const WhisperLive = Layer.effect(
  Whisper,
  Effect.gen(function* () {
    const commandExecutor = yield* CommandExecutor.CommandExecutor;
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    return {
      wavOutput: (wavPath: string) => {
        const outputDirectory = path.dirname(wavPath);
        const outputPath = path.join(
          outputDirectory,
          `${path.basename(wavPath, path.extname(wavPath))}.txt`,
        );

        return fileSystem.access(wavPath).pipe(
          Effect.mapError((error) => {
            if (isNotFoundError(error)) {
              return new WhisperWavNotFound({ path: wavPath });
            }

            return new WhisperUnknownError({ cause: error });
          }),
          Effect.zipRight(
            commandExecutor
              .exitCode(
                Command.make(
                  "whisper",
                  wavPath,
                  "--language",
                  "en",
                  "--model",
                  "base",
                  "--threads",
                  "8",
                  "--task",
                  "transcribe",
                  "--output_dir",
                  outputDirectory,
                  "--output_format",
                  "txt",
                ),
              )
              .pipe(
                Effect.flatMap((exitCode) => {
                  if (exitCode === 0) {
                    return Effect.void;
                  }

                  return Effect.fail(
                    new WhisperUnknownError({ cause: `Whisper exited with code ${exitCode}` }),
                  );
                }),
                Effect.mapError((error) => {
                  if (
                    isNotFoundError(error) &&
                    error.module === "Command" &&
                    error.method === "spawn"
                  ) {
                    return new WhisperCommandNotFound();
                  }

                  return new WhisperUnknownError({ cause: error });
                }),
              ),
          ),
          Effect.zipRight(fileSystem.readFileString(outputPath)),
          Effect.map((text) => text.trim()),
          Effect.filterOrFail(
            (text) => text.length > 0,
            () => new WhisperUnknownError({ cause: `Missing transcription in ${outputPath}` }),
          ),
          Effect.mapError((error) => {
            if (
              error instanceof WhisperCommandNotFound ||
              error instanceof WhisperWavNotFound ||
              error instanceof WhisperUnknownError
            ) {
              return error;
            }

            return new WhisperUnknownError({ cause: error });
          }),
        );
      },
    };
  }),
);
