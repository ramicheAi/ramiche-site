import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
  // Check snapshots from Mar 2-6 for XP data
  for (const date of ['2026-03-06', '2026-03-05', '2026-03-04']) {
    const snap = await getDoc(doc(db, `organizations/saint-andrews-aquatics/snapshots/${date}`));
    if (snap.exists()) {
      const d = snap.data();
      console.log(`\n=== ${date} ===`);
      console.log('totalXPAwarded:', d.totalXPAwarded);
      console.log('totalAthletes:', d.totalAthletes);
      console.log('attendance:', JSON.stringify(d.attendance));

      if (d.athleteXPs && typeof d.athleteXPs === 'object') {
        if (Array.isArray(d.athleteXPs)) {
          console.log('athleteXPs: array len=' + d.athleteXPs.length);
          const nonZero = d.athleteXPs.filter(x => x > 0);
          console.log('non-zero XPs:', nonZero.length);
        } else {
          const entries = Object.entries(d.athleteXPs);
          console.log('athleteXPs entries:', entries.length);
          const nonZero = entries.filter(([,v]) => v > 0);
          console.log('non-zero XPs:', nonZero.length);
          if (nonZero.length > 0) {
            console.log('sample non-zero:', nonZero.slice(0, 5).map(([k,v]) => `${k}: ${v}`));
          }
        }
      }
    }
  }

  // Also check the old "rosters/platinum" for any backup with XP
  const oldRoster = await getDoc(doc(db, 'organizations/saint-andrews-aquatics/rosters/platinum'));
  if (oldRoster.exists()) {
    const d = oldRoster.data();
    const athletes = d.athletes || d._items || [];
    const totalXP = athletes.reduce((s, a) => s + (a.xp || 0), 0);
    console.log('\n=== rosters/platinum ===');
    console.log('athletes:', athletes.length, 'totalXP:', totalXP);
    if (totalXP > 0) {
      const top5 = [...athletes].sort((a,b) => (b.xp||0) - (a.xp||0)).slice(0,5);
      console.log('top 5:', top5.map(a => `${a.name}: ${a.xp}XP`));
    }
  }

  process.exit(0);
}

check().catch(e => { console.error(e.message); process.exit(1); });
