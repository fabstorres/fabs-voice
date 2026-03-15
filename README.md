# fabs-voice

This is a working prototype of the smart transcription tool I’ve always wanted. Because I prompt AI all day, a Linux-first, fully-local, voice-enabled recorder is a must. Down the road it will also: send the raw transcript through a small LLM to auto-correct grammar and polish phrasing, and stream audio in 1-second chunks to Whisper so the text transcribes almost as fast as you speak.

## Requirements

This app depends on the `whisper` CLI from Whisper AI to transcribe recorded audio.

Whisper installation instructions: [openai/whisper](https://github.com/openai/whisper)

Make sure `whisper` is installed and available on your `PATH` before running the app.

This app also expects the grammar-cleaning model `GRMR-2B-Instruct-Q4_K_M.gguf` to be present in `model/`.
Download it from Hugging Face and place it at `model/GRMR-2B-Instruct-Q4_K_M.gguf` before running the app.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
