# Launch/first-attack investigation

The screenshot showing Start browsing does not establish a GPU crash. Browser tool documentation says assistant-created tabs are temporary unless marked as deliverables. Earlier reopen calls omitted that marker. The current tab is marked to survive the turn. This is a concrete opening-workflow defect and a plausible explanation for disappearing tabs, not proof that every occurrence had that cause.

Installed Edge, headless, at 2094x1090: default backend and explicit D3D11 both launched from the title and destroyed the first enemy using Enter and held Space. Both reached score 100 at simulation time 1.267 seconds without page or inspector errors. This does not reproduce a full headed embedded-browser session. No graphics simplification is justified by these results.

WebGL loss now pauses gameplay, clears input and blocks resume until restoration. Three.js handles resource restoration; the mission remains paused afterward. Rendering exceptions and shader errors show a reload action. A single localStorage entry, nebula-run:last-flight, stores up to 20 recent gameplay events, 50 errors, metrics, ship status and viewport once per second and immediately on detected failures. Nothing is transmitted. Storage failures cannot stop play. The previous entry is exposed as previousFlightDiagnostic in the development inspector, alongside graphicsState (ready/lost/failed).

Full browser-process termination cannot be recovered by page code. The journal may retain only the last successful checkpoint and cannot prove why a tab disappeared.

Verification: build passed with existing bundle-size warning; eight controls/recovery tests passed, including firing, collision, end/restart, real WEBGL_lose_context loss/restoration, and an injected draw exception followed by reload. Screenshots are in ignored test-results. No ship, environment quality or combat balance changes. No push or merge.
