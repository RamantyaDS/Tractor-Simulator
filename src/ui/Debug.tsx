import { useEffect, useState } from 'react';
import { audioDebug, debugBeep } from '../sound';

/** Hidden audio diagnostics, shown only with ?debug in the address. */
export function Debug() {
  const [d, setD] = useState(audioDebug());
  useEffect(() => {
    const id = setInterval(() => setD(audioDebug()), 400);
    return () => clearInterval(id);
  }, []);
  if (!new URLSearchParams(location.search).has('debug')) return null;
  return (
    <div className="debug">
      <b>Audio debug</b>
      {Object.entries(d).map(([k, v]) => (
        <div key={k}>
          {k}: <code>{String(v)}</code>
        </div>
      ))}
      <div>UA: <code>{navigator.userAgent.match(/Edg\/[\d.]+|Chrome\/[\d.]+|Firefox\/[\d.]+/)?.[0]}</code></div>
      <button className="small" onClick={debugBeep}>Nada tes</button>
    </div>
  );
}
