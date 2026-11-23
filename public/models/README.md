# Offline pose assets

Place the mission-approved model assets in this directory before operating without a network:

- `mediapipe/wasm/`
- `pose_landmarker_lite.task`
- `movenet-lightning/model.json` and its local weight shards

Camera inference uses only local camera frames. Model asset downloads must be reviewed and pinned as part of the mission configuration.
