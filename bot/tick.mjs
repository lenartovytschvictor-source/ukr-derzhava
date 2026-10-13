// Державний бот: раз на 15 хвилин відкриває сайт з правами адміна,
// закриває голосування, виконує прийняті закони
// і постить вісті держави в гілку Telegram.
import admin from "firebase-admin";
import { chromium } from "playwright";
import { createHash } from "node:crypto";

const SITE = process.env.SITE_URL || "https://ukr-derzhava.in.ua/";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.private_key) { console.error("Немає секрету FIREBASE_SERVICE_ACCOUNT"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const token = await admin.auth().createCustomToken("derzhava-bot", { bot: true });

// ---- Telegram
const TG = {
  token: (process.env.TELEGRAM_BOT_TOKEN || "").trim(),
  chat: (process.env.TELEGRAM_CHAT_ID || "").trim(),
  thread: (process.env.TELEGRAM_THREAD_ID || "").trim(),
  remindThread: (process.env.TELEGRAM_REMIND_THREAD_ID || "").trim(),
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function tgSend(text, thread) {
  const body = { chat_id: TG.chat, text, parse_mode: "HTML", disable_web_page_preview: true };
  if (thread) body.message_thread_id = Number(thread);
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) return true;
    if (j.parameters && j.parameters.retry_after) { await sleep((j.parameters.retry_after + 1) * 1000); continue; }
    throw new Error(`Telegram: ${j.error_code || r.status} ${j.description || ""}`);
  }
  return false;
}
const hid = s => createHash("sha1").update(s).digest("hex").slice(0, 20);

async function telegram(page) {
  if (!TG.token || !TG.chat) { console.log("Telegram: секретів немає — пропускаю"); return; }
  const feed = await page.evaluate(() => (window.__tgFeed ? window.__tgFeed() : []));
  const ref = admin.firestore().doc("botstate/telegram");
  const snap = await ref.get();
  const first = !snap.exists;
  const sent = (snap.exists && snap.data().sent) || {};
  const now = Date.now();
  const fresh = feed.filter(e => !sent[hid(e.id)]);
  const mark = e => { sent[hid(e.id)] = now; };

  if (first) {
    // Перший запуск: вітаємось і постимо лише свіже (за останні 6 годин), старе позначаємо як надіслане.
    const recent = fresh.filter(e => e.kind !== "minor" && now - e.at < 6 * 3600000).slice(-8);
    fresh.forEach(e => { if (!recent.includes(e)) mark(e); });
    await tgSend("🤖 <b>Бот «Українська Держава» підключено</b>\n\nТут з’являтимуться укази, закони, рішення Суду, відзнаки й нагадування про голосування в Палаті Земель.\n\n" + `<a href="${SITE}">${SITE.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>`, TG.thread);
    for (const e of recent) {
      const th = e.kind === "remind" && TG.remindThread ? TG.remindThread : TG.thread;
      try { await sleep(1200); await tgSend(e.text, th); mark(e); } catch (err) { console.log("Не вдалося надіслати:", err.message); break; }
    }
    console.log(`Telegram: привітання надіслано, свіжих подій ${recent.length}`);
  } else {
    const main = fresh.filter(e => e.kind !== "minor");
    const minor = fresh.filter(e => e.kind === "minor");
    let n = 0;
    for (const e of main.slice(0, 8)) {
      const th = e.kind === "remind" && TG.remindThread ? TG.remindThread : TG.thread;
      try { await tgSend(e.text, th); mark(e); n++; await sleep(1200); }
      catch (err) { console.log("Не вдалося надіслати:", err.message); break; }
    }
    if (minor.length) {
      const lines = minor.slice(-15).map(e => "• " + e.text);
      try {
        await tgSend("📖 <b>Літопис держави</b>\n\n" + lines.join("\n") + (minor.length > 15 ? `\n…і ще ${minor.length - 15}` : "") + `\n\n<a href="${SITE}#home">Відкрити на сайті</a>`, TG.thread);
        minor.forEach(mark); n++;
      } catch (err) { console.log("Не вдалося надіслати дайджест:", err.message); }
    }
    console.log(`Telegram: надіслано ${n}, нових подій ${fresh.length}`);
  }
  // Прибираємо старі позначки (події старші за 48 год. бот однаково не бере).
  for (const [k, t] of Object.entries(sent)) if (now - t > 7 * 86400000) delete sent[k];
  await ref.set({ sent, at: now });
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log("[сайт]", m.text()); });
  await page.goto(SITE + "?bot=1&t=" + Date.now(), { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => typeof window.__botLogin === "function", null, { timeout: 60000 });
  await page.evaluate(t => window.__botLogin(t), token);
  await page.waitForFunction(() => window.__BOT_READY === true, null, { timeout: 90000 });
  const result = await page.evaluate(() => window.__botTick());
  console.log("Результат:", result);
  await page.waitForTimeout(4000);
  try { await telegram(page); } catch (err) { console.log("Telegram: помилка", err.message); }
} finally {
  await browser.close();
}
