// Telegram-бот команд нового сайту. Працює у фоні під час зміни (GitHub Actions).
//   /start КОД — підключити особисті сповіщення (код — у профілі на сайті)
//   /stop — відключити · /закони · /вибори · /новини · /свята · /допомога
import { db, TG, SITE, H, ms, short, kyiv, link, all, sleep, tgApi } from "./lib.mjs";

const END = Date.now() + Number(process.env.TGBOT_MINUTES || 320) * 60000;
if (!TG.token) { console.log("tgbot: немає TELEGRAM_BOT_TOKEN — вимикаюсь"); process.exit(0); }
const reply = (chat, text) => tgApi("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }).catch(e => console.log("tgbot:", e.message));
const HOST = SITE.replace(/^https?:\/\//, "").replace(/\/$/, "");
const HELP = `🤖 <b>Бот «Українська Держава»</b>\n\n/закони — голосування в Палаті й нові закони\n/вибори — вибори, що тривають\n/новини — останні новини\n/свята — найближчі свята\n/stop — вимкнути особисті сповіщення\n\nЩоб отримувати особисті сповіщення, відкрийте на сайті «Профіль» → «Сповіщення в Telegram» → «Підключити».\n<a href="${SITE}">${H(HOST)}</a>`;

async function handle(m) {
  const chat = m.chat && m.chat.id, text = String(m.text || "").trim();
  if (!chat || !text.startsWith("/")) return;
  const [c0, ...args] = text.split(/\s+/); const cmd = c0.replace(/@.*$/, "").toLowerCase();
  const priv = m.chat.type === "private";
  if (cmd === "/start") {
    const code = (args[0] || "").trim().toUpperCase();
    if (!code) return reply(chat, HELP);
    if (!priv) return reply(chat, "Підключайте сповіщення в особистих повідомленнях із ботом.");
    const q = await db.collection("ud_tgcodes").where("code", "==", code).limit(1).get();
    if (q.empty) return reply(chat, "❌ Код не знайдено або він уже використаний. Створіть новий у профілі на сайті.");
    const d = q.docs[0];
    if (Date.now() - ms(d.data().at) > 24 * 3600e3) { await d.ref.delete(); return reply(chat, "⌛ Код застарів. Створіть новий у профілі на сайті."); }
    await db.doc("ud_tglinks/" + d.id).set({ chat, user: (m.from && (m.from.username || m.from.first_name)) || "", at: Date.now() });
    await d.ref.delete();
    return reply(chat, "✅ Сповіщення підключено.\nСюди приходитимуть призначення, зірочки й нагороди, виклики до суду, згадки в чаті й нові особисті повідомлення.\n\n/допомога — усі команди");
  }
  if (cmd === "/stop") {
    const q = await db.collection("ud_tglinks").where("chat", "==", chat).get();
    for (const d of q.docs) await d.ref.delete();
    return reply(chat, "🔕 Особисті сповіщення вимкнено. Увімкнути знову — у профілі на сайті.");
  }
  if (cmd === "/help" || cmd === "/допомога") return reply(chat, HELP);
  if (cmd === "/закони" || cmd === "/laws") {
    const bills = (await all("ud_bills")).filter(b => b.status === "voting");
    const laws = (await all("ud_laws")).filter(l => l.kind === "law").sort((a, b) => ms(b.at) - ms(a.at)).slice(0, 5);
    return reply(chat, `🗳 <b>Голосування в Палаті Земель</b>\n${bills.map(b => `• ${link("derzhava/palata/" + b.id, b.title)} — до ${H(kyiv(b.voteEnd))}`).join("\n") || "Зараз нічого не голосується."}\n\n📜 <b>Нещодавні закони</b>\n${laws.map(l => `• ${link("zakon/zakony/" + l.id, `№ ${l.no} «${l.title}»`)}`).join("\n") || "—"}`);
  }
  if (cmd === "/вибори" || cmd === "/elections") {
    const els = (await all("ud_elections")).filter(e => ["nomination", "voting"].includes(e.stage));
    return reply(chat, `🗳 <b>Вибори</b>\n${els.map(e => `• ${link("derzhava/vybory/" + e.id, e.title)} — ${e.stage === "nomination" ? "висування до " + H(kyiv(e.nomEnd)) : "голосування до " + H(kyiv(e.voteEnd))}`).join("\n") || "Зараз виборів немає."}`);
  }
  if (cmd === "/новини" || cmd === "/news") {
    const n = (await all("ud_news")).sort((a, b) => ms(b.at) - ms(a.at)).slice(0, 5);
    return reply(chat, `📰 <b>Новини</b>\n${n.map(x => `• ${link("novyny/" + x.id, x.title)}\n  <i>${H(short(x.text, 120))}</i>`).join("\n") || "Новин ще немає."}`);
  }
  if (cmd === "/свята" || cmd === "/holidays") {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const next = h => { if (h.yearly) { const [mm, dd] = String(h.date).split("-").map(Number); let x = new Date(now.getFullYear(), mm - 1, dd); if (x < now) x = new Date(now.getFullYear() + 1, mm - 1, dd); return x; } const x = new Date(h.date + "T00:00:00"); return x < now ? null : x; };
    const list = (await all("ud_holidays")).map(h => ({ h, d: next(h) })).filter(x => x.d).sort((a, b) => a.d - b.d).slice(0, 5);
    return reply(chat, `📅 <b>Найближчі свята</b>\n${list.map(({ h, d }) => `• ${H(kyiv(d, false))} — ${h.kind === "church" ? "⛪" : "🏛"} ${H(h.name)}`).join("\n") || "У календарі порожньо."}`);
  }
}

let offset = 0;
try { const s = await db.doc("ud_bot/tgbot").get(); if (s.exists) offset = s.data().offset || 0; } catch (_) {}
console.log("tgbot: слухаю команди…");
while (Date.now() < END) {
  try {
    const j = await tgApi("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });
    for (const u of j.result) { offset = u.update_id + 1; try { if (u.message) await handle(u.message); } catch (e) { console.log("tgbot: помилка", e.message); } }
    if (j.result.length) await db.doc("ud_bot/tgbot").set({ offset, at: Date.now() });
  } catch (e) {
    if (/409/.test(e.message)) { console.log("tgbot: інший екземпляр уже слухає — чекаю"); await sleep(60000); }
    else { console.log("tgbot: мережа", e.message); await sleep(5000); }
  }
}
console.log("tgbot: зміна закінчилась");
process.exit(0);
