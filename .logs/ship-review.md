# Ship candidate review — approval pending

Manta-7 is an original named-component Three.js interceptor, loaded only through the development inspector. Normal scenes and production retain the old ship. No music or gameplay-background changes.

Neutral showroom includes rear, rear-three-quarter, side, top, gameplay-distance, old/new, and collision views. Input drives existing banking; movement raises engine emissive intensity from 2 to 4. Stabilized muzzle nodes remain at (+/-0.42, 0, -1.5).

Rest bounds including idle exhaust: candidate 3.040 x 0.585 x 4.030; legacy 4.344 x 0.820 x 5.000 (X/Y/Z). Collision sphere remains radius 0.65, volume 1.15035, centered on player. Rendered wings are not extra collision surfaces, consistent with existing arcade collision behavior.

Same 1280x720 neutral studio, 140 rendered frames per variant: legacy 59 FPS / 17.08 ms / 12 calls / 332 triangles; candidate 58 FPS / 17.22 ms / 25 calls / 332 triangles. These are short host-specific samples, not sustained performance guarantees. Separate named components cost 13 additional calls; no additional lights or postprocessing passes are used for the engines.

Production build passed (existing Three.js bundle-size warning remains). Bundle scan confirmed no candidate/showroom/inspector markers. Eighteen scene/control/showcase tests passed with no unexpected browser errors. Full mission journey was not rerun: this phase does not replace the gameplay ship or change simulation.

Artifacts: test-results/ship-ship-candidate-review-abe2b-onse-and-unchanged-gameplay-game/ contains the four requested angles, gameplay-distance and collision screenshots, inspection.json and review.json. Tests verify unchanged radius/hardpoints, bounded model size, banking, engine response, firing and returning to the original scene.

Await user visual approval before promoting the candidate to normal gameplay or publishing it.
