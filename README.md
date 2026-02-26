# sukuna-shrine-vfx

Interactive Three.js + MediaPipe project inspired by Sukuna's Malevolent Shrine.

## What This Build Does
- Uses webcam hand tracking (MediaPipe Hands).
- Builds and latches the domain after the summon gesture.
- Fires **Dismantle** slashes when you raise a two-finger sign.
- Closes the domain when you make a fist.
- Includes camera feed + hand skeleton in the bottom-left tracker panel.

## Requirements
- macOS, Windows, or Linux
- Python 3 installed
- Modern browser (Chrome recommended)
- Webcam access permission enabled

## Quick Start (Local)
```bash
git clone https://github.com/Klauscreates/sukuna-shrine-vfx.git
cd sukuna-shrine-vfx
python3 -m http.server 8000
```

Open:
- `http://localhost:8000`

## Controls / Gestures
1. **Summon Domain**
- Put both hands in frame and bring them close together.
- Once formed, the domain stays active (latched).

2. **Fire Dismantle**
- Raise **index + middle finger up** (ring + pinky down).
- Each new raise event fires one slash burst.

3. **Close Domain**
- Make a **fist**.
- Domain transitions into closing state.

## Troubleshooting
1. Black screen / no visuals
- Confirm the server is running in terminal.
- Reload with hard refresh: `Cmd + Shift + R`.

2. Camera panel black
- Check browser camera permissions for `localhost`.
- Close other apps/tabs using your camera.

3. Gestures not triggering
- Ensure both hands are clearly visible with good lighting.
- Keep hands inside the tracker panel view.
- Try slower, clearer gesture transitions.

4. Webcam works but domain does not start
- Bring both hands closer together in frame (palm centers).
- Hold briefly until trigger is detected.

## Share With Other People
Option A: Share repo link
- Send: `https://github.com/Klauscreates/sukuna-shrine-vfx`
- They run the Quick Start commands above.

Option B: Share zip
```bash
cd ..
zip -r sukuna-shrine-vfx.zip sukuna-shrine-vfx
```
Then share `sukuna-shrine-vfx.zip`.

## Project Files
- `index.html` - page and script includes
- `style.css` - layout and visual layering
- `main.js` - hand tracking, state machine, VFX logic
