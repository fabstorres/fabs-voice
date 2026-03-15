import { Effect } from "effect";
import * as BunContext from "@effect/platform-bun/BunContext";

import { ClipboardLive } from "./clipboard/live";
import { Clipboard } from "./clipboard/service";
import { MicrophoneLive } from "./microphone/live";
import { Microphone } from "./microphone/service";
import { TranscriptCleanerLive } from "./transcript-cleaner/live";
import { TranscriptCleaner } from "./transcript-cleaner/service";
import { WhisperLive } from "./whisper/live";
import { Whisper } from "./whisper/service";

const program = Effect.gen(function* () {
  const clipboard = yield* Clipboard;
  const microphone = yield* Microphone;
  const transcriptCleaner = yield* TranscriptCleaner;
  const whisper = yield* Whisper;
  const outputPath = yield* microphone.saveAndRecordPlayback();
  const transcription = yield* whisper.wavOutput(outputPath);
  const cleanedTranscription = yield* transcriptCleaner.cleanTranscript(transcription);
  yield* clipboard.copy(cleanedTranscription);

  yield* Effect.log(`Recording saved to ${outputPath}`);
  yield* Effect.log(`Raw transcription: ${transcription}`);
  yield* Effect.log(`Cleaned transcription: ${cleanedTranscription}`);
  yield* Effect.log("Cleaned transcription copied to clipboard");
});

Effect.runPromise(
  program.pipe(
    Effect.provide(ClipboardLive),
    Effect.provide(MicrophoneLive),
    Effect.provide(TranscriptCleanerLive),
    Effect.provide(WhisperLive),
    Effect.provide(BunContext.layer),
  ),
);
