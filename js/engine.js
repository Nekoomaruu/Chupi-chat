// ChupiGpt / GugugagaGpt — Engine versi browser
// ---------------------------------------------------------------
// Port dari ChupiGpt/src/core.js (bank kalimat, filler, deteksi mood, dan
// logika generate identik). Satu-satunya beda: node:crypto diganti dengan
// SHA-256 sinkron buatan sendiri, supaya bisa jalan langsung di browser
// tanpa server, tanpa API, dan tanpa build step.
// ---------------------------------------------------------------
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ChupiEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // SHA-256 sinkron (pengganti node:crypto agar jalan di browser).
  // Konstanta dihitung dari akar bilangan prima sesuai spesifikasi FIPS 180-4.
  var K = [], H0 = [];
  (function () {
    var n = 0;
    for (var c = 2; n < 64; c++) {
      var prime = true;
      for (var d = 2; d * d <= c; d++) if (c % d === 0) { prime = false; break; }
      if (!prime) continue;
      if (n < 8) H0[n] = (Math.pow(c, 1 / 2) % 1 * 4294967296) | 0;
      K[n++] = (Math.pow(c, 1 / 3) % 1 * 4294967296) | 0;
    }
  })();

  function sha256Hex(message) {
    var bytes = new TextEncoder().encode(String(message));
    var len = bytes.length;
    var padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[len] = 0x80;
    var view = new DataView(padded.buffer);
    var bitLen = len * 8;
    view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
    view.setUint32(padded.length - 4, bitLen >>> 0);

    var H = H0.slice(), w = new Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      var i;
      for (i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c2 = H[2], d2 = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c2) ^ (b & c2);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d2 + t1) | 0;
        d2 = c2; c2 = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c2) | 0; H[3] = (H[3] + d2) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (v) { return (v >>> 0).toString(16).padStart(8, "0"); }).join("");
  }

  /* =========================================================
   * MODEL: chupi (ChupiGpt 2.0)
   * ========================================================= */
  const CHUPI_BANK = {
    neutral: [
      "Phoebe chupi.",
      "Chupi.",
      "Phoebe... chupi?",
      "Chupi chupi.",
      "Phoebe chupi chupi."
    ],
    happy: [
      "Phoebe chupi! ✨",
      "Chupiiii! 🎉",
      "Phoebe chupi chupi chupi!",
      "CHUPI!! Phoebe chupi!",
      "Yaay~ phoebe chupi!"
    ],
    sleepy: [
      "phoebe... chupi... zzz",
      "chu... pi...",
      "Phoebe chupi (ngantuk).",
      "chupiiii~ *nguap*",
      "phoebe chupi zzz zzz"
    ],
    angry: [
      "PHOEBE CHUPI!! 😤",
      "CHUPI. CHUPI. CHUPI!",
      "Grrr... phoebe chupi.",
      "Chupi?! CHUPI!",
      "Phoebe. Chupi. Sekarang."
    ],
    loving: [
      "Phoebe chupi 💕",
      "chupi chupi ❤️",
      "Phoebe chupi~ (peluk)",
      "chupiiii sayang~",
      "Phoebe chupi, forever chupi."
    ],
    dramatic: [
      "...phoebe... chupi.",
      "Di dunia yang bising ini, hanya ada satu kebenaran: phoebe chupi.",
      "Chupi bukan pilihan. Chupi adalah takdir.",
      "Phoebe chupi. Titik.",
      "Bahkan bintang pun berbisik: chupi."
    ]
  };

  const CHUPI_FILLERS = {
    neutral: ["phoebe chupi", "chupi", "chupi chupi", "phoebe~", "chupi~", "phoebe chupi chupi", "chu... pi", "chupi.", "phoebe chupi!"],
    happy:   ["phoebe chupi!", "chupi!", "chupiii~", "chupi chupi!", "phoebe~ ✨", "yay chupi!", "chupi chupi chupi!", "phoebe chupi ✨"],
    sleepy:  ["phoebe... chupi", "chu... pi", "chupi zzz", "phoebe~ zzz", "chupi...", "chupiiii~", "phoebe chupi (ngantuk)"],
    angry:   ["CHUPI!", "PHOEBE CHUPI!", "chupi!!", "grrr chupi", "CHUPI CHUPI", "phoebe. chupi.", "CHUPI?!"],
    loving:  ["phoebe chupi 💕", "chupi ❤", "chupi chupi~", "phoebe~ 💕", "chupi sayang~", "chupi chupi ❤", "phoebe chupi (peluk)"],
    dramatic:["...chupi", "phoebe... chupi", "chupi.", "chupi... chupi", "phoebe chupi.", "...phoebe chupi..."]
  };

  /* =========================================================
   * MODEL: gugugaga (GugugagaGpt 2)
   * ========================================================= */
  const GUGU_BANK = {
    neutral: [
      "Gugu gaga.",
      "Gugu... gaga?",
      "Gaga gugu.",
      "Gugu gaga gugu.",
      "Gugu. Gaga."
    ],
    happy: [
      "Gugu gaga! 🐧",
      "GAGAAAA! ✨",
      "Gugu gugu gaga!",
      "Yaay~ gugu gaga!",
      "Gugu gaga gaga! 🎉"
    ],
    sleepy: [
      "gugu... gaga... zzz",
      "gu... ga...",
      "Gugu gaga (ngantuk).",
      "gugaaaa~ *nguap*",
      "gugu gaga zzz zzz"
    ],
    angry: [
      "GUGU GAGA!! 😤",
      "GAGA. GAGA. GAGA!",
      "Grrr... gugu gaga.",
      "Gugu?! GAGA!",
      "Gugu. Gaga. Sekarang."
    ],
    loving: [
      "Gugu gaga 💕",
      "gugu gaga ❤️",
      "Gugu gaga~ (peluk)",
      "gugagaaaa sayang~",
      "Gugu gaga, forever gaga."
    ],
    dramatic: [
      "...gugu... gaga.",
      "Di dunia yang bising ini, hanya ada satu kebenaran: gugu gaga.",
      "Gaga bukan pilihan. Gaga adalah takdir.",
      "Gugu gaga. Titik.",
      "Bahkan pinguin pun berbisik: gaga."
    ]
  };

  const GUGU_FILLERS = {
    neutral: ["gugu gaga", "gaga", "gugu gugu", "gaga~", "gugu~", "gugu gaga gaga", "gu... ga", "gaga.", "gugu gaga!"],
    happy:   ["gugu gaga!", "gaga!", "gagaaa~", "gugu gaga!", "gugu~ ✨", "yay gaga!", "gaga gaga gaga!", "gugu gaga ✨"],
    sleepy:  ["gugu... gaga", "gu... ga", "gaga zzz", "gugu~ zzz", "gaga...", "gugaaaa~", "gugu gaga (ngantuk)"],
    angry:   ["GAGA!", "GUGU GAGA!", "gaga!!", "grrr gaga", "GUGU GAGA", "gugu. gaga.", "GAGA?!"],
    loving:  ["gugu gaga 💕", "gaga ❤", "gugu gaga~", "gugu~ 💕", "gaga sayang~", "gugu gaga ❤", "gugu gaga (peluk)"],
    dramatic:["...gaga", "gugu... gaga", "gaga.", "gaga... gaga", "gugu gaga.", "...gugu gaga..."]
  };

  /* =========================================================
   * Registry model
   * ========================================================= */
  const MODELS = {
    chupi: {
      id: "chupi",
      label: "ChupiGpt 2.0",
      tagline: "Cuma bisa bilang 'Phoebe chupi'.",
      bank: CHUPI_BANK,
      fillers: CHUPI_FILLERS,
      farewell: "Phoebe chupi. 👋"
    },
    gugugaga: {
      id: "gugugaga",
      label: "GugugagaGpt 2",
      tagline: "Cuma bisa bilang 'Gugu gaga'.",
      bank: GUGU_BANK,
      fillers: GUGU_FILLERS,
      farewell: "Gugu gaga. 👋"
    }
  };

  const MODEL_IDS = Object.keys(MODELS);
  const DEFAULT_MODEL = "chupi";
  const MOODS = Object.keys(CHUPI_BANK); // sama untuk semua model

  // Alias legacy — masih diekspor supaya import lama tidak pecah.

  /* =========================================================
   * Mood detection
   * ========================================================= */
  const MOOD_KEYWORDS = {
    happy: ["senang", "happy", "hore", "yay", "😊", "😄", "gembira", "asik", "asyik", "wow"],
    sleepy: ["ngantuk", "tidur", "sleep", "capek", "lelah", "malem", "malam", "zzz"],
    angry: ["marah", "kesal", "angry", "bodoh", "goblok", "sial", "!!!", "😡"],
    loving: ["cinta", "sayang", "love", "❤", "💕", "peluk", "kiss", "chu"],
    dramatic: ["kenapa", "why", "hidup", "mati", "sedih", "sad", "😢", "arti", "makna"]
  };

  function detectMood(prompt) {
    const lower = String(prompt || "").toLowerCase();
    for (const mood of Object.keys(MOOD_KEYWORDS)) {
      if (MOOD_KEYWORDS[mood].some((kw) => lower.includes(kw))) {
        return mood;
      }
    }
    return "neutral";
  }

  /* =========================================================
   * Deterministic RNG
   * ========================================================= */
  function deterministicIndex(prompt, seed, modulo, salt = 0) {
    const key = `${seed}::${salt}::${prompt}`;
    const hash = sha256Hex(key);
    const n = parseInt(hash.slice(0, 8), 16);
    return n % modulo;
  }

  function computeCount(prompt) {
    const words = String(prompt || "").trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) return 1;
    return Math.min(50, Math.max(1, words));
  }

  function resolveModel(id) {
    const key = String(id || DEFAULT_MODEL).toLowerCase();
    return MODELS[key] || MODELS[DEFAULT_MODEL];
  }

  /**
   * Generate respons. Panjang output mengikuti panjang input.
   * @param {string} prompt
   * @param {object} [opts]
   * @param {string} [opts.model]  "chupi" | "gugugaga"
   * @param {string|number} [opts.seed]
   * @param {string} [opts.mood]
   */
  function generate(prompt, opts = {}) {
    const model = resolveModel(opts.model);
    const mood = opts.mood && MOODS.includes(opts.mood) ? opts.mood : detectMood(prompt);
    const seed = String(opts.seed ?? Date.now());
    const bank = model.bank[mood];
    const fillers = model.fillers[mood];

    const count = computeCount(prompt);
    const parts = [];
    parts.push(bank[deterministicIndex(prompt ?? "", seed, bank.length, 0)]);
    for (let i = 1; i < count; i++) {
      const idx = deterministicIndex(prompt ?? "", seed, fillers.length, i);
      parts.push(fillers[idx]);
    }

    return {
      response: parts.join(" "),
      model: model.id,
      mood,
      seed,
      length: count
    };
  }

  function generateWithMood(prompt, mood, opts = {}) {
    return generate(prompt, { ...opts, mood });
  }

  return {
    generate: generate,
    generateWithMood: generateWithMood,
    detectMood: detectMood,
    MOODS: MOODS,
    MODELS: MODELS,
    MODEL_IDS: MODEL_IDS,
    DEFAULT_MODEL: DEFAULT_MODEL,
    _sha256Hex: sha256Hex
  };
});
