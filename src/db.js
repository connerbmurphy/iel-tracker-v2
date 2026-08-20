import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

function docRef(accountId, key) {
  return doc(db, 'accounts', accountId, 'data', key);
}

export async function fsGet(accountId, key) {
  try {
    const snap = await getDoc(docRef(accountId, key));
    return snap.exists() ? (snap.data().value ?? null) : null;
  } catch { return null; }
}

export async function fsSet(accountId, key, value) {
  try { await setDoc(docRef(accountId, key), { value }); return true; }
  catch { return false; }
}

export async function fsDelete(accountId, key) {
  try { await deleteDoc(docRef(accountId, key)); return true; }
  catch { return false; }
}

export async function fsLoadAll(accountId) {
  try {
    const snap = await getDocs(collection(db, 'accounts', accountId, 'data'));
    const result = {};
    snap.forEach(d => { result[d.id] = d.data().value; });
    return result;
  } catch { return {}; }
}
