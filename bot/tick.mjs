// Державний бот (новий сайт): раз на 15 хвилин
//  1) закриває голосування в Палаті й вибори за таймером (так само, як кнопки на сайті);
//  2) публікує події держави в гілку Telegram;
//  3) надсилає особисті сповіщення тим, хто підключив Telegram у профілі;
//  4) раз на добу робить резервну копію в приватне сховище Firebase.
// Працює напряму з базою серверним ключем — без браузера.
import { admin, db, FV, TS, TG, SITE, H, ms, short, kyiv, link, all, one, sleep, tgSend } from "./lib.mjs";
import { readFileSync } from "node:fs";
// спільний із сайтом модуль автоматичних дій законів (лежить у папці сайту v2)
import { fxOps, fxPending } from "../v2/js/effects.js";

const NOW = Date.now();
const LOG = [];
const say = s => { console.log(s); LOG.push(s); };
const CHDEF = { hours: 24, quorum: 50, petition: 5, nomHours: 48, voteHours: 48 };

// ---------- 1. Таймери ----------
async function timers(D) {
  const CH = { ...CHDEF, ...((await one("ud_config", "chamber")) || {}) };
  const players = new Set(D.players.map(p => p.id));
  // члени Палати — унікальні люди на місцях Палати
  const members = [...new Set(D.positions.filter(p => ["chair", "zemska", "sotenna"].includes(p.chamber) && p.holder && players.has(p.holder)).map(p => p.holder))];
  const need = Math.floor(members.length * CH.quorum / 100) + 1;
  for (const b of D.bills.filter(b => b.status === "voting" && ms(b.voteEnd) && ms(b.voteEnd) <= NOW)) {
    const votes = (await db.collection(`ud_bills/${b.id}/votes`).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(v => members.includes(v.id));
    const c = { for: 0, against: 0, abstain: 0 }; votes.forEach(v => { if (c[v.v] != null) c[v.v]++; });
    const cast = c.for + c.against + c.abstain, pass = cast >= need && c.for > c.against;
    const status = pass ? "passed" : "rejected";
    await db.doc(`ud_bills/${b.id}`).update({ status, result: { ...c, cast, need, seats: members.length }, closedAt: FV.serverTimestamp() });
    b.status = status; b.result = { ...c, cast, need };
    say(`Палата: «${b.title}» — ${pass ? "ухвалено" : "відхилено"} (${c.for}/${c.against}/${c.abstain}, кворум ${need})`);
    if (pass && b.kind === "call" && b.target) {
      const p = D.positions.find(x => x.id === b.target);
      if (p && !D.elections.some(e => e.pos === p.id && ["nomination", "voting"].includes(e.stage))) {
        const ref = db.collection("ud_elections").doc();
        const e = { pos: p.id, title: p.title, scope: p.land || "", stage: "nomination", nomEnd: TS.fromMillis(NOW + CH.nomHours * 3600e3), voteHours: CH.voteHours, bill: b.id, by: "bot", at: FV.serverTimestamp() };
        await ref.set(e); D.elections.push({ id: ref.id, ...e, at: TS.now() });
        say(`Вибори оголошено постановою: ${p.title}`);
      }
    }
  }
  // подолання вето: потрібно «За» щонайменше override% (типово 67%) від тих, хто голосував, і кворум
  for (const b of D.bills.filter(b => b.status === "override" && ms(b.ovEnd) && ms(b.ovEnd) <= NOW)) {
    const votes = (await db.collection(`ud_bills/${b.id}/ovotes`).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(v => members.includes(v.id));
    const c = { for: 0, against: 0, abstain: 0 }; votes.forEach(v => { if (c[v.v] != null) c[v.v]++; });
    const cast = c.for + c.against + c.abstain, pass = cast >= need && c.for * 100 >= cast * (CH.override || 67);
    const res = { ...c, cast, need, seats: members.length };
    if (!pass) {
      await db.doc(`ud_bills/${b.id}`).update({ status: "vetoed", ovResult: res, ovDone: true });
      Object.assign(b, { status: "vetoed", ovResult: res, ovDone: true });
      say(`Палата: вето на «${b.title}» не подолано`); continue;
    }
    const no = Math.max(0, ...D.laws.filter(l => l.kind === "law").map(l => l.no || 0)) + 1;
    const ref = db.collection("ud_laws").doc();
    const law = { kind: "law", no, title: b.title, text: b.text || "", code: "", status: "active", date: new Date(NOW).toISOString().slice(0, 10), by: "", bill: b.id, note: "override", at: FV.serverTimestamp() };
    const batch = db.batch();
    batch.update(db.doc(`ud_bills/${b.id}`), { status: "overridden", ovResult: res, ovDone: true });
    batch.set(ref, law); await batch.commit();
    Object.assign(b, { status: "overridden", ovResult: res, ovDone: true }); D.laws.push({ id: ref.id, ...law, at: TS.now() });
    say(`Палата подолала вето: «${b.title}» → закон № ${no}`);
  }
  for (const e of D.elections) {
    // висування скінчилось → голосування (список виборців фіксується зараз)
    if (e.stage === "nomination" && ms(e.nomEnd) && ms(e.nomEnd) <= NOW) {
      const cands = (await db.collection(`ud_elections/${e.id}/cands`).get()).size;
      if (!cands) { await db.doc(`ud_elections/${e.id}`).update({ stage: "cancelled", closedAt: FV.serverTimestamp(), note: "no-candidates" }); e.stage = "cancelled"; say(`Вибори «${e.title}» скасовано: немає кандидатів`); continue; }
      const voters = D.players.filter(p => p.status === "cit" && (!e.scope || p.land === e.scope)).map(p => p.id);
      const vh = e.voteHours || CH.voteHours;
      await db.doc(`ud_elections/${e.id}`).update({ stage: "voting", voters, voteEnd: TS.fromMillis(NOW + vh * 3600e3) });
      Object.assign(e, { stage: "voting", voters, voteEnd: TS.fromMillis(NOW + vh * 3600e3) });
      say(`Вибори «${e.title}»: почалось голосування (${voters.length} виборців)`);
    } else if (e.stage === "voting" && ms(e.voteEnd) && ms(e.voteEnd) <= NOW) {
      const cand = new Set((await db.collection(`ud_elections/${e.id}/cands`).get()).docs.map(d => d.id));
      const votes = (await db.collection(`ud_elections/${e.id}/votes`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
      const voters = new Set(e.voters || []), results = {}; let turnout = 0;
      votes.forEach(v => { if (voters.has(v.id) && cand.has(v.cand)) { results[v.cand] = (results[v.cand] || 0) + 1; turnout++; } });
      const top = Math.max(0, ...Object.values(results)), leaders = Object.keys(results).filter(k => results[k] === top);
      const winner = top > 0 && leaders.length === 1 ? leaders[0] : "";
      const stage = top > 0 && leaders.length > 1 ? "tie" : "done";
      const batch = db.batch();
      batch.update(db.doc(`ud_elections/${e.id}`), { stage, results, turnout, winner, closedAt: FV.serverTimestamp() });
      const wp = winner && D.positions.find(p => p.id === e.pos);
      if (wp) batch.update(db.doc(`ud_positions/${e.pos}`), { holder: winner, since: FV.serverTimestamp() });
      await batch.commit();
      if (wp) Object.assign(wp, { holder: winner, since: TS.now() });
      Object.assign(e, { stage, results, turnout, winner });
      say(`Вибори «${e.title}»: ${stage === "tie" ? "нічия" : winner ? "переможець " + ((D.players.find(p => p.id === winner) || {}).name || winner) : "без голосів"}`);
    }
  }
}

// ---------- 1б. Автоматичні дії законів і кінець надзвичайного стану ----------
async function effects(D) {
  const pend = D.bills.filter(b => fxPending(b) && !b.fxErr);   // з помилкою — не повторюємо, адмін виправить і натисне «Виконати зараз»
  const site = (await one("ud_config", "site")) || {};
  if (site.emergency && site.emergency.on && ms(site.emergency.until) && ms(site.emergency.until) <= NOW) {
    await db.doc("ud_config/site").set({ emergency: { ...site.emergency, on: false, ended: NOW } }, { merge: true });
    say("Надзвичайний стан закінчився за строком");
  }
  if (!pend.length) return;
  let landsList = ((await one("ud_config", "lands")) || {}).list;
  if (!Array.isArray(landsList)) { try { landsList = JSON.parse(readFileSync(new URL("../v2/data/lands-default.json", import.meta.url))); } catch (_) { landsList = []; } }
  const places = await all("ud_places"), constitution = await one("ud_law", "constitution");
  for (const b of pend) {
    const law = D.laws.find(l => l.bill === b.id) || null;
    try {
      const ops = fxOps(b, { positions: D.positions, lands: landsList, places, laws: D.laws, holidays: D.holidays, constitution, law }, FV.serverTimestamp());
      const batch = db.batch();
      for (const o of ops) {
        const r = db.doc(`${o.c}/${o.id}`);
        if (o.op === "set") batch.set(r, o.v, o.merge ? { merge: true } : {});
        else if (o.op === "update") batch.update(r, o.v);
        else if (o.op === "del") batch.delete(r);
      }
      batch.update(db.doc(`ud_bills/${b.id}`), { fxDone: true, fxAt: FV.serverTimestamp(), fxErr: "" });
      await batch.commit();
      b.fxDone = true; b.fxAt = TS.now();
      // наступні дії в цьому ж запуску бачать нові землі й Конституцію
      for (const o of ops) if (o.c === "ud_config" && o.id === "lands") landsList = o.v.list;
      say(`Закон «${b.title}»: виконано — ${b.fxText || b.fx.type}`);
    } catch (err) {
      await db.doc(`ud_bills/${b.id}`).update({ fxErr: String(err.message || err).slice(0, 200) });
      say(`Закон «${b.title}»: не вдалося виконати — ${err.message}`);
    }
  }
}

// ---------- 2. Стрічка подій у Telegram ----------
const name = (D, pid) => (D.players.find(p => p.id === pid) || {}).name || "—";
function feed(D) {
  const ev = [];
  const add = (key, at, text, o = {}) => ev.push({ key, at: ms(at) || NOW, text, ...o });
  for (const n of D.news) add("n:" + n.id, n.at, `📰 <b>${H(n.title)}</b>\n\n${H(short(n.text, 700))}\n\n${link("novyny/" + n.id, "Читати на сайті")}`, { img: n.img });
  const codes = Object.fromEntries(D.codes.map(c => [c.id, c.name]));
  for (const l of D.laws) {
    if (l.kind === "decree") add("d:" + l.id, l.at, `🪶 <b>Указ Гетьмана № ${l.no}</b>\n«${H(l.title)}»\n\n${H(short(l.text, 400))}\n\n${link("zakon/zakony/" + l.id, "Текст указу")}`);
    else add("l:" + l.id, l.at, `📜 <b>Закон № ${l.no} підписано</b>\n«${H(l.title)}»${l.code && codes[l.code] ? `\n📘 ${H(codes[l.code])}` : ""}\n\n${link("zakon/zakony/" + l.id, "Текст закону")}`);
  }
  for (const b of D.bills) {
    if (b.status === "voting" && b.voteEnd) add("bv:" + b.id, b.voteStart || NOW, `🗳 <b>Палата Земель голосує</b>\n«${H(b.title)}»\nДо ${H(kyiv(b.voteEnd))}\n\n${link("derzhava/palata/" + b.id, "Проголосувати")}`, { remind: true });
    if (["passed", "rejected", "signed", "vetoed"].includes(b.status) && b.result) {
      const r = b.result, ok = b.status !== "rejected";
      add("br:" + b.id, b.closedAt || NOW, `${ok ? "✅ Палата Земель ухвалила" : "❌ Палата Земель відхилила"} «${H(b.title)}»\nЗа ${r.for || 0} · проти ${r.against || 0} · утрималось ${r.abstain || 0}\n\n${link("derzhava/palata/" + b.id, "Деталі")}`);
    }
    if (b.status === "vetoed" || b.ovResult) add("bx:" + b.id, b.signedAt || NOW, `⛔ Гетьман ветував закон «${H(b.title)}»`);
    if (b.status === "override" && b.ovEnd) add("bo:" + b.id, b.ovStart || NOW, `🔁 <b>Палата голосує за подолання вето</b>\n«${H(b.title)}»\nДо ${H(kyiv(b.ovEnd))}\n\n${link("derzhava/palata/" + b.id, "Проголосувати")}`, { remind: true });
    if (b.status === "overridden") add("bo2:" + b.id, NOW, `💪 <b>Палата Земель подолала вето</b>\n«${H(b.title)}» набрав чинності без підпису Гетьмана`);
    if (b.fxDone && b.fxText) add("fx:" + b.id, b.fxAt || NOW, `⚙️ За законом «${H(b.title)}»: ${H(b.fxText)}`);
  }
  for (const e of D.elections) {
    add("en:" + e.id, e.at, `🗳 <b>Оголошено вибори: ${H(e.title)}</b>\nВисування кандидатів до ${H(kyiv(e.nomEnd))}${e.scope ? "\nГолосують прописані в землі" : ""}\n\n${link("derzhava/vybory/" + e.id, "Висунутись")}`);
    if (["voting", "done", "tie"].includes(e.stage) && e.voteEnd) add("ev:" + e.id, ms(e.voteEnd) - (e.voteHours || 48) * 3600e3, `🗳 <b>Вибори «${H(e.title)}»: голосування</b>\nДо ${H(kyiv(e.voteEnd))}\n\n${link("derzhava/vybory/" + e.id, "Проголосувати")}`, { remind: true });
    if (e.stage === "done" && e.winner) add("er:" + e.id, e.closedAt || NOW, `🏆 <b>${H(e.title)}</b>: обрано ${H(name(D, e.winner))}\nПроголосувало ${e.turnout || 0} з ${(e.voters || []).length}`);
    if (e.stage === "tie") add("er:" + e.id, e.closedAt || NOW, `⚖️ Вибори «${H(e.title)}» завершились нічиєю — потрібні повторні вибори.`);
  }
  if (D.site && D.site.emergency && D.site.emergency.from) {
    const em = D.site.emergency;
    add("em:" + em.from, em.from, `🚨 <b>Запроваджено надзвичайний стан</b>${em.reason ? "\n" + H(em.reason) : ""}\nДо ${H(kyiv(em.until))}`);
    if (!em.on || ms(em.until) <= NOW) add("em2:" + em.from, Math.min(NOW, ms(em.ended) || ms(em.until) || NOW), "✅ Надзвичайний стан завершено");
  }
  for (const x of D.chdocs || []) add("chd:" + x.id, x.at, `${x.kind === "msg" ? "✉️ <b>Послання Патріарха</b>" : `📜 <b>Постанова Церкви № ${x.no || "?"}</b>`}\n«${H(x.title)}»\n\n${H(short(x.text, 500))}\n\n${link("narod/tserkva", "Церква")}`);
  for (const c of D.cases) if (!c.closed && c.status === "verdict") add("cv:" + c.id, c.decidedAt, `⚖️ <b>Суд: вирок у справі № ${c.no}</b>\n«${H(c.title)}»\n${H(name(D, c.plaintiff))} ⟶ ${H(name(D, c.defendant))}\n\n${link("zakon/sud/" + c.id, "Вирок")}`);
  const awards = Object.fromEntries(D.awards.map(a => [a.id, a]));
  for (const g of D.grants) if (!g.revoked && awards[g.award]) add("aw:" + g.id, g.at, `🏅 ${H(name(D, g.pid))} нагороджено «${H(awards[g.award].name)}»${g.reason ? `\n${H(short(g.reason, 200))}` : ""}`);
  for (const t of D.treaties) { const s = D.states.find(x => x.id === t.state); add("tr:" + t.id, Date.parse((t.signed || "") + "T12:00:00") || NOW, `🤝 <b>Угода${s ? " з " + H(s.name) : ""}</b>\n«${H(t.title)}»\n\n${link("derzhava/dyplomatiya", "Дипломатія")}`); }
  // свято сьогодні (за київським часом, після 8:00)
  const kd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kiev" }).format(new Date(NOW));
  const kh = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kiev", hour: "2-digit", hour12: false }).format(new Date(NOW)));
  if (kh >= 8) for (const h of D.holidays) if ((h.yearly ? kd.slice(5) === h.date : kd === h.date)) add(`hol:${h.id}:${kd}`, NOW, `${h.kind === "church" ? "⛪" : "🎉"} <b>Сьогодні — ${H(h.name)}!</b>${h.desc ? "\n" + H(h.desc) : ""}`);
  return ev.sort((a, b) => a.at - b.at);
}
async function telegram(D) {
  if (!TG.token || !TG.chat) { say("Telegram: немає секретів — пропускаю"); return; }
  const ref = db.doc("ud_bot/telegram"), snap = await ref.get(), first = !snap.exists;
  const sent = (snap.exists && snap.data().sent) || {};
  const ev = feed(D), fresh = ev.filter(e => !sent[e.key]);
  let n = 0;
  if (first) {
    fresh.forEach(e => { sent[e.key] = NOW; });     // старе не дублюємо
    await tgSend(TG.chat, `🤖 <b>Бот нового сайту Української Держави підключено</b>\n\nТут з'являтимуться новини, закони й укази, голосування Палати Земель, вибори, вироки суду, нагороди й свята.\n\n<a href="${SITE}">${H(SITE.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>`, TG.thread);
    say("Telegram: перший запуск — привітання, старі події позначено");
  } else {
    // беремо лише свіже (за 2 доби), не більше 10 за раз
    for (const e of fresh.filter(e => NOW - e.at < 48 * 3600e3).slice(0, 10)) {
      try { await tgSend(TG.chat, e.text, e.remind && TG.remindThread ? TG.remindThread : TG.thread, e.img); sent[e.key] = NOW; n++; await sleep(1200); }
      catch (err) { say("Telegram: не надіслано — " + err.message); break; }
    }
    fresh.filter(e => NOW - e.at >= 48 * 3600e3).forEach(e => { sent[e.key] = NOW; });
  }
  for (const [k, t] of Object.entries(sent)) if (NOW - t > 60 * 864e5) delete sent[k];
  await ref.set({ sent, at: NOW });
  if (n) say(`Telegram: надіслано ${n}`);
}

// ---------- 3. Особисті сповіщення ----------
async function personal(D) {
  if (!TG.token) return;
  const links = {}; (await db.collection("ud_tglinks").get()).forEach(d => { if (d.data().chat) links[d.id] = d.data().chat; });
  const ref = db.doc("ud_bot/personal"), snap = await ref.get(), st = snap.exists ? snap.data() : {};
  const since = st.since || NOW - 15 * 60e3, sent = st.sent || {};
  const holders = Object.fromEntries(D.positions.map(p => [p.id, p.holder || ""]));
  const out = [];   // {pid, key, text}
  if (snap.exists) {
    // лише справжні зміни: посада була в попередньому знімку і людина на ній інша
    for (const p of D.positions) if (p.holder && st.holders && p.id in st.holders && st.holders[p.id] !== p.holder) out.push({ pid: p.holder, key: `ap:${p.id}:${p.holder}:${ms(p.since)}`, text: `👔 Вас призначено на посаду «${H(p.title)}».` });
    for (const s of D.stars) if (ms(s.at) > since) out.push({ pid: s.pid, key: "st:" + s.id, text: `⭐ ${s.n > 0 ? "+" : ""}${s.n} зірочок${s.reason ? ": " + H(s.reason) : ""}\n${link("narod/gravets/" + s.pid, "Моя служба")}` });
    const aw = Object.fromEntries(D.awards.map(a => [a.id, a.name]));
    for (const g of D.grants) if (ms(g.at) > since && !g.revoked) out.push({ pid: g.pid, key: "gr:" + g.id, text: `🏅 Вас нагороджено «${H(aw[g.award] || "")}»${g.reason ? "\n" + H(g.reason) : ""}` });
    for (const c of D.cases) if (ms(c.at) > since && c.defendant) out.push({ pid: c.defendant, key: "cs:" + c.id, text: `⚖️ Проти вас подано позов: справа № ${c.no} «${H(c.title)}».\n${link("zakon/sud/" + c.id, "Відкрити справу")}` });
    // згадки в загальних чатах (особисті повідомлення бот не читає — лише хто написав)
    const lands = ((await one("ud_config", "lands")) || {}).list || [];
    const chans = [["general", "Загальний"], ["gov", "Чат уряду"], ...lands.map(l => ["land_" + l.id, l.name])];
    const linked = D.players.filter(p => links[p.id]);
    for (const [ch, title] of chans) {
      const msgs = (await db.collection(`ud_chat/${ch}/msgs`).where("at", ">", TS.fromMillis(since)).get()).docs.map(d => ({ id: d.id, ...d.data() }));
      for (const m of msgs) for (const p of linked) if (p.id !== m.by && String(m.text || "").includes("@" + p.name))
        out.push({ pid: p.id, key: `mn:${ch}:${m.id}:${p.id}`, text: `💬 ${H(name(D, m.by))} згадав вас у чаті «${H(title)}»:\n«${H(short(m.text, 200))}»` });
    }
    // нове голосування Уряду — усім членам Уряду, крім автора
    const GOV = ["hetman", "pysar", "finance", "interior", "foreign", "defense", "press", "prosecutor"];
    const govIds = [...new Set(D.positions.filter(p => GOV.includes(p.id) && p.holder).map(p => p.holder))];
    for (const v of D.govvotes || []) if (ms(v.at) > since && !v.closed)
      for (const pid of govIds) if (pid !== v.by) out.push({ pid, key: `gv:${v.id}:${pid}`, text: `🗳 <b>Голосування Уряду</b>: «${H(v.title)}»\nДо ${H(kyiv(v.end))}\n\n${link("derzhava/vlada", "Проголосувати")}` });
    // внески: нове нагадування і «термін завтра/сьогодні» (один раз)
    for (const x of D.dues || []) {
      if (x.status !== "open") continue;
      const due = x.due ? ` до ${H(kyiv(Date.parse(x.due + "T12:00:00"), false))}` : "";
      if (ms(x.at) > since) out.push({ pid: x.pid, key: "du:" + x.id, text: `💰 Нагадування про внесок: <b>${H(x.what)}</b>${due}.${x.note ? "\n" + H(x.note) : ""}\n${link("derzhava/ekonomika", "Економіка")}` });
      if (x.due) { const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kiev" }).format(new Date(NOW)); const left = Math.round((Date.parse(x.due + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 864e5);
        if (left >= 0 && left <= 1) out.push({ pid: x.pid, key: `dd:${x.id}:${x.due}`, text: `⏰ ${left ? "Завтра" : "Сьогодні"} термін внеску: <b>${H(x.what)}</b>.` }); }
    }
    for (const c of D.dms) if (ms(c.at) > since && c.last) for (const pid of c.members || []) if (pid !== c.last.by)
      out.push({ pid, key: `dm:${c.id}:${ms(c.at)}`, text: `✉️ Нове особисте повідомлення від ${H(name(D, c.last.by))}.\n${link("chat/osobysti/" + c.id, "Відкрити")}` });
  }
  let n = 0;
  for (const o of out) {
    if (!links[o.pid] || sent[o.key]) continue;
    try { await tgSend(links[o.pid], o.text); n++; await sleep(400); }
    catch (err) { if (!/blocked|chat not found|deactivated/i.test(err.message)) { say("Особисте не надіслано: " + err.message); continue; } }
    sent[o.key] = NOW;
    if (n >= 40) break;
  }
  for (const [k, t] of Object.entries(sent)) if (NOW - t > 30 * 864e5) delete sent[k];
  await ref.set({ since: NOW - 60e3, holders, sent, at: NOW });
  if (n) say(`Особисті сповіщення: ${n}`);
}

// ---------- 4. Резервна копія (раз на добу, приватне сховище) ----------
// особисті повідомлення, коди й зв'язки Telegram у копію не потрапляють
const SKIP = new Set(["ud_dms", "ud_reads", "ud_tgcodes", "ud_tglinks", "ud_bot", "botstate"]);
async function dumpRef(ref, depth) {
  const out = {};
  for (const d of (await ref.get()).docs) {
    const v = { data: d.data() };
    if (depth < 3) { const subs = await d.ref.listCollections(); if (subs.length) { v.subs = {}; for (const c of subs) v.subs[c.id] = await dumpRef(c, depth + 1); } }
    out[d.id] = v;
  }
  return out;
}
async function backup() {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kiev" }).format(new Date(NOW));
  const ref = db.doc("ud_bot/backup"), st = await ref.get();
  if (st.exists && st.data().day === day) return;
  const all = {};
  for (const c of await db.listCollections()) if (!SKIP.has(c.id)) all[c.id] = await dumpRef(c, 0);
  const json = JSON.stringify({ at: new Date(NOW).toISOString(), collections: all });
  const bucket = admin.storage().bucket();
  await bucket.file(`backups/v2-${day}.json`).save(json, { contentType: "application/json", resumable: false });
  const [files] = await bucket.getFiles({ prefix: "backups/v2-" });
  const days = files.map(f => (/v2-(\d{4}-\d{2}-\d{2})/.exec(f.name) || [])[1]).filter(Boolean).sort();
  for (const f of files) { const m = /v2-(\d{4}-\d{2}-\d{2})/.exec(f.name); if (m && days.indexOf(m[1]) < days.length - 30) await f.delete().catch(() => {}); }
  await ref.set({ day, at: NOW, size: json.length });
  say(`Резервна копія за ${day}: ${Math.round(json.length / 1024)} КБ`);
}

// прибирання: пошти в публічних документах бути не повинно (старі записи до виправлення сайту)
async function scrub() {
  for (const col of ["ud_history", "ud_elections"]) {
    for (const d of (await db.collection(col).get()).docs) if (String(d.data().by || "").includes("@")) { await d.ref.update({ by: "admin" }); say(`Прибрано пошту з ${col}/${d.id}`); }
  }
}

// ---------- запуск ----------
const D = {};
for (const c of ["players", "positions", "bills", "elections", "news", "laws", "codes", "awards", "grants", "stars", "states", "treaties", "holidays"]) D[c] = await all("ud_" + c);
D.cases = await all("ud_cases"); D.dms = await all("ud_dms"); D.dues = await all("ud_dues");
D.chdocs = await all("ud_chdocs"); D.govvotes = await all("ud_govvotes");
for (const [label, fn] of [["Таймери", () => timers(D)], ["Дії законів", () => effects(D)], ["Стан", async () => { D.site = (await one("ud_config", "site")) || {}; }], ["Прибирання", scrub], ["Telegram", () => telegram(D)], ["Особисті", () => personal(D)], ["Копія", backup]]) {
  try { await fn(); } catch (err) { say(`${label}: помилка — ${err.message}`); }
}
await db.doc("ud_bot/state").set({ at: NOW, log: LOG.slice(-30) });
console.log("Готово.");
process.exit(0);
