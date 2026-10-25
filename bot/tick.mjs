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


// ---- УД 2.0: особисті сповіщення, щотижневий звіт, дані для команд, перевірка профілів
async function tgPersonal(page) {
  if (!TG.token) return;
  const db = admin.firestore();
  const links = {}; (await db.collection("tglinks").get()).forEach(d => { const v = d.data(); if (v.chat) links[d.id] = v.chat; });
  if (!Object.keys(links).length) { console.log("Особисті: ніхто не підключив Telegram"); return; }
  const evs = await page.evaluate(() => (window.__tgPersonal ? window.__tgPersonal() : []));
  const ref = db.doc("botstate/tgpersonal"); const snap = await ref.get(); const sent = (snap.exists && snap.data().sent) || {}; const now = Date.now(); let n = 0;
  for (const e of evs) {
    const chat = links[String(e.email || "").toLowerCase()]; const k = hid(e.id);
    if (!chat || sent[k]) continue;
    try { await tgSendTo(chat, e.text); sent[k] = now; n++; await sleep(400); } catch (err) { console.log("Особисте не надіслано:", err.message); if (/blocked|chat not found|deactivated/i.test(err.message)) sent[k] = now; }
    if (n >= 40) break;
  }
  for (const [k, t] of Object.entries(sent)) if (now - t > 30 * 86400000) delete sent[k];
  await ref.set({ sent, at: now });
  console.log(`Особисті сповіщення: ${n}`);
}
async function tgSendTo(chat, text) {
  const r = await fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }) });
  const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(`${j.error_code || r.status} ${j.description || ""}`); return true;
}
async function tgWeekly(page) {
  if (!TG.token || !TG.chat) return;
  const w = await page.evaluate(() => (window.__tgWeekly ? window.__tgWeekly() : null)); if (!w) return;
  const ref = admin.firestore().doc("botstate/weekly"); const snap = await ref.get(); if (snap.exists && snap.data().last === w.id) return;
  await tgSend(w.text, TG.thread); await ref.set({ last: w.id, at: Date.now() }); console.log("Щотижневий звіт надіслано");
}
async function saveSummary(page) {
  const sm = await page.evaluate(() => (window.__tgSummary ? window.__tgSummary() : null)); if (!sm) return;
  await admin.firestore().doc("botstate/summary").set({ ...sm, at: Date.now() });
}
async function checkProfiles() {
  const db = admin.firestore(); const q = await db.collection("applications").where("status", "==", "open").get(); let n = 0;
  for (const d of q.docs) {
    const a = d.data(); if (a.check || !a.profile) continue;
    const m = /(\d{2,})/.exec(String(a.profile)); if (!m) { await d.ref.update({ check: { ok: false, at: Date.now() } }); continue; }
    let ok = false, gameName = "";
    try {
      const r = await fetch("https://dragpolit.com/profile/" + m[1], { headers: { "user-agent": "Mozilla/5.0 UkrDerzhavaBot" }, redirect: "follow" });
      if (r.ok) { const html = await r.text(); const t = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i.exec(html) || /<title>([^<]+)<\/title>/i.exec(html); gameName = t ? t[1].replace(/\s*[|–—-]\s*DragPolit.*$/i, "").trim() : ""; ok = !/not found|404|не знайдено/i.test(html.slice(0, 3000)); }
    } catch (e) { console.log("Перевірка профілю:", e.message); continue; }
    const norm = s => String(s || "").toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "");
    await d.ref.update({ check: { ok, gameName: gameName.slice(0, 80), match: gameName ? norm(gameName).includes(norm(a.name)) || norm(a.name).includes(norm(gameName)) : null, at: Date.now() } }); n++;
  }
  if (n) console.log(`Перевірено профілів: ${n}`);
}


// ---- щоденна резервна копія всієї бази у приватне сховище Firebase (backups/…; клієнти туди доступу не мають)
async function dumpRef(ref, depth) {
  const out = {};
  const snap = await ref.get();
  for (const d of snap.docs) {
    const v = { data: d.data() };
    if (depth < 3) { const subs = await d.ref.listCollections(); if (subs.length) { v.subs = {}; for (const c of subs) v.subs[c.id] = await dumpRef(c, depth + 1); } }
    out[d.id] = v;
  }
  return out;
}
async function dailyBackup() {
  const db = admin.firestore();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kiev" }).format(new Date());
  const ref = db.doc("botstate/backup"); const st = await ref.get();
  if (st.exists && st.data().day === day) return;
  const cols = await db.listCollections(); const all = {};
  for (const c of cols) { if (c.id === "botstate") continue; all[c.id] = await dumpRef(c, 0); }
  const bucket = admin.storage().bucket(process.env.BACKUP_BUCKET || "ukr-derzhava.firebasestorage.app");
  const json = JSON.stringify({ at: new Date().toISOString(), collections: all });
  await bucket.file(`backups/${day}.json`).save(json, { contentType: "application/json", resumable: false });
  const stDoc = await db.doc("site/state").get();
  if (stDoc.exists && stDoc.data().json) await bucket.file(`backups/${day}-state.json`).save(stDoc.data().json, { contentType: "application/json", resumable: false });
  // зберігаємо останні 30 днів
  const [files] = await bucket.getFiles({ prefix: "backups/" });
  const days = [...new Set(files.map(f => (/backups\/(\d{4}-\d{2}-\d{2})/.exec(f.name) || [])[1]).filter(Boolean))].sort();
  const old = days.slice(0, Math.max(0, days.length - 30));
  for (const f of files) { const m = /backups\/(\d{4}-\d{2}-\d{2})/.exec(f.name); if (m && old.includes(m[1])) await f.delete().catch(() => {}); }
  await ref.set({ day, at: Date.now(), size: json.length });
  console.log(`Резервна копія за ${day}: ${Math.round(json.length / 1024)} КБ`);
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
  try { await tgPersonal(page); } catch (err) { console.log("Особисті: помилка", err.message); }
  try { await tgWeekly(page); } catch (err) { console.log("Звіт: помилка", err.message); }
  try { await saveSummary(page); } catch (err) { console.log("Зведення: помилка", err.message); }
  try { await checkProfiles(); } catch (err) { console.log("Профілі: помилка", err.message); }
  try { await dailyBackup(); } catch (err) { console.log("Резервна копія: помилка", err.message); }
} finally {
  await browser.close();
}
