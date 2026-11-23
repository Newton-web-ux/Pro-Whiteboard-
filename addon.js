/* ============================================================
   ProBoard addon.js — Miro-style tools
   Load LAST:  <script src="addon.js"></script>  (before </body>)
   Everything is stored as normal shapes in pages[].shapes, so
   undo, save, cloud sync, export and recording keep working.
   ============================================================ */
(() => {
"use strict";
const A = { col:"#fef08a", cc:"#475569", stamp:"👍", auto:false, snap:false, draft:null, conn:null, pan:null, pen:false };
const $ = id => document.getElementById(id);
const uid = () => "s" + Math.random().toString(36).slice(2, 9);
const P = () => pages[current];
const toast = m => { try { showRoomToast(m); } catch (e) {} };
const persist = () => { try { saveToLocalStorage(); cloudAutoSaveTrigger(); if (roomRef && MY_ROLE === "admin") pushBoardSnapshot(); } catch (e) {} };
const ensureId = s => (s._id || (s._id = uid()), s._id);
const mk = (o, front) => { const s = Object.assign({ _id: uid(), lineWidth: 2 }, o); front ? P().shapes.unshift(s) : P().shapes.push(s); return s; };
const isLine = s => s.type === "arrow" || s.type === "line";

/* ---------- styles ---------- */
const css = document.createElement("style");
css.textContent = `
.a-pop{position:fixed;z-index:99990;display:flex;gap:6px;flex-wrap:wrap;max-width:250px;padding:10px;background:var(--bg-card);border:1px solid var(--border-bright);border-radius:12px;box-shadow:var(--shadow-lg)}
.a-pop button{min-width:34px;height:34px;border-radius:8px;border:1px solid var(--border-md);background:var(--bg-hover);color:var(--text-primary);cursor:pointer;font-size:18px;padding:0 6px}
.a-pop button:hover{border-color:var(--accent)}
#a_sel{position:fixed;top:calc(var(--total-top) + 10px);left:50%;transform:translateX(-50%);display:none;align-items:center;gap:5px;padding:6px 10px;background:var(--bg-card);border:1px solid var(--border-bright);border-radius:12px;box-shadow:var(--shadow-lg);z-index:700}
#a_sel button{min-width:30px;height:30px;border-radius:7px;border:1px solid var(--border);background:var(--bg-hover);color:var(--text-primary);cursor:pointer;font-size:14px}
#a_sel button:hover{border-color:var(--accent)}
#a_sel .sw{width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.3);cursor:pointer;display:inline-block}
#a_tmr{position:fixed;left:150px;bottom:40px;display:none;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-card);border:1px solid var(--border-bright);border-radius:100px;font:600 18px var(--mono);color:var(--text-primary);z-index:700;box-shadow:var(--shadow-md)}
#a_tmr.done{color:var(--danger);border-color:var(--danger)}
#a_tmr button{border:0;background:none;color:var(--text-secondary);cursor:pointer;font-size:14px}`;
document.head.appendChild(css);

/* ---------- ribbon tab ---------- */
const tabs = $("ribbonTabs"), bar = $("ribbonBar");
const tb = document.createElement("button");
tb.className = "tabBtn"; tb.dataset.tab = "addonTab"; tb.textContent = "Board Tools";
tabs.insertBefore(tb, $("storageTabBtn"));
const panel = document.createElement("div");
panel.id = "addonTab"; panel.className = "ribbonPanel";
panel.innerHTML = `
<div class="group">
 <button class="btn-text" data-tool="a_pointer" title="Select & move (V)"><i class="fa fa-arrow-pointer"></i> Select</button>
 <button class="btn-text" data-tool="a_sticky" title="Sticky note (N). Click or drag"><i class="fa fa-note-sticky"></i> Sticky</button>
 <button id="a_col" title="Sticky colour"><i class="fa fa-palette"></i></button>
 <button class="btn-text" data-tool="a_text" title="Text box (T)"><i class="fa fa-font"></i> Text</button>
 <button class="btn-text" data-tool="a_frame" title="Frame"><i class="fa fa-vector-square"></i> Frame</button>
 <button class="btn-text" data-tool="a_conn" title="Connector (C). Sticks to shapes and follows them"><i class="fa fa-right-long"></i> Connector</button>
</div>
<div class="group">
 <button class="btn-text" id="a_stamp" title="Stamps and reactions"><i class="fa fa-face-smile"></i> Stamp</button>
 <button class="btn-text" id="a_table" title="Insert table"><i class="fa fa-table"></i> Table</button>
</div>
<div class="group">
 <button class="btn-text" id="a_auto" title="Turns rough lines, circles and rectangles into clean shapes. Hold Shift for a straight line"><i class="fa fa-wand-magic-sparkles"></i> Smart draw</button>
 <button class="btn-text" id="a_snap" title="Snap moved shapes to a 20px grid"><i class="fa fa-border-all"></i> Snap</button>
 <button class="btn-text" data-tool="a_laser" title="Laser pointer (L)"><i class="fa fa-crosshairs"></i> Laser</button>
 <button class="btn-text" id="a_timer" title="Countdown timer"><i class="fa fa-stopwatch"></i> Timer</button>
</div>
<div class="group">
 <button class="btn-text" id="a_exp" title="Download board as JSON"><i class="fa fa-file-export"></i> Export</button>
 <button class="btn-text" id="a_imp" title="Open a board JSON file"><i class="fa fa-file-import"></i> Import</button>
</div>`;
bar.appendChild(panel);
tb.onclick = () => {
  document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".ribbonPanel").forEach(p => p.classList.remove("active"));
  tb.classList.add("active"); panel.classList.add("active");
};

/* ---------- floating bits ---------- */
const sel = document.createElement("div"); sel.id = "a_sel"; document.body.appendChild(sel);
const tmr = document.createElement("div"); tmr.id = "a_tmr";
tmr.innerHTML = `<span id="a_tt">05:00</span><button title="Stop">✕</button>`; document.body.appendChild(tmr);
const LZ = document.createElement("canvas");
LZ.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;margin:0;background:transparent;border-radius:0;box-shadow:none;pointer-events:none;z-index:99997";
document.body.appendChild(LZ);
const lz = LZ.getContext("2d");
const fit = () => { LZ.width = innerWidth; LZ.height = innerHeight; }; fit(); addEventListener("resize", fit);

/* ---------- popovers ---------- */
let pp = null;
const closePop = () => { pp && pp.remove(); pp = null; };
function pop(btn, items, cb) {
  closePop();
  pp = document.createElement("div"); pp.className = "a-pop";
  items.forEach(it => { const b = document.createElement("button"); b.innerHTML = it.h; b.onclick = () => cb(it.v); pp.appendChild(b); });
  const r = btn.getBoundingClientRect();
  pp.style.left = Math.min(r.left, innerWidth - 260) + "px"; pp.style.top = r.bottom + 6 + "px";
  document.body.appendChild(pp);
  setTimeout(() => document.addEventListener("click", closePop, { once: true }), 0);
}

/* ---------- tools ---------- */
function setTool(t) {
  tool = t; shapeTool = null; A.draft = A.conn = A.pan = null;
  if (t !== "a_pointer") { selectedShape = null; selectedImage = null; redraw(); }
  ui();
}
function sync() {
  panel.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
  canvas.style.cursor = tool === "a_pointer" ? "default" : String(tool).startsWith("a_") ? "crosshair" : "";
}
panel.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => setTool(b.dataset.tool));
document.addEventListener("click", () => setTimeout(sync, 0));

$("a_col").onclick = e => pop(e.currentTarget,
  ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#e9d5ff"].map(c => ({ h: `<span style="display:block;width:22px;height:22px;border-radius:50%;background:${c}"></span>`, v: c })),
  c => { A.col = c; setTool("a_sticky"); });
$("a_stamp").onclick = e => pop(e.currentTarget, ["👍", "❤️", "⭐", "✅", "❓", "🔥", "💡", "🎉"].map(x => ({ h: x, v: x })), x => { A.stamp = x; setTool("a_stamp"); });
$("a_table").onclick = table;
$("a_auto").onclick = e => { A.auto = !A.auto; e.currentTarget.classList.toggle("active", A.auto); toast(A.auto ? "Smart draw on. Draw a line, circle or box" : "Smart draw off"); };
$("a_snap").onclick = e => { A.snap = !A.snap; e.currentTarget.classList.toggle("active", A.snap); toast(A.snap ? "Snap to grid on" : "Snap off"); };
$("a_timer").onclick = e => pop(e.currentTarget, [1, 5, 10, 15].map(m => ({ h: m + "m", v: m })), startTimer);
$("a_exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([serializeBoard()], { type: "application/json" })); a.download = "board_" + boardID + ".json"; a.click(); };
$("a_imp").onclick = () => {
  const i = document.createElement("input"); i.type = "file"; i.accept = ".json";
  i.onchange = () => { const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); if (!Array.isArray(j.pages)) throw 0; localStorage.setItem(storageKey, JSON.stringify(j)); location.reload(); } catch (e) { alert("This is not a valid board file."); } }; r.readAsText(i.files[0]); };
  i.click();
};

/* ---------- geometry ---------- */
const ctr = s => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
function edge(s, t) {
  const c = ctr(s), dx = t.x - c.x, dy = t.y - c.y; if (!dx && !dy) return c;
  const hw = Math.abs(s.w) / 2, hh = Math.abs(s.h) / 2;
  const k = Math.min(dx ? hw / Math.abs(dx) : 1e9, dy ? hh / Math.abs(dy) : 1e9);
  return { x: c.x + dx * k, y: c.y + dy * k };
}
function relink(pg) {
  const by = {}; pg.shapes.forEach(s => { if (s._id) by[s._id] = s; });
  pg.shapes.forEach(s => {
    if (s.type !== "arrow" || !(s.from || s.to)) return;
    const a = by[s.from], b = by[s.to]; if (!a && !b) return;
    const A0 = { x: s.x, y: s.y }, B0 = { x: s.x + s.w, y: s.y + s.h };
    const Ac = a ? ctr(a) : A0, Bc = b ? ctr(b) : B0;
    const A1 = a ? edge(a, Bc) : A0, B1 = b ? edge(b, Ac) : B0;
    s.x = A1.x; s.y = A1.y; s.w = B1.x - A1.x; s.h = B1.y - A1.y;
  });
}
const _redraw = window.redraw;
window.redraw = function () { try { relink(pages[current]); } catch (e) {} return _redraw.apply(this, arguments); };

function shapeAt(p, forConn) {
  const S = P().shapes;
  for (let i = S.length - 1; i >= 0; i--) {
    const s = S[i]; if (isLine(s) || (forConn && s.frame)) continue;
    if (p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) return s;
  }
  return null;
}
const imgAt = p => P().images.some(i => p.x > i.x && p.x < i.x + i.w && p.y > i.y && p.y < i.y + i.h);
function sd(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const connAt = p => P().shapes.slice().reverse().find(s => isLine(s) && sd(p, { x: s.x, y: s.y }, { x: s.x + s.w, y: s.y + s.h }) < 10 / scale);
const snap = v => Math.round(v / 20) * 20;

/* ---------- creating objects ---------- */
const CRE = {
  a_sticky: () => ({ type: "rect", fill: A.col, strokeColor: "rgba(0,0,0,.12)", lineWidth: 1, label: "", labelColor: "#1f2937", fontSize: 20, labelPad: 16, labelTop: 16, sticky: true, dw: 220, dh: 220 }),
  a_text:   () => ({ type: "rect", fill: "transparent", noStroke: true, strokeColor: "transparent", label: "", labelColor: colorPicker.value, fontSize: Math.max(16, +sizePicker.value * 6), labelPad: 6, labelTop: 6, dw: 320, dh: 56 }),
  a_frame:  () => ({ type: "rect", fill: "transparent", strokeColor: "#64748b", lineWidth: 2, label: "Frame", labelColor: "#64748b", fontSize: 18, labelBold: true, labelPad: 12, labelTop: 10, frame: true, dw: 640, dh: 420 })
};
function conn(a, b) { return mk({ type: "arrow", x: 0, y: 0, w: 0, h: 0, from: ensureId(a), to: ensureId(b), strokeColor: A.cc, fill: A.cc, lineWidth: 3 }, true); }
function child() {
  const s = selectedShape; if (!s || s.type !== "rect") return;
  saveState(); ensureId(s);
  const n = P().shapes.filter(x => x.type === "arrow" && x.from === s._id).length;
  const c = mk({ type: "rect", x: s.x + s.w + 110, y: s.y + n * (s.h + 30), w: s.w, h: s.h, fill: s.fill, strokeColor: s.strokeColor, noStroke: s.noStroke, lineWidth: s.lineWidth, label: "", labelColor: s.labelColor, fontSize: s.fontSize, labelPad: s.labelPad, labelTop: s.labelTop, labelBold: s.labelBold, textAlign: s.textAlign, sticky: s.sticky });
  conn(s, c); selectedShape = c; redraw(); persist(); ui(); edit(c);
}
function table() {
  const v = prompt("Table size (rows x columns)", "3x3"); if (!v) return;
  const m = v.match(/(\d+)\s*[x×,]\s*(\d+)/i); if (!m) return;
  const R = Math.min(+m[1], 12), C = Math.min(+m[2], 8), o = pos({ clientX: innerWidth / 2 - C * 80, clientY: 160 });
  saveState();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++)
    mk({ type: "rect", x: o.x + c * 160, y: o.y + r * 60, w: 160, h: 60, fill: r ? "#ffffff" : "#e0e7ff", strokeColor: "#94a3b8", lineWidth: 1, label: "", labelColor: "#0f172a", fontSize: 16, labelPad: 10, labelTop: 18, labelBold: !r });
  redraw(); persist();
}

/* ---------- inline text editor ---------- */
function edit(s) {
  if (!s || s.type !== "rect") return;
  document.querySelectorAll(".a-ed").forEach(x => x.remove());
  const r = canvas.getBoundingClientRect(), ta = document.createElement("textarea"); ta.className = "a-ed"; ta.value = s.label || "";
  Object.assign(ta.style, { position: "fixed", left: r.left + s.x * scale + "px", top: r.top + s.y * scale + "px", width: Math.max(90, s.w * scale) + "px", height: Math.max(44, s.h * scale) + "px", zIndex: 99998, font: (s.fontSize || 14) * scale + "px 'DM Sans',sans-serif", padding: (s.labelPad ?? 14) * scale + "px", background: s.fill && s.fill !== "transparent" ? s.fill : "#fff", color: s.labelColor || "#111", border: "2px solid #6366f1", borderRadius: "6px", resize: "none", outline: "none", textAlign: s.textAlign || "left" });
  let closed = false;
  const done = ok => { if (closed) return; closed = true; if (ok && ta.value !== (s.label || "")) { saveState(); s.label = ta.value; } ta.remove(); redraw(); persist(); };
  ta.onblur = () => done(true);
  ta.onkeydown = e => { e.stopPropagation(); if (e.key === "Escape") done(false); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) done(true); };
  document.body.appendChild(ta); ta.focus(); ta.select();
}
canvas.addEventListener("dblclick", e => {
  const s = shapeAt(pos(e)); if (!s || s.type !== "rect") return;
  if (s.frame && pos(e).y > s.y + 44) return;
  edit(s);
});

/* ---------- selection toolbar ---------- */
const B = (a, t, ti) => `<button data-a="${a}" title="${ti}">${t}</button>`;
function ui() {
  sync();
  let s = selectedShape; if (s && !P().shapes.includes(s)) s = selectedShape = null;
  if (!s) { sel.style.display = "none"; return; }
  const pal = s.type === "rect" ? ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#e9d5ff", "#ffffff"] : ["#0f172a", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
  sel.innerHTML = pal.map(c => `<span class="sw" data-a="col" data-c="${c}" style="background:${c}"></span>`).join("")
    + (s.type === "rect" ? B("fs-", "A−", "Smaller text") + B("fs+", "A+", "Larger text") + B("edit", "✎", "Edit text (Enter)") : "")
    + B("dup", "⧉", "Duplicate (Ctrl+D)") + B("front", "⇧", "Bring to front") + B("back", "⇩", "Send to back") + B("del", "🗑", "Delete (Del)");
  sel.style.display = "flex";
}
sel.onclick = e => {
  const t = e.target.closest("[data-a]"), s = selectedShape; if (!t || !s) return;
  const a = t.dataset.a; saveState();
  if (a === "col") { if (s.type === "rect") s.fill = t.dataset.c; else { s.strokeColor = s.fill = s.color = t.dataset.c; } }
  else if (a === "fs-" || a === "fs+") s.fontSize = Math.max(8, (s.fontSize || 14) + (a === "fs+" ? 2 : -2));
  else if (a === "edit") { P().undo.pop(); edit(s); return; }
  else if (a === "dup") { P().undo.pop(); dup(); return; }
  else if (a === "del") { P().undo.pop(); del(); return; }
  else if (a === "front" || a === "back") { const S = P().shapes; S.splice(S.indexOf(s), 1); a === "front" ? S.push(s) : S.unshift(s); }
  redraw(); persist(); ui();
};
function dup() {
  const s = selectedShape; if (!s) return; saveState();
  const n = JSON.parse(JSON.stringify(s)); n._id = uid();
  if (n.type === "arrow") { delete n.from; delete n.to; }
  n.x += 30; n.y += 30; P().shapes.push(n); selectedShape = n; redraw(); persist(); ui();
}
function del() {
  const p = P();
  if (selectedShape) { saveState(); const id = selectedShape._id; p.shapes = p.shapes.filter(x => x !== selectedShape && !(id && (x.from === id || x.to === id))); selectedShape = null; }
  else if (selectedImage) { saveState(); p.images = p.images.filter(i => i !== selectedImage); selectedImage = null; }
  redraw(); persist(); ui();
}
["undoBtn", "redoBtn"].forEach(id => $(id).addEventListener("click", () => setTimeout(() => { selectedShape = null; ui(); }, 0)));

/* ---------- pointer handling ---------- */
const own = () => String(tool).startsWith("a_") && !scrollMode && !(typeof MY_ROLE !== "undefined" && MY_ROLE === "viewer");
const stop = e => { e.stopImmediatePropagation(); e.preventDefault(); };
const cc = () => $("canvasContainer");

canvas.addEventListener("pointerdown", e => {
  A.pen = tool === "pen"; if (!own()) return;
  const p = pos(e), t = tool;
  if (t === "a_pointer") {
    if (shapeAt(p) || imgAt(p)) return;                       // let the original handler drag/resize it
    const c = connAt(p);
    if (c) { selectedShape = c; selectedImage = null; redraw(); ui(); return stop(e); }
    selectedShape = null; selectedImage = null; redraw(); ui();
    A.pan = { x: e.clientX, y: e.clientY, l: cc().scrollLeft, t: cc().scrollTop }; return stop(e);
  }
  canvas.setPointerCapture(e.pointerId);
  if (CRE[t]) {
    const c = CRE[t](); saveState();
    A.dw = c.dw; A.dh = c.dh; delete c.dw; delete c.dh;
    A.draft = mk(Object.assign(c, { x: p.x, y: p.y, w: 0, h: 0 }), !!c.frame); A.start = p;
  } else if (t === "a_conn") {
    saveState(); const f = shapeAt(p, true);
    A.conn = mk({ type: "arrow", x: p.x, y: p.y, w: 0, h: 0, strokeColor: A.cc, fill: A.cc, lineWidth: 3, from: f ? ensureId(f) : undefined }, true);
  } else if (t === "a_stamp") {
    saveState(); mk({ type: "rect", x: p.x - 40, y: p.y - 40, w: 80, h: 80, fill: "transparent", noStroke: true, strokeColor: "transparent", label: A.stamp, fontSize: 56, textAlign: "center", labelPad: 0, labelTop: 8 });
    redraw(); persist();
  } else if (t === "a_laser") { trail.push({ x: e.clientX, y: e.clientY, t: performance.now() }); lzGo(); }
  stop(e);
}, true);

canvas.addEventListener("pointermove", e => {
  if (!own()) return;
  const p = pos(e);
  if (tool === "a_pointer" && !A.pan) return;
  if (A.pan) { cc().scrollLeft = A.pan.l - (e.clientX - A.pan.x); cc().scrollTop = A.pan.t - (e.clientY - A.pan.y); }
  else if (A.draft) { const s = A.draft; s.x = Math.min(A.start.x, p.x); s.y = Math.min(A.start.y, p.y); s.w = Math.abs(p.x - A.start.x); s.h = Math.abs(p.y - A.start.y); redraw(); }
  else if (A.conn) { A.conn.w = p.x - A.conn.x; A.conn.h = p.y - A.conn.y; redraw(); }
  else if (tool === "a_laser") { trail.push({ x: e.clientX, y: e.clientY, t: performance.now() }); lzGo(); }
  stop(e);
}, true);

canvas.addEventListener("pointerup", e => {
  if (!own()) return;
  if (tool === "a_pointer" && !A.pan) return;
  const p = pos(e);
  if (A.pan) A.pan = null;
  else if (A.draft) {
    const s = A.draft; A.draft = null;
    if (s.w < 14 && s.h < 14) { s.w = A.dw; s.h = A.dh; }
    if (A.snap) { s.x = snap(s.x); s.y = snap(s.y); }
    selectedShape = s; tool = "a_pointer"; redraw(); persist(); ui(); edit(s);
  } else if (A.conn) {
    const c = A.conn, t = shapeAt(p, true); A.conn = null;
    if (t && t._id !== c.from) c.to = ensureId(t);
    if (!c.to && Math.hypot(c.w, c.h) < 12) P().shapes = P().shapes.filter(x => x !== c);
    redraw(); persist();
  }
  stop(e);
}, true);

/* after the original pointerup: snap, smart draw, refresh UI */
canvas.addEventListener("pointerup", e => { const sh = e.shiftKey; setTimeout(() => { post(sh); ui(); }, 0); });

function recog(st) {
  const pts = st.points; if (pts.length < 8) return null;
  const a = pts[0], b = pts[pts.length - 1];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0;
  pts.forEach(q => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); sx += q.x; sy += q.y; });
  const w = x1 - x0, h = y1 - y0, dg = Math.hypot(w, h); if (dg < 30) return null;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L > dg * .85) {
    const d = Math.max(...pts.map(q => Math.abs((b.y - a.y) * q.x - (b.x - a.x) * q.y + b.x * a.y - b.y * a.x) / L));
    if (d < dg * .06) return { type: "line", x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }
  if (L < dg * .25) {
    const near = pts.filter(q => Math.min(q.x - x0, x1 - q.x, q.y - y0, y1 - q.y) < dg * .07).length / pts.length;
    if (near > .85) return { type: "rect", x: x0, y: y0, w, h };
    const cx = sx / pts.length, cy = sy / pts.length, rs = pts.map(q => Math.hypot(q.x - cx, q.y - cy));
    const mr = rs.reduce((m, v) => m + v, 0) / rs.length;
    if (Math.max(...rs.map(r => Math.abs(r - mr))) / mr < .22 && Math.abs(w - h) < Math.max(w, h) * .3) return { type: "circle", x: x0, y: y0, w, h };
  }
  return null;
}
function post(shift) {
  const p = P(); let ch = false;
  if (A.pen && currentStroke && currentStroke.type === "pen" && p.strokes.includes(currentStroke) && currentStroke.points.length > 1) {
    const st = currentStroke, pts = st.points;
    if (shift) { st.points = [pts[0], pts[pts.length - 1]]; ch = true; }
    else if (A.auto) {
      const r = recog(st);
      if (r) { p.strokes = p.strokes.filter(x => x !== st); p.shapes.push(Object.assign({ _id: uid(), color: st.color, strokeColor: st.color, lineWidth: st.size, fill: "transparent" }, r)); ch = true; }
    }
  }
  A.pen = false;
  if (A.snap && tool === "a_pointer" && selectedShape && !isLine(selectedShape)) { selectedShape.x = snap(selectedShape.x); selectedShape.y = snap(selectedShape.y); ch = true; }
  if (ch) { redraw(); persist(); }
}

/* ---------- laser ---------- */
let trail = [], lzOn = false;
function lzGo() { if (!lzOn) { lzOn = true; lzLoop(); } }
function lzLoop() {
  const n = performance.now(); trail = trail.filter(q => n - q.t < 900);
  lz.clearRect(0, 0, LZ.width, LZ.height); lz.lineCap = "round"; lz.shadowColor = "#ff2d55"; lz.shadowBlur = 14;
  for (let i = 1; i < trail.length; i++) {
    lz.strokeStyle = `rgba(255,45,85,${1 - (n - trail[i].t) / 900})`; lz.lineWidth = 7;
    lz.beginPath(); lz.moveTo(trail[i - 1].x, trail[i - 1].y); lz.lineTo(trail[i].x, trail[i].y); lz.stroke();
  }
  if (trail.length) { const q = trail[trail.length - 1]; lz.fillStyle = "#ff2d55"; lz.beginPath(); lz.arc(q.x, q.y, 8, 0, 7); lz.fill(); requestAnimationFrame(lzLoop); }
  else lzOn = false;
}

/* ---------- timer ---------- */
let tI = null;
function beep() { try { const c = new AudioContext(); [0, .35, .7].forEach(d => { const o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(c.currentTime + d); o.stop(c.currentTime + d + .2); }); } catch (e) {} }
function startTimer(m) {
  clearInterval(tI); tmr.classList.remove("done"); closePop();
  const end = Date.now() + m * 6e4; tmr.style.display = "flex";
  tI = setInterval(() => {
    const s = Math.max(0, Math.round((end - Date.now()) / 1e3));
    $("a_tt").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    if (!s) { clearInterval(tI); tmr.classList.add("done"); beep(); }
  }, 250);
}
tmr.querySelector("button").onclick = () => { clearInterval(tI); tmr.style.display = "none"; };

/* ---------- shortcuts ---------- */
addEventListener("keydown", e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  const k = e.key, m = e.ctrlKey || e.metaKey;
  if (m && k.toLowerCase() === "z") { e.preventDefault(); $(e.shiftKey ? "redoBtn" : "undoBtn").click(); return; }
  if (m && k.toLowerCase() === "y") { e.preventDefault(); $("redoBtn").click(); return; }
  if (m && k.toLowerCase() === "d") { e.preventDefault(); dup(); return; }
  if (m || e.altKey) return;
  const s = selectedShape, keys = { v: "a_pointer", n: "a_sticky", t: "a_text", c: "a_conn", l: "a_laser" };
  if ((k === "Delete" || k === "Backspace") && (s || selectedImage)) { e.preventDefault(); del(); }
  else if (k === "Tab" && s) { e.preventDefault(); child(); }
  else if ((k === "Enter" || k === "F2") && s) { e.preventDefault(); edit(s); }
  else if (k.startsWith("Arrow") && s && !isLine(s)) {
    e.preventDefault(); const d = e.shiftKey ? 1 : 10;
    s.x += k === "ArrowRight" ? d : k === "ArrowLeft" ? -d : 0; s.y += k === "ArrowDown" ? d : k === "ArrowUp" ? -d : 0; redraw(); persist();
  } else if (keys[k.toLowerCase()]) setTool(keys[k.toLowerCase()]);
});

sync();
})();
