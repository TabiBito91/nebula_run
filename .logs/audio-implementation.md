# Audio implementation

Branch: feature/game-audio, based on approved 457af80 (including dynamic background and crash recovery). Scope approved after Phase 1 inspection. No environment/ship/combat redesign.

## Music and controls checkpoint

Native Web Audio manager owns a single gesture-unlocked AudioContext, music and SFX parent gains, seven category buses, compressor and output meter. Buffer caching and bounded source ownership keep looping audio unique. Music prepares one procedural track per task; no network assets are required. Asset definitions and replacement URLs are centralized. External-load failures fall back to generated buffers.

Music states derive from status, actual threats and core presence. Combat remains for at least eight mission seconds and four quiet seconds. Crossfades take two audio seconds. Pause preserves music offset and retires transient/engine voices; resume creates one new music source at the saved offset. Hidden documents suspend the context. Scene generations cancel old playback and reset transition history.

Controls add a small Audio panel with master/music/SFX volumes and mute. Defaults: .8/.35/.7. Settings use a versioned localStorage key with validation and storage-failure tolerance. Audio panel keyboard input does not steer/fire/pause gameplay; focusing it clears held controls.

Initial build and two music tests passed: no context before interaction, settings survive reload, sliders do not steer, mute works, pause offset remains frozen and repeated scene resets do not duplicate music. All audio assets are temporary; see public/audio/ASSETS.md.
