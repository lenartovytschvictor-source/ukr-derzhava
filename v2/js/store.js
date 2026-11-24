// Дані сайту в пам'яті + хто зараз увійшов і що йому дозволено.
// Справжній захист — у правилах Firebase (firestore.rules); тут лише показуємо кнопки тим, кому можна.
export const OWNERS = ["lenartovytsch.victor@gmail.com"];   // адміністрація проєкту, як і на старому сайті
export const DEMO = new URLSearchParams(location.search).has("demo");

export let B;   // бекенд
export const S = {
  ready: false, user: null,
  players: [], positions: [], links: [], apps: [],
  admins: [], lands: null, texts: {}, history: null, site: {},
  bills: [], elections: [], states: [], treaties: [], chamber: {}, places: [],
  codes: [], laws: [], constitution: null, casesPub: [], casesPriv: [], caseCounter: null,
  army: [], units: [], ranksCfg: null, stars: [], awards: [], grants: [], church: null, clergy: [], parishes: [], holidays: [],
  chat: {}, chatCfg: {}, mutes: [], dms: [], reads: {},
  myLink: null, myApp: null, err: "",
};
let renderCb = () => {};
let raf = 0;
export function onChange(cb) { renderCb = cb; }
export function changed() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; syncCaseWatch(); syncChat(); renderCb(); }); }

const unsub = [];
function stopUserWatches() { while (unsub.length) { try { unsub.pop()(); } catch (_) {} } }

export async function initStore() {
  B = DEMO ? await import("./backend-demo.js") : await import("./backend-fb.js");
  await B.init();
  // загальнодоступні дані
  B.watch("ud_players", r => { S.players = r; changed(); }, e => fail(e));
  B.watch("ud_positions", r => { S.positions = r.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)); changed(); }, e => fail(e));
  B.watch("ud_texts", r => { S.texts = Object.fromEntries(r.map(x => [x.id, x])); changed(); }, e => fail(e));
  B.watchDoc("ud_config", "lands", d => { S.lands = d && Array.isArray(d.list) ? d.list : null; changed(); });
  B.watchDoc("ud_config", "site", d => { S.site = d || {}; changed(); });
  B.watchDoc("ud_history", "main", d => { S.history = d; changed(); });
  B.watch("ud_bills", r => { S.bills = r; changed(); }, e => fail(e));
  B.watch("ud_elections", r => { S.elections = r; changed(); }, e => fail(e));
  B.watch("ud_states", r => { S.states = r; changed(); }, e => fail(e));
  B.watch("ud_treaties", r => { S.treaties = r; changed(); }, e => fail(e));
  B.watchDoc("ud_config", "chamber", d => { S.chamber = d || {}; changed(); });
  B.watch("ud_places", r => { S.places = r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "uk")); changed(); }, e => fail(e));
  B.watch("ud_codes", r => { S.codes = r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); changed(); }, e => fail(e));
  B.watch("ud_laws", r => { S.laws = r; changed(); }, e => fail(e));
  B.watchDoc("ud_law", "constitution", d => { S.constitution = d; changed(); });
  // етап 5: військо, нагороди, церква
  B.watch("ud_army", r => { S.army = r; changed(); }, e => fail(e));
  B.watch("ud_units", r => { S.units = r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "uk")); changed(); }, e => fail(e));
  B.watchDoc("ud_config", "ranks", d => { S.ranksCfg = d; changed(); });
  B.watch("ud_stars", r => { S.stars = r.sort((a, b) => ms(b.at) - ms(a.at)); changed(); }, e => fail(e));
  B.watch("ud_awards", r => { S.awards = r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); changed(); }, e => fail(e));
  B.watch("ud_grants", r => { S.grants = r.sort((a, b) => ms(b.at) - ms(a.at)); changed(); }, e => fail(e));
  B.watchDoc("ud_church", "main", d => { S.church = d; changed(); });
  B.watch("ud_clergy", r => { S.clergy = r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); changed(); }, e => fail(e));
  B.watch("ud_parishes", r => { S.parishes = r.sort((a, b) => a.name.localeCompare(b.name, "uk")); changed(); }, e => fail(e));
  B.watch("ud_holidays", r => { S.holidays = r; changed(); }, e => fail(e));
  // етап 6: чат
  B.watchDoc("ud_config", "chat", d => { S.chatCfg = d || {}; changed(); });
  B.watch("ud_mutes", r => { S.mutes = r; changed(); }, () => {});
  B.watchDoc("ud_counters", "cases", d => { S.caseCounter = d; changed(); });
  B.watchWhere("ud_cases", "closed", "==", false, r => { S.casesPub = r; changed(); }, e => fail(e));
  B.onAuth(u => { S.user = u; S.ready = true; userWatches(); changed(); });
}
function fail(e) { console.warn(e); S.err = String(e && e.message || e); changed(); }

// дані, які залежать від того, хто увійшов
function userWatches() {
  stopUserWatches();
  S.myLink = null; S.myApp = null; S.links = []; S.apps = []; S.admins = [];
  const u = S.user;
  if (!u) return;
  unsub.push(B.watchDoc("ud_links", u.email, d => { S.myLink = d; changed(); }, () => {}));
  unsub.push(B.watchDoc("ud_apps", u.email, d => { S.myApp = d; changed(); }, () => {}));
  unsub.push(B.watchDoc("ud_config", "admins", d => { S.admins = (d && d.emails) || []; changed(); }, () => { S.admins = []; }));
  // реєстр пошт і заявки бачать лише ті, хто веде реєстр (правила не віддадуть іншим)
  unsub.push(B.watch("ud_links", r => { S.links = r; changed(); }, () => { S.links = []; }));
  unsub.push(B.watch("ud_apps", r => { S.apps = r; changed(); }, () => { S.apps = []; }));
}

// Суд: відкриті справи бачать усі; закриті — лише учасники й судові посадовці (так само в правилах бази)
let caseKey = "", caseUn = null;
function syncCaseWatch() {
  const m = me();
  const key = !S.user ? "" : courtStaff() ? "all" : m ? "p:" + m.id : "";
  if (key === caseKey) return;
  caseKey = key; if (caseUn) { try { caseUn(); } catch (_) {} caseUn = null; } S.casesPriv = [];
  if (key === "all") caseUn = B.watch("ud_cases", r => { S.casesPriv = r; changed(); }, () => {});
  else if (key) caseUn = B.watchWhere("ud_cases", "parties", "array-contains", m.id, r => { S.casesPriv = r; changed(); }, () => {});
}
// ---------- Чат ----------
// чат уряду: ці посади (новим посадам доступ треба дописати і тут, і в правилах бази)
export const GOV = ["hetman", "pysar", "finance", "interior", "foreign", "defense", "press", "prosecutor"];
export const isGov = () => isAdmin() || GOV.some(holds);
export const isMod = () => isAdmin() || (!!me() && (S.chatCfg.mods || []).includes(me().id));
export const muteOf = pid => S.mutes.find(m => m.id === pid && ms(m.until) > Date.now()) || null;
// доступні канали: ключ → шлях до повідомлень
export function channels() {
  const m = me(), out = [];
  if (!S.user) return out;
  out.push({ key: "general", path: "ud_chat/general/msgs" });
  if (m && m.land) out.push({ key: "land_" + m.land, path: `ud_chat/land_${m.land}/msgs`, land: m.land });
  if (isGov()) out.push({ key: "gov", path: "ud_chat/gov/msgs" });
  return out;
}
export const chatHooks = new Set();   // сторінка чату оновлює стрічку напряму, без перемальовування всієї сторінки
let chatSubs = new Map(), dmKey = "", dmUn = null, readKey = "", readUn = null;
function syncChat() {
  const want = new Map(channels().map(c => [c.key, c.path]));
  for (const [k, un] of chatSubs) if (!want.has(k)) { try { un(); } catch (_) {} chatSubs.delete(k); delete S.chat[k]; }
  for (const [k, path] of want) if (!chatSubs.has(k)) chatSubs.set(k, B.watchLast(path, 150, r => { S.chat[k] = r.reverse(); chatHooks.forEach(f => f(k)); changed(); }, e => fail(e)));
  const m = me(), pid = S.user && m ? m.id : "";
  if (pid !== dmKey) {
    if (dmUn) { try { dmUn(); } catch (_) {} } dmUn = null; S.dms = []; dmKey = pid;
    if (pid) dmUn = B.watchWhere("ud_dms", "members", "array-contains", pid, r => { S.dms = r.sort((a, b) => ms(b.at) - ms(a.at)); chatHooks.forEach(f => f("dms")); changed(); }, () => {});
  }
  if (pid !== readKey) {
    if (readUn) { try { readUn(); } catch (_) {} } readUn = null; S.reads = {}; readKey = pid;
    if (pid) readUn = B.watchDoc("ud_reads", pid, d => { S.reads = d || {}; changed(); });
  }
}
// непрочитані: повідомлення інших людей, новіші за мою позначку
export function unread(key) {
  const m = me(), seen = ms(S.reads[key]) || 0;
  if (key.startsWith("dm_")) { const c = S.dms.find(x => "dm_" + x.id === key); return c && c.last && c.last.by !== (m && m.id) && ms(c.last.at) > seen ? 1 : 0; }
  return (S.chat[key] || []).filter(x => x.by !== (m && m.id) && ms(x.at) > seen).length;
}
export const unreadTotal = () => channels().reduce((n, c) => n + unread(c.key), 0) + S.dms.reduce((n, c) => n + unread("dm_" + c.id), 0);

export const cases = () => { const M = new Map(); [...S.casesPub, ...S.casesPriv].forEach(c => M.set(c.id, c)); return [...M.values()]; };

// ---------- хто є хто ----------
export const player = id => S.players.find(p => p.id === id) || null;
export const me = () => (S.myLink && player(S.myLink.pid)) || null;
export const pos = id => S.positions.find(p => p.id === id) || null;
export const holds = id => { const m = me(), p = pos(id); return !!(m && p && p.holder === m.id); };
export const isOwner = () => !!(S.user && OWNERS.includes(S.user.email));
export const isAdmin = () => isOwner() || !!(S.user && S.admins.includes(S.user.email));
export const isHetman = () => holds("hetman");
export const isCitizen = () => { const m = me(); return !!(m && m.status === "cit"); };
export const canPlayers = () => isAdmin() || isHetman() || holds("interior");
export const canAppoint = p => isAdmin() || (isHetman() && p && p.appointBy === "hetman")
  || (!!p && p.appointBy === "osavul" && !!p.land && holds("osavul_" + p.land));   // Осавул призначає джур і війтів своєї землі
// Крайовий Осавул землі — посада osavul_<land>; уділи й міста землі ведуть адмін, Писар і Осавул цієї землі
export const isOsavul = landId => holds("osavul_" + landId);
export const canPlaces = landId => isAdmin() || holds("pysar") || isOsavul(landId);
export const canLands = () => isAdmin() || holds("pysar");
export const canTexts = () => isAdmin();
export const canHistory = () => isAdmin();
export const canDiplo = () => isAdmin() || isHetman() || holds("foreign");
export const isChair = () => holds("chair");
// ---------- Військо ----------
// звання: [днів служби, зірочок]; Полковник — лише призначенням
export const RANKS_DEFAULT = [
  { id: "kozak", name: "Козак", days: 0, stars: 0 }, { id: "dzhura", name: "Джура", days: 10, stars: 0 },
  { id: "desiatnyk", name: "Десятник", days: 30, stars: 10 }, { id: "khorunzhyi", name: "Хорунжий", days: 60, stars: 25 },
  { id: "bunchuzhnyi", name: "Бунчужний", days: 100, stars: 50 }, { id: "sotnyk", name: "Сотник", days: 150, stars: 80 },
  { id: "osavul", name: "Осавул", days: 210, stars: 120 }, { id: "polkovnyk", name: "Полковник", appoint: true },
];
export const ranks = () => (S.ranksCfg && Array.isArray(S.ranksCfg.list) && S.ranksCfg.list.length ? S.ranksCfg.list : RANKS_DEFAULT);
export const soldier = pid => S.army.find(a => a.id === pid) || null;
export const serviceDays = a => { const d = Date.parse(String((a && a.since) || "") + "T00:00:00"); return isNaN(d) ? 0 : Math.max(0, Math.floor((Date.now() - d) / 864e5)); };
// поточне звання: призначене (Полковник) або найвище, для якого виконано обидві умови
export function rankOf(a) {
  if (!a) return null;
  const R = ranks();
  if (a.appointed) { const r = R.find(x => x.id === a.appointed); if (r) return r; }
  const d = serviceDays(a), st = a.stars || 0;
  let cur = null; for (const r of R) if (!r.appoint && d >= (r.days || 0) && st >= (r.stars || 0)) cur = r;
  return cur || R.find(r => !r.appoint) || null;
}
export function nextRank(a) {
  const R = ranks().filter(r => !r.appoint), cur = rankOf(a);
  if (!cur || cur.appoint) return null;
  const i = R.findIndex(r => r.id === cur.id);
  return R[i + 1] || null;
}
export const rankIdx = pid => { const a = soldier(pid); if (!a) return -1; const r = rankOf(a); return r ? ranks().findIndex(x => x.id === r.id) : -1; };
export const meetsRank = (pid, minRank) => !minRank || rankIdx(pid) >= ranks().findIndex(r => r.id === minRank);
export const canArmy = () => isAdmin() || holds("defense");                 // командування: Секретар оборони й адміни
export const unit = id => S.units.find(u => u.id === id) || null;
export const commands = uid => { const m = me(); const u = unit(uid); return !!(m && u && u.commander === m.id); };
// Нагороди: створюють Гетьман і адміни; видають ще й посади, зазначені в нагороді
export const canAwards = () => isAdmin() || isHetman();
export const canIssue = aw => canAwards() || (!!aw && (aw.issuers || []).some(holds));
// Церква: Патріарх і адміни; державні свята — Гетьман, Писар, адміни
export const canChurch = () => isAdmin() || holds("patriarch");
export const canHolidays = kind => kind === "church" ? canChurch() : (isAdmin() || isHetman() || holds("pysar"));

// Закон
export const JUDGES = ["judge_1", "judge_2", "judge_3"];
export const isJudge = () => JUDGES.some(holds);
export const courtStaff = () => isAdmin() || isJudge() || holds("prosecutor") || isHetman() || holds("interior");
export const canCodes = () => isAdmin() || holds("pysar");          // кодекси, реєстр законів, Конституція
export const canDecree = () => isAdmin() || isHetman();
// чинні судові заборони обіймати посади (не помилувані, строк ще не минув)
export const bansOf = pid => cases().filter(c => c.status === "verdict" && !c.pardon && c.defendant === pid && c.banUntil && Date.parse(c.banUntil + "T23:59:59") > Date.now());
export const canChamber = () => isAdmin() || isChair();          // керує порядком роботи Палати й виборами
export const canEditAnything = () => isAdmin() || canPlayers() || isHetman() || canLands() || canDiplo() || isChair() || lands().some(l => isOsavul(l.id));
// Палата Земель: місця — це посади з полем chamber (chair / zemska / sotenna)
export const seats = () => S.positions.filter(p => p.chamber);
export const mySeat = () => { const m = me(); return m ? seats().find(p => p.holder === m.id) || null : null; };
export const CH = () => ({ hours: 24, quorum: 50, petition: 5, nomHours: 48, voteHours: 48, ...S.chamber });
export const positionsOf = pid => S.positions.filter(p => p.holder && p.holder === pid);
export const emailOf = pid => { const l = S.links.find(x => x.pid === pid); return l ? l.id : ""; };

// землі: з бази, а поки їх не збережено — з плану (data/lands-default.json)
let LANDS_DEFAULT = [];
export async function loadDefaults() {
  try { LANDS_DEFAULT = await (await fetch("data/lands-default.json")).json(); } catch (_) {}
}
export const lands = () => S.lands || LANDS_DEFAULT;
export const landsFromPlan = () => LANDS_DEFAULT;
export const land = id => lands().find(l => l.id === id) || null;

// час: Firestore Timestamp / Date / число / рядок → мілісекунди
export const ms = v => !v ? 0 : v.toMillis ? v.toMillis() : v.seconds ? v.seconds * 1000 : typeof v === "number" ? v : Date.parse(v) || 0;

// ---------- журнал дій ----------
export async function log(act, text) {
  if (!S.user) return;
  try { await B.add("ud_log", { act, text: String(text).slice(0, 500), by: S.user.email, at: B.now() }); } catch (e) { console.warn("log", e); }
}
