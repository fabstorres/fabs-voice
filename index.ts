import { Effect } from "effect";
import * as BunContext from "@effect/platform-bun/BunContext";

import { MicrophoneLive } from "./microphone/live";
import { Microphone } from "./microphone/service";
import { WhisperLive } from "./whisper/live";
import { Whisper } from "./whisper/service";

const program = Effect.gen(function* () {
  const microphone = yield* Microphone;
  const whisper = yield* Whisper;
  const outputPath = yield* microphone.saveAndRecordPlayback();
  const transcription = yield* whisper.wavOutput(outputPath);

  yield* Effect.log(`Recording saved to ${outputPath}`);
  yield* Effect.log(`Transcription: ${transcription}`);
});

Effect.runPromise(
  program.pipe(
    Effect.provide(MicrophoneLive),
    Effect.provide(WhisperLive),
    Effect.provide(BunContext.layer),
  ),
);
