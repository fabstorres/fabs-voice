import { Context, Data, Effect } from "effect";

export class TranscriptCleanerModelNotFound extends Data.TaggedError(
  "TranscriptCleanerModelNotFound",
)<{ readonly path: string }> {}

export class TranscriptCleanerInitializationError extends Data.TaggedError(
  "TranscriptCleanerInitializationError",
)<{ readonly cause: unknown }> {}

export class TranscriptCleanerInferenceError extends Data.TaggedError(
  "TranscriptCleanerInferenceError",
)<{ readonly cause: unknown }> {}

export type TranscriptCleanerError =
  | TranscriptCleanerModelNotFound
  | TranscriptCleanerInitializationError
  | TranscriptCleanerInferenceError;

export interface ITranscriptCleaner {
  readonly cleanTranscript: (
    transcript: string,
  ) => Effect.Effect<string, TranscriptCleanerError>;
}

export class TranscriptCleaner extends Context.Tag("TranscriptCleaner")<
  TranscriptCleaner,
  ITranscriptCleaner
>() {}
