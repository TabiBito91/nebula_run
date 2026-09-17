# Return to main menu

Implemented approved Option 1: the pause overlay offers Return to Main Menu, with a native modal confirmation explaining progress/score loss. Keep Playing has initial focus; Enter activates the focused button, Tab stays in the modal, and Escape dismisses it without resuming. Keep Playing returns to the paused screen. Existing P/Escape resume behavior applies outside the modal. Both end screens offer Main Menu without confirmation.

Game.returnToMenu reuses createMission/replace and the existing scene-generation cleanup. Inputs, timers, entities, score, rendered effects and gameplay audio reset without recreating the renderer or AudioContext. Audio preferences and ship selection remain intact. Graphics failure recovery remains the existing reload workflow.

Verification: inspected paused gameplay state/screenshot/errors before editing; built successfully; eight existing controls/music tests passed; four new menu tests passed after correcting test focus/locator setup. Tests cover cancellation, safe default focus, Escape/P behavior, quitting with held movement/fire, three fresh launches, empty entity collections, audio cleanup/settings, selected ship and both end screens. Browser audit found no unexpected errors. Screenshot review prompted an opaque confirmation background to eliminate text showing through.

Changed files: Game.ts, Hud.ts, Keyboard.ts, style.css, README.md, tests/menu.spec.ts and this log. No ship/environment/combat changes. No commit, push or merge requested or performed for this change.
