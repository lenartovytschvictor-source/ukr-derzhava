// Спільне для державного бота: доступ до бази (серверний ключ Firebase) і Telegram.
// Усі секрети — лише в GitHub: FIREBASE_SERVICE_ACCOUNT, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_THREAD_ID, TELEGRAM_REMIND_THREAD_ID.
import admin from "firebase-admin";

export const SITE = (process.env.SITE_URL || "https://ukr-derzhava.in.ua/").replace(/\/?$/, "/");
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.private_key) { console.error("Немає секрету FIREBASE_SERVICE_ACCOUNT"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: process.env.BACKUP_BUCKET || "ukr-derzhava.firebasestorage.app" });
export { admin };
export const db = admin.firestore();
export const FV = admin.firestore.FieldValue;
export const TS = admin.firestore.Timestamp;

export const TG = {
  token: (process.env.TELEGRAM_BOT_TOKEN || "").trim(),
  chat: (process.env.TELEGRAM_CHAT_ID || "").trim(),
  thread: (process.env.TELEGRAM_THREAD_ID || "").trim(),
  remindThread: (process.env.TELEGRAM_REMIND_THREAD_ID || "").trim(),
};
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const H = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const ms = v => !v ? 0 : typeof v === "number" ? v : v.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : (Date.parse(v) || 0);
export const short = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
export const kyiv = (v, withTime = true) => new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kiev", day: "numeric", month: "long", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(ms(v)));
export const link = (path, text) => `<a href="${SITE}#/${path}">${H(text)}</a>`;

export async function all(col) { const s = await db.collection(col).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
export async function one(col, id) { const s = await db.doc(`${col}/${id}`).get(); return s.exists ? { id: s.id, ...s.data() } : null; }

async function tgCall(method, body, isForm) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://api.telegram.org/bot${TG.token}/${method}`, isForm ? { method: "POST", body } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) return j;
    if (j.parameters && j.parameters.retry_after) { await sleep((j.parameters.retry_after + 1) * 1000); continue; }
    throw new Error(`Telegram: ${j.error_code || r.status} ${j.description || ""}`);
  }
  throw new Error("Telegram: забагато спроб");
}
export const tgApi = tgCall;
// повідомлення в чат (і гілку); якщо є картинка (data:URL) — фото з підписом
export async function tgSend(chat, text, thread, img) {
  if (img && /^data:image\//.test(img) && text.length <= 1000) {
    const [meta, b64] = img.split(",");
    const type = (/data:([^;]+)/.exec(meta) || [])[1] || "image/jpeg";
    const f = new FormData();
    f.append("chat_id", String(chat)); if (thread) f.append("message_thread_id", String(thread));
    f.append("caption", text); f.append("parse_mode", "HTML");
    f.append("photo", new Blob([Buffer.from(b64, "base64")], { type }), "image." + (type.split("/")[1] || "jpg"));
    try { return await tgCall("sendPhoto", f, true); } catch (e) { console.log("Фото не пройшло, надсилаю текстом:", e.message); }
  }
  const body = { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true };
  if (thread) body.message_thread_id = Number(thread);
  return tgCall("sendMessage", body);
}
