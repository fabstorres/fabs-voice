import { Effect } from "effect";
import * as BunContext from "@effect/platform-bun/BunContext";

import { MicrophoneLive } from "./microphone/live";
import { Microphone } from "./microphone/service";

const program = Effect.gen(function* () {
  const microphone = yield* Microphone;
  const outputPath = yield* microphone.saveAndRecordPlayback();

  yield* Effect.log(`Recording saved to ${outputPath}`);
});

Effect.runPromise(
  program.pipe(
    Effect.provide(MicrophoneLive),
    Effect.provide(BunContext.layer),
  ),
);
