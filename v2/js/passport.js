// 🪪 Паспорт громадянина: картинка 1000×640, яку можна завантажити й скинути в чат.
import { S, positionsOf, soldier, rankOf, land, sym } from "./store.js";
import { t } from "./i18n.js";
import { asset } from "./ui.js";

const W = 1000, H = 640;
const load = (src, cors) => new Promise(res => { if (!src) return res(null); const im = new Image(); if (cors) im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const avatarUrl = p => { const n = String(p.profile || "").replace(/\D/g, ""); return p.img || (n ? `https://cdn.dragpolit.com/avatars/users/${n}.webp` : ""); };
function fit(ctx, text, max, font) { let f = font; ctx.font = f; let s = String(text || ""); while (ctx.measureText(s).width > max && s.length > 1) s = s.slice(0, -2) + "…"; return s; }
const mrz = s => String(s || "").toUpperCase().normalize("NFD").replace(/[^A-ZА-ЯІЇЄҐ0-9]/g, "<");

export async function drawPassport(p, withPhoto = true) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), F = '"Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';
  // тло: пергамент + гільйош
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#f8f1df"); g.addColorStop(1, "#eadfc4"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = "rgba(11,61,145,.07)"; c.lineWidth = 1;
  for (let k = 0; k < 26; k++) { c.beginPath(); for (let x = 0; x <= W; x += 6) { const y = 80 + k * 22 + Math.sin(x / 38 + k * .7) * 9 + Math.sin(x / 13 + k) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  // смуга прапора й рамка
  c.fillStyle = "#0057b7"; c.fillRect(0, 0, W, 34); c.fillStyle = "#ffd700"; c.fillRect(0, 34, W, 14);
  c.strokeStyle = "#b8a271"; c.lineWidth = 3; c.strokeRect(14, 62, W - 28, H - 76);
  // герб держави і заголовок
  const coat = await load((S.site && S.site.coat) || asset("img/gerb.png"));
  if (coat) { const s = 92 / Math.max(coat.width, coat.height); c.drawImage(coat, 40, 76, coat.width * s, coat.height * s); }
  c.fillStyle = "#0b3d91"; c.font = `800 34px ${F}`; c.fillText(((S.site && S.site.stateName) || "Українська Держава").toUpperCase(), 150, 112);
  c.fillStyle = "#5b4a24"; c.font = `600 19px ${F}`; c.fillText(t("pp.title") + " · UKRAINIAN STATE · PASSPORT", 150, 142);
  // фото
  const px = 44, py = 196, pw = 230, ph = 290;
  c.fillStyle = "#fff"; c.fillRect(px - 6, py - 6, pw + 12, ph + 12); c.strokeStyle = "#b8a271"; c.lineWidth = 2; c.strokeRect(px - 6, py - 6, pw + 12, ph + 12);
  let ph1 = withPhoto ? await load(avatarUrl(p), true) : null;
  if (ph1) { const s = Math.max(pw / ph1.width, ph / ph1.height), w = ph1.width * s, h = ph1.height * s; c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip(); c.drawImage(ph1, px + (pw - w) / 2, py + (ph - h) / 2, w, h); c.restore(); }
  else { c.fillStyle = "#dbe4f3"; c.fillRect(px, py, pw, ph); c.fillStyle = "#0b3d91"; c.font = `800 110px ${F}`; c.textAlign = "center"; c.fillText((p.name || "?").trim().charAt(0).toUpperCase(), px + pw / 2, py + ph / 2 + 38); c.textAlign = "left"; }
  // поля
  const L = land(p.land), a = soldier(p.id), r = a && rankOf(a), posn = positionsOf(p.id).map(x => x.title);
  const field = (k, v, x, y, w, big) => {
    c.fillStyle = "#7a6738"; c.font = `600 13px ${F}`; c.fillText(String(k).toUpperCase(), x, y);
    c.fillStyle = "#1b2233"; c.fillText(fit(c, v, w, `700 ${big ? 30 : 20}px ${F}`), x, y + (big ? 32 : 24));
  };
  const X1 = 310, X2 = 590, CW2 = 260;
  field(t("pp.f.name"), p.name, X1, 212, 540, true);
  field(t("pp.f.no"), p.profile ? "DragPolit № " + String(p.profile).replace(/\D/g, "") : "—", X1, 282, CW2);
  field(t("pp.f.status"), t(p.status === "cit" ? "pp.s.cit" : p.status === "tour" ? "pp.s.tour" : "pp.s.ex"), X2, 282, CW2);
  field(t("pp.f.land"), L ? L.name : "—", X1, 338, CW2);
  field(t("pp.f.rank"), r ? r.name : "—", X2, 338, CW2);
  field(t("pp.f.post"), posn.slice(0, 2).join(", ") || "—", X1, 394, 540);
  field(t("pp.f.since"), p.since || "—", X1, 450, CW2);
  field(t("pp.f.issued"), new Date().toLocaleDateString("uk-UA"), X2, 450, CW2);
  // герб землі прописки
  const ls = L && sym("land_" + L.id), lc = ls && ls.coat ? await load(ls.coat) : null;
  if (lc) { const s = 78 / Math.max(lc.width, lc.height); c.globalAlpha = .9; c.drawImage(lc, W - 118, 196, lc.width * s, lc.height * s); c.globalAlpha = 1; }
  // нагороди
  const aw = S.grants.filter(x => x.pid === p.id && !x.revoked).map(x => S.awards.find(w => w.id === x.award)).filter(Boolean).slice(0, 10);
  if (aw.length) { c.font = `26px ${F}`; aw.forEach((w, i) => c.fillText(w.emoji || "🏅", W - 122 + (i % 3) * 34, 320 + Math.floor(i / 3) * 36)); }
  // машинозчитуваний рядок — для краси
  c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(14, H - 92, W - 28, 78);
  c.fillStyle = "#1b2233"; c.font = `600 22px "Courier New", monospace`;
  const l1 = ("P<UKR" + mrz(p.name) + "<".repeat(44)).slice(0, 44), l2 = (mrz(String(p.profile || p.id)).padEnd(9, "<") + "<UKR<" + mrz(p.since || "") + "<".repeat(44)).slice(0, 44);
  c.fillText(l1, 40, H - 56); c.fillText(l2, 40, H - 26);
  return cv;
}

export async function passportBlob(p) {
  let cv = await drawPassport(p, true);
  try { return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("blob")), "image/png")); }
  catch (_) {   // фото з іншого сайту заборонило збереження — малюємо з ініціалами
    cv = await drawPassport(p, false);
    return new Promise(res => cv.toBlob(res, "image/png"));
  }
}
