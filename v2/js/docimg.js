// 🖼 Офіційний документ картинкою: указ, наказ, грамота, подяка… з гербом, печаткою й підписом.
// Картинку можна завантажити й вставити в статтю в грі; на сайті вона не зберігається.
import { S, me, isAdmin, positionsOf } from "./store.js";
import { t } from "./i18n.js";
import { esc, asset, modal } from "./ui.js";

const W = 1000, H = 1414, F = '"Segoe UI", Roboto, "Noto Sans", Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';
const load = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
export const DOC_TYPES = {
  hetman: ["decree", "order", "address", "diploma", "thanks", "cert"],
  church: ["epistle", "resolution", "diploma", "blessing"],
  chamber: ["resolution", "address", "diploma", "thanks"],
  any: ["order", "notice", "address", "diploma", "thanks", "cert"],
  lawdoc: ["law", "decree"],
};
const RECIPIENT = ["diploma", "thanks", "cert", "blessing"];

// від чийого імені: мої посади (+ Церква для Патріарха, + Державна канцелярія для адміна)
export function issuers() {
  const m = me(); if (!m) return [];
  const out = positionsOf(m.id).map(p => ({ id: p.id, role: p.title, name: m.name, kind: p.id === "hetman" ? "hetman" : p.id === "patriarch" ? "church" : p.chamber === "chair" ? "chamber" : "any" }));
  if (!out.length && isAdmin()) out.push({ id: "admin", role: t("dc.chancellery"), name: m.name, kind: "any" });
  return out;
}
function wrap(c, text, max) {
  const out = [];
  String(text || "").split(/\n/).forEach(par => {
    if (!par.trim()) { out.push(""); return; }
    let line = "";
    par.split(/\s+/).forEach(w => { const tst = line ? line + " " + w : w; if (c.measureText(tst).width > max && line) { out.push(line); line = w; } else line = tst; });
    out.push(line);
  });
  return out;
}
// кругла печатка з текстом по колу
function seal(c, x, y, r, top, coat) {
  c.save(); c.globalAlpha = .78; c.strokeStyle = "#1d3f9a"; c.fillStyle = "#1d3f9a";
  c.lineWidth = 4; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r - 10, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(x, y, r - 40, 0, Math.PI * 2); c.stroke();
  c.font = `700 17px ${F}`; c.textAlign = "center"; c.textBaseline = "middle";
  const s = (" " + top.toUpperCase() + " ★").split(""), step = Math.PI * 2 / Math.max(s.length, 34);
  s.forEach((ch, i) => { const a = -Math.PI / 2 - (s.length - 1) * step / 2 + i * step; c.save(); c.translate(x + Math.cos(a) * (r - 24), y + Math.sin(a) * (r - 24)); c.rotate(a + Math.PI / 2); c.fillText(ch, 0, 0); c.restore(); });
  if (coat) { c.globalAlpha = .55; const k = (r - 46) * 1.4 / Math.max(coat.width, coat.height); c.drawImage(coat, x - coat.width * k / 2, y - coat.height * k / 2, coat.width * k, coat.height * k); }
  c.restore(); c.textAlign = "left"; c.textBaseline = "alphabetic";
}

export async function drawDoc(d) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), church = d.kind === "church";
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#fbf6e8"); g.addColorStop(1, "#efe4c8"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  // рамка
  c.strokeStyle = "#b8a271"; c.lineWidth = 6; c.strokeRect(30, 30, W - 60, H - 60); c.lineWidth = 1.5; c.strokeRect(44, 44, W - 88, H - 88);
  c.fillStyle = church ? "#7a1f2b" : "#0057b7"; c.fillRect(44, 44, W - 88, 10); c.fillStyle = church ? "#c9a227" : "#ffd700"; c.fillRect(44, 54, W - 88, 6);
  // герб і шапка
  const coatSrc = church ? ((S.church && S.church.emblem) || "") : ((S.site && S.site.coat) || asset("img/gerb.png"));
  const coat = await load(coatSrc) || (church ? null : await load(asset("img/gerb.png")));
  if (coat) { const k = 130 / Math.max(coat.width, coat.height); c.drawImage(coat, W / 2 - coat.width * k / 2, 90, coat.width * k, coat.height * k); }
  else if (church) { c.fillStyle = "#7a1f2b"; c.font = `110px ${SERIF}`; c.textAlign = "center"; c.fillText("✝", W / 2, 200); c.textAlign = "left"; }
  const head = church ? ((S.church && S.church.title) || t("chu.name")) : ((S.site && S.site.stateName) || t("site.name"));
  c.textAlign = "center"; c.fillStyle = "#0b3d91"; c.font = `800 34px ${SERIF}`; c.fillText(head.toUpperCase(), W / 2, 270);
  c.fillStyle = "#5b4a24"; c.font = `600 20px ${F}`; c.fillText(d.role, W / 2, 304);
  c.strokeStyle = "#b8a271"; c.lineWidth = 2; c.beginPath(); c.moveTo(200, 330); c.lineTo(W - 200, 330); c.stroke();
  // вид документа й номер
  c.fillStyle = "#1b2233"; c.font = `800 52px ${SERIF}`; c.fillText(t("dc.t." + d.type).toUpperCase(), W / 2, 410);
  let y = 410;
  if (d.no) { c.font = `600 22px ${F}`; c.fillStyle = "#5b4a24"; c.fillText("№ " + d.no, W / 2, y += 40); }
  if (d.title) { c.font = `700 italic 28px ${SERIF}`; c.fillStyle = "#1b2233"; wrap(c, "«" + d.title + "»", W - 220).forEach(l => c.fillText(l, W / 2, y += 46)); }
  if (d.recipient && RECIPIENT.includes(d.type)) {
    c.font = `600 22px ${F}`; c.fillStyle = "#5b4a24"; c.fillText(t("dc.awardedTo"), W / 2, y += 60);
    c.font = `800 40px ${SERIF}`; c.fillStyle = "#0b3d91"; c.fillText(d.recipient, W / 2, y += 54);
  }
  // текст
  c.textAlign = "left"; c.fillStyle = "#1b2233"; c.font = `400 25px ${SERIF}`;
  y += 50; const lim = H - 360;
  const L = wrap(c, d.text, W - 220);
  for (const ln of L) { if (y > lim) { c.fillText("…", 110, y); break; } if (ln) c.fillText(ln, 110, y); y += ln ? 36 : 20; }
  // дата, підпис, печатка
  const by = H - 230;
  c.font = `600 22px ${F}`; c.fillStyle = "#5b4a24"; c.fillText(d.date, 110, by + 70);
  c.textAlign = "right"; c.fillStyle = "#1b2233"; c.font = `600 22px ${F}`; c.fillText(d.role, W - 110, by);
  c.strokeStyle = "#1b2233"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(W - 430, by + 70); c.lineTo(W - 110, by + 70); c.stroke();
  c.font = `italic 38px ${SERIF}`; c.fillStyle = "#1d2f6b"; c.fillText(d.name, W - 130, by + 60);
  c.font = `500 18px ${F}`; c.fillStyle = "#5b4a24"; c.fillText(d.name, W - 110, by + 98);
  c.textAlign = "left";
  seal(c, W - 520, by + 40, 92, head, coat);
  return cv;
}
const toBlob = cv => new Promise(res => cv.toBlob(res, "image/png"));
async function showImage(w, d) {
  const box = w.querySelector("[data-dcout]");
  box.innerHTML = `<p class="hint">${esc(t("loading"))}</p>`;
  const blob = await toBlob(await drawDoc(d)), url = URL.createObjectURL(blob);
  box.innerHTML = `<img class="ppimg" src="${url}" alt="${esc(t("dc.t." + d.type))}"><div class="row end"><a class="btn primary" href="${url}" download="${esc(t("dc.t." + d.type))}${d.no ? "-" + esc(d.no) : ""}.png">⬇️ ${esc(t("pp.download"))}</a></div>`;
}
const today = () => new Date().toLocaleDateString("uk-UA");
// вікно-конструктор
export function docDialog(pre = {}) {
  const iss = pre.issuer ? [pre.issuer] : issuers(); if (!iss.length) return;
  const typeOpts = i => DOC_TYPES[iss[i].kind].map(k => `<option value="${k}"${k === pre.type ? " selected" : ""}>${esc(t("dc.t." + k))}</option>`).join("");
  const w = modal(t("dc.title"), `<form class="form" data-dcf>
    ${iss.length > 1 ? `<label>${esc(t("dc.from"))}<select name="iss">${iss.map((x, i) => `<option value="${i}">${esc(x.role)}</option>`).join("")}</select></label>` : `<p class="hint">${esc(t("dc.from"))}: <b>${esc(iss[0].role)}</b> ${esc(iss[0].name)}</p>`}
    <div class="row2"><label>${esc(t("dc.type"))}<select name="type">${typeOpts(0)}</select></label><label>${esc(t("dc.no"))}<input name="no" maxlength="20" value="${esc(pre.no || "")}" placeholder="${esc(t("dc.optional"))}"></label></div>
    <label>${esc(t("dc.dTitle"))}<input name="title" maxlength="200" value="${esc(pre.title || "")}"></label>
    <label data-rcp>${esc(t("dc.recipient"))}<input name="recipient" maxlength="60" list="dcpl" value="${esc(pre.recipient || "")}"><datalist id="dcpl">${S.players.map(p => `<option value="${esc(p.name)}">`).join("")}</datalist></label>
    <label>${esc(t("dc.text"))}<textarea name="text" rows="8" maxlength="6000">${esc(pre.text || "")}</textarea></label>
    <div class="row2"><label>${esc(t("dc.date"))}<input name="date" maxlength="40" value="${esc(pre.date || today())}"></label><span></span></div>
    <div class="row end"><button class="primary">🖼 ${esc(t("dc.make"))}</button></div></form><div data-dcout></div><p class="hint">${esc(t("dc.hint"))}</p>`, { wide: true });
  const f = w.querySelector("[data-dcf]");
  const sync = () => { w.querySelector("[data-rcp]").hidden = !RECIPIENT.includes(f.type.value); };
  if (f.iss) f.iss.onchange = () => { f.type.innerHTML = typeOpts(+f.iss.value); sync(); };
  f.type.onchange = sync; sync();
  f.onsubmit = e => { e.preventDefault(); const x = iss[f.iss ? +f.iss.value : 0];
    showImage(w, { kind: x.kind, role: x.role, name: x.name, type: f.type.value, no: f.no.value.trim(), title: f.title.value.trim(), recipient: f.recipient.value.trim(), text: f.text.value, date: f.date.value.trim() }); };
  if (pre.auto) f.requestSubmit();
}
