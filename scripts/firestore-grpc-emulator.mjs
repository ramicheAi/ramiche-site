import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  setDoc,
  terminate,
  updateDoc,
} from "firebase/firestore";

const projectId = process.env.GCLOUD_PROJECT;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

assert.match(projectId ?? "", /^demo-/, "Use a demo-* project so the CLI cannot contact production");
assert.match(firestoreHost ?? "", /^(127\.0\.0\.1|localhost):\d+$/);
assert.match(authHost ?? "", /^(127\.0\.0\.1|localhost):\d+$/);

// Avoid configuring the client twice: emulators:exec exports these variables,
// while this script explicitly connects both SDKs below.
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

let grpcPackage;
for (const relativePath of [
  "node_modules/@firebase/firestore/node_modules/@grpc/grpc-js/package.json",
  "node_modules/@grpc/grpc-js/package.json",
]) {
  try {
    grpcPackage = JSON.parse(await readFile(path.join(process.cwd(), relativePath), "utf8"));
    break;
  } catch {}
}
assert.ok(grpcPackage, "Resolved @grpc/grpc-js package was not found");
assert.equal(grpcPackage.version, process.env.EXPECT_GRPC_VERSION ?? "1.14.6");

const app = initializeApp(
  { projectId, apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com` },
  `grpc-emulator-${Date.now()}`,
);
const auth = getAuth(app);
const db = getFirestore(app);
const [firestoreHostname, firestorePort] = firestoreHost.split(":");

connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
connectFirestoreEmulator(db, firestoreHostname, Number(firestorePort));

const ref = doc(db, "grpc-compat", "range-crossing");
const unauthenticatedRef = doc(db, "grpc-compat", "unauthenticated-denial");
const evidence = {
  grpcVersion: grpcPackage.version,
  unauthenticatedDenied: false,
  anonymousAuth: false,
  readWrite: false,
  listenerEvents: 0,
  transactionAttempts: 0,
  transactionRetried: false,
  errorCode: null,
  restReadStatusAfterWrite: null,
};

try {
  const credential = await signInAnonymously(auth);
  await auth.authStateReady();
  const idToken = await credential.user.getIdToken(true);
  evidence.anonymousAuth = credential.user.isAnonymous;
  assert.equal(evidence.anonymousAuth, true);

  const listenerValues = [];
  const listenerReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("listener timed out")), 10_000);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) listenerValues.push(snapshot.data().counter);
        if (listenerValues.includes(2)) {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      },
      reject,
    );
  });

  await setDoc(ref, { counter: 1, transport: "grpc-js" });
  const restRead = await fetch(
    `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/grpc-compat/range-crossing`,
    { headers: { authorization: `Bearer ${idToken}` } },
  );
  evidence.restReadStatusAfterWrite = restRead.status;
  console.log("REST_AFTER_WRITE", restRead.status, await restRead.text());
  await updateDoc(ref, { counter: 2 });
  await listenerReady;
  evidence.listenerEvents = listenerValues.length;
  evidence.readWrite = true;

  await runTransaction(db, async (transaction) => {
    evidence.transactionAttempts += 1;
    const snapshot = await transaction.get(ref);
    assert.equal(snapshot.exists(), true);
    if (evidence.transactionAttempts === 1) {
      await setDoc(ref, { counter: 10, transport: "grpc-js" });
    }
    transaction.update(ref, { counter: (snapshot.data()?.counter ?? 0) + 1 });
  });

  evidence.transactionRetried = evidence.transactionAttempts >= 2;
  assert.equal(evidence.transactionRetried, true);
  const finalRestRead = await fetch(
    `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/grpc-compat/range-crossing`,
    { headers: { authorization: `Bearer ${idToken}` } },
  );
  assert.equal(finalRestRead.status, 200);
  const finalRestDocument = await finalRestRead.json();
  assert.equal(finalRestDocument.fields?.counter?.integerValue, "11");

  await signOut(auth);
  try {
    await setDoc(unauthenticatedRef, { forbidden: true });
  } catch (error) {
    evidence.errorCode = error?.code ?? String(error);
    evidence.unauthenticatedDenied = error?.code === "permission-denied";
  }
  assert.equal(evidence.unauthenticatedDenied, true);

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await signOut(auth).catch(() => undefined);
  await terminate(db).catch(() => undefined);
  await deleteApp(app).catch(() => undefined);
}
