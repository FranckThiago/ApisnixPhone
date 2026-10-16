import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { WaitingCallCard } from '../../src/features/calls/WaitingCallCard';
import '../../src/styles/tokens.css';
import '../../src/styles/app.css';
import type { CallSnapshot } from '../../src/telephony/types';
export function Preview() {
  const [answered, setAnswered] = useState(false), [visible, setVisible] = useState(true);
  const call: CallSnapshot = { id: 'preview', direction: 'inbound', rawInput: '1002', dialTarget: '1002', remoteName: answered ? 'Premier correspondant' : 'Second correspondant', phase: answered ? 'held' : 'ringing-in', startedAt: 1, muted: false, holdPending: false, dtmf: '' };
  return <main style={{ width: 'min(390px, 100%)', margin: '24px auto', padding: 16, boxSizing: 'border-box' }}>
    <h1 style={{ fontSize: 22 }}>Pilote double appel</h1><p>Aperçu local — identités fictives</p>
    <WaitingCallCard call={visible ? call : undefined} onAnswer={() => setAnswered(true)} onDecline={() => setVisible(false)} onSwitch={() => setAnswered(false)} />
    <section className="dock-card call-card" style={{ marginTop: 16, padding: 24 }}><p>Conversation en cours</p><h2>{answered ? 'Second correspondant' : 'Premier correspondant'}</h2><p>00:42</p><button className="hangup" onClick={() => { setAnswered(false); setVisible(true); }}>Raccrocher</button></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
