# Audio asset ledger and replacement guide

All current audio is **temporary, original procedural test audio**, synthesized by `src/game/audio/procedural.ts` from oscillators, envelopes and deterministic noise. There are no sampled recordings, downloaded compositions, reference melodies or external audio dependencies. Names below are manifest IDs; no corresponding recording files are shipped.

Creator/source for every entry: generated specifically for Nebula Run in this project. License status: project-original source/output; no separate project distribution license has been selected. No third-party license or attribution requirement applies to these generated buffers. They are intended for commercial as well as noncommercial use, but this ledger does not grant rights in any replacement recording. All are placeholders, not a final mastered soundtrack.

Music IDs: `music:menu`, `music:flight`, `music:combat`, `music:boss`, `music:victory`, `music:failure`.
- First four: mono 22,050 Hz, 16-second, eight-bar loops at 120 BPM. Temporary short loops deliberately differ from the recommended final 90–180-second flight/combat tracks.
- Victory/failure: four-second, non-looping resolutions.
- Direction: restrained synth harmony, melodic pulses, bass and percussion. All notes and rhythms are authored in the generator.

## Replace a placeholder

Place recordings in `public/audio/music/` or `public/audio/sfx/`. Set `url` in the corresponding definition in `src/game/audio/manifest.ts`, e.g. `audio/music/flight.ogg`; optionally set `fallbackUrl` to an MP3 or WAV alternative. Paths resolve against Vite BASE_URL. Provide `loopStart`/`loopEnd` in decoded seconds for exact loop boundaries; defaults use the whole file. Keep the stable ID so gameplay does not change. Remove a URL to restore procedural audio. Failed or rejected recordings also fall back to the procedural buffer.

Deliver lossless WAV masters at 44.1/48 kHz; encode runtime versions after listening on target browsers. Flight/combat: 90–180 seconds; menu/boss: 30–120 seconds as appropriate; victory/failure: 3–10 seconds. Aim for peak headroom (at least 3 dB), and supply loop points and any reverb-tail instructions. The loader limits each encoded file to 24 MiB and each decoded buffer to 80 MiB; keep the practical music working set smaller, especially on mobile hardware not verified by this project.

For **each replacement**, add filename, creator, source URL, exact license/version or written permission, attribution text, commercial-use permission, and temporary/final status here before distribution. Unknown licensing is a blocker to distributing that replacement, not permission to use it.
