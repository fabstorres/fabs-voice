import { Context, Data, Effect } from "effect";

export class MicrophoneError extends Data.TaggedError("MicrophoneError")<{}> {}

export interface IMicrophone {
  readonly saveAndRecordPlayback: () => Effect.Effect<string, MicrophoneError>;
}

export class Microphone extends Context.Tag("Microphone")<
  Microphone,
  IMicrophone
>() {}
