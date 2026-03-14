import { spawn } from "node:child_process";

import { Effect, Layer } from "effect";

import {
  Clipboard,
  ClipboardCommandNotFound,
  ClipboardCopyError,
} from "./service";

type ClipboardCommand = readonly [string, ...Array<string>];

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

const uniqueCommands = (
  commands: ReadonlyArray<ClipboardCommand>,
): ReadonlyArray<ClipboardCommand> => {
  const seen = new Set<string>();

  return commands.filter((command) => {
    const key = command.join("\0");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const clipboardCommands = (): ReadonlyArray<ClipboardCommand> => {
  if (process.platform === "darwin") {
    return [["pbcopy"]];
  }

  if (process.platform === "win32") {
    return [["cmd", "/c", "clip"]];
  }

  const commands: Array<ClipboardCommand> = [];

  if (process.env.WAYLAND_DISPLAY) {
    commands.push(["wl-copy"]);
  }

  if (process.env.DISPLAY) {
    commands.push(["xclip", "-selection", "clipboard"]);
  }

  commands.push(
    ["wl-copy"],
    ["xclip", "-selection", "clipboard"],
    ["xsel", "--clipboard", "--input"],
  );

  return uniqueCommands(commands);
};

const commandLabel = (commands: ReadonlyArray<ClipboardCommand>) =>
  commands.map(([command]) => command).join(" / ");

const copy = (text: string) =>
  Effect.async<void, ClipboardCommandNotFound | ClipboardCopyError>((resume) => {
    const commands = clipboardCommands();
    let commandIndex = 0;
    let resolved = false;
    let proc: ReturnType<typeof spawn> | undefined;

    const complete = (effect: Effect.Effect<void, ClipboardCommandNotFound | ClipboardCopyError>) => {
      if (resolved) {
        return;
      }

      resolved = true;
      resume(effect);
    };

    const runNext = () => {
      const next = commands[commandIndex];

      if (!next) {
        complete(
          Effect.fail(new ClipboardCommandNotFound({ command: commandLabel(commands) })),
        );
        return;
      }

      commandIndex += 1;

      const [command, ...args] = next;
      proc = spawn(command, args, {
        stdio: ["pipe", "ignore", "ignore"],
      });

      proc.once("error", (error) => {
        if (isNotFoundError(error)) {
          runNext();
          return;
        }

        complete(Effect.fail(new ClipboardCopyError({ cause: error })));
      });

      proc.once("exit", (code) => {
        if (code === 0) {
          complete(Effect.void);
          return;
        }

        complete(
          Effect.fail(
            new ClipboardCopyError({
              cause: `Clipboard command exited with code ${code}`,
            }),
          ),
        );
      });

      if (!proc.stdin) {
        complete(
          Effect.fail(
            new ClipboardCopyError({ cause: "Clipboard stdin is not available" }),
          ),
        );
        return;
      }

      proc.stdin.once("error", (error) => {
        complete(Effect.fail(new ClipboardCopyError({ cause: error })));
      });

      proc.stdin.end(text);
    };

    runNext();

    return Effect.sync(() => {
      if (!resolved && proc && !proc.killed) {
        proc.kill();
      }
    });
  });

export const ClipboardLive = Layer.succeed(Clipboard, {
  copy,
});
