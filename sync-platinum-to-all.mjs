import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyCM-bxw5yIdrLYeAZ1PfUmnoy-9tBBhiVY',
  authDomain: 'apex-athlete-73755.firebaseapp.com',
  projectId: 'apex-athlete-73755',
  storageBucket: 'apex-athlete-73755.firebasestorage.app',
  messagingSenderId: '840367715029',
  appId: '1:840367715029:web:ad98e8de737958fa76285c'
});

const db = getFirestore(app);

async function sync() {
  // Read from rosters/platinum (has 1520 XP — the good data)
  const platDoc = await getDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/platinum'));
  if (!platDoc.exists()) {
    console.error('rosters/platinum not found');
    process.exit(1);
  }

  const platData = platDoc.data();
  const athletes = platData.athletes || [];
  const totalXP = athletes.reduce((s, a) => s + (a.xp || 0), 0);
  console.log(`rosters/platinum: ${athletes.length} athletes, ${totalXP} XP`);

  if (totalXP === 0) {
    console.error('Platinum data also has 0 XP — aborting');
    process.exit(1);
  }

  // Write to rosters/all (overwrite the zero-XP version)
  await setDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/all'), {
    athletes,
    groupId: 'all',
    _updatedAt: serverTimestamp(),
    _restoredFrom: 'rosters/platinum',
  });

  console.log(`Wrote ${athletes.length} athletes (${totalXP} XP) to rosters/all`);

  // Verify
  const verify = await getDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/all'));
  const vXP = verify.data().athletes.reduce((s, a) => s + (a.xp || 0), 0);
  console.log(`Verified rosters/all: ${vXP} XP`);

  process.exit(0);
}

sync().catch(e => { console.error(e.message); process.exit(1); });
