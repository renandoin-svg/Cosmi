import React, { useRef, useState, useMemo } from "react";
import { Trash2, Pencil, X, RotateCcw, AlertTriangle, Check, MousePointerClick, Plus } from "lucide-react";

// ---------------------------------------------------------------------------
// PROTÓTIPO v3 — Mapa facial + catálogo Marca→Produto com "adicionar" (não texto solto)
// Valida: cascata de produto, "Outros" = adicionar ao catálogo (dedup), bolus/vetor,
// técnica, sub-regiões. NÃO persiste entre recarregamentos. Sem dados reais.
// O catálogo abaixo é ILUSTRATIVO (marcas reais pesquisadas); o CSV-semente verificado
// para o Brasil é entregue à parte.
// ---------------------------------------------------------------------------

const TIPOS = {
  toxina:        { label: "Toxina",         cor: "#0d9488", unidade: "U",  tecnica: false },
  preenchedor:   { label: "Preenchedor",    cor: "#d97706", unidade: "ml", tecnica: true  },
  bioestimulador:{ label: "Bioestimulador", cor: "#7c3aed", unidade: "ml", tecnica: true  },
  outro:         { label: "Outro",          cor: "#64748b", unidade: "un", tecnica: false },
};

// Catálogo-semente ilustrativo: [marca, produto, tipo]
const SEED = [
  ["Restylane", "Lyft", "preenchedor"], ["Restylane", "Defyne", "preenchedor"],
  ["Restylane", "Refyne", "preenchedor"], ["Restylane", "Kysse", "preenchedor"],
  ["Restylane", "Volyme", "preenchedor"], ["Restylane", "Shaype", "preenchedor"],
  ["Restylane", "Restylane clássico", "preenchedor"], ["Restylane", "Skinbooster Vital", "preenchedor"],
  ["Restylane", "Skinbooster Vital Light", "preenchedor"],
  ["Juvéderm", "Voluma", "preenchedor"], ["Juvéderm", "Volift", "preenchedor"],
  ["Juvéderm", "Volbella", "preenchedor"], ["Juvéderm", "Ultra XC", "preenchedor"],
  ["Juvéderm", "Ultra Plus XC", "preenchedor"], ["Juvéderm", "Volux", "preenchedor"],
  ["Juvéderm", "Skinvive", "preenchedor"],
  ["Belotero", "Balance", "preenchedor"], ["Belotero", "Intense", "preenchedor"],
  ["Belotero", "Volume", "preenchedor"], ["Belotero", "Soft", "preenchedor"],
  ["Belotero", "Lips Shape", "preenchedor"], ["Belotero", "Lips Contour", "preenchedor"],
  ["Belotero", "Revive", "preenchedor"],
  ["Sculptra", "Sculptra (frasco)", "bioestimulador"],
  ["Radiesse", "Radiesse", "bioestimulador"], ["Radiesse", "Radiesse (+) Lido", "bioestimulador"],
  ["Ellansé", "S", "bioestimulador"], ["Ellansé", "M", "bioestimulador"],
  ["Ellansé", "L", "bioestimulador"], ["Ellansé", "E", "bioestimulador"],
  ["Botox", "Botox", "toxina"], ["Dysport", "Dysport", "toxina"], ["Xeomin", "Xeomin", "toxina"],
  ["Botulift", "Botulift", "toxina"], ["Prosigne", "Prosigne", "toxina"],
];
const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

const REGIOES = {
  frontal: [
    { nome: "Fronte", x: 200, y: 120 }, { nome: "Glabela", x: 200, y: 170 },
    { nome: "Supercílio D", x: 150, y: 178 }, { nome: "Supercílio E", x: 250, y: 178 },
    { nome: "Têmpora D", x: 100, y: 165 }, { nome: "Têmpora E", x: 300, y: 165 },
    { nome: "Pés de galinha D", x: 110, y: 200 }, { nome: "Pés de galinha E", x: 290, y: 200 },
    { nome: "Tear trough D", x: 165, y: 222 }, { nome: "Tear trough E", x: 235, y: 222 },
    { nome: "Dorso nasal", x: 200, y: 235 }, { nome: "Ponta nasal", x: 200, y: 258 },
    { nome: "Malar D", x: 128, y: 248 }, { nome: "Malar E", x: 272, y: 248 },
    { nome: "Sulco nasogeniano D", x: 168, y: 282 }, { nome: "Sulco nasogeniano E", x: 232, y: 282 },
    { nome: "Filtro", x: 200, y: 296 }, { nome: "Arco do cupido", x: 200, y: 304 },
    { nome: "Lábio superior D", x: 184, y: 309 }, { nome: "Lábio superior E", x: 216, y: 309 },
    { nome: "Lábio inferior", x: 200, y: 324 },
    { nome: "Comissura D", x: 168, y: 316 }, { nome: "Comissura E", x: 232, y: 316 },
    { nome: "Sulco mentolabial", x: 200, y: 350 },
    { nome: "Pré-jowl D", x: 150, y: 368 }, { nome: "Pré-jowl E", x: 250, y: 368 },
    { nome: "Pogônio", x: 200, y: 378 }, { nome: "Menton", x: 200, y: 402 },
    { nome: "Masseter D", x: 112, y: 320 }, { nome: "Masseter E", x: 288, y: 320 },
    { nome: "Linha mandibular D", x: 138, y: 350 }, { nome: "Linha mandibular E", x: 262, y: 350 },
  ],
  perfil: [
    { nome: "Fronte", x: 235, y: 130 }, { nome: "Têmpora", x: 285, y: 165 },
    { nome: "Pés de galinha", x: 270, y: 200 }, { nome: "Zigomático", x: 232, y: 245 },
    { nome: "Pré-auricular", x: 315, y: 235 }, { nome: "Sulco nasogeniano", x: 200, y: 280 },
    { nome: "Lábios", x: 178, y: 300 }, { nome: "Sulco mentolabial", x: 185, y: 345 },
    { nome: "Pogônio", x: 178, y: 372 }, { nome: "Menton", x: 195, y: 392 },
    { nome: "Linha mandibular", x: 270, y: 360 }, { nome: "Masseter", x: 300, y: 320 },
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
const rotuloProduto = (p) => `${p.marca} ${p.produto}`.trim();
function raioPonto(p) {
  if (p.tipo === "toxina") return 5 + Math.min(p.dose, 20) * 0.55;
  return 6 + Math.min(p.dose, 4) * 5;
}

function FaceFrontal() {
  return (
    <g fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M200 70 C120 70 105 160 110 230 C114 300 150 410 200 415 C250 410 286 300 290 230 C295 160 280 70 200 70 Z" />
      <path d="M122 110 C150 78 250 78 278 110" strokeWidth="1.5" />
      <path d="M120 175 C140 165 168 165 184 174" /><path d="M216 174 C232 165 260 165 280 175" />
      <ellipse cx="152" cy="198" rx="20" ry="11" /><ellipse cx="248" cy="198" rx="20" ry="11" />
      <path d="M200 205 L200 252 M200 252 C188 262 178 262 172 256 M200 252 C212 262 222 262 228 256" />
      <path d="M168 312 C182 305 192 305 200 308 C208 305 218 305 232 312" strokeWidth="1.5" />
      <path d="M168 312 C188 322 212 322 232 312" />
      <path d="M168 312 C184 318 216 318 232 312 C212 330 188 330 168 312 Z" strokeWidth="1.2" opacity="0.85" />
      <path d="M194 296 L194 308 M206 296 L206 308" strokeWidth="1" opacity="0.6" />
      <path d="M150 250 C140 280 150 300 168 312" strokeWidth="1.4" opacity="0.6" />
      <path d="M250 250 C260 280 250 300 232 312" strokeWidth="1.4" opacity="0.6" />
      <path d="M176 348 C188 356 212 356 224 348" strokeWidth="1.3" opacity="0.6" />
      <path d="M178 396 C190 404 210 404 222 396" strokeWidth="1.1" opacity="0.45" />
    </g>
  );
}
function FacePerfil() {
  return (
    <g fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M250 75 C200 80 175 120 172 165 C170 195 150 205 150 220 C150 232 168 236 172 244 C176 258 168 275 178 288 C170 300 178 315 178 330 C150 345 175 400 235 405 C300 408 320 350 322 280 C326 170 315 95 250 75 Z" />
      <circle cx="300" cy="235" r="22" strokeWidth="1.5" />
      <path d="M168 230 C150 226 145 236 158 244" strokeWidth="1.5" />
      <path d="M163 300 C175 296 188 298 196 304" strokeWidth="1.5" />
      <path d="M232 110 C265 108 295 130 300 160" strokeWidth="1.5" opacity="0.6" />
    </g>
  );
}
const VIEWS = {
  frontal: { label: "Frontal", vb: [0, 0, 400, 460], Face: FaceFrontal },
  perfil:  { label: "Perfil",  vb: [0, 0, 400, 460], Face: FacePerfil },
};

export default function App() {
  const [view, setView] = useState("frontal");
  const [points, setPoints] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [catalogo, setCatalogo] = useState(() =>
    SEED.map(([marca, produto, tipo], i) => ({ id: "s" + i, marca, produto, tipo }))
  );
  const svgRef = useRef(null);
  const dragRef = useRef(false);
  const THRESHOLD = 7;

  const editing = points.find((p) => p.id === editingId) || null;

  // dedup: reaproveita entrada existente (marca+produto, sem caixa/espaço)
  function addCatalogo(marca, produto, tipo) {
    const m = marca.trim(), pr = produto.trim();
    const achado = catalogo.find((c) => norm(c.marca) === norm(m) && norm(c.produto) === norm(pr));
    if (achado) return achado;
    const novo = { id: crypto.randomUUID(), marca: m, produto: pr, tipo };
    setCatalogo((prev) => [...prev, novo]);
    return novo;
  }

  function toVB(e) {
    const r = svgRef.current.getBoundingClientRect();
    const [, , w, h] = VIEWS[view].vb;
    return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h };
  }
  function onDown(e) {
    if (e.target?.dataset?.point) return;
    const pt = toVB(e); dragRef.current = true;
    setDraft({ x: pt.x, y: pt.y, x2: pt.x, y2: pt.y });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
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
    const base = vetor ? catalogo.find((c) => c.marca === "Restylane" && c.produto === "Lyft") : catalogo.find((c) => c.tipo === "toxina");
    const novo = {
      id: crypto.randomUUID(), view, forma: vetor ? "vetor" : "ponto",
      x: draft.x, y: draft.y, x2: draft.x2, y2: draft.y2,
      marca: base.marca, produto: base.produto, tipo: base.tipo,
      dose: vetor ? 0.5 : 4,
      regiao: regiaoMaisProxima(view, draft.x, draft.y),
      instrumento: vetor ? "Cânula" : "Agulha",
      tecnica: vetor ? "Retroinjeção linear" : "Bolus",
      plano: "—", lote: "", validade: "",
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Mapa facial — sessão</h1>
            <p className="text-sm text-slate-500">Protótipo · catálogo Marca→Produto · não salva dados</p>
          </div>
          <button onClick={() => { setPoints([]); setEditingId(null); }} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition">
            <RotateCcw size={15} /> Limpar sessão
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Sem dados reais. "Outros" adiciona ao catálogo (com dedup), não salva texto solto. Catálogo aqui é ilustrativo.</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                {Object.entries(VIEWS).map(([k, v]) => (
                  <button key={k} onClick={() => { setView(k); setEditingId(null); }}
                    className={`px-3 py-1 text-sm rounded-md transition ${view === k ? "bg-white shadow-sm font-medium text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>{v.label}</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2 inline-flex items-center gap-1">
              <MousePointerClick size={13} /> Toque = bolus · Arraste = trajeto de cânula/retroinjeção
            </p>

            <svg ref={svgRef} viewBox={VIEWS[view].vb.join(" ")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
              className="w-full cursor-crosshair select-none touch-none" style={{ maxHeight: 540 }}>
              {React.createElement(VIEWS[view].Face)}
              {pontosVista.map((p) => {
                const cor = TIPOS[p.tipo].cor, sel = p.id === editingId;
                if (p.forma === "vetor") {
                  const mx = (p.x + p.x2) / 2, my = (p.y + p.y2) / 2;
                  return (
                    <g key={p.id} onPointerDown={(e) => { e.stopPropagation(); setEditingId(p.id); }} style={{ cursor: "pointer" }}>
                      <line data-point="1" x1={p.x} y1={p.y} x2={p.x2} y2={p.y2} stroke={cor} strokeOpacity={0.7} strokeWidth={sel ? 7 : 5} strokeLinecap="round" />
                      <circle data-point="1" cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={cor} strokeWidth={2} />
                      <text x={mx + 6} y={my - 6} fontSize="10" fontWeight="700" fill={cor} pointerEvents="none">{p.dose}</text>
                    </g>
                  );
                }
                return (
                  <g key={p.id}>
                    <circle data-point="1" cx={p.x} cy={p.y} r={raioPonto(p)} fill={cor} fillOpacity={0.55} stroke={cor} strokeWidth={sel ? 3 : 1.5}
                      onPointerDown={(e) => { e.stopPropagation(); setEditingId(p.id); }} style={{ cursor: "pointer" }} />
                    <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff" pointerEvents="none">{p.dose}</text>
                  </g>
                );
              })}
              {draft && Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > THRESHOLD && (
                <line x1={draft.x} y1={draft.y} x2={draft.x2} y2={draft.y2} stroke="#0f172a" strokeOpacity={0.4} strokeWidth={4} strokeDasharray="4 4" strokeLinecap="round" />
              )}
            </svg>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              {Object.entries(TIPOS).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.cor }} />
                  {v.label}: <strong className="text-slate-900">{+(totais[k] || 0).toFixed(1)} {v.unidade}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {editing ? (
              <Editor p={editing} catalogo={catalogo} onChange={atualizarPonto} addCatalogo={addCatalogo}
                onClose={() => setEditingId(null)} onDelete={() => excluir(editing.id)} />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-sm text-slate-500">
                <div className="flex items-center gap-2 text-slate-700 font-medium mb-1"><MousePointerClick size={16} /> Nada selecionado</div>
                Toque no rosto pra um bolus, arraste pra um trajeto, ou toque numa marcação pra editar.
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Por região</h2>
              {porRegiao.length === 0 ? <p className="text-sm text-slate-400">Sem aplicações ainda.</p> : (
                <ul className="space-y-1 max-h-44 overflow-auto">
                  {porRegiao.map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: TIPOS[r.tipo].cor }} />{r.regiao}</span>
                      <span className="font-medium text-slate-900">{+r.dose.toFixed(1)} {TIPOS[r.tipo].unidade}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Aplicações ({points.length})</h2>
              {points.length === 0 ? <p className="text-sm text-slate-400">Nada registrado.</p> : (
                <ul className="divide-y divide-slate-100 -my-1 max-h-60 overflow-auto">
                  {points.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIPOS[p.tipo].cor }} />
                      <span className="flex-1 min-w-0 truncate">
                        <span className="text-slate-900">{p.regiao}</span>
                        <span className="text-slate-400"> · {rotuloProduto(p)} · {p.dose}{TIPOS[p.tipo].unidade}{TIPOS[p.tipo].tecnica ? ` · ${p.tecnica}` : ""}</span>
                      </span>
                      <button onClick={() => { setView(p.view); setEditingId(p.id); }} className="p-1 text-slate-400 hover:text-slate-700"><Pencil size={14} /></button>
                      <button onClick={() => excluir(p.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Editor({ p, catalogo, onChange, addCatalogo, onClose, onDelete }) {
  const tipo = TIPOS[p.tipo];
  const marcas = [...new Set(catalogo.map((c) => c.marca))];
  const produtosDaMarca = catalogo.filter((c) => c.marca === p.marca);

  const [novaMarca, setNovaMarca] = useState(false);
  const [nmMarca, setNmMarca] = useState("");
  const [nmProduto, setNmProduto] = useState("");
  const [nmTipo, setNmTipo] = useState("preenchedor");

  const [novoProduto, setNovoProduto] = useState(false);
  const [npNome, setNpNome] = useState("");

  function escolherMarca(v) {
    if (v === "__nova__") { setNovaMarca(true); return; }
    const prim = catalogo.find((c) => c.marca === v);
    onChange({ marca: v, produto: prim.produto, tipo: prim.tipo });
    setNovoProduto(false);
  }
  function escolherProduto(v) {
    if (v === "__novo__") { setNovoProduto(true); return; }
    const c = catalogo.find((x) => x.marca === p.marca && x.produto === v);
    onChange({ produto: v, tipo: c.tipo });
  }
  function commitNovaMarca() {
    if (!nmMarca.trim() || !nmProduto.trim()) return;
    const c = addCatalogo(nmMarca, nmProduto, nmTipo);
    onChange({ marca: c.marca, produto: c.produto, tipo: c.tipo });
    setNovaMarca(false); setNmMarca(""); setNmProduto("");
  }
  function commitNovoProduto() {
    if (!npNome.trim()) return;
    const c = addCatalogo(p.marca, npNome, p.tipo);
    onChange({ produto: c.produto, tipo: c.tipo });
    setNovoProduto(false); setNpNome("");
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-300 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Editar · <span className="text-slate-500 font-normal">{p.forma === "vetor" ? "trajeto" : "bolus"}</span></h2>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button>
      </div>

      <div className="space-y-3">
        {/* MARCA */}
        <Field label="Marca">
          <select value={novaMarca ? "__nova__" : p.marca} onChange={(e) => escolherMarca(e.target.value)} className="input">
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="__nova__">+ Nova marca…</option>
          </select>
        </Field>
        {novaMarca && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2">
            <p className="text-xs font-medium text-slate-500">Adicionar nova marca ao catálogo</p>
            <input value={nmMarca} onChange={(e) => setNmMarca(e.target.value)} placeholder="Marca (ex.: Sofiderm)" className="input" autoFocus />
            <input value={nmProduto} onChange={(e) => setNmProduto(e.target.value)} placeholder="Primeiro produto (ex.: Fine)" className="input" />
            <select value={nmTipo} onChange={(e) => setNmTipo(e.target.value)} className="input">
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={commitNovaMarca} className="flex-1 inline-flex items-center justify-center gap-1 text-sm px-2 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition"><Plus size={14} /> Adicionar e usar</button>
              <button onClick={() => setNovaMarca(false)} className="px-2 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-100">Cancelar</button>
            </div>
          </div>
        )}

        {/* PRODUTO */}
        {!novaMarca && (
          <Field label="Produto">
            <select value={novoProduto ? "__novo__" : p.produto} onChange={(e) => escolherProduto(e.target.value)} className="input">
              {produtosDaMarca.map((c) => <option key={c.id} value={c.produto}>{c.produto}</option>)}
              <option value="__novo__">+ Novo produto…</option>
            </select>
          </Field>
        )}
        {novoProduto && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2">
            <p className="text-xs font-medium text-slate-500">Novo produto em <strong>{p.marca}</strong> ({tipo.label})</p>
            <input value={npNome} onChange={(e) => setNpNome(e.target.value)} placeholder="Nome do produto / linha" className="input" autoFocus />
            <div className="flex gap-2">
              <button onClick={commitNovoProduto} className="flex-1 inline-flex items-center justify-center gap-1 text-sm px-2 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition"><Plus size={14} /> Adicionar e usar</button>
              <button onClick={() => setNovoProduto(false)} className="px-2 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-100">Cancelar</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Dose (${tipo.unidade})`}>
            <input type="number" step={p.tipo === "toxina" ? 0.5 : 0.1} min={0} value={p.dose}
              onChange={(e) => onChange({ dose: e.target.value === "" ? 0 : Number(e.target.value) })} className="input" />
          </Field>
          <Field label="Região">
            <select value={p.regiao} onChange={(e) => onChange({ regiao: e.target.value })} className="input">
              {REGIOES[p.view].map((r) => <option key={r.nome} value={r.nome}>{r.nome}</option>)}
            </select>
          </Field>
        </div>

        {tipo.tecnica && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Instrumento">
              <select value={p.instrumento} onChange={(e) => onChange({ instrumento: e.target.value })} className="input">
                {["Agulha", "Cânula"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Plano">
              <select value={p.plano} onChange={(e) => onChange({ plano: e.target.value })} className="input">
                {["Derme", "Subcutâneo", "Supraperiosteal", "SMAS", "Submuscular", "—"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Técnica">
                <select value={p.tecnica} onChange={(e) => onChange({ tecnica: e.target.value })} className="input">
                  {["Bolus", "Retroinjeção linear", "Leque", "Cross-hatching", "Pontos seriados", "Torre/coluna"].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Lote"><input value={p.lote} onChange={(e) => onChange({ lote: e.target.value })} placeholder="ex: ABX123" className="input" /></Field>
          <Field label="Validade"><input type="month" value={p.validade} onChange={(e) => onChange({ validade: e.target.value })} className="input" /></Field>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={onClose} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition"><Check size={15} /> Pronto</button>
          <button onClick={onDelete} className="inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-300 text-rose-600 hover:bg-rose-50 transition"><Trash2 size={15} /> Excluir</button>
        </div>
      </div>

      <style>{`.input{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font-size:14px;background:#fff;outline:none}.input:focus{border-color:#0d9488;box-shadow:0 0 0 2px rgba(13,148,136,.15)}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (<label className="block"><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>);
}
