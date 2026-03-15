import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import { Effect, Layer } from "effect";

import { Microphone, MicrophoneError } from "./service";

const require = createRequire(import.meta.url);
const micModule = require("mic");

type MicAudioStream = NodeJS.ReadableStream & {
  on: (event: string, listener: (...args: Array<unknown>) => void) => unknown;
  off?: (event: string, listener: (...args: Array<unknown>) => void) => unknown;
  removeListener?: (
    event: string,
    listener: (...args: Array<unknown>) => void,
  ) => unknown;
};

type MicInstance = {
  start: () => void;
  stop: () => void;
  getAudioStream: () => MicAudioStream;
};

const mic = micModule as unknown as (
  options?: Record<string, unknown>,
) => MicInstance;

const silenceFramesBeforeStop = 12;

const detachListener = (
  stream: MicAudioStream,
  event: string,
  listener: (...args: Array<unknown>) => void,
) => {
  if (stream.off) {
    stream.off(event, listener);
    return;
  }

  if (stream.removeListener) {
    stream.removeListener(event, listener);
  }
};

const toUint8Array = (chunk: unknown): Uint8Array => {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }

  if (typeof chunk === "string") {
    return new TextEncoder().encode(chunk);
  }

  return new Uint8Array(chunk as ArrayBufferLike);
};

const concatenateChunks = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(size);

  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
};

const recordToPath = (fileSystem: FileSystem.FileSystem, outputPath: string) =>
  Effect.async<string, MicrophoneError>((resume) => {
    const micInstance = mic({
      rate: "16000",
      channels: "1",
      device: "default",
      fileType: "wav",
      exitOnSilence: silenceFramesBeforeStop,
    });

    const audioStream = micInstance.getAudioStream();
    const chunks: Array<Uint8Array> = [];
    let finished = false;

    const complete = (effect: Effect.Effect<string, MicrophoneError>) => {
      if (finished) {
        return;
      }

      finished = true;
      detachListener(audioStream, "data", onData);
      detachListener(audioStream, "silence", onSilence);
      detachListener(audioStream, "error", onError);
      detachListener(audioStream, "stopComplete", onStopComplete);
      resume(effect);
    };

    const onData = (chunk: unknown) => {
      chunks.push(toUint8Array(chunk));
    };

    const onSilence = () => {
      micInstance.stop();
    };

    const onError = () => {
      complete(Effect.fail(new MicrophoneError()));
    };

    const onStopComplete = () => {
      const audio = concatenateChunks(chunks);
      complete(
        fileSystem.writeFile(outputPath, audio).pipe(
          Effect.as(outputPath),
          Effect.mapError(() => new MicrophoneError()),
        ),
      );
    };

    audioStream.on("data", onData);
    audioStream.on("silence", onSilence);
    audioStream.on("error", onError);
    audioStream.on("stopComplete", onStopComplete);

    micInstance.start();

    return Effect.sync(() => {
      if (!finished) {
        micInstance.stop();
        detachListener(audioStream, "data", onData);
        detachListener(audioStream, "silence", onSilence);
        detachListener(audioStream, "error", onError);
        detachListener(audioStream, "stopComplete", onStopComplete);
      }
    });
  });

export const MicrophoneLive = Layer.effect(
  Microphone,
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    return {
      saveAndRecordPlayback: () =>
        Effect.gen(function* () {
          const outputPath = path.resolve("./tmp", `${randomUUID()}.wav`);

          yield* fileSystem.makeDirectory(path.dirname(outputPath), {
            recursive: true,
          });

          yield* Effect.log("Recording started...");
          yield* Effect.log("Waiting for a longer pause before stopping...");

          const recordedPath = yield* recordToPath(fileSystem, outputPath);

          yield* Effect.log("Recording stopped.");

          return recordedPath;
        }).pipe(Effect.mapError(() => new MicrophoneError())),
    };
  }),
);
