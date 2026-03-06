const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

const builds = JSON.parse(fs.readFileSync("/Users/admin/.openclaw/workspace/yolo-builds/builds.json", "utf8"));

if (getApps().length === 0) {
  initializeApp({ projectId: "apex-athlete-73755" });
}
const db = getFirestore();

async function run() {
  const batch = db.batch();
  for (const build of builds) {
    const id = build.folder || build.name.replace(/\s+/g, "-").toLowerCase();
    batch.set(
      db.collection("yolo_builds").doc(id),
      Object.assign({}, build, { reviewStatus: build.reviewStatus || "pending" }),
      { merge: true }
    );
  }
  await batch.commit();
  console.log("Seeded", builds.length, "builds to Firestore");

  const snap = await db.collection("yolo_builds").get();
  console.log("Verified:", snap.size, "docs");
  snap.docs.forEach(d => console.log(" ", d.id, ":", d.data().name, "-", d.data().reviewStatus));
}

run().catch(e => { console.error(e); process.exit(1); });
