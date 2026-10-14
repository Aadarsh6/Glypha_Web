import { useReducedMotion } from '../hooks';

export interface NatSignal { stage: number; sent: number; tampers: number }

const BLUE = '#6E9BFF', RED = '#FF7A59', GREEN = '#67DDA1', INK = '#E9ECE7', FAINT = '#3a423b', MUTE = '#7d867d';

const CAPTION = [
  'Two peers, each behind a NAT that drops anything it did not start.',
  "Asking the rendezvous where 'world' is. It is a directory, nothing more.",
  'Trying a direct connection to world.',
  'Direct failed. Both sides punch at the same moment, hoping the NATs open.',
  'Punch failed. Connecting out to the relay instead: outbound always works.',
  'Connected. The relay forwards bytes and cannot read them.',
];
const STATUS = ['idle', 'rendezvous', 'direct', 'punching', 'relay', 'via relay'];

const RDV_A = 'M50,100 C70,40 150,33 222,33';
const RDV_B = 'M470,100 C450,40 370,33 298,33';
const REL_A = 'M50,140 C70,205 150,205 222,205';
const REL_B = 'M298,205 C370,205 450,205 470,140';
const FULL = 'M50,140 C70,205 150,205 222,205 L298,205 C370,205 450,205 470,140';

// SMIL elements inserted after load need an explicit start, so each one is begun on mount.
const go = (el: SVGElement | null) => { (el as unknown as SVGAnimationElement | null)?.beginElement?.(); };

function Dot({ path, color, dur = 1.2, loop = false, r = 3 }: { path: string; color: string; dur?: number; loop?: boolean; r?: number }) {
  const rc = loop ? 'indefinite' : 1;
  return (
    <circle r={r} fill={color} opacity={0}>
      <animateMotion ref={go} begin="indefinite" dur={`${dur}s`} path={path} repeatCount={rc} fill="freeze" />
      <animate ref={go} begin="indefinite" attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur={`${dur}s`} repeatCount={rc} fill="freeze" />
    </circle>
  );
}

function Cross({ x, y, steady, anim }: { x: number; y: number; steady: boolean; anim: boolean }) {
  return (
    <text x={x} y={y} fill={RED} fontSize="15" fontWeight="700" textAnchor="middle" opacity={steady || !anim ? 1 : 0}>
      {!steady && anim && (
        <animate ref={go} begin="indefinite" attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.72;.8;.95;1" dur="1.2s" repeatCount="indefinite" />
      )}
      ✕
    </text>
  );
}

function Peer({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x} y={100} width={56} height={40} fill="#0f1411" stroke={INK} strokeWidth={1.2} />
      <text x={x + 28} y={124} fill={INK} fontSize="11" textAnchor="middle">{label}</text>
    </g>
  );
}

function Nat({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x} y={84} width={12} height={72} fill="url(#brick)" stroke={MUTE} strokeWidth={1} />
      <text x={x + 6} y={74} fill={MUTE} fontSize="9" textAnchor="middle">{label}</text>
    </g>
  );
}

export function NatDiagram({ stage, sent, tampers }: NatSignal) {
  const reduced = useReducedMotion();
  const anim = !reduced;
  const live = stage === 5;
  const directColor = stage === 2 ? BLUE : stage >= 3 ? RED : FAINT;
  const flow = (on: boolean) => (on && anim ? 'natflow' : undefined);

  return (
    <div className="natbox" aria-label="Animated diagram of the connection attempt">
      <div className="nat-head">
        <span>network path to &apos;world&apos;</span>
        <span style={{ color: stage === 5 ? GREEN : stage >= 3 ? RED : stage > 0 ? BLUE : undefined }}>{STATUS[stage]}</span>
      </div>
      <svg className="nat-svg" viewBox="0 0 520 240" role="img" aria-hidden="true" fontFamily="var(--font-mono)">
        <defs>
          <pattern id="brick" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#141a16" />
            <line x1="0" y1="0" x2="0" y2="6" stroke={MUTE} strokeWidth="2" opacity=".55" />
          </pattern>
        </defs>

        {/* edges */}
        <path d="M78,120 L442,120" fill="none" stroke={directColor} strokeWidth={1.5} strokeDasharray="5 5"
          opacity={stage >= 3 ? 0.4 : 0.9} className={flow(stage === 2)} />
        {[RDV_A, RDV_B].map(d => (
          <path key={d} d={d} fill="none" stroke={stage > 0 ? BLUE : FAINT} strokeWidth={1.2} strokeDasharray="4 4"
            opacity={stage === 1 ? 1 : stage > 1 ? 0.3 : 0.6} className={flow(stage === 1)} />
        ))}
        {[REL_A, REL_B].map(d => (
          <path key={d} d={d} fill="none" stroke={live ? GREEN : stage === 4 ? BLUE : FAINT}
            strokeWidth={live ? 2 : 1.2} strokeDasharray={live ? undefined : '4 4'} opacity={stage >= 4 ? 1 : 0.6}
            className={flow(stage === 4)} />
        ))}

        <Nat x={140} label="home NAT" />
        <Nat x={374} label="carrier NAT" />
        <Peer x={22} label="you" />
        <Peer x={442} label="world" />

        <g>
          <rect x={222} y={18} width={76} height={30} fill="#0f1411" stroke={stage === 1 ? BLUE : MUTE} strokeWidth={1.2} />
          <text x={260} y={37} fill={INK} fontSize="10" textAnchor="middle">rendezvous</text>
          <rect x={222} y={190} width={76} height={30} fill="#0f1411" stroke={live ? GREEN : stage === 4 ? BLUE : MUTE} strokeWidth={live ? 2 : 1.2} />
          <text x={260} y={209} fill={live ? GREEN : INK} fontSize="10" textAnchor="middle">relay</text>
        </g>

        {/* blocked marks */}
        {stage >= 2 && <Cross x={362} y={125} steady={stage >= 3} anim={anim} />}
        {stage >= 3 && <Cross x={166} y={125} steady={stage >= 4} anim={anim} />}

        {/* packets, remounted per stage so each phase restarts */}
        {anim && (
          <g key={stage}>
            {stage === 1 && <><Dot path={RDV_A} color={BLUE} dur={1.1} loop /><Dot path={RDV_B} color={BLUE} dur={1.1} loop /></>}
            {stage === 2 && <Dot path="M78,120 L362,120" color={BLUE} loop />}
            {stage === 3 && <><Dot path="M78,120 L362,120" color={BLUE} loop /><Dot path="M442,120 L166,120" color={BLUE} loop /></>}
            {stage === 4 && <><Dot path={REL_A} color={BLUE} dur={1.1} loop /><Dot path={`M470,140 C450,205 370,205 298,205`} color={BLUE} dur={1.1} loop /></>}
            {live && <Dot path={FULL} color={GREEN} dur={3.2} loop r={2.5} />}
          </g>
        )}
        {anim && live && sent > 0 && <g key={`m${sent}`}><Dot path={FULL} color={GREEN} dur={1.3} r={4.5} /></g>}
        {anim && live && tampers > 0 && (
          <g key={`t${tampers}`}>
            <Dot path={FULL} color={RED} dur={1.3} r={4.5} />
            <text x={470} y={162} fill={RED} fontSize="13" fontWeight="700" textAnchor="middle" opacity={0}>
              <animate ref={go} begin="indefinite" attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.8;.86;.97;1" dur="1.9s" fill="freeze" />
              ✕
            </text>
          </g>
        )}
      </svg>
      <p className="nat-cap">{CAPTION[stage]}</p>
    </div>
  );
}
