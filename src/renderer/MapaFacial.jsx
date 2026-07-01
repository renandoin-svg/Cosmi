import React, { useRef, useState, useMemo, useEffect } from 'react';

// ---------------------------------------------------------------------------
// §2 Mapa facial interativo.
// Comportamento portado da referência (mapa-facial-cosmiatria.jsx) e ampliado:
// atlas anatômico detalhado, camada de zonas de perigo vascular, foto de fundo.
// Nesta etapa as marcações e o catálogo são em memória (demonstração). A
// persistência em paciente/sessão entra nas §3/§5.
// ---------------------------------------------------------------------------

const TIPOS = {
  toxina:         { label: 'Toxina',         cor: '#2f9e8f', unidade: 'U',  tecnica: false },
  preenchedor:    { label: 'Preenchedor',    cor: '#d98a29', unidade: 'ml', tecnica: true  },
  bioestimulador: { label: 'Bioestimulador', cor: '#8b6bd9', unidade: 'ml', tecnica: true  },
  outro:          { label: 'Outro',          cor: '#7c8b99', unidade: 'un', tecnica: false },
};

// Catálogo-semente (do CSV verificado). [marca, produto, tipo, aviso?]
const SEED = [
  ['Restylane', 'Lyft', 'preenchedor'], ['Restylane', 'Defyne', 'preenchedor'],
  ['Restylane', 'Refyne', 'preenchedor'], ['Restylane', 'Kysse', 'preenchedor'],
  ['Restylane', 'Volyme', 'preenchedor'], ['Restylane', 'Shaype', 'preenchedor'],
  ['Restylane', 'Restylane clássico', 'preenchedor'], ['Restylane', 'Skinbooster Vital', 'preenchedor'],
  ['Restylane', 'Skinbooster Vital Light', 'preenchedor'],
  ['Juvéderm', 'Voluma', 'preenchedor'], ['Juvéderm', 'Volift', 'preenchedor'],
  ['Juvéderm', 'Volbella', 'preenchedor'], ['Juvéderm', 'Ultra XC', 'preenchedor'],
  ['Juvéderm', 'Ultra Plus XC', 'preenchedor'], ['Juvéderm', 'Volux', 'preenchedor'],
  ['Juvéderm', 'Skinvive', 'preenchedor'],
  ['Belotero', 'Balance', 'preenchedor'], ['Belotero', 'Intense', 'preenchedor'],
  ['Belotero', 'Volume', 'preenchedor'], ['Belotero', 'Soft', 'preenchedor'],
  ['Belotero', 'Lips Shape', 'preenchedor'], ['Belotero', 'Lips Contour', 'preenchedor'],
  ['Belotero', 'Revive', 'preenchedor'],
  ['Sculptra', 'Sculptra', 'bioestimulador'],
  ['Radiesse', 'Radiesse Duo', 'bioestimulador'], ['Radiesse', 'Radiesse (+) com lidocaína', 'bioestimulador'],
  ['Ellansé', 'Ellansé S', 'bioestimulador'], ['Ellansé', 'Ellansé M', 'bioestimulador'],
  ['Ellansé', 'Ellansé L', 'bioestimulador'], ['Ellansé', 'Ellansé E', 'bioestimulador'],
  ['Botox', 'Botox', 'toxina'], ['Dysport', 'Dysport', 'toxina'], ['Xeomin', 'Xeomin', 'toxina'],
  ['Prosigne', 'Prosigne', 'toxina'], ['Botulift', 'Botulift', 'toxina'],
  ['Nabota', 'Nabota', 'toxina'], ['Letybo', 'Letybo', 'toxina'],
  ['Botulim', 'Botulim', 'toxina', 'Registro Anvisa encerrado em 2025 — não utilizar'],
  ['Blautox', 'Blautox', 'toxina', 'Registro Anvisa porém fora do mercado — verificar'],
];

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const rotuloProduto = (p) => `${p.marca} ${p.produto}`.trim();

// Âncoras de região (base da sugestão automática). Mantidas da referência.
const REGIOES = {
  frontal: [
    { nome: 'Fronte', x: 200, y: 120 }, { nome: 'Glabela', x: 200, y: 170 },
    { nome: 'Supercílio D', x: 150, y: 178 }, { nome: 'Supercílio E', x: 250, y: 178 },
    { nome: 'Têmpora D', x: 100, y: 165 }, { nome: 'Têmpora E', x: 300, y: 165 },
    { nome: 'Pés de galinha D', x: 110, y: 200 }, { nome: 'Pés de galinha E', x: 290, y: 200 },
    { nome: 'Tear trough D', x: 165, y: 222 }, { nome: 'Tear trough E', x: 235, y: 222 },
    { nome: 'Dorso nasal', x: 200, y: 235 }, { nome: 'Ponta nasal', x: 200, y: 258 },
    { nome: 'Malar D', x: 128, y: 248 }, { nome: 'Malar E', x: 272, y: 248 },
    { nome: 'Sulco nasogeniano D', x: 168, y: 282 }, { nome: 'Sulco nasogeniano E', x: 232, y: 282 },
    { nome: 'Filtro', x: 200, y: 296 }, { nome: 'Arco do cupido', x: 200, y: 304 },
    { nome: 'Lábio superior D', x: 184, y: 309 }, { nome: 'Lábio superior E', x: 216, y: 309 },
    { nome: 'Vermelhão superior', x: 200, y: 310 }, { nome: 'Lábio inferior', x: 200, y: 324 },
    { nome: 'Comissura D', x: 168, y: 316 }, { nome: 'Comissura E', x: 232, y: 316 },
    { nome: 'Sulco mentolabial', x: 200, y: 350 },
    { nome: 'Pré-jowl D', x: 150, y: 368 }, { nome: 'Pré-jowl E', x: 250, y: 368 },
    { nome: 'Pogônio', x: 200, y: 378 }, { nome: 'Menton', x: 200, y: 402 },
    { nome: 'Masseter D', x: 112, y: 320 }, { nome: 'Masseter E', x: 288, y: 320 },
    { nome: 'Linha mandibular D', x: 138, y: 350 }, { nome: 'Linha mandibular E', x: 262, y: 350 },
  ],
  perfil: [
    { nome: 'Fronte', x: 235, y: 130 }, { nome: 'Têmpora', x: 285, y: 165 },
    { nome: 'Pés de galinha', x: 270, y: 200 }, { nome: 'Zigomático', x: 232, y: 245 },
    { nome: 'Pré-auricular', x: 315, y: 235 }, { nome: 'Sulco nasogeniano', x: 200, y: 280 },
    { nome: 'Lábios', x: 178, y: 300 }, { nome: 'Sulco mentolabial', x: 185, y: 345 },
    { nome: 'Pogônio', x: 178, y: 372 }, { nome: 'Menton', x: 195, y: 392 },
    { nome: 'Linha mandibular', x: 270, y: 360 }, { nome: 'Masseter', x: 300, y: 320 },
  ],
};
function regiaoMaisProxima(view, x, y) {
  let melhor = REGIOES[view][0], dist = Infinity;
  for (const r of REGIOES[view]) {
    const d = (r.x - x) ** 2 + (r.y - y) ** 2;
    if (d < dist) { dist = d; melhor = r; }
  }
  return melhor.nome;
}
function raioPonto(p) {
  if (p.tipo === 'toxina') return 5 + Math.min(p.dose, 20) * 0.55;
  return 6 + Math.min(p.dose, 4) * 5;
}

const LIG_COLOR = '#c98b2e';   // ligamentos de retenção
const ATLAS = '#54636f';       // traço do atlas
const ATLAS_SOFT = '#3c4854';  // traço secundário
const THIRDS = '#3f6f66';      // linhas dos terços
const LABEL = '#7d8b98';
const DANGER = '#e0554f';

// --------- Atlas anatômico detalhado ---------
function AtlasFrontal({ rotulos }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Contorno do rosto e linha do cabelo */}
      <g stroke={ATLAS} strokeWidth="2">
        <path d="M200 66 C118 66 103 158 108 230 C112 302 150 412 200 418 C250 412 288 302 292 230 C297 158 282 66 200 66 Z" />
        <path d="M120 108 C150 74 250 74 280 108" stroke={ATLAS_SOFT} strokeWidth="1.4" />
      </g>

      {/* Terços faciais */}
      <g stroke={THIRDS} strokeWidth="1.2" strokeDasharray="5 5" opacity="0.9">
        <line x1="112" y1="170" x2="288" y2="170" />
        <line x1="120" y1="268" x2="280" y2="268" />
      </g>
      {rotulos && (
        <g fill={THIRDS} fontSize="8" opacity="0.95">
          <text x="300" y="130">terço superior</text>
          <text x="300" y="222">terço médio</text>
          <text x="300" y="330">terço inferior</text>
        </g>
      )}

      {/* Sobrancelhas e olhos */}
      <g stroke={ATLAS} strokeWidth="1.5">
        <path d="M120 174 C140 164 168 164 184 173" /><path d="M216 173 C232 164 260 164 280 174" />
        <ellipse cx="152" cy="198" rx="20" ry="11" /><ellipse cx="248" cy="198" rx="20" ry="11" />
        <circle cx="152" cy="198" r="4" fill={ATLAS_SOFT} stroke="none" />
        <circle cx="248" cy="198" r="4" fill={ATLAS_SOFT} stroke="none" />
      </g>

      {/* Nariz */}
      <path d="M200 200 L200 252 M200 252 C188 262 178 262 172 256 M200 252 C212 262 222 262 228 256" stroke={ATLAS} strokeWidth="1.5" />

      {/* Sulcos nasogenianos */}
      <path d="M150 250 C140 280 150 300 168 312" stroke={ATLAS_SOFT} strokeWidth="1.3" />
      <path d="M250 250 C260 280 250 300 232 312" stroke={ATLAS_SOFT} strokeWidth="1.3" />

      {/* Lábios — sub-regiões */}
      <g stroke={ATLAS} strokeWidth="1.4">
        {/* arco do cupido + vermelhão superior */}
        <path d="M168 312 C182 304 193 304 200 309 C207 304 218 304 232 312" />
        {/* linha de fechamento */}
        <path d="M168 312 C188 320 212 320 232 312" strokeWidth="1.6" />
        {/* vermelhão inferior */}
        <path d="M168 312 C184 330 216 330 232 312" strokeWidth="1.2" />
        {/* colunas do filtro */}
        <path d="M194 296 L193 309 M206 296 L207 309" stroke={ATLAS_SOFT} strokeWidth="1" />
      </g>

      {/* Mento — sulco mentolabial, pogônio, menton */}
      <g stroke={ATLAS_SOFT} strokeWidth="1.2">
        <path d="M176 348 C188 356 212 356 224 348" />
        <path d="M178 396 C190 404 210 404 222 396" opacity="0.7" />
      </g>

      {/* Ligamentos de retenção */}
      <Ligaments pontos={[[108, 150], [292, 150], [128, 238], [272, 238], [120, 300], [280, 300], [150, 378], [250, 378]]} />
      {rotulos && (
        <g fill={LABEL} fontSize="7">
          <text x="196" y="292" textAnchor="middle">filtro</text>
          <text x="200" y="345" textAnchor="middle">sulco mentolabial</text>
          <text x="200" y="392" textAnchor="middle">pogônio</text>
          <text x="200" y="414" textAnchor="middle">menton</text>
        </g>
      )}
    </g>
  );
}

function AtlasPerfil({ rotulos }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke={ATLAS} strokeWidth="2">
        <path d="M250 72 C200 78 175 120 172 165 C170 195 150 205 150 220 C150 232 168 236 172 244 C176 258 168 275 178 288 C170 300 178 315 178 330 C150 345 175 402 235 407 C300 410 320 350 322 280 C326 168 315 92 250 72 Z" />
        <circle cx="300" cy="235" r="22" stroke={ATLAS_SOFT} strokeWidth="1.4" />
      </g>
      {/* Terços */}
      <g stroke={THIRDS} strokeWidth="1.2" strokeDasharray="5 5" opacity="0.85">
        <line x1="175" y1="165" x2="322" y2="165" />
        <line x1="168" y1="262" x2="322" y2="262" />
      </g>
      <g stroke={ATLAS_SOFT} strokeWidth="1.4">
        <path d="M168 230 C150 226 145 236 158 244" />
        <path d="M163 300 C175 296 190 298 198 305" />
        <path d="M172 345 C182 352 196 352 205 345" />
      </g>
      <Ligaments pontos={[[285, 165], [255, 250], [280, 315], [250, 372]]} />
      {rotulos && (
        <g fill={LABEL} fontSize="7">
          <text x="300" y="150">têmpora</text>
          <text x="150" y="372">pogônio</text>
        </g>
      )}
    </g>
  );
}

function Ligaments({ pontos }) {
  return (
    <g stroke={LIG_COLOR} strokeWidth="1.4" opacity="0.85">
      {pontos.map(([x, y], i) => (
        <g key={i}>
          <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} />
          <line x1={x - 3} y1={y + 3} x2={x + 3} y2={y - 3} />
        </g>
      ))}
    </g>
  );
}

// --------- Zonas de perigo vascular (camada opcional) ---------
function DangerFrontal() {
  return (
    <g fill="none" stroke={DANGER} strokeWidth="3" strokeOpacity="0.5" strokeLinecap="round">
      {/* Artéria facial: mandíbula -> comissura -> asa nasal */}
      <path d="M150 372 C160 330 172 316 182 300 C185 288 186 275 190 264" />
      <path d="M250 372 C240 330 228 316 218 300 C215 288 214 275 210 264" />
      {/* Artéria angular -> canto medial */}
      <path d="M190 264 C186 250 184 236 186 224" />
      <path d="M210 264 C214 250 216 236 214 224" />
      {/* Artéria dorsal nasal */}
      <path d="M200 214 L200 250" />
      {/* Supratroclear / supraorbital (glabela/fronte) */}
      <path d="M188 176 L184 150" /><path d="M212 176 L216 150" />
      {/* Arcada labial superior/inferior */}
      <path d="M172 312 C188 318 212 318 228 312" strokeOpacity="0.4" />
      <circle cx="200" cy="120" r="0" />
    </g>
  );
}
function DangerPerfil() {
  return (
    <g fill="none" stroke={DANGER} strokeWidth="3" strokeOpacity="0.5" strokeLinecap="round">
      {/* Artéria temporal superficial (pré-auricular subindo) */}
      <path d="M300 260 C298 220 290 180 278 150" />
      {/* Artéria facial */}
      <path d="M250 372 C230 330 210 305 198 285 C192 272 190 258 190 250" />
      {/* Angular */}
      <path d="M190 250 C188 236 186 224 188 214" />
    </g>
  );
}

export default function MapaFacial() {
  const [view, setView] = useState('frontal');
  const [points, setPoints] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [showDanger, setShowDanger] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [photo, setPhoto] = useState({ frontal: null, perfil: null });
  const [photoOpacity, setPhotoOpacity] = useState(0.5);
  const [catalogo, setCatalogo] = useState(() =>
    SEED.map(([marca, produto, tipo, aviso], i) => ({ id: 's' + i, marca, produto, tipo, aviso: aviso || null })),
  );
  const svgRef = useRef(null);
  const dragRef = useRef(false);
  const THRESHOLD = 7;

  const editing = points.find((p) => p.id === editingId) || null;

  function addCatalogo(marca, produto, tipo) {
    const m = marca.trim(), pr = produto.trim();
    const achado = catalogo.find((c) => norm(c.marca) === norm(m) && norm(c.produto) === norm(pr));
    if (achado) return achado;
    const novo = { id: crypto.randomUUID(), marca: m, produto: pr, tipo, aviso: null };
    setCatalogo((prev) => [...prev, novo]);
    return novo;
  }

  function toVB(e) {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 400, y: ((e.clientY - r.top) / r.height) * 460 };
  }
  function onDown(e) {
    if (e.target?.dataset?.point) return;
    const pt = toVB(e); dragRef.current = true;
    setDraft({ x: pt.x, y: pt.y, x2: pt.x, y2: pt.y });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onMove(e) {
    if (!dragRef.current) return;
    const pt = toVB(e); setDraft((d) => (d ? { ...d, x2: pt.x, y2: pt.y } : d));
  }
  function onUp() {
    if (!dragRef.current || !draft) { dragRef.current = false; return; }
    dragRef.current = false;
    const dist = Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y);
    const vetor = dist > THRESHOLD;
    // padrão: vetor -> primeiro preenchedor; toque -> primeira toxina
    const base = vetor
      ? catalogo.find((c) => c.tipo === 'preenchedor') || catalogo[0]
      : catalogo.find((c) => c.tipo === 'toxina') || catalogo[0];
    const novo = {
      id: crypto.randomUUID(), view, forma: vetor ? 'vetor' : 'ponto',
      x: draft.x, y: draft.y, x2: draft.x2, y2: draft.y2,
      marca: base.marca, produto: base.produto, tipo: base.tipo,
      dose: vetor ? 0.5 : 4,
      regiao: regiaoMaisProxima(view, draft.x, draft.y),
      instrumento: vetor ? 'Cânula' : 'Agulha',
      tecnica: vetor ? 'Retroinjeção linear' : 'Bolus',
      plano: '—', lote: '', validade: '',
    };
    setPoints((prev) => [...prev, novo]); setEditingId(novo.id); setDraft(null);
  }

  function atualizarPonto(campos) {
    setPoints((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...campos } : p)));
  }
  function excluir(id) {
    setPoints((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const totais = useMemo(() => {
    const t = { toxina: 0, preenchedor: 0, bioestimulador: 0, outro: 0 };
    points.forEach((p) => (t[p.tipo] += Number(p.dose) || 0));
    return t;
  }, [points]);
  const porRegiao = useMemo(() => {
    const m = {};
    points.forEach((p) => {
      const k = `${p.regiao}__${p.tipo}`;
      if (!m[k]) m[k] = { regiao: p.regiao, tipo: p.tipo, dose: 0 };
      m[k].dose += Number(p.dose) || 0;
    });
    return Object.values(m).sort((a, b) => a.regiao.localeCompare(b.regiao));
  }, [points]);

  const pontosVista = points.filter((p) => p.view === view);

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto((prev) => ({ ...prev, [view]: url }));
    e.target.value = '';
  }
  function removerFoto() {
    setPhoto((prev) => {
      if (prev[view]) URL.revokeObjectURL(prev[view]);
      return { ...prev, [view]: null };
    });
  }
  useEffect(() => () => { Object.values(photo).forEach((u) => u && URL.revokeObjectURL(u)); }, []); // eslint-disable-line

  return (
    <div>
      <div className="banner warn" style={{ marginBottom: 14 }}>
        Demonstração do mapa (§2): marcações e catálogo ficam em memória e não são salvos ainda.
        A ligação a paciente/sessão e a persistência entram nas próximas etapas.
      </div>

      <div className="map-layout">
        {/* ---- Canvas ---- */}
        <div className="map-canvas-wrap">
          <div className="map-toolbar">
            <div className="seg">
              {['frontal', 'perfil'].map((k) => (
                <button key={k} className={view === k ? 'active' : ''} onClick={() => { setView(k); setEditingId(null); }}>
                  {k === 'frontal' ? 'Frontal' : 'Perfil'}
                </button>
              ))}
            </div>
            <label className="toggle"><input type="checkbox" checked={showDanger} onChange={(e) => setShowDanger(e.target.checked)} /> Zonas de perigo</label>
            <label className="toggle"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Rótulos anatômicos</label>
            <div className="spacer" />
            <label className="toggle" style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} /> 📷 Foto de fundo
            </label>
            {photo[view] && <button className="icon-btn danger" onClick={removerFoto}>remover foto</button>}
          </div>

          {photo[view] && (
            <div className="range-row" style={{ marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>Opacidade da foto</span>
              <input type="range" min="0.1" max="1" step="0.05" value={photoOpacity} onChange={(e) => setPhotoOpacity(Number(e.target.value))} />
            </div>
          )}

          <p className="gesture-hint">👆 Toque = bolus (ponto) · ✋ Arraste = trajeto (cânula/retroinjeção)</p>

          <svg ref={svgRef} viewBox="0 0 400 460" className="map-svg"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            {photo[view] && (
              <image href={photo[view]} x="0" y="0" width="400" height="460"
                preserveAspectRatio="xMidYMid meet" opacity={photoOpacity} />
            )}
            {view === 'frontal' ? <AtlasFrontal rotulos={showLabels} /> : <AtlasPerfil rotulos={showLabels} />}
            {showDanger && (view === 'frontal' ? <DangerFrontal /> : <DangerPerfil />)}

            {pontosVista.map((p) => {
              const cor = TIPOS[p.tipo].cor, sel = p.id === editingId;
              if (p.forma === 'vetor') {
                const mx = (p.x + p.x2) / 2, my = (p.y + p.y2) / 2;
                return (
                  <g key={p.id} onPointerDown={(e) => { e.stopPropagation(); setEditingId(p.id); }} style={{ cursor: 'pointer' }}>
                    <line data-point="1" x1={p.x} y1={p.y} x2={p.x2} y2={p.y2} stroke={cor} strokeOpacity={0.75} strokeWidth={sel ? 7 : 5} strokeLinecap="round" />
                    <circle data-point="1" cx={p.x} cy={p.y} r={3.5} fill="#0b0f14" stroke={cor} strokeWidth={2} />
                    <text x={mx + 6} y={my - 6} fontSize="10" fontWeight="700" fill={cor} pointerEvents="none">{p.dose}</text>
                  </g>
                );
              }
              return (
                <g key={p.id}>
                  <circle data-point="1" cx={p.x} cy={p.y} r={raioPonto(p)} fill={cor} fillOpacity={0.55} stroke={cor} strokeWidth={sel ? 3 : 1.5}
                    onPointerDown={(e) => { e.stopPropagation(); setEditingId(p.id); }} style={{ cursor: 'pointer' }} />
                  <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff" pointerEvents="none">{p.dose}</text>
                </g>
              );
            })}
            {draft && Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > THRESHOLD && (
              <line x1={draft.x} y1={draft.y} x2={draft.x2} y2={draft.y2} stroke="#e6edf3" strokeOpacity={0.4} strokeWidth={4} strokeDasharray="4 4" strokeLinecap="round" />
            )}
          </svg>

          <div className="legend">
            {Object.entries(TIPOS).map(([k, v]) => (
              <span className="item" key={k}>
                <span className="dot" style={{ background: v.cor }} />
                {v.label}: <b>{+(totais[k] || 0).toFixed(1)} {v.unidade}</b>
              </span>
            ))}
            {showDanger && <span className="item"><span className="dot" style={{ background: DANGER }} /> Zona de perigo vascular</span>}
            <span className="item"><span className="dot" style={{ background: LIG_COLOR }} /> Ligamento de retenção (✕)</span>
          </div>
        </div>

        {/* ---- Painel lateral ---- */}
        <div>
          {editing ? (
            <Editor p={editing} catalogo={catalogo} view={view} onChange={atualizarPonto} addCatalogo={addCatalogo}
              onClose={() => setEditingId(null)} onDelete={() => excluir(editing.id)} />
          ) : (
            <div className="panel">
              <h2>Nada selecionado</h2>
              <p className="muted" style={{ fontSize: 13 }}>Toque no rosto para um bolus, arraste para um trajeto, ou toque numa marcação para editar.</p>
            </div>
          )}

          <div className="panel">
            <h2>Por região</h2>
            {porRegiao.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Sem aplicações ainda.</p> : (
              <ul className="mk-list">
                {porRegiao.map((r, i) => (
                  <li key={i}>
                    <span className="dot" style={{ background: TIPOS[r.tipo].cor }} />
                    <span className="grow">{r.regiao}</span>
                    <b>{+r.dose.toFixed(1)} {TIPOS[r.tipo].unidade}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h2>Aplicações ({points.length})</h2>
            {points.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Nada registrado.</p> : (
              <ul className="mk-list">
                {points.map((p) => (
                  <li key={p.id}>
                    <span className="dot" style={{ background: TIPOS[p.tipo].cor }} />
                    <span className="grow">
                      {p.regiao} · <span className="muted">{rotuloProduto(p)} · {p.dose}{TIPOS[p.tipo].unidade}{TIPOS[p.tipo].tecnica ? ` · ${p.tecnica}` : ''} · {p.view}</span>
                    </span>
                    <button className="icon-btn" onClick={() => { setView(p.view); setEditingId(p.id); }}>✎</button>
                    <button className="icon-btn danger" onClick={() => excluir(p.id)}>🗑</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function Editor({ p, catalogo, view, onChange, addCatalogo, onClose, onDelete }) {
  const tipo = TIPOS[p.tipo];
  const marcas = [...new Set(catalogo.map((c) => c.marca))];
  const produtosDaMarca = catalogo.filter((c) => c.marca === p.marca);
  const produtoAtual = catalogo.find((c) => c.marca === p.marca && c.produto === p.produto);

  const [novaMarca, setNovaMarca] = useState(false);
  const [nmMarca, setNmMarca] = useState('');
  const [nmProduto, setNmProduto] = useState('');
  const [nmTipo, setNmTipo] = useState('preenchedor');
  const [novoProduto, setNovoProduto] = useState(false);
  const [npNome, setNpNome] = useState('');

  function escolherMarca(v) {
    if (v === '__nova__') { setNovaMarca(true); return; }
    const prim = catalogo.find((c) => c.marca === v);
    onChange({ marca: v, produto: prim.produto, tipo: prim.tipo });
    setNovoProduto(false);
  }
  function escolherProduto(v) {
    if (v === '__novo__') { setNovoProduto(true); return; }
    const c = catalogo.find((x) => x.marca === p.marca && x.produto === v);
    onChange({ produto: v, tipo: c.tipo });
  }
  function commitNovaMarca() {
    if (!nmMarca.trim() || !nmProduto.trim()) return;
    const c = addCatalogo(nmMarca, nmProduto, nmTipo);
    onChange({ marca: c.marca, produto: c.produto, tipo: c.tipo });
    setNovaMarca(false); setNmMarca(''); setNmProduto('');
  }
  function commitNovoProduto() {
    if (!npNome.trim()) return;
    const c = addCatalogo(p.marca, npNome, p.tipo);
    onChange({ produto: c.produto, tipo: c.tipo });
    setNovoProduto(false); setNpNome('');
  }

  return (
    <div className="panel editor">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Editar · <span className="muted" style={{ fontWeight: 400 }}>{p.forma === 'vetor' ? 'trajeto' : 'bolus'}</span></h2>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>

      {produtoAtual?.aviso && (
        <div className="banner warn" style={{ marginBottom: 10 }}>⚠️ {produtoAtual.aviso}</div>
      )}

      <Field label="Marca">
        <select value={novaMarca ? '__nova__' : p.marca} onChange={(e) => escolherMarca(e.target.value)}>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="__nova__">+ Nova marca…</option>
        </select>
      </Field>
      {novaMarca && (
        <div className="add-box">
          <p>Adicionar nova marca ao catálogo (com dedup)</p>
          <input type="text" value={nmMarca} onChange={(e) => setNmMarca(e.target.value)} placeholder="Marca (ex.: Rennova)" autoFocus />
          <input type="text" value={nmProduto} onChange={(e) => setNmProduto(e.target.value)} placeholder="Primeiro produto (ex.: Elleva)" />
          <select value={nmTipo} onChange={(e) => setNmTipo(e.target.value)}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="row">
            <button className="primary" onClick={commitNovaMarca}>+ Adicionar e usar</button>
            <button onClick={() => setNovaMarca(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {!novaMarca && (
        <Field label="Produto">
          <select value={novoProduto ? '__novo__' : p.produto} onChange={(e) => escolherProduto(e.target.value)}>
            {produtosDaMarca.map((c) => <option key={c.id} value={c.produto}>{c.produto}</option>)}
            <option value="__novo__">+ Novo produto…</option>
          </select>
        </Field>
      )}
      {novoProduto && (
        <div className="add-box">
          <p>Novo produto em <b>{p.marca}</b> ({tipo.label})</p>
          <input type="text" value={npNome} onChange={(e) => setNpNome(e.target.value)} placeholder="Nome do produto / linha" autoFocus />
          <div className="row">
            <button className="primary" onClick={commitNovoProduto}>+ Adicionar e usar</button>
            <button onClick={() => setNovoProduto(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid2">
        <Field label={`Dose (${tipo.unidade})`}>
          <input type="number" step={p.tipo === 'toxina' ? 0.5 : 0.1} min={0} value={p.dose}
            onChange={(e) => onChange({ dose: e.target.value === '' ? 0 : Number(e.target.value) })} />
        </Field>
        <Field label="Região">
          <select value={p.regiao} onChange={(e) => onChange({ regiao: e.target.value })}>
            {REGIOES[view].map((r) => <option key={r.nome} value={r.nome}>{r.nome}</option>)}
          </select>
        </Field>
      </div>

      {tipo.tecnica && (
        <div className="grid2">
          <Field label="Instrumento">
            <select value={p.instrumento} onChange={(e) => onChange({ instrumento: e.target.value })}>
              {['Agulha', 'Cânula'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Plano">
            <select value={p.plano} onChange={(e) => onChange({ plano: e.target.value })}>
              {['Derme', 'Subcutâneo', 'Supraperiosteal', 'SMAS', 'Submuscular', '—'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Técnica">
              <select value={p.tecnica} onChange={(e) => onChange({ tecnica: e.target.value })}>
                {['Bolus', 'Retroinjeção linear', 'Leque', 'Cross-hatching', 'Pontos seriados', 'Torre/coluna'].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          </div>
        </div>
      )}

      <div className="grid2">
        <Field label="Lote"><input type="text" value={p.lote} onChange={(e) => onChange({ lote: e.target.value })} placeholder="ex.: ABX123" /></Field>
        <Field label="Validade"><input type="month" value={p.validade} onChange={(e) => onChange({ validade: e.target.value })} /></Field>
      </div>

      <div className="row" style={{ marginTop: 6 }}>
        <button className="primary" style={{ flex: 1 }} onClick={onClose}>✓ Pronto</button>
        <button className="danger" onClick={onDelete}>🗑 Excluir</button>
      </div>
    </div>
  );
}
