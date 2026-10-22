// Chupi Chat — logika aplikasi (tanpa framework, tanpa build step).
(function () {
  "use strict";

  var Engine = window.ChupiEngine;
  var Icons = window.ChupiIcons;
  var icon = Icons.icon;

  var STORE_KEY = "chupichat:v1";
  var THEME_KEY = "chupichat:theme";
  var MAX_CHATS = 50;
  var MAX_MSGS = 300;
  var NEW_TITLE = "Chat baru";

  var AVATARS = { chupi: "assets/chupi.webp", gugugaga: "assets/gugugaga.webp" };
  var SUGGESTIONS = [
    "Halo, kamu siapa?",
    "Aku lagi senang banget hari ini",
    "Aku ngantuk berat",
    "Kenapa langit itu biru?",
    "Aku sayang kamu",
    "Aku kesal sama kamu"
  ];

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var desktopMq = window.matchMedia("(min-width: 800px)");

  function $(id) { return document.getElementById(id); }
  var els = {
    app: $("app"), sidebar: $("sidebar"), scrim: $("scrim"), history: $("history"),
    newChat: $("newChat"), clearAll: $("clearAll"), closeSidebar: $("closeSidebar"),
    toggleSidebar: $("toggleSidebar"), modelBtn: $("modelBtn"), modelBtnAvatar: $("modelBtnAvatar"),
    modelBtnLabel: $("modelBtnLabel"), modelMenu: $("modelMenu"), themeBtn: $("themeBtn"),
    messages: $("messages"), composer: $("composer"), input: $("input"), sendBtn: $("sendBtn"),
    hintText: $("hintText"), dialog: $("confirm"), confirmTitle: $("confirmTitle"),
    confirmText: $("confirmText"), confirmOk: $("confirmOk")
  };

  /* ---------- Util ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === false || v == null) return;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v; // hanya untuk string SVG dari icons.js
        else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var kids = [].concat(arguments[i]);
      for (var j = 0; j < kids.length; j++) {
        var kid = kids[j];
        if (kid == null || kid === false) continue;
        el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
      }
    }
    return el;
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function wordCount(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }

  /* ---------- State & penyimpanan ---------- */
  function validModel(id) { return Engine.MODEL_IDS.indexOf(id) !== -1 ? id : Engine.DEFAULT_MODEL; }

  function cleanChat(c) {
    if (!c || typeof c.id !== "string" || !Array.isArray(c.messages)) return null;
    var msgs = c.messages.filter(function (m) {
      return m && typeof m.text === "string" && (m.role === "user" || m.role === "bot" || m.role === "system");
    }).map(function (m) {
      return { role: m.role, text: m.text, model: m.role === "bot" ? validModel(m.model) : undefined, ts: Number(m.ts) || Date.now() };
    });
    return {
      id: c.id,
      title: typeof c.title === "string" && c.title ? c.title : NEW_TITLE,
      model: validModel(c.model),
      updatedAt: Number(c.updatedAt) || Date.now(),
      messages: msgs
    };
  }

  function loadState() {
    var base = { chats: [], activeId: null, lastModel: Engine.DEFAULT_MODEL, sidebarOpen: true };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return base;
      var d = JSON.parse(raw);
      var chats = (Array.isArray(d.chats) ? d.chats : []).map(cleanChat).filter(Boolean).slice(0, MAX_CHATS);
      var active = chats.some(function (c) { return c.id === d.activeId; }) ? d.activeId : null;
      return { chats: chats, activeId: active, lastModel: validModel(d.lastModel), sidebarOpen: d.sidebarOpen !== false };
    } catch (e) {
      return base;
    }
  }

  var state = loadState();

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state, function (k, v) { return k === "pending" ? undefined : v; }));
    } catch (e) { /* penyimpanan penuh / diblokir: app tetap jalan di memori */ }
  }

  function getActive() {
    for (var i = 0; i < state.chats.length; i++) if (state.chats[i].id === state.activeId) return state.chats[i];
    return null;
  }

  function currentModelId() {
    var c = getActive();
    return c ? c.model : state.lastModel;
  }

  function makeTitle(text) {
    var t = text.replace(/\s+/g, " ").trim();
    return t.length > 36 ? t.slice(0, 35).trimEnd() + "…" : t;
  }

  /* ---------- Tema ---------- */
  function currentTheme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }

  function renderThemeBtn() {
    var dark = currentTheme() === "dark";
    els.themeBtn.innerHTML = icon(dark ? "sun" : "moon", 20);
    els.themeBtn.setAttribute("aria-label", dark ? "Ganti ke tema terang" : "Ganti ke tema gelap");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#1B1611" : "#FFF8EC");
  }

  function setTheme(t, persist) {
    document.documentElement.setAttribute("data-theme", t);
    if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* abaikan */ } }
    renderThemeBtn();
  }

  /* ---------- Sidebar ---------- */
  function setSidebar(open) {
    els.app.setAttribute("data-sidebar", open ? "open" : "closed");
    els.sidebar.inert = !open;
    els.toggleSidebar.setAttribute("aria-expanded", String(open));
    els.scrim.hidden = !(open && !desktopMq.matches);
    if (desktopMq.matches) { state.sidebarOpen = open; save(); }
  }

  function isSidebarOpen() { return els.app.getAttribute("data-sidebar") === "open"; }

  function groupLabel(ts) {
    var start = new Date(); start.setHours(0, 0, 0, 0);
    var day = 86400000;
    if (ts >= start.getTime()) return "Hari ini";
    if (ts >= start.getTime() - day) return "Kemarin";
    if (ts >= start.getTime() - 7 * day) return "7 hari terakhir";
    return "Lebih lama";
  }

  function renderSidebar() {
    var nav = els.history;
    nav.replaceChildren();
    els.clearAll.hidden = state.chats.length === 0;
    if (!state.chats.length) {
      nav.appendChild(h("p", { class: "history-empty" }, "Belum ada obrolan. Mulai chat pertamamu!"));
      return;
    }
    var sorted = state.chats.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var order = [], groups = {};
    sorted.forEach(function (c) {
      var g = groupLabel(c.updatedAt);
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(c);
    });
    order.forEach(function (g) {
      nav.appendChild(h("h3", { class: "group-label" }, g));
      var ul = h("ul");
      groups[g].forEach(function (c) { ul.appendChild(historyItem(c)); });
      nav.appendChild(ul);
    });
  }

  function historyItem(c) {
    var active = c.id === state.activeId;
    return h("li", { class: "history-row" },
      h("button", { class: "history-item", type: "button", "aria-current": active ? "true" : false, onclick: function () { openChat(c.id); } },
        h("img", { class: "avatar avatar-sm", src: AVATARS[c.model], alt: "", width: 28, height: 28 }),
        h("span", { class: "title" }, c.title)),
      h("button", { class: "history-del", type: "button", "aria-label": "Hapus chat: " + c.title, html: icon("trash-2", 18),
        onclick: function () { deleteChat(c); } }));
  }

  /* ---------- Header & composer ---------- */
  function renderHeader() {
    var m = Engine.MODELS[currentModelId()];
    els.modelBtnAvatar.src = AVATARS[m.id];
    els.modelBtnLabel.textContent = m.label;
    els.input.placeholder = "Tulis pesan untuk " + m.label + "...";
    els.hintText.textContent = m.label + " — " + m.tagline + " Obrolan hanya tersimpan di browsermu.";
  }

  function updateComposer() {
    var c = getActive();
    els.sendBtn.disabled = !els.input.value.trim() || !!(c && c.pending);
  }

  function autoGrow() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 160) + "px";
  }

  /* ---------- Menu model ---------- */
  function renderModelMenu() {
    els.modelMenu.replaceChildren();
    var cur = currentModelId();
    Engine.MODEL_IDS.forEach(function (id) {
      var m = Engine.MODELS[id];
      els.modelMenu.appendChild(h("button", { class: "model-opt", type: "button", role: "menuitemradio",
        "aria-checked": String(id === cur), onclick: function () { setModel(id); } },
        h("img", { class: "avatar avatar-md", src: AVATARS[id], alt: "", width: 36, height: 36 }),
        h("span", { class: "meta" }, h("span", { class: "name" }, m.label), h("span", { class: "tag" }, m.tagline)),
        h("span", { class: "tick", html: icon("check", 18) })));
    });
  }

  function openModelMenu() {
    renderModelMenu();
    els.modelMenu.hidden = false;
    els.modelBtn.setAttribute("aria-expanded", "true");
    var first = els.modelMenu.querySelector('[aria-checked="true"]') || els.modelMenu.firstElementChild;
    if (first) first.focus();
  }

  function closeModelMenu(returnFocus) {
    if (els.modelMenu.hidden) return;
    els.modelMenu.hidden = true;
    els.modelBtn.setAttribute("aria-expanded", "false");
    if (returnFocus) els.modelBtn.focus();
  }

  function setModel(id) {
    if (!Engine.MODELS[id]) return;
    var c = getActive();
    var changed = id !== currentModelId();
    state.lastModel = id;
    if (c && c.model !== id) {
      c.model = id;
      if (c.messages.length) c.messages.push({ role: "system", text: "Model diganti ke " + Engine.MODELS[id].label, ts: Date.now() });
    }
    save();
    renderAll();
    closeModelMenu(true);
    if (changed) els.input.focus();
  }

  /* ---------- Render pesan ---------- */
  var stick = true;

  function scrollToBottom(force) {
    if (force || stick) els.messages.scrollTop = els.messages.scrollHeight;
  }

  els.messages.addEventListener("scroll", function () {
    stick = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 80;
  });

  function lastBotIndex(chat) {
    for (var i = chat.messages.length - 1; i >= 0; i--) {
      var r = chat.messages[i].role;
      if (r === "system") continue;
      return r === "bot" ? i : -1;
    }
    return -1;
  }

  function copyText(text, btn) {
    function done() {
      btn.innerHTML = icon("check", 18);
      setTimeout(function () { btn.innerHTML = icon("copy", 18); }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { /* gagal: abaikan */ });
      return;
    }
    var ta = h("textarea", { "aria-hidden": "true", tabindex: "-1" });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* abaikan */ }
    ta.remove();
  }

  function messageEl(m, opts) {
    opts = opts || {};
    if (m.role === "system") return h("div", { class: "sys", role: "separator" }, h("span", null, m.text));
    if (m.role === "user") {
      return h("div", { class: "msg user" }, h("div", { class: "body" }, h("div", { class: "bubble" }, m.text)));
    }
    var name = Engine.MODELS[m.model].label;
    var actions = h("div", { class: "actions" },
      h("button", { class: "act", type: "button", "aria-label": "Salin balasan", html: icon("copy", 18),
        onclick: function (e) { copyText(m.text, e.currentTarget); } }));
    if (opts.last) {
      actions.appendChild(h("button", { class: "act", type: "button", "aria-label": "Buat ulang balasan", html: icon("rotate-ccw", 18),
        onclick: regenerate }));
    }
    return h("div", { class: "msg bot" + (opts.revealing ? " revealing" : "") },
      h("img", { class: "avatar avatar-md", src: AVATARS[m.model], alt: name, width: 36, height: 36 }),
      h("div", { class: "body" }, h("div", { class: "bubble" }, opts.revealing ? "" : m.text), actions));
  }

  function typingEl(model) {
    var label = Engine.MODELS[model].label;
    return h("div", { class: "msg bot typing", role: "status", "aria-label": label + " sedang mengetik" },
      h("img", { class: "avatar avatar-md", src: AVATARS[model], alt: "", width: 36, height: 36 }),
      h("div", { class: "body" }, h("div", { class: "bubble" }, h("span", { class: "dots" }, h("i"), h("i"), h("i")))));
  }

  function emptyEl() {
    var m = Engine.MODELS[currentModelId()];
    return h("div", { class: "empty" },
      h("img", { class: "empty-avatar", src: AVATARS[m.id], alt: m.label, width: 112, height: 112 }),
      h("h2", null, "Halo, aku " + m.label),
      h("p", { class: "empty-sub" }, m.tagline + " Yuk ngobrol!"),
      h("div", { class: "suggest-title" }, h("span", { html: icon("sparkles", 16) }), "Coba kirim ini"),
      h("div", { class: "chips" }, SUGGESTIONS.map(function (s) {
        return h("button", { class: "chip", type: "button", onclick: function () { send(s); } }, s);
      })));
  }

  function renderMessages() {
    var chat = getActive();
    var thread = h("div", { class: "thread" });
    if (!chat || !chat.messages.length) {
      thread.appendChild(emptyEl());
    } else {
      var lb = lastBotIndex(chat);
      chat.messages.forEach(function (m, i) { thread.appendChild(messageEl(m, { last: i === lb })); });
      if (chat.pending) thread.appendChild(typingEl(chat.pendingModel || chat.model));
    }
    els.messages.replaceChildren(thread);
    stick = true;
    scrollToBottom(true);
  }

  function renderAll() {
    renderSidebar();
    renderHeader();
    renderMessages();
    updateComposer();
  }

  /* ---------- Balasan: titik mengetik + efek ketik ---------- */
  function reveal(bubble, text, done) {
    if (reducedMotion.matches) { bubble.textContent = text; done(true); return; }
    var chars = Array.from(text);
    var total = chars.length, tick = 22;
    var perTick = Math.max(1, Math.ceil(total / (2200 / tick)));
    var i = 0;
    bubble.classList.add("caret");
    (function step() {
      if (!bubble.isConnected) { done(false); return; }
      i = Math.min(total, i + perTick);
      bubble.textContent = chars.slice(0, i).join("");
      scrollToBottom(false);
      if (i < total) setTimeout(step, tick);
      else { bubble.classList.remove("caret"); done(true); }
    })();
  }

  function respond(chat, promptText) {
    var model = chat.model;
    chat.pending = true;
    chat.pendingModel = model;
    var delay = reducedMotion.matches ? 250 : Math.min(1600, 500 + wordCount(promptText) * 45);

    setTimeout(function () {
      chat.pending = false;
      chat.pendingModel = undefined;
      if (state.chats.indexOf(chat) === -1) return; // chat sudah dihapus

      var out = Engine.generate(promptText, { model: model });
      var msg = { role: "bot", text: out.response, model: out.model, ts: Date.now() };
      chat.messages.push(msg);
      chat.updatedAt = Date.now();
      trimChat(chat);
      save();

      if (state.activeId !== chat.id) { renderSidebar(); updateComposer(); return; }

      var thread = els.messages.firstElementChild;
      var typing = thread && thread.querySelector(".typing");
      if (!thread || !typing) { renderAll(); return; }
      var el = messageEl(msg, { revealing: true });
      typing.replaceWith(el);
      renderSidebar();
      scrollToBottom(false);
      reveal(el.querySelector(".bubble"), msg.text, function (stillThere) {
        if (stillThere && state.activeId === chat.id) renderMessages();
        updateComposer();
      });
    }, delay);
  }

  function trimChat(chat) {
    if (chat.messages.length > MAX_MSGS) chat.messages = chat.messages.slice(-MAX_MSGS);
  }

  /* ---------- Aksi ---------- */
  function send(raw) {
    var text = String(raw).trim();
    if (!text) return;
    var chat = getActive();
    if (chat && chat.pending) return;
    if (!chat) {
      chat = { id: uid(), title: NEW_TITLE, model: state.lastModel, updatedAt: Date.now(), messages: [] };
      state.chats.unshift(chat);
      if (state.chats.length > MAX_CHATS) state.chats = state.chats.slice(0, MAX_CHATS);
      state.activeId = chat.id;
    }
    chat.messages.push({ role: "user", text: text, ts: Date.now() });
    if (chat.title === NEW_TITLE) chat.title = makeTitle(text);
    chat.updatedAt = Date.now();
    trimChat(chat);
    respond(chat, text);
    save();
    renderAll();
  }

  function regenerate() {
    var chat = getActive();
    if (!chat || chat.pending) return;
    var idx = lastBotIndex(chat);
    if (idx === -1) return;
    chat.messages.splice(idx, 1);
    var lastUser = null;
    for (var i = chat.messages.length - 1; i >= 0; i--) if (chat.messages[i].role === "user") { lastUser = chat.messages[i]; break; }
    if (!lastUser) return;
    respond(chat, lastUser.text);
    save();
    renderAll();
  }

  function newChat() {
    var c = getActive();
    if (c || state.activeId !== null) {
      state.activeId = null;
      save();
      renderAll();
    }
    if (!desktopMq.matches) setSidebar(false);
    els.input.focus();
  }

  function openChat(id) {
    if (state.activeId !== id) {
      state.activeId = id;
      save();
      renderAll();
    }
    if (!desktopMq.matches) setSidebar(false);
  }

  function askConfirm(title, text, okLabel) {
    return new Promise(function (resolve) {
      els.confirmTitle.textContent = title;
      els.confirmText.textContent = text;
      els.confirmOk.textContent = okLabel;
      els.dialog.returnValue = "";
      els.dialog.addEventListener("close", function () { resolve(els.dialog.returnValue === "ok"); }, { once: true });
      els.dialog.showModal();
    });
  }

  function deleteChat(chat) {
    askConfirm("Hapus chat ini?", "\"" + chat.title + "\" akan dihapus permanen dari browsermu.", "Hapus").then(function (ok) {
      if (!ok) return;
      state.chats = state.chats.filter(function (c) { return c !== chat; });
      if (state.activeId === chat.id) state.activeId = null;
      save();
      renderAll();
    });
  }

  function deleteAll() {
    askConfirm("Hapus semua riwayat?", "Semua obrolan akan dihapus permanen dari browsermu dan tidak bisa dikembalikan.", "Hapus semua").then(function (ok) {
      if (!ok) return;
      state.chats = [];
      state.activeId = null;
      save();
      renderAll();
    });
  }

  /* ---------- Event ---------- */
  els.composer.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = els.input.value;
    if (!text.trim()) return;
    var c = getActive();
    if (c && c.pending) return;
    els.input.value = "";
    autoGrow();
    updateComposer();
    send(text);
  });

  els.input.addEventListener("input", function () { autoGrow(); updateComposer(); });
  els.input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      els.composer.requestSubmit();
    }
  });

  els.newChat.addEventListener("click", newChat);
  els.clearAll.addEventListener("click", deleteAll);
  els.toggleSidebar.addEventListener("click", function () { setSidebar(!isSidebarOpen()); });
  els.closeSidebar.addEventListener("click", function () { setSidebar(false); });
  els.scrim.addEventListener("click", function () { setSidebar(false); });
  els.themeBtn.addEventListener("click", function () { setTheme(currentTheme() === "dark" ? "light" : "dark", true); });

  els.modelBtn.addEventListener("click", function () { els.modelMenu.hidden ? openModelMenu() : closeModelMenu(false); });
  document.addEventListener("click", function (e) {
    if (!els.modelMenu.hidden && !e.target.closest(".model-switch")) closeModelMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!els.modelMenu.hidden) { closeModelMenu(true); return; }
    if (!desktopMq.matches && isSidebarOpen()) setSidebar(false);
  });

  desktopMq.addEventListener("change", function () {
    setSidebar(desktopMq.matches ? state.sidebarOpen !== false : false);
  });

  // Ikuti tema sistem selama pengguna belum memilih sendiri.
  var colorMq = window.matchMedia("(prefers-color-scheme: dark)");
  colorMq.addEventListener("change", function (e) {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (err) { /* abaikan */ }
    if (!stored) setTheme(e.matches ? "dark" : "light", false);
  });

  /* ---------- Mulai ---------- */
  Icons.hydrate();
  renderThemeBtn();
  // Atur posisi awal sidebar tanpa animasi supaya tidak "meluncur" tiap halaman dibuka.
  els.app.classList.add("no-transition");
  setSidebar(desktopMq.matches ? state.sidebarOpen !== false : false);
  renderAll();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { els.app.classList.remove("no-transition"); });
  });
  if (desktopMq.matches) els.input.focus();
})();
