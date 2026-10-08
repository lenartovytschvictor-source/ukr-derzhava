// Державний бот: раз на 15 хвилин відкриває сайт з правами адміна,
// закриває голосування й виконує прийняті закони.
import admin from "firebase-admin";
import { chromium } from "playwright";

const SITE = process.env.SITE_URL || "https://lenartovytschvictor-source.github.io/ukr-derzhava/";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.private_key) { console.error("Немає секрету FIREBASE_SERVICE_ACCOUNT"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const token = await admin.auth().createCustomToken("derzhava-bot", { bot: true });

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
  await page.waitForTimeout(3000);
} finally {
  await browser.close();
}
