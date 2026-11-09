// Robot Ralass : envoie les notifs en attente + relances "mauvais payeur"
import admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'ralass' });
const db = admin.firestore();
const APP_URL = process.env.APP_URL || '';
const now = Date.now();
const users = {};
const getUser = async uid => users[uid] ??= (await db.doc(`users/${uid}`).get()).data() || {};
const eur = n => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €';

async function send(uids, title, body) {
  const pairs = [];
  for (const uid of uids) for (const t of (await getUser(uid)).tokens || []) pairs.push([uid, t]);
  if (!pairs.length) return;
  const res = await admin.messaging().sendEachForMulticast({
    tokens: pairs.map(p => p[1]),
    webpush: { notification: { title, body, icon: APP_URL + 'icon-192.png' }, fcmOptions: APP_URL ? { link: APP_URL } : undefined },
  });
  res.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument'))
      db.doc(`users/${pairs[i][0]}`).update({ tokens: admin.firestore.FieldValue.arrayRemove(pairs[i][1]) });
  });
  console.log(`→ ${title} | ${res.successCount}/${pairs.length} envoyées`);
}

// 1. File d'attente
const q = await db.collection('queue').where('sent', '==', false).limit(300).get();
for (const d of q.docs) { const x = d.data(); await send(x.to || [], x.title, x.body); await d.ref.update({ sent: true, sentAt: now }); }

// 2. Mauvais payeurs
const groups = {};
const ex = await db.collection('expenses').where('status', '==', 'active').get();
for (const d of ex.docs) {
  const e = d.data();
  const g = groups[e.groupId] ??= (await db.doc(`groups/${e.groupId}`).get()).data();
  if (!g) continue;
  const delay = (g.delayMinutes ?? 2880) * 60000;
  if (now - e.activatedAt < delay) continue;
  const repeat = g.delayMinutes < 60 ? 30 * 60000 : 20 * 3600000;
  const msgs = g.messages?.length ? g.messages : ['MAUVAIS PAYEUR'];
  const payer = (await getUser(e.payer)).name || '?';
  for (const [uid, s] of Object.entries(e.shares || {})) {
    if (s.status === 'paid' || (s.lastShameAt && now - s.lastShameAt < repeat)) continue;
    const who = (await getUser(uid)).name || '?';
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    await send(g.members || [], `🚨 ${who.toUpperCase()} — MAUVAIS PAYEUR`, `« ${msg} » — doit ${eur(s.amount)} à ${payer} (${e.title})`);
    await d.ref.update({ [`shares.${uid}.lastShameAt`]: now });
  }
}
console.log('OK');
process.exit(0);
