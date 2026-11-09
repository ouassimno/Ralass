// Outil d'admin ponctuel : liste les dépenses, ou en supprime une par son id
import { Firestore } from '@google-cloud/firestore';
const db = new Firestore({ projectId: 'ralass' });
const [mode, id] = [process.env.MODE, process.env.EXPENSE_ID];
if (mode === 'delete' && id) { await db.doc(`expenses/${id}`).delete(); console.log('SUPPRIME', id); }
const users = {};
const nm = async u => users[u] ??= ((await db.doc(`users/${u}`).get()).data() || {}).name;
const ex = (await db.collection('expenses').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
for (const e of ex) console.log('DEPENSE', e.id, '|', e.title, '|', e.amount, '€ |', await nm(e.payer), '|', new Date(e.createdAt).toISOString(), '|', e.status);
process.exit(0);
