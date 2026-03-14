import { Context, Data, Effect } from "effect";

export class ClipboardCommandNotFound extends Data.TaggedError(
  "ClipboardCommandNotFound",
)<{ readonly command: string }> {}

export class ClipboardCopyError extends Data.TaggedError("ClipboardCopyError")<{
  readonly cause: unknown;
}> {}

export type ClipboardError = ClipboardCommandNotFound | ClipboardCopyError;

export interface IClipboard {
  readonly copy: (text: string) => Effect.Effect<void, ClipboardError>;
}

export class Clipboard extends Context.Tag("Clipboard")<Clipboard, IClipboard>() {}
