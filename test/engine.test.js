// Jalankan: node test/engine.test.js
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const E = require("../js/engine.js");

// SHA-256 buatan sendiri harus sama persis dengan node:crypto
["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000), "日本語🎉", "seed::0::halo"].forEach(function (s) {
  assert.equal(E._sha256Hex(s), createHash("sha256").update(s).digest("hex"));
});

// Dua model tersedia
assert.deepEqual(E.MODEL_IDS, ["chupi", "gugugaga"]);

// Seed sama -> hasil sama; seed beda -> bisa beda
const a = E.generate("halo dunia semua", { model: "chupi", seed: 7 });
const b = E.generate("halo dunia semua", { model: "chupi", seed: 7 });
assert.deepEqual(a, b);

// Karakter khas tiap model
assert.match(E.generate("halo", { model: "chupi", seed: 1 }).response, /chupi/i);
assert.match(E.generate("halo", { model: "gugugaga", seed: 1 }).response, /gaga/i);

// Mood
assert.equal(E.detectMood("aku senang"), "happy");
assert.equal(E.detectMood("aku ngantuk"), "sleepy");
assert.equal(E.detectMood("halo"), "neutral");

// Panjang output mengikuti input, maksimal 50
assert.equal(E.generate("satu dua tiga empat lima", { seed: 1 }).length, 5);
assert.equal(E.generate("a ".repeat(200), { seed: 1 }).length, 50);

console.log("semua test engine lulus");
