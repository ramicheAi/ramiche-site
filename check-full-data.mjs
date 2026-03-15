import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyCM-bxw5yIdrLYeAZ1PfUmnoy-9tBBhiVY',
  authDomain: 'apex-athlete-73755.firebaseapp.com',
  projectId: 'apex-athlete-73755',
  storageBucket: 'apex-athlete-73755.firebasestorage.app',
  messagingSenderId: '840367715029',
  appId: '1:840367715029:web:ad98e8de737958fa76285c'
});

const db = getFirestore(app);

async function check() {
  // Check all documents in the rosters collection
  const col = collection(db, 'organizations/saint-andrews-aquatics/rosters');
  const snap = await getDocs(col);
  console.log('=== All Roster Documents ===');
  snap.forEach(d => {
    const data = d.data();
    const athletes = data.athletes || data._items || [];
    const totalXP = athletes.reduce((s, a) => s + (a.xp || 0), 0);
    console.log(`${d.id}: ${athletes.length} athletes, totalXP: ${totalXP}, updatedAt: ${data._updatedAt?.seconds ? new Date(data._updatedAt.seconds * 1000).toISOString() : 'unknown'}`);
    if (totalXP > 0) {
      const top = [...athletes].sort((a,b) => (b.xp||0) - (a.xp||0)).slice(0,3);
      console.log('  top:', top.map(a => `${a.name}: ${a.xp}XP lv${a.level}`));
    }
  });

  // Check the Mar 5 snapshot XP data more carefully
  const mar5 = await getDoc(doc(db, 'organizations/saint-andrews-aquatics/snapshots/2026-03-05'));
  if (mar5.exists()) {
    const d = mar5.data();
    console.log('\n=== Mar 5 Snapshot (last good data) ===');
    console.log('totalXPAwarded:', d.totalXPAwarded);
    const xps = d.athleteXPs;
    if (xps && typeof xps === 'object') {
      const entries = Object.entries(xps).filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a);
      console.log('Athletes with XP:', entries.length);
      entries.forEach(([id, xp]) => console.log(`  ${id}: ${xp}`));
    }
  }

  // Check config/settings for any backed up data
  const config = await getDoc(doc(db, 'organizations/saint-andrews-aquatics/config/settings'));
  if (config.exists()) {
    const d = config.data();
    console.log('\n=== Config/Settings ===');
    console.log('keys:', Object.keys(d).join(', '));
  }

  process.exit(0);
}

check().catch(e => { console.error(e.message); process.exit(1); });
