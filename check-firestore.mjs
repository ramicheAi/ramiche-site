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

async function go() {
  const paths = [
    'organizations/saint-andrews-aquatics/rosters/all',
    'organizations/saint-andrews-aquatics/rosters/platinum',
    'teams/saint-andrews-aquatics/rosters/all',
    'teams/saint-andrews-aquatics/rosters/platinum',
  ];

  for (const p of paths) {
    try {
      const snap = await getDoc(doc(db, p));
      if (snap.exists()) {
        const d = snap.data();
        const it = d._items || d.athletes || [];
        const ks = Object.keys(d).filter(k => k !== '_updatedAt' && k !== 'groupId');
        const nk = ks.filter(k => /^\d+$/.test(k));
        if (it.length > 0) {
          const xp = it.reduce((s, a) => s + (a.xp || 0), 0);
          console.log(`${p}: ${it.length} athletes, totalXP: ${xp}`);
          it.sort((a, b) => (b.xp || 0) - (a.xp || 0));
          it.slice(0, 3).forEach(a => console.log(`  ${a.name}: ${a.xp} XP`));
        } else if (nk.length > 0) {
          const arr = nk.sort((a, b) => +a - +b).map(k => d[k]);
          const xp = arr.reduce((s, a) => s + (a.xp || 0), 0);
          console.log(`${p} (legacy): ${arr.length} athletes, totalXP: ${xp}`);
          arr.sort((a, b) => (b.xp || 0) - (a.xp || 0));
          arr.slice(0, 3).forEach(a => console.log(`  ${a.name}: ${a.xp} XP`));
        } else {
          console.log(`${p}: exists but unknown format, keys: ${ks.slice(0, 10).join(', ')}`);
        }
      } else {
        console.log(`${p}: NOT FOUND`);
      }
    } catch (e) {
      console.log(`${p}: ERROR - ${e.code || e.message}`);
    }
  }

  // Also check snapshots for historical data
  console.log('\n--- Checking snapshots for historical XP data ---');
  const { collection: col, getDocs: gd } = await import('firebase/firestore');
  try {
    const snapsCol = col(db, 'organizations/saint-andrews-aquatics/snapshots');
    const snaps = await gd(snapsCol);
    console.log(`Found ${snaps.size} snapshots`);
    snaps.forEach(s => {
      const d = s.data();
      const athletes = d.athletes || d.roster || [];
      if (athletes.length > 0) {
        const xp = athletes.reduce((sum, a) => sum + (a.xp || 0), 0);
        console.log(`  snapshot/${s.id}: ${athletes.length} athletes, totalXP: ${xp}`);
      } else {
        console.log(`  snapshot/${s.id}: keys=${Object.keys(d).join(',')}`);
        if (d.athleteXPs) {
          const entries = Object.entries(d.athleteXPs).sort((a,b) => (b[1]) - (a[1]));
          const total = entries.reduce((s, [,v]) => s + v, 0);
          console.log(`    athleteXPs: ${entries.length} entries, totalXP: ${total}`);
          entries.slice(0,5).forEach(([k,v]) => console.log(`      ${k}: ${v} XP`));
        }
        if (d.attendance) console.log(`    attendance: ${JSON.stringify(d.attendance).slice(0,100)}`);
      }
    });
  } catch (e) { console.log('Snapshots error:', e.message); }

  // RECOVERY: Read Mar 3 snapshot and restore XP to roster
  const RECOVER = process.argv.includes('--recover');
  if (RECOVER) {
    console.log('\n=== RECOVERING XP FROM MARCH 3 SNAPSHOT ===');
    const { setDoc: sd, serverTimestamp: ts } = await import('firebase/firestore');

    // 1. Get the Mar 3 snapshot with the good XP data
    const snapRef = doc(db, 'organizations/saint-andrews-aquatics/snapshots/2026-03-03');
    const snapDoc = await getDoc(snapRef);
    if (!snapDoc.exists()) { console.error('Mar 3 snapshot not found!'); process.exit(1); }
    const xpMap = snapDoc.data().athleteXPs; // { "athlete-id": xpNumber }
    const totalSnapshotXP = Object.values(xpMap).reduce((s, v) => s + v, 0);
    console.log(`Snapshot has ${Object.keys(xpMap).length} athletes, total XP: ${totalSnapshotXP}`);

    // 2. Get current roster
    const rosterRef = doc(db, 'organizations/saint-andrews-aquatics/rosters/all');
    const rosterDoc = await getDoc(rosterRef);
    if (!rosterDoc.exists()) { console.error('Roster not found!'); process.exit(1); }
    const roster = rosterDoc.data().athletes;
    console.log(`Current roster: ${roster.length} athletes`);

    // 3. Apply XP from snapshot to roster athletes
    // Level calculation based on XP thresholds
    const getLevel = (xp) => {
      if (xp >= 2000) return 'Legend';
      if (xp >= 1500) return 'Captain';
      if (xp >= 1000) return 'Elite';
      if (xp >= 600) return 'Warrior';
      if (xp >= 300) return 'Contender';
      return 'Rookie';
    };

    let recovered = 0;
    const updated = roster.map(a => {
      const snapshotXP = xpMap[a.id] || 0;
      if (snapshotXP > (a.xp || 0)) {
        recovered++;
        return { ...a, xp: snapshotXP, level: getLevel(snapshotXP) };
      }
      return a;
    });

    const newTotal = updated.reduce((s, a) => s + (a.xp || 0), 0);
    console.log(`Recovered XP for ${recovered} athletes. New total: ${newTotal}`);

    // Show top 5
    const sorted = [...updated].sort((a,b) => (b.xp||0) - (a.xp||0));
    sorted.slice(0,5).forEach(a => console.log(`  ${a.name}: ${a.xp} XP (${a.level})`));

    // 4. Write back to BOTH roster paths
    await sd(rosterRef, { athletes: updated, groupId: 'all', _updatedAt: ts() }, { merge: false });
    console.log('Wrote rosters/all');

    const platRef = doc(db, 'organizations/saint-andrews-aquatics/rosters/platinum');
    await sd(platRef, { athletes: updated, groupId: 'platinum', _updatedAt: ts() }, { merge: false });
    console.log('Wrote rosters/platinum');

    console.log('\n=== RECOVERY COMPLETE ===');
  }

  process.exit(0);
}
go().catch(e => { console.error(e); process.exit(1); });
