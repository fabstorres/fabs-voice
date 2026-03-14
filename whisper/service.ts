import { Context, Data, Effect } from "effect";

export class WhisperCommandNotFound extends Data.TaggedError(
  "WhisperCommandNotFound",
)<{}> {}

export class WhisperWavNotFound extends Data.TaggedError(
  "WhisperWavNotFound",
)<{ readonly path: string }> {}

export class WhisperUnknownError extends Data.TaggedError(
  "WhisperUnknownError",
)<{ readonly cause: unknown }> {}

export type WhisperError =
  | WhisperCommandNotFound
  | WhisperWavNotFound
  | WhisperUnknownError;

export interface IWhisper {
  readonly wavOutput: (uuid: string) => Effect.Effect<string, WhisperError>;
}

export class Whisper extends Context.Tag("Whisper")<Whisper, IWhisper>() {}
