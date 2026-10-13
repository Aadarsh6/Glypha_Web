// Curated constellation — positions authored, values illustrative.
export interface ObsNode {
  id: string; kind: 'peer' | 'coord' | 'watch';
  label: string; role: string; fp?: string; addr?: string;
  x: number; y: number;
}

export const OBS_NODES: ObsNode[] = [
  { id: 'r1', kind: 'coord', label: 'RENDEZVOUS 01', role: 'coordination · introductions', x: 430, y: 30 },
  { id: 'r2', kind: 'coord', label: 'RENDEZVOUS 02', role: 'coordination · introductions', x: 840, y: 330 },
  { id: 'alpha', kind: 'peer', label: 'ALPHA', role: 'persistent identity', fp: '7F3A 9C1B 42DE 0817', addr: '10.0.4.12', x: 160, y: 160 },
  { id: 'bravo', kind: 'peer', label: 'BRAVO', role: 'persistent identity', fp: '61AA 3B9D F2E4 7F3A', addr: '172.19.8.5', x: 540, y: 200 },
  { id: 'wren', kind: 'peer', label: 'WREN', role: 'persistent identity', fp: 'C4E1 08AA 5512 D9F0', addr: '192.168.1.23', x: 800, y: 70 },
  { id: 'cirrus', kind: 'peer', label: 'CIRRUS', role: 'persistent identity', fp: '9B07 22E4 A1C8 3F55', addr: '10.1.9.7', x: 240, y: 420 },
  { id: 'delta', kind: 'peer', label: 'DELTA', role: 'persistent identity', fp: 'E5C0 61AA 3B9D F2E4', addr: '172.20.3.44', x: 660, y: 450 },
  { id: 'watch', kind: 'watch', label: 'THE OBSERVER', role: 'any network on the path', x: 450, y: 640 },
];

export interface ObsEdgeDef {
  id: string; source: string; target: string;
  kind: 'direct' | 'announce' | 'meta';
  active?: boolean; label?: string; meta?: string;
}

export const OBS_EDGES: ObsEdgeDef[] = [
  { id: 'e-ab', source: 'alpha', target: 'bravo', kind: 'direct', active: true, label: '29 7F 3A …' },
  { id: 'e-wb', source: 'wren', target: 'bravo', kind: 'direct', active: true, label: '51 8C E2 …' },
  { id: 'e-ca', source: 'cirrus', target: 'alpha', kind: 'direct' },
  { id: 'e-ar', source: 'alpha', target: 'r1', kind: 'announce' },
  { id: 'e-br', source: 'bravo', target: 'r1', kind: 'announce' },
  { id: 'e-cr', source: 'cirrus', target: 'r2', kind: 'announce' },
  { id: 'e-dr', source: 'delta', target: 'r2', kind: 'announce' },
  { id: 'm-a', source: 'watch', target: 'alpha', kind: 'meta', meta: '10.0.4.12 ▸ 172.19.8.5 · 1.4 KB' },
  { id: 'm-b', source: 'watch', target: 'bravo', kind: 'meta', meta: '172.19.8.5 ▸ 10.0.4.12 · 1.4 KB' },
  { id: 'm-c', source: 'watch', target: 'cirrus', kind: 'meta', meta: '10.1.9.7 ▸ 10.0.4.12 · 0.3 KB' },
  { id: 'm-r', source: 'watch', target: 'r1', kind: 'meta', meta: 'coordination traffic · 0.2 KB' },
];