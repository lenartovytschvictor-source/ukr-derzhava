// Бекенд Firebase: вхід через Google і база Firestore.
// Ключі тут — публічна конфігурація веб-застосунку Firebase (не секрет). Токен бота й інші секрети
// ніколи не потрапляють у код сайту — лише в секрети GitHub.
const V = "10.12.2";
const firebaseConfig = {
  apiKey: "AIzaSyCOIvpJ9-KWPFrmk3atQ75xrwrUdqlcBdg",
  authDomain: "ukr-derzhava.firebaseapp.com",
  projectId: "ukr-derzhava",
  storageBucket: "ukr-derzhava.firebasestorage.app",
  messagingSenderId: "303373917631",
  appId: "1:303373917631:web:052939254583b6a589950a"
};

let F, A, db, auth;

export async function init() {
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [app, fs, au] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-firestore.js"),
    import(base + "firebase-auth.js"),
  ]);
  F = fs; A = au;
  // Власний домен: якщо на сайті є помічник входу (/__/auth/…), вхід іде через наш домен (працює і в Safari).
  const own = /(^|\.)ukr-derzhava\.in\.ua$/.test(location.hostname)
    && await fetch("/__/firebase/init.json", { cache: "no-store" }).then(r => r.ok).catch(() => false);
  if (own) firebaseConfig.authDomain = location.hostname;
  const fbApp = app.initializeApp(firebaseConfig, "ud2");
  try {
    db = F.initializeFirestore(fbApp, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) { db = F.getFirestore(fbApp); }
  auth = A.getAuth(fbApp);
}

const ref = (c, id) => F.doc(db, c, id);
// очікувані мітки часу (ще не підтверджені сервером) — оцінкою, щоб нове повідомлення одразу стало на місце
const plain = s => s.exists() ? { id: s.id, ...s.data({ serverTimestamps: "estimate" }) } : null;

export const get = async (c, id) => plain(await F.getDoc(ref(c, id)));
export const list = async c => (await F.getDocs(F.collection(db, c))).docs.map(plain);
export const set = (c, id, v, merge) => F.setDoc(ref(c, id), v, merge ? { merge: true } : {});
export const update = (c, id, v) => F.updateDoc(ref(c, id), v);
export const del = (c, id) => F.deleteDoc(ref(c, id));
export const add = async (c, v) => (await F.addDoc(F.collection(db, c), v)).id;
export const newId = c => F.doc(F.collection(db, c)).id;
export const now = () => F.serverTimestamp();
export const delField = () => F.deleteField();

// кілька змін за раз (усе або нічого)
export async function batch(ops) {
  const b = F.writeBatch(db);
  for (const o of ops) {
    if (o.op === "set") b.set(ref(o.c, o.id), o.v, o.merge ? { merge: true } : {});
    else if (o.op === "update") b.update(ref(o.c, o.id), o.v);
    else if (o.op === "del") b.delete(ref(o.c, o.id));
  }
  await b.commit();
}

export function watch(c, cb, onErr) {
  return F.onSnapshot(F.collection(db, c), s => cb(s.docs.map(plain)), e => onErr && onErr(e));
}
export function watchWhere(c, field, op, value, cb, onErr) {
  return F.onSnapshot(F.query(F.collection(db, c), F.where(field, op, value)), s => cb(s.docs.map(plain)), e => onErr && onErr(e));
}
// останні n документів за полем at (для чатів)
export function watchLast(c, n, cb, onErr) {
  return F.onSnapshot(F.query(F.collection(db, c), F.orderBy("at", "desc"), F.limit(n)), s => cb(s.docs.map(plain)), e => onErr && onErr(e));
}
export function watchDoc(c, id, cb, onErr) {
  return F.onSnapshot(ref(c, id), s => cb(plain(s)), e => onErr && onErr(e));
}

// ---------- вхід ----------
export function onAuth(cb) {
  A.onAuthStateChanged(auth, u => cb(u && u.email ? { uid: u.uid, email: u.email.toLowerCase(), name: u.displayName || "", photo: u.photoURL || "", verified: !!u.emailVerified } : null));
}
export async function signIn() {
  const p = new A.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  await A.signInWithPopup(auth, p);
}
export const signOut = () => A.signOut(auth);
export const isDemo = false;
