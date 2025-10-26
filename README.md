# Nodal

## Inspiration
Bridge the gap between physical gesture and digital music. Conduct music with natural hand movements and watch your ideas come alive visually.

## Features
- **Gesture-based control**: Hand tracking or draggable markers  
- **Polyphonic melodies**: Multiple independent voices  
- **Visual feedback**: Animated nodal tree structures  
- **Spatial sound**: X-axis = panning, Y-axis = pitch  
- **Scale quantization**: Major, Minor, Dorian, Lydian, Mixolydian, Chromatic  
- **MIDI output**: Connect to DAWs like Ableton or Logic  

## Tech Stack
- React + TypeScript  
- Web Audio API & Web MIDI API  
- Canvas API for visuals  
- MediaPipe Hands for tracking  
- Custom algorithms for scales and lane selection  

## Getting Started
```bash
npm install
npm run dev
```

- **Open in your browser:** [http://localhost:5173](http://localhost:5173)
- **Or check out our deployment on Vercel:** [https://nodal-six.vercel.app/](https://nodal-six.vercel.app/)

### Setup
- Connect a virtual MIDI bus (IAC Driver on Mac, loopMIDI on Windows)  
- Route to your DAW  
- Enable hand tracking or drag markers  
- Make music!  

### Future Plans
- Add more scales & gesture vocabulary  
- Collaboration mode for multiple performers  
- ML-powered note suggestions  
- Mobile and 3D visualization support
