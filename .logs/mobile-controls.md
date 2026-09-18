# Mobile controls verification

Implemented relative drag targets using Pointer Events/capture on the canvas, constrained by the existing speed and bounds. Coarse-pointer devices auto-fire using the existing cooldown. Touch release/cancel/lost capture clears steering. Pause, focus loss, scene replacement and resize clear active touches; portrait rotation pauses and requires explicit resume. Desktop keys remain available. Text inputs now ignore gameplay shortcuts.

Landscape layout includes safe-area padding, larger buttons, scrollable result/dialog panels and a portrait rotation prompt. Existing 1.5 rendering pixel-ratio cap is retained. Audio already unlocks on pointer gestures. Screenshot review found audio overlapping the score and missing title spacing; both were refined.

Verification: production build passed; 12 Chromium tests passed (mobile, controls and menu suites). Mobile tests emulate 844x390, touch enabled, device scale 3; real touch events steer without jumping and tap controls start/pause/resume. Audit reported no unexpected browser errors. Screenshots and inspection JSON are in test-results/mobile-*/. Actual iPhone Safari and Android device performance are not verified. No deployment or push performed.
