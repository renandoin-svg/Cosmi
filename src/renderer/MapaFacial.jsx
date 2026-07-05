import React, { useRef, useState, useMemo, useEffect } from 'react';

// ---------------------------------------------------------------------------
// §2 Mapa facial interativo.
// Atlas desenhado sobre um grid de proporções (cânones neoclássicos: terços
// verticais iguais tricóton–glabela–subnasal–mento; quintos horizontais, cada
// um = uma largura de olho; nariz ≈ 1 quinto; boca ≈ 1,5× largura do nariz).
// Feições espelhadas para simetria. Ligamentos de retenção, sub-regiões de
// lábio e de mento (pogônio, gnátio, menton) e camada opcional de zonas de
// perigo vascular. Marcações/catálogo em memória (demo); persistência em §3/§5.
// ---------------------------------------------------------------------------

const TIPOS = {
  toxina:         { label: 'Toxina',         cor: '#2f9e8f', unidade: 'U',  tecnica: false },
  preenchedor:    { label: 'Preenchedor',    cor: '#e08a2b', unidade: 'ml', tecnica: true  },
  bioestimulador: { label: 'Bioestimulador', cor: '#9b6be0', unidade: 'ml', tecnica: true  },
  outro:          { label: 'Outro',          cor: '#8894a0', unidade: 'un', tecnica: false },
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

// Âncoras de região (base da sugestão automática). "D" = direito do paciente
// (à esquerda na imagem frontal). Coordenadas no viewBox 0 0 400 460.
const REGIOES = {
  frontal: [
    { nome: 'Fronte', x: 200, y: 120 }, { nome: 'Glabela', x: 200, y: 168 },
    { nome: 'Supercílio D', x: 170, y: 166 }, { nome: 'Supercílio E', x: 230, y: 166 },
    { nome: 'Têmpora D', x: 126, y: 150 }, { nome: 'Têmpora E', x: 274, y: 150 },
    { nome: 'Pés de galinha D', x: 150, y: 188 }, { nome: 'Pés de galinha E', x: 250, y: 188 },
    { nome: 'Tear trough D', x: 178, y: 196 }, { nome: 'Tear trough E', x: 222, y: 196 },
    { nome: 'Malar D', x: 156, y: 220 }, { nome: 'Malar E', x: 244, y: 220 },
    { nome: 'Dorso nasal', x: 200, y: 205 }, { nome: 'Ponta nasal', x: 200, y: 250 },
    { nome: 'Sulco nasogeniano D', x: 182, y: 260 }, { nome: 'Sulco nasogeniano E', x: 218, y: 260 },
    { nome: 'Filtro', x: 200, y: 266 }, { nome: 'Arco do cupido', x: 200, y: 278 },
    { nome: 'Lábio superior D', x: 192, y: 279 }, { nome: 'Lábio superior E', x: 208, y: 279 },
    { nome: 'Vermelhão superior', x: 200, y: 280 }, { nome: 'Lábio inferior', x: 200, y: 290 },
    { nome: 'Comissura D', x: 180, y: 283 }, { nome: 'Comissura E', x: 220, y: 283 },
    { nome: 'Sulco mentolabial', x: 200, y: 308 },
    { nome: 'Masseter D', x: 150, y: 270 }, { nome: 'Masseter E', x: 250, y: 270 },
    { nome: 'Linha mandibular D', x: 162, y: 300 }, { nome: 'Linha mandibular E', x: 238, y: 300 },
    { nome: 'Pré-jowl D', x: 172, y: 312 }, { nome: 'Pré-jowl E', x: 228, y: 312 },
    { nome: 'Pogônio', x: 200, y: 320 }, { nome: 'Gnátio', x: 200, y: 328 }, { nome: 'Menton', x: 200, y: 334 },
  ],
  perfil: [
    { nome: 'Fronte', x: 250, y: 120 }, { nome: 'Supercílio', x: 245, y: 160 },
    { nome: 'Têmpora', x: 292, y: 150 }, { nome: 'Pés de galinha', x: 272, y: 182 },
    { nome: 'Zigomático', x: 262, y: 214 }, { nome: 'Pré-auricular', x: 300, y: 224 },
    { nome: 'Dorso nasal', x: 200, y: 200 }, { nome: 'Ponta nasal', x: 188, y: 224 },
    { nome: 'Sulco nasogeniano', x: 204, y: 258 }, { nome: 'Lábio superior', x: 196, y: 286 },
    { nome: 'Lábio inferior', x: 196, y: 298 }, { nome: 'Comissura', x: 210, y: 292 },
    { nome: 'Sulco mentolabial', x: 204, y: 316 }, { nome: 'Masseter', x: 296, y: 300 },
    { nome: 'Linha mandibular', x: 272, y: 344 },
    { nome: 'Pogônio', x: 200, y: 336 }, { nome: 'Gnátio', x: 205, y: 344 }, { nome: 'Menton', x: 214, y: 352 },
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

const LIG_COLOR = '#3a86c8';   // ligamentos de retenção (✕)
const DANGER = '#e0554f';      // zonas de perigo vascular
const SKIN_STROKE = '#b98a6d';
const HAIR = '#4a3a30';
const THIRDS = '#b58e72';
const LABEL = '#5f4636';

function MapDefs() {
  return (
    <defs>
      <radialGradient id="skin" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stopColor="#f6dcc6" /><stop offset="70%" stopColor="#eec4a4" /><stop offset="100%" stopColor="#dcae8b" />
      </radialGradient>
      <radialGradient id="skinP" cx="46%" cy="42%" r="70%">
        <stop offset="0%" stopColor="#f4d8c1" /><stop offset="70%" stopColor="#e9c1a1" /><stop offset="100%" stopColor="#d7a986" />
      </radialGradient>
      {/* Meia-face direita (sobrancelha + olho) — espelhada para simetria perfeita */}
      <g id="halfR" fill="none" stroke="#7a5342" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M216 168 C226 161 240 160 248 166 C240 164 226 165 217 171 Z" fill="#5b4436" stroke="none" />
        <path d="M215 187 C224 178 240 178 246 186 C240 193 224 193 215 187 Z" fill="#fbf4ec" />
        <path d="M216 184 C225 178 239 178 246 184" stroke="#a07a66" strokeWidth="0.9" />
        <circle cx="230" cy="186" r="6.6" fill="#5f4130" stroke="none" />
        <circle cx="230" cy="186" r="2.9" fill="#211712" stroke="none" />
        <circle cx="232" cy="184" r="1.1" fill="#fff" stroke="none" />
      </g>
    </defs>
  );
}

// --------- Atlas frontal ---------
function AtlasFrontal({ rotulos }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* Pescoço */}
      <path d="M174 330 C174 350 172 362 166 380 L234 380 C228 362 226 350 226 330 Z" fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.2" opacity="0.97" />
      {/* Orelhas */}
      <path d="M124 198 C112 194 110 214 116 228 C120 238 128 240 134 236" fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.2" />
      <path d="M276 198 C288 194 290 214 284 228 C280 238 272 240 266 236" fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.2" />
      {/* Rosto */}
      <path d="M200 46 C152 46 122 74 118 118 C114 150 118 180 126 206 C132 232 142 262 160 292
               C170 312 180 326 190 333 C194 336 206 336 210 333 C220 326 230 312 240 292
               C258 262 268 232 274 206 C282 180 286 150 282 118 C278 74 248 46 200 46 Z"
        fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.7" />
      {/* Sombreado das maçãs */}
      <g fill="#cf9a78" opacity="0.12"><ellipse cx="156" cy="222" rx="16" ry="10" /><ellipse cx="244" cy="222" rx="16" ry="10" /></g>
      {/* Cabelo */}
      <path d="M118 118 C110 58 154 32 200 32 C246 32 290 58 282 118 C276 98 262 86 244 82
               C236 72 220 70 200 70 C180 70 164 72 156 82 C138 86 124 98 118 118 Z" fill={HAIR} />
      {/* Terços */}
      <g stroke={THIRDS} strokeWidth="1" strokeDasharray="4 6" opacity="0.45" fill="none">
        <line x1="126" y1="172" x2="274" y2="172" /><line x1="132" y1="256" x2="268" y2="256" />
      </g>
      {/* Nariz (simétrico): dorso, asas, base, columela */}
      <g fill="none" stroke="#c79a7d" strokeWidth="1.1">
        <path d="M190 176 C189 200 187 224 186 242" /><path d="M210 176 C211 200 213 224 214 242" />
        <path d="M186 242 C179 244 176 250 181 255 C185 258 190 256 192 251" />
        <path d="M214 242 C221 244 224 250 219 255 C215 258 210 256 208 251" />
      </g>
      <path d="M186 250 C190 258 210 258 214 250 C210 260 190 260 186 250 Z" fill="#dcae8b" stroke="#c79a7d" strokeWidth="0.7" />
      <ellipse cx="189" cy="252" rx="2.3" ry="1.5" fill="#9a715b" /><ellipse cx="211" cy="252" rx="2.3" ry="1.5" fill="#9a715b" />
      {/* Filtro */}
      <g stroke="#c79a7d" strokeWidth="0.8" fill="none" opacity="0.7"><path d="M196 258 L195 274" /><path d="M204 258 L205 274" /></g>
      {/* Lábios (boca ≈ 1,5× largura do nariz) */}
      <g stroke="#b06a5c" strokeWidth="1">
        <path d="M178 282 C186 275 194 276 200 280 C206 276 214 275 222 282 C213 287 187 287 178 282 Z" fill="#d69384" />
        <path d="M178 282 C188 296 212 296 222 282 C213 287 187 287 178 282 Z" fill="#d18b7c" />
        <path d="M178 282 C188 284 212 284 222 282" stroke="#9c5f53" fill="none" />
      </g>
      {/* Sulco mentolabial */}
      <path d="M184 308 C192 314 208 314 216 308" fill="none" stroke="#c79a7d" strokeWidth="1" opacity="0.7" />
      {/* Feições espelhadas */}
      <use href="#halfR" />
      <use href="#halfR" transform="matrix(-1 0 0 1 400 0)" />
      {/* Ligamentos de retenção (✕): zigomático, zigomático-cutâneo, masseterino, mandibular */}
      <Ligaments pontos={[[134, 209], [266, 209], [157, 229], [243, 229], [149, 279], [251, 279], [173, 315], [227, 315]]} />

      {rotulos && (
        <g fill={LABEL} fontSize="7.5" fontWeight="600">
          <text x="282" y="130">terço superior</text>
          <text x="282" y="216">terço médio</text>
          <text x="282" y="312">terço inferior</text>
          <text x="200" y="272" textAnchor="middle" fontWeight="400">filtro</text>
          <text x="200" y="322" textAnchor="middle">pogônio</text>
          <text x="200" y="330" textAnchor="middle">gnátio</text>
          <text x="200" y="343" textAnchor="middle">menton</text>
        </g>
      )}
    </g>
  );
}

// --------- Atlas perfil (face à esquerda) ---------
function AtlasPerfil({ rotulos }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* Pescoço */}
      <path d="M244 356 C246 372 244 382 240 392 L322 392 L322 344 C314 354 300 358 284 358 Z"
        fill="url(#skinP)" stroke={SKIN_STROKE} strokeWidth="1.2" opacity="0.97" />
      {/* Contorno de perfil construído nos terços */}
      <path d="M244 60 C224 66 214 92 214 120 C214 138 214 152 216 166
               C210 178 198 196 190 214 C186 221 186 228 192 233
               C196 237 199 244 200 254 C197 266 194 276 196 286
               C198 294 198 298 195 302 C193 308 197 314 202 318
               C201 328 200 338 207 346 C214 353 228 357 244 357
               C275 357 300 344 307 316 C316 292 322 248 318 186
               C314 120 296 66 258 60 C253 59 248 59 244 60 Z"
        fill="url(#skinP)" stroke={SKIN_STROKE} strokeWidth="1.7" />
      {/* Sombreado */}
      <g fill="#cf9a78" opacity="0.12"><ellipse cx="264" cy="238" rx="20" ry="13" /></g>
      {/* Cabelo */}
      <path d="M214 122 C210 68 250 42 293 53 C333 64 344 132 320 190 C320 150 312 112 291 99
               C269 85 241 90 227 113 C223 120 217 128 214 122 Z" fill={HAIR} />
      {/* Orelha */}
      <path d="M294 214 C284 212 281 228 287 243 C291 254 302 256 307 249 C312 242 311 222 302 217 C300 215 297 214 294 214 Z"
        fill="url(#skinP)" stroke={SKIN_STROKE} strokeWidth="1.2" />
      <path d="M296 225 C293 230 294 240 299 244" fill="none" stroke="#c79a7d" strokeWidth="0.9" />
      {/* Terços */}
      <g stroke={THIRDS} strokeWidth="1" strokeDasharray="4 6" opacity="0.4" fill="none">
        <line x1="206" y1="168" x2="322" y2="168" /><line x1="192" y1="254" x2="322" y2="254" />
      </g>
      {/* Sobrancelha + olho */}
      <path d="M226 160 C236 154 250 154 260 159 C250 157 236 158 227 164 Z" fill="#5b4436" />
      <path d="M230 176 C238 171 248 172 255 177 C248 181 238 181 230 176 Z" fill="#fbf4ec" stroke="#7a5342" strokeWidth="1.1" />
      <circle cx="242" cy="177" r="4.2" fill="#5f4130" /><circle cx="242" cy="177" r="1.9" fill="#211712" />
      {/* Narina */}
      <path d="M181 238 C186 241 193 239 193 234" fill="none" stroke="#7a5342" strokeWidth="1.1" />
      <ellipse cx="185" cy="240" rx="2.3" ry="1.5" fill="#9a715b" />
      {/* Lábios */}
      <g fill="#d69384" stroke="#b06a5c" strokeWidth="1">
        <path d="M188 284 C194 281 201 282 202 286 C198 289 192 290 187 289 Z" />
        <path d="M188 296 C194 300 201 301 202 298 C199 304 192 305 187 301 Z" />
      </g>
      {/* Sulco mentolabial */}
      <path d="M196 316 C200 320 207 320 211 314" fill="none" stroke="#c79a7d" strokeWidth="1" opacity="0.7" />
      {/* Ligamentos */}
      <Ligaments pontos={[[289, 153], [261, 219], [295, 303], [251, 345]]} />

      {rotulos && (
        <g fill={LABEL} fontSize="7.5" fontWeight="600">
          <text x="216" y="337">pogônio</text>
          <text x="216" y="348">gnátio</text>
          <text x="216" y="360">menton</text>
        </g>
      )}
    </g>
  );
}

function Ligaments({ pontos }) {
  return (
    <g stroke={LIG_COLOR} strokeWidth="1.5" opacity="0.9">
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
// Artéria facial cruza a mandíbula à frente do masseter, sobe lateral à
// comissura rumo à asa nasal; vira artéria angular até o canto medial,
// anastomosando com a supratroclear/dorsal nasal. Arcadas labiais sup./inf.
function DangerFrontal() {
  return (
    <g fill="none" stroke={DANGER} strokeWidth="2.6" strokeOpacity="0.55" strokeLinecap="round">
      <path d="M156 300 C164 292 174 288 180 284 C185 272 187 260 188 250" />
      <path d="M244 300 C236 292 226 288 220 284 C215 272 213 260 212 250" />
      <path d="M188 250 C186 230 185 208 187 186 C188 178 190 172 191 168" />
      <path d="M212 250 C214 230 215 208 213 186 C212 178 210 172 209 168" />
      <path d="M200 190 L200 250" strokeDasharray="3 3" />
      <path d="M178 280 C188 276 212 276 222 280" strokeOpacity="0.4" />
      <path d="M178 284 C188 292 212 292 222 284" strokeOpacity="0.4" />
    </g>
  );
}
function DangerPerfil() {
  return (
    <g fill="none" stroke={DANGER} strokeWidth="2.6" strokeOpacity="0.55" strokeLinecap="round">
      <path d="M300 246 C296 212 288 176 278 150" />
      <path d="M262 352 C244 330 220 300 205 288 C198 280 194 264 192 250" />
      <path d="M192 250 C192 230 194 208 202 190" />
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
            <MapDefs />
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
                    <line data-point="1" x1={p.x} y1={p.y} x2={p.x2} y2={p.y2} stroke={cor} strokeOpacity={0.85} strokeWidth={sel ? 7 : 5} strokeLinecap="round" />
                    <circle data-point="1" cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={cor} strokeWidth={2} />
                    <text x={mx + 6} y={my - 6} fontSize="10" fontWeight="700" fill={cor} stroke="#0e1116" strokeWidth="0.5" pointerEvents="none">{p.dose}</text>
                  </g>
                );
              }
              return (
                <g key={p.id}>
                  <circle data-point="1" cx={p.x} cy={p.y} r={raioPonto(p)} fill={cor} fillOpacity={0.62} stroke={cor} strokeWidth={sel ? 3 : 1.5}
                    onPointerDown={(e) => { e.stopPropagation(); setEditingId(p.id); }} style={{ cursor: 'pointer' }} />
                  <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" pointerEvents="none">{p.dose}</text>
                </g>
              );
            })}
            {draft && Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > THRESHOLD && (
              <line x1={draft.x} y1={draft.y} x2={draft.x2} y2={draft.y2} stroke="#1a2733" strokeOpacity={0.7} strokeWidth={4} strokeDasharray="4 4" strokeLinecap="round" />
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
