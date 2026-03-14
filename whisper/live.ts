import * as Command from "@effect/platform/Command";
import * as CommandExecutor from "@effect/platform/CommandExecutor";
import * as FileSystem from "@effect/platform/FileSystem";
import { Effect, Layer } from "effect";

import {
  Whisper,
  WhisperCommandNotFound,
  WhisperUnknownError,
  WhisperWavNotFound,
} from "./service";

const toWavPath = (uuid: string) => `./tmp/${uuid}.wav`;

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

const parseTranscription = (output: string) => {
  const lines = output.split(/\r?\n/);
  const timestampPattern =
    /^\[(\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}\.\d{3})\]\s*(.*)$/;
  const segments: Array<string> = [];
  let foundTimestamp = false;

  for (const line of lines) {
    const match = line.match(timestampPattern);

    if (!match) {
      continue;
    }

    foundTimestamp = true;
    const text = match[3]?.trim();

    if (text) {
      segments.push(text);
    }
  }

  if (!foundTimestamp || segments.length === 0) {
    return Effect.fail(new WhisperUnknownError({ cause: output }));
  }

  return Effect.succeed(segments.join(" ").trim());
};

export const WhisperLive = Layer.effect(
  Whisper,
  Effect.gen(function* () {
    const commandExecutor = yield* CommandExecutor.CommandExecutor;
    const fileSystem = yield* FileSystem.FileSystem;

    return {
      wavOutput: (uuid: string) => {
        const wavPath = toWavPath(uuid);

        return fileSystem.access(wavPath).pipe(
          Effect.mapError((error) => {
            if (isNotFoundError(error)) {
              return new WhisperWavNotFound({ path: wavPath });
            }

            return new WhisperUnknownError({ cause: error });
          }),
          Effect.zipRight(
            commandExecutor
              .string(
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
                  "--output_format",
                  "txt",
                ),
              )
              .pipe(
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
          Effect.flatMap(parseTranscription),
        );
      },
    };
  }),
);
