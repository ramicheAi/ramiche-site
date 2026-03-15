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

// XP data from Mar 5 snapshot (last good data)
const xpData = {
  'erin-reid': 85,
  'conner-brinley': 85,
  'jared-berke': 85,
  'gabia-gelumbickas': 85,
  'lilly-karas': 85,
  'nerea-gutierrez': 85,
  'christina-gumbinger': 85,
  'alexandra-lucchese': 85,
  'christina-paschal': 85,
  'alera-hurwitz': 85,
  'cash-vinas': 85,
  'mayah-chouloute': 85,
  'athena-rilo': 75,
  'jette-neubauer': 75,
  'william-domokos-murphy': 75,
  'cielo-moya': 75,
  'jorge-aguila': 70,
  'ariana-moya-vargas': 70,
  'simon-sheinfeld': 60,
};

// Level thresholds
function getLevel(xp) {
  if (xp >= 500) return 'Legend';
  if (xp >= 350) return 'Captain';
  if (xp >= 200) return 'Elite';
  if (xp >= 100) return 'Warrior';
  if (xp >= 50) return 'Contender';
  return 'Rookie';
}

async function restore() {
  // Get current roster from "rosters/all"
  const rosterDoc = await getDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/all'));
  if (!rosterDoc.exists()) {
    console.error('rosters/all not found');
    process.exit(1);
  }

  const data = rosterDoc.data();
  const athletes = data.athletes || [];
  console.log('Current roster:', athletes.length, 'athletes');

  // Apply XP from snapshot
  let restored = 0;
  const updated = athletes.map(a => {
    const id = a.id || a.name?.toLowerCase().replace(/\s+/g, '-');
    if (xpData[id]) {
      restored++;
      const xp = xpData[id];
      return {
        ...a,
        xp,
        level: getLevel(xp),
        streak: a.streak || 0,
      };
    }
    return a;
  });

  console.log(`Restored XP for ${restored} athletes`);

  // Verify before writing
  const totalXP = updated.reduce((s, a) => s + (a.xp || 0), 0);
  console.log('Total XP after restore:', totalXP);

  if (restored === 0) {
    console.error('No athletes matched — aborting');
    process.exit(1);
  }

  // Write back to Firestore
  await setDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/all'), {
    athletes: updated,
    groupId: 'all',
    _updatedAt: serverTimestamp(),
    _restoredFrom: 'snapshot-2026-03-05',
  }, { merge: true });

  console.log('Restored rosters/all successfully');

  // Also update rosters/platinum (same data)
  await setDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/platinum'), {
    athletes: updated,
    groupId: 'platinum',
    _updatedAt: serverTimestamp(),
    _restoredFrom: 'snapshot-2026-03-05',
  }, { merge: true });

  console.log('Restored rosters/platinum successfully');

  // Verify
  const verify = await getDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/all'));
  const vData = verify.data();
  const vXP = vData.athletes.reduce((s, a) => s + (a.xp || 0), 0);
  console.log('Verified total XP:', vXP);

  process.exit(0);
}

restore().catch(e => { console.error(e.message); process.exit(1); });
