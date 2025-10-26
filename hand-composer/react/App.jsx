import { useEffect, useRef, useState } from 'react'

export default function App() {
  const [data, setData] = useState(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5100/ws') // FastAPI bridge
    wsRef.current = ws
    ws.onmessage = (e) => {
      try { setData(JSON.parse(e.data)) } catch {}
    }
    ws.onclose = () => console.log('WS closed')
    return () => ws.close()
  }, [])

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
      {/* TOP: camera feed from Python bridge (MJPEG) */}
      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#111'}}>
        <img
          src="http://localhost:5100/video"
          alt="camera"
          style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}
        />
      </div>

      {/* BOTTOM: simple visualizer placeholder */}
      <div style={{height:'40vh', borderTop:'1px solid #222', padding:'16px', background:'#0a0a0a'}}>
        <div style={{opacity:0.8, marginBottom:8}}>
          {data
            ? <>Chord: <b>{data.chord}</b> · Notes: <b>{(data.notes||[]).join(', ')}</b> · BPM: <b>{data.bpm}</b> · Vel: <b>{data.velocity}</b> · FPS: <b>{Number(data.fps_cam).toFixed(1)}</b> · Inference: <b>{Number(data.infer_ms).toFixed(2)} ms</b></>
            : 'Connecting…'}
        </div>
        <Bars notes={data?.notes||[]} bpm={data?.bpm||0} />
      </div>
    </div>
  )
}

function Bars({ notes, bpm }) {
  // simple bar viz: map MIDI notes to widths
  const widths = notes.map(n => ((n % 12) + 1) * 6)
  return (
    <div style={{display:'flex', gap:8, height:'100%'}}>
      {widths.length === 0
        ? <div style={{opacity:0.6}}>No notes yet… (move your hand)</div>
        : widths.map((w,i) => (
          <div key={i} style={{flex:1, display:'flex', alignItems:'flex-end'}}>
            <div style={{width:'100%', height: `${40 + w}px`, background:'#4ade80', borderRadius:6}}/>
          </div>
        ))
      }
    </div>
  )
}
