// Дрібні помічники інтерфейсу: екранування, аватарки, повідомлення, вікна.
import { t } from "./i18n.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const attr = esc;

// аватарка: своя картинка → аватар із гри (webp, потім jpg) → ініціали
export function avatar(p, cls = "av") {
  const name = (p && p.name) || "?";
  const ini = esc(name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase());
  const src = p && p.img ? p.img : (p && /^\d+$/.test(String(p.profile || "")) ? `https://cdn.dragpolit.com/avatars/users/${p.profile}.webp` : "");
  if (!src) return `<span class="${cls} ini" aria-hidden="true">${ini}</span>`;
  const alt2 = p && !p.img && p.profile ? `https://cdn.dragpolit.com/avatars/users/${p.profile}.jpg` : "";
  return `<span class="${cls}"><span class="avi" aria-hidden="true">${ini}</span><img src="${esc(src)}" alt="" loading="lazy" data-alt="${esc(alt2)}" data-ini="${ini}"></span>`;
}
// якщо картинка не завантажилась — пробуємо .jpg, потім ініціали
document.addEventListener("error", e => {
  const im = e.target;
  if (!(im instanceof HTMLImageElement) || !im.dataset.ini) return;
  if (im.dataset.alt) { const a = im.dataset.alt; im.dataset.alt = ""; im.src = a; return; }
  im.parentElement.classList.add("ini"); im.remove();
}, true);

export const profUrl = p => (p && /^\d+$/.test(String(p.profile || ""))) ? `https://dragpolit.com/profile/${p.profile}` : "";

// ---------- повідомлення внизу екрана ----------
let toastT = 0;
export function toast(msg, kind = "") {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.className = "show " + kind; el.textContent = msg;
  clearTimeout(toastT); toastT = setTimeout(() => { el.className = ""; }, kind === "err" ? 6000 : 3000);
}
export function errMsg(e) {
  const m = String(e && (e.code || e.message) || e);
  if (/permission|insufficient/i.test(m)) return t("err.perm");
  if (/network|offline|unavailable/i.test(m)) return t("err.net");
  return t("err.generic") + " " + m.slice(0, 120);
}
// обгортка для дій: показує помилку замість тихого падіння; повертає false, якщо не вдалося
export async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg, "ok"); return r === undefined ? true : r; }
  catch (e) { console.error(e); toast(errMsg(e), "err"); return false; }
}

// ---------- вікно ----------
export function modal(title, bodyHtml, { wide = false, onMount } = {}) {
  closeModal();
  const w = document.createElement("div");
  w.id = "modal"; w.className = "modal";
  w.innerHTML = `<div class="mback" data-close></div><div class="mbox${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="mhead"><h3>${esc(title)}</h3><button type="button" class="icon" data-close aria-label="${esc(t("close"))}">✕</button></div>
    <div class="mbody">${bodyHtml}</div></div>`;
  document.body.appendChild(w);
  w.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  const f = w.querySelector("input,select,textarea,button:not([data-close])"); if (f) f.focus();
  if (onMount) onMount(w);
  return w;
}
export function closeModal() { const m = document.getElementById("modal"); if (m) m.remove(); }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

export function confirmBox(text, yes = t("yes")) {
  return new Promise(res => {
    const w = modal(t("confirm"), `<p>${esc(text)}</p><div class="row end"><button type="button" class="ghost" data-no>${esc(t("cancel"))}</button><button type="button" class="danger" data-yes>${esc(yes)}</button></div>`);
    w.querySelector("[data-yes]").onclick = () => { closeModal(); res(true); };
    w.querySelector("[data-no]").onclick = () => { closeModal(); res(false); };
  });
}

// зменшення картинки перед збереженням (аватарки, прапори)
export function pickImage(max = 160) {
  return new Promise(res => {
    const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
    i.onchange = () => {
      const f = i.files[0]; if (!f) return res("");
      const r = new FileReader();
      r.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL("image/webp", 0.85));
        };
        im.src = r.result;
      };
      r.readAsDataURL(f);
    };
    i.click();
  });
}

export const fmtDate = v => {
  const d = v && v.toDate ? v.toDate() : (typeof v === "number" ? new Date(v) : v && v.seconds ? new Date(v.seconds * 1000) : null);
  return d ? d.toLocaleString(document.documentElement.lang || "uk", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
};
export const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
export const normEmail = s => String(s || "").trim().toLowerCase();
export const okEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(s));
export const profNum = s => { const m = String(s || "").match(/(\d{1,7})\s*\/?\s*$/); return m ? m[1] : ""; };

// шлях до файлу сайту (картинки, дані) — працює і з /v2/, і з кореня домену
export const asset = p => new URL("../" + p, import.meta.url).href;
