import React, { useRef, useState, useMemo, useEffect } from 'react';

// ---------------------------------------------------------------------------
// §2 Mapa facial interativo.
// Atlas desenhado como retrato humano (tom de pele, cabelo, olhos, nariz,
// lábios) com proporções por terços faciais; ligamentos de retenção, sub-
// regiões de lábio e de mento (pogônio, gnátio, menton) e camada opcional de
// zonas de perigo vascular baseada nos artigos compilados.
// Marcações e catálogo são em memória (demonstração); persistência em §3/§5.
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
    { nome: 'Fronte', x: 200, y: 120 }, { nome: 'Glabela', x: 200, y: 165 },
    { nome: 'Supercílio D', x: 170, y: 156 }, { nome: 'Supercílio E', x: 230, y: 156 },
    { nome: 'Têmpora D', x: 122, y: 150 }, { nome: 'Têmpora E', x: 278, y: 150 },
    { nome: 'Pés de galinha D', x: 142, y: 182 }, { nome: 'Pés de galinha E', x: 258, y: 182 },
    { nome: 'Tear trough D', x: 176, y: 192 }, { nome: 'Tear trough E', x: 224, y: 192 },
    { nome: 'Malar D', x: 152, y: 214 }, { nome: 'Malar E', x: 248, y: 214 },
    { nome: 'Dorso nasal', x: 200, y: 200 }, { nome: 'Ponta nasal', x: 200, y: 252 },
    { nome: 'Sulco nasogeniano D', x: 178, y: 260 }, { nome: 'Sulco nasogeniano E', x: 222, y: 260 },
    { nome: 'Filtro', x: 200, y: 280 }, { nome: 'Arco do cupido', x: 200, y: 294 },
    { nome: 'Lábio superior D', x: 191, y: 296 }, { nome: 'Lábio superior E', x: 209, y: 296 },
    { nome: 'Vermelhão superior', x: 200, y: 298 }, { nome: 'Lábio inferior', x: 200, y: 306 },
    { nome: 'Comissura D', x: 174, y: 300 }, { nome: 'Comissura E', x: 226, y: 300 },
    { nome: 'Sulco mentolabial', x: 200, y: 316 },
    { nome: 'Masseter D', x: 140, y: 272 }, { nome: 'Masseter E', x: 260, y: 272 },
    { nome: 'Linha mandibular D', x: 158, y: 302 }, { nome: 'Linha mandibular E', x: 242, y: 302 },
    { nome: 'Pré-jowl D', x: 168, y: 320 }, { nome: 'Pré-jowl E', x: 232, y: 320 },
    { nome: 'Pogônio', x: 200, y: 328 }, { nome: 'Gnátio', x: 200, y: 335 }, { nome: 'Menton', x: 200, y: 341 },
  ],
  perfil: [
    { nome: 'Fronte', x: 250, y: 120 }, { nome: 'Supercílio', x: 250, y: 160 },
    { nome: 'Têmpora', x: 292, y: 150 }, { nome: 'Pés de galinha', x: 272, y: 182 },
    { nome: 'Zigomático', x: 260, y: 214 }, { nome: 'Pré-auricular', x: 300, y: 224 },
    { nome: 'Dorso nasal', x: 198, y: 205 }, { nome: 'Ponta nasal', x: 184, y: 234 },
    { nome: 'Sulco nasogeniano', x: 206, y: 260 }, { nome: 'Lábio superior', x: 194, y: 288 },
    { nome: 'Lábio inferior', x: 194, y: 300 }, { nome: 'Comissura', x: 210, y: 296 },
    { nome: 'Sulco mentolabial', x: 202, y: 318 }, { nome: 'Masseter', x: 296, y: 300 },
    { nome: 'Linha mandibular', x: 272, y: 345 },
    { nome: 'Pogônio', x: 198, y: 335 }, { nome: 'Gnátio', x: 203, y: 345 }, { nome: 'Menton', x: 212, y: 352 },
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
const SKIN_STROKE = '#b3866a';
const FEAT = '#7d5a49';         // traço das feições
const FEAT_SOFT = '#a07a66';
const HAIR = '#4a3a30';
const LIPS = '#cf9082';
const THIRDS = '#a9846b';
const LABEL = '#5f4636';

function MapDefs() {
  return (
    <defs>
      <radialGradient id="skin" cx="50%" cy="42%" r="66%">
        <stop offset="0%" stopColor="#f3d5bd" />
        <stop offset="66%" stopColor="#e6bd9d" />
        <stop offset="100%" stopColor="#d0a07f" />
      </radialGradient>
      <radialGradient id="skinP" cx="46%" cy="42%" r="68%">
        <stop offset="0%" stopColor="#f1d2ba" />
        <stop offset="70%" stopColor="#e3ba9a" />
        <stop offset="100%" stopColor="#cd9d7c" />
      </radialGradient>
    </defs>
  );
}

// --------- Atlas frontal (retrato) ---------
function AtlasFrontal({ rotulos }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* Pescoço */}
      <path d="M172 330 C172 350 170 362 164 378 L236 378 C230 362 228 350 228 330 Z" fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.2" opacity="0.96" />
      {/* Orelhas */}
      <path d="M118 196 C106 192 104 210 110 224 C114 234 122 236 128 232" fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.2" />
      <path d="M282 196 C294 192 296 210 290 224 C286 234 278 236 272 232" fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.2" />

      {/* Rosto (pele) */}
      <path d="M200 80 C168 78 138 88 128 114 C118 140 116 166 120 196 C124 224 132 255 150 286
               C164 315 184 335 200 341 C216 335 236 315 250 286 C268 255 276 224 280 196
               C284 166 282 140 272 114 C262 88 232 78 200 80 Z"
        fill="url(#skin)" stroke={SKIN_STROKE} strokeWidth="1.6" />

      {/* Sombreamento suave das maçãs do rosto */}
      <g fill="#c78f6d" opacity="0.10"><ellipse cx="152" cy="216" rx="17" ry="10" /><ellipse cx="248" cy="216" rx="17" ry="10" /></g>

      {/* Cabelo */}
      <path d="M120 118 C106 62 150 30 200 30 C250 30 294 62 280 118
               C274 102 260 90 242 84 C234 72 218 68 200 68 C182 68 166 72 158 84
               C140 90 126 102 120 118 Z" fill={HAIR} />

      {/* Terços faciais (referência) */}
      <g stroke={THIRDS} strokeWidth="1" strokeDasharray="4 5" opacity="0.5" fill="none">
        <line x1="122" y1="166" x2="278" y2="166" />
        <line x1="128" y1="256" x2="272" y2="256" />
      </g>

      {/* Sobrancelhas */}
      <path d="M150 161 C162 152 178 151 189 157 C178 155 162 157 151 165 Z" fill={HAIR} opacity="0.85" />
      <path d="M250 161 C238 152 222 151 211 157 C222 155 238 157 249 165 Z" fill={HAIR} opacity="0.85" />

      {/* Olhos */}
      <g fill="none" stroke={FEAT} strokeWidth="1.4">
        <path d="M150 181 C158 173 176 173 184 180 C176 188 158 188 150 181 Z" fill="#f7efe6" />
        <path d="M216 181 C224 173 242 173 250 181 C242 188 224 188 216 181 Z" fill="#f7efe6" />
        <path d="M151 178 C160 172 176 172 185 178" stroke={FEAT_SOFT} strokeWidth="0.9" />
        <path d="M215 178 C224 172 240 172 249 178" stroke={FEAT_SOFT} strokeWidth="0.9" />
      </g>
      <circle cx="167" cy="181" r="6" fill="#6b4a34" /><circle cx="167" cy="181" r="2.6" fill="#241a14" /><circle cx="169" cy="179" r="1" fill="#fff" />
      <circle cx="233" cy="181" r="6" fill="#6b4a34" /><circle cx="233" cy="181" r="2.6" fill="#241a14" /><circle cx="235" cy="179" r="1" fill="#fff" />

      {/* Nariz */}
      <g fill="none" stroke={FEAT_SOFT} strokeWidth="1.2">
        <path d="M194 172 C193 192 192 212 190 232" /><path d="M206 172 C207 192 208 212 210 232" />
        <path d="M190 232 C187 244 191 253 200 255 C209 253 213 244 210 232" stroke={FEAT} />
        <path d="M190 243 C183 243 180 250 185 255 C189 257 192 254 193 250" />
        <path d="M210 243 C217 243 220 250 215 255 C211 257 208 254 207 250" />
      </g>
      <ellipse cx="190" cy="251" rx="2.2" ry="1.4" fill="#8a6653" /><ellipse cx="210" cy="251" rx="2.2" ry="1.4" fill="#8a6653" />

      {/* Filtro */}
      <g stroke={FEAT_SOFT} strokeWidth="0.8" fill="none" opacity="0.75"><path d="M196 260 L195 290" /><path d="M204 260 L205 290" /></g>

      {/* Lábios */}
      <g stroke="#a76b5f" strokeWidth="1.1">
        <path d="M173 298 C183 291 191 291 200 296 C209 291 217 291 227 298 C214 304 186 304 173 298 Z" fill={LIPS} />
        <path d="M173 298 C186 312 214 312 227 298 C214 304 186 304 173 298 Z" fill={LIPS} />
        <path d="M173 298 C186 301 214 301 227 298" stroke="#8f5a50" fill="none" />
      </g>

      {/* Sulco mentolabial */}
      <g fill="none" stroke={FEAT_SOFT} strokeWidth="1.1" opacity="0.7"><path d="M180 316 C190 322 210 322 220 316" /></g>

      {/* Ligamentos de retenção (✕): zigomático, zigomático-cutâneo, masseterino, mandibular */}
      <Ligaments pontos={[[128, 206], [272, 206], [150, 224], [250, 224], [140, 272], [260, 272], [168, 316], [232, 316]]} />

      {rotulos && (
        <g fill={LABEL} fontSize="7.5" fontWeight="600">
          <text x="284" y="130">terço superior</text>
          <text x="284" y="214">terço médio</text>
          <text x="284" y="320">terço inferior</text>
          <text x="200" y="286" textAnchor="middle" fontWeight="400">filtro</text>
          <text x="200" y="329" textAnchor="middle">pogônio</text>
          <text x="200" y="337" textAnchor="middle">gnátio</text>
          <text x="200" y="349" textAnchor="middle">menton</text>
        </g>
      )}
    </g>
  );
}

// --------- Atlas perfil (retrato de lado, face à esquerda) ---------
function AtlasPerfil({ rotulos }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* Pescoço */}
      <path d="M242 356 C244 372 242 382 238 392 L322 392 L322 342 C314 352 300 356 282 356 Z"
        fill="url(#skinP)" stroke={SKIN_STROKE} strokeWidth="1.2" opacity="0.96" />

      {/* Rosto (pele), face voltada à esquerda */}
      <path d="M238 78 C226 92 220 120 220 150 C220 160 219 166 221 171
               C210 182 194 202 184 224 C180 231 180 236 186 240
               C190 243 193 247 196 256 C192 268 189 278 191 288
               C193 296 193 300 190 304 C188 310 192 316 197 320
               C196 330 195 340 203 347 C211 354 226 358 242 358
               C273 358 298 346 306 320 C316 298 324 250 320 188
               C317 120 296 74 250 74 C246 74 242 76 238 78 Z"
        fill="url(#skinP)" stroke={SKIN_STROKE} strokeWidth="1.6" />

      {/* Sombreamento suave */}
      <g fill="#c78f6d" opacity="0.10"><ellipse cx="258" cy="238" rx="20" ry="13" /></g>

      {/* Cabelo */}
      <path d="M220 150 C214 92 250 46 292 56 C330 66 342 122 320 188
               C324 140 308 100 286 90 C266 80 244 82 230 108 C224 120 221 134 220 150 Z" fill={HAIR} />

      {/* Orelha */}
      <path d="M292 216 C283 214 280 229 286 243 C290 253 300 255 305 249 C310 242 309 223 300 218 C298 216 295 216 292 216 Z"
        fill="url(#skinP)" stroke={SKIN_STROKE} strokeWidth="1.2" />
      <path d="M294 226 C291 230 292 240 297 244" fill="none" stroke={FEAT_SOFT} strokeWidth="0.9" />

      {/* Terços faciais */}
      <g stroke={THIRDS} strokeWidth="1" strokeDasharray="4 5" opacity="0.45" fill="none">
        <line x1="212" y1="168" x2="322" y2="168" />
        <line x1="196" y1="258" x2="322" y2="258" />
      </g>

      {/* Sobrancelha + olho */}
      <path d="M228 160 C238 154 252 154 262 159 C252 157 238 158 229 164 Z" fill={HAIR} opacity="0.85" />
      <path d="M232 178 C240 173 250 174 257 179 C250 183 240 183 232 178 Z" fill="#f7efe6" stroke={FEAT} strokeWidth="1.1" />
      <circle cx="244" cy="179" r="4" fill="#6b4a34" /><circle cx="244" cy="179" r="1.8" fill="#241a14" />

      {/* Narina */}
      <path d="M188 240 C193 243 199 241 199 236" fill="none" stroke={FEAT} strokeWidth="1.1" />
      <ellipse cx="192" cy="242" rx="2.2" ry="1.4" fill="#8a6653" />

      {/* Lábios */}
      <g fill={LIPS} stroke="#a76b5f" strokeWidth="1">
        <path d="M190 286 C196 283 202 284 203 288 C199 291 193 292 189 291 Z" />
        <path d="M190 298 C196 302 202 303 203 300 C200 306 193 307 189 303 Z" />
      </g>

      {/* Sulco mentolabial */}
      <path d="M198 318 C202 322 208 322 212 316" fill="none" stroke={FEAT_SOFT} strokeWidth="1.1" opacity="0.7" />

      {/* Ligamentos */}
      <Ligaments pontos={[[286, 150], [258, 216], [293, 300], [246, 344]]} />

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
      <path d="M152 300 C160 292 170 298 176 298 C182 286 186 272 188 256" />
      <path d="M248 300 C240 292 230 298 224 298 C218 286 214 272 212 256" />
      <path d="M188 256 C186 234 185 208 187 186 C188 176 190 170 191 162" />
      <path d="M212 256 C214 234 215 208 213 186 C212 176 210 170 209 162" />
      <path d="M200 204 L200 250" strokeDasharray="3 3" />
      <path d="M174 296 C186 292 214 292 226 296" strokeOpacity="0.4" />
      <path d="M174 301 C186 308 214 308 226 301" strokeOpacity="0.4" />
    </g>
  );
}
function DangerPerfil() {
  return (
    <g fill="none" stroke={DANGER} strokeWidth="2.6" strokeOpacity="0.55" strokeLinecap="round">
      <path d="M300 248 C296 214 288 178 278 150" />
      <path d="M270 352 C250 330 224 306 210 298 C202 290 198 272 196 256" />
      <path d="M196 256 C196 234 197 210 206 188" />
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
                    <line data-point="1" x1={p.x} y1={p.y} x2={p.x2} y2={p.y2} stroke={cor} strokeOpacity={0.8} strokeWidth={sel ? 7 : 5} strokeLinecap="round" />
                    <circle data-point="1" cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={cor} strokeWidth={2} />
                    <text x={mx + 6} y={my - 6} fontSize="10" fontWeight="700" fill={cor} stroke="#fff" strokeWidth="0.5" pointerEvents="none">{p.dose}</text>
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
              <line x1={draft.x} y1={draft.y} x2={draft.x2} y2={draft.y2} stroke="#33251d" strokeOpacity={0.6} strokeWidth={4} strokeDasharray="4 4" strokeLinecap="round" />
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
