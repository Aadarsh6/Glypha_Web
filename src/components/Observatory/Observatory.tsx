import { useMemo, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap,
  Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath,
  type Node, type Edge, type NodeProps, type EdgeProps, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { OBS_NODES, OBS_EDGES, type ObsNode } from '../../data/observatory';
import { Reveal, SectionHeader } from '../ui';

type Data = ObsNode & { observer?: boolean };

function Shell({ data, className }: { data: Data; className: string }) {
  const d = data;
  return (
    <div className={className}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
      <div className="rf-top">
        <span className={`rf-led ${d.kind === 'watch' ? 'warn' : ''}`} />
        <span className="rf-name">{d.label}</span>
      </div>
      {d.fp && <div className="rf-fp">{d.fp}</div>}
      {d.addr && <div className={`rf-addr${d.observer ? ' warn' : ''}`}>{d.addr} · demo</div>}
      {d.kind === 'peer' && d.observer && <div className="rf-exposed">EXPOSED · TIMING · VOLUME</div>}
      {d.kind === 'watch' && (
        <div className="rf-watch-note">{d.observer ? 'WATCHING · who, when, how much' : 'sees: nothing readable'}</div>
      )}
      <div className="rf-role">{d.role}</div>
    </div>
  );
}
const PeerRF = (p: NodeProps) => <Shell {...p} data={p.data as unknown as Data} className="rf-peer" />;
const CoordRF = (p: NodeProps) => <Shell {...p} data={p.data as unknown as Data} className="rf-coord" />;
const WatchRF = (p: NodeProps) => <Shell {...p} data={p.data as unknown as Data} className="rf-watch" />;

const nodeTypes = { peer: PeerRF, coord: CoordRF, watch: WatchRF } as unknown as NodeTypes;

function GlyphaEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const d = (data ?? {}) as { kind?: string; observer?: boolean; active?: boolean; label?: string; meta?: string };
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, curvature: 0.22 });

  let stroke = '#3A423A';
  let cls = '';
  let label = '';
  let width = 1.2;
  let opacity = 1;

  if (d.kind === 'meta') {
    stroke = '#E7B86D'; cls = 'rf-edge-meta'; label = d.meta ?? ''; width = 1.4;
  } else if (d.observer) {
    stroke = '#E7B86D'; label = 'SEEN · contents opaque'; width = 1.4;
    if (d.kind === 'announce') { opacity = 0.2; label = ''; }
  } else if (d.active) {
    stroke = '#67DDA1'; cls = 'rf-edge-flow'; label = d.label ?? ''; width = 1.6;
  }

  const lx = (sourceX + targetX) / 2;
  const ly = (sourceY + targetY) / 2;
  const warn = d.kind === 'meta' || d.observer;

  return (
    <>
      <BaseEdge id={id} path={path} className={cls}
        style={{ stroke, strokeWidth: width, opacity }} />
      {label && (
        <EdgeLabelRenderer>
          <div className={`rf-elabel ${warn ? 'warn' : 'acc'}`}
            style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const edgeTypes = { glypha: GlyphaEdge };

export function Observatory() {
  const [observer, setObserver] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const nodes: Node[] = useMemo(
    () => OBS_NODES.map(n => ({
      id: n.id,
      type: n.kind === 'peer' ? 'peer' : n.kind === 'coord' ? 'coord' : 'watch',
      position: { x: n.x, y: n.y },
      data: { ...n, observer },
    })),
    [observer],
  );

  const edges: Edge[] = useMemo(
    () => OBS_EDGES.map(e => ({
      id: e.id, source: e.source, target: e.target, type: 'glypha',
      hidden: e.kind === 'meta' && !observer,
      data: { ...e, observer },
    })),
    [observer],
  );

  const node = OBS_NODES.find(n => n.id === sel);

  return (
    <section id="observatory" className="hairtop">
      <div className="wrap">
        <SectionHeader
          index="03" label="Observatory"
          title="A network you can flip inside out."
          lede="A larger mesh, fully explorable — pan, zoom, select any peer. Then flip the observer switch and see the same network from the outside: encryption protects what travels, never the fact that you're talking."
        />

        <Reveal>
          <div className="labbar">
            <div className="tabs" role="group" aria-label="View mode">
              <button className="tab" aria-pressed={!observer} onClick={() => setObserver(false)}>
                <b>PAYLOAD</b>VIEW
              </button>
              <button className="tab" aria-pressed={observer} onClick={() => setObserver(true)}>
                <b>OBSERVER</b>VIEW
              </button>
            </div>
            <span className="lstat">drag to pan · pinch or buttons to zoom · click nodes</span>
          </div>

          <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="obsbox">
              <ReactFlow
                nodes={nodes} edges={edges}
                nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                onNodeClick={(_e, n) => setSel(n.id)}
                fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
                minZoom={0.4} maxZoom={1.6}
                zoomOnScroll={false} panOnScroll={false}
                nodesDraggable={false} nodesConnectable={false}
                proOptions={{ hideAttribution: false }}
              >
                <Background variant={BackgroundVariant.Dots} color="#1A1E1A" gap={26} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable={false} zoomable={false}
                  maskColor="rgba(9,10,9,.72)"
                  nodeColor={n => (n.type === 'watch' ? '#E7B86D' : n.type === 'coord' ? '#4A544A' : '#67DDA1')}
                />
              </ReactFlow>
              <span className="m-tl">MESH · LOCAL SIM</span>
              <span className="m-tr">SIMULATED · NO NETWORK</span>
            </div>

            <aside className="insp" aria-label="Node inspector">
              <div className="ihead">
                <span>INSPECTOR</span>
                <span className={`isel${node ? ' on' : ''}`}>{node ? node.label : 'NO SELECTION'}</span>
              </div>
              {node ? (
                <>
                  <div className="kv"><span>kind</span><b>{node.kind === 'peer' ? 'peer' : node.kind === 'coord' ? 'rendezvous' : 'network observer'}</b></div>
                  {node.fp && <div className="kv"><span>fingerprint</span><b>{node.fp.slice(0, 9)}…</b></div>}
                  {node.addr && <div className="kv"><span>address</span><b className={observer ? 'warnv' : ''}>{node.addr} · demo</b></div>}
                  {node.kind === 'coord' && <div className="kv"><span>relays</span><b>no messages</b></div>}
                  {node.kind === 'peer' && (
                    observer ? (
                      <>
                        <div className="kv"><span>visible</span><b className="warnv">address · timing · volume</b></div>
                        <div className="kv"><span>contents</span><b className="okv">encrypted</b></div>
                      </>
                    ) : (
                      <>
                        <div className="kv"><span>readable by</span><b className="okv">peers only</b></div>
                        <div className="kv"><span>shape of talk</span><b>still visible</b></div>
                      </>
                    )
                  )}
                  {node.kind === 'watch' && (
                    observer ? (
                      <div className="kv"><span>sees</span><b className="warnv">who, when, how much</b></div>
                    ) : (
                      <div className="kv"><span>sees</span><b>encrypted bytes</b></div>
                    )
                  )}
                  <p className="inote">{node.role}</p>
                </>
              ) : (
                <p className="inote">Select any node in the mesh. Then flip the view — the nodes don't move, but what you can see about them changes completely.</p>
              )}
            </aside>
          </div>

          <p className={`labnote${observer ? ' warn' : ''}`} style={{ marginTop: 14 }}>
            {observer
              ? 'observer view — the network learns who talks to whom, when, and how much. it never learns what.'
              : 'payload view — ciphertext between peers, fingerprints on the nodes. select a peer, then flip the switch.'}
          </p>
        </Reveal>
      </div>
    </section>
  );
}