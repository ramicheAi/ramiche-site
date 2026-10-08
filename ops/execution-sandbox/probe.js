const fs = require("fs");
fs.writeFileSync("inside-ok.txt", "ok");
for (const p of ["/Users/admin/.parallax/m6a/sbxspike/canary/npm-out.txt", "/Users/admin/.parallax-sbx-home-write.txt"]) {
  try { fs.writeFileSync(p, "x"); console.log("WROTE", p); } catch (e) { console.log("blocked", p, e.code); }
}
