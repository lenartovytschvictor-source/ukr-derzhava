// Telegram-бот команд «Українська Держава» 2.0.
// Працює у фоні під час зміни державного бота (GitHub Actions): слухає повідомлення й одразу відповідає.
//   /start КОД — підключити особисті сповіщення (код береться в «Моєму кабінеті» на сайті)
//   /stop — відключити сповіщення
//   /казна, /закони, /мій_внесок, /допомога
// Токен — лише із секрету TELEGRAM_BOT_TOKEN у GitHub; на сайті його немає.
import admin from "firebase-admin";

const SITE = process.env.SITE_URL || "https://ukr-derzhava.in.ua/";
const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const END = Date.now() + (Number(process.env.TGBOT_MINUTES || 320) * 60000);
if (!TOKEN) { console.log("tgbot: немає TELEGRAM_BOT_TOKEN — вимикаюсь"); process.exit(0); }
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.private_key) { console.log("tgbot: немає FIREBASE_SERVICE_ACCOUNT"); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const API = m => `https://api.telegram.org/bot${TOKEN}/${m}`;
const H = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(method, body) {
  const r = await fetch(API(method), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}
const reply = (chat, text) => call("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true });

async function emailOfChat(chat) {
  const q = await db.collection("tglinks").where("chat", "==", chat).limit(1).get();
  return q.empty ? "" : q.docs[0].id;
}
async function summary() { const s = await db.doc("botstate/summary").get(); return s.exists ? s.data() : {}; }

const HELP = `🤖 <b>Бот «Українська Держава»</b>\n\n/казна — що зараз у державній скарбниці\n/закони — голосування в Палаті й нові закони\n/мій_внесок — ваш тижневий внесок і борги\n/stop — вимкнути особисті сповіщення\n\nЩоб отримувати сповіщення, відкрийте на сайті «Мій кабінет» → «Підключити сповіщення» і надішліть сюди команду з кодом.\n<a href="${SITE}">${SITE.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>`;

async function handle(m) {
  const chat = m.chat && m.chat.id; const text = String(m.text || "").trim(); if (!chat || !text.startsWith("/")) return;
  const [cmd0, ...args] = text.split(/\s+/); const cmd = cmd0.replace(/@.*$/, "").toLowerCase();
  const priv = m.chat.type === "private";
  if (cmd === "/start") {
    const code = (args[0] || "").trim().toUpperCase();
    if (!code) return reply(chat, HELP);
    if (!priv) return reply(chat, "Підключайте сповіщення в особистих повідомленнях із ботом.");
    let q = await db.collection("tgcodes").where("code", "==", code).limit(1).get();
    if (q.empty) q = await db.collection("profiles").where("tgcode", "==", code).limit(1).get();
    if (q.empty) return reply(chat, "❌ Код не знайдено. Створіть новий у «Моєму кабінеті» на сайті.");
    const email = q.docs[0].id;
    await db.doc("tglinks/" + email).set({ chat, user: m.from && (m.from.username || m.from.first_name) || "", at: Date.now() });
    return reply(chat, `✅ Сповіщення підключено.\nТепер сюди приходитимуть голосування в Палаті, нагадування про внески й виклики до Суду.\n\n/допомога — усі команди`);
  }
  if (cmd === "/stop") { const e = await emailOfChat(chat); if (e) await db.doc("tglinks/" + e).delete(); return reply(chat, "🔕 Особисті сповіщення вимкнено. Увімкнути знову — у «Моєму кабінеті» на сайті."); }
  if (cmd === "/help" || cmd === "/допомога") return reply(chat, HELP);
  if (cmd === "/казна" || cmd === "/treasury") { const s = await summary(); return reply(chat, `🏛 <b>Державна скарбниця</b>\n${(s.treasury || []).map(x => "• " + H(x)).join("\n") || "Даних ще немає."}\n\n<a href="${SITE}#econ">Економіка на сайті</a>`); }
  if (cmd === "/закони" || cmd === "/laws") { const s = await summary(); const o = (s.open || []).map(b => `• «${H(b.title)}» — до ${H(b.closes)}`).join("\n"); const p = (s.passed || []).map(t => `• ${H(t)}`).join("\n");
    return reply(chat, `🗳 <b>На голосуванні</b>\n${o || "Зараз нічого не голосується."}\n\n📜 <b>Нещодавно прийняті</b>\n${p || "—"}\n\n<a href="${SITE}#parl">Палата Земель</a>`); }
  if (cmd === "/мій_внесок" || cmd === "/внесок" || cmd === "/dues") {
    const e = await emailOfChat(chat); if (!e) return reply(chat, "Спершу підключіть акаунт: «Мій кабінет» на сайті → «Підключити сповіщення».");
    const s = await summary(); const d = (s.dues || {})[e]; return reply(chat, d && d.length ? `💰 <b>Ваші тижневі внески</b>\n${d.map(x => "• " + H(x)).join("\n")}\n\n<a href="${SITE}#econ">Позначити здачу</a>` : "У вас немає тижневих внесків — їх здають Крайові Осавули й Старости.");
  }
}

let offset = 0;
try { const st = await db.doc("botstate/tgbot").get(); if (st.exists) offset = st.data().offset || 0; } catch (_) {}
console.log("tgbot: слухаю команди…");
while (Date.now() < END) {
  try {
    const j = await call("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });
    if (j.ok) {
      for (const u of j.result) { offset = u.update_id + 1; try { if (u.message) await handle(u.message); } catch (e) { console.log("tgbot: помилка", e.message); } }
      if (j.result.length) await db.doc("botstate/tgbot").set({ offset, at: Date.now() });
    } else { if (j.error_code === 409) { console.log("tgbot: інший екземпляр уже слухає — чекаю"); await sleep(60000); } else await sleep(5000); }
  } catch (e) { console.log("tgbot: мережа", e.message); await sleep(5000); }
}
console.log("tgbot: зміна закінчилась");
process.exit(0);
