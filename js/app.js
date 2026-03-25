// ============================================================
//  GIVINGTUESDAY MEME LAB v2 — app.js
//  Anonymous auth · free-drag text · corner resize · export fix
// ============================================================

import { auth, db, storage } from "./firebase-config.js";
import {
  signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, setDoc, getDoc,
  arrayUnion, arrayRemove, query, orderBy, limit,
  serverTimestamp, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, uploadString, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ─── RANDOM NAME GENERATOR ────────────────────────────────
const ADJECTIVES = [
  "Generous","Radiant","Mighty","Golden","Cosmic","Sparkly","Wholesome",
  "Chaotic","Legendary","Gentle","Fierce","Snazzy","Heroic","Glorious",
  "Electric","Serene","Funky","Daring","Sneaky","Tender","Vivid","Bold",
  "Fuzzy","Luminous","Sassy","Plucky","Nimble","Breezy","Cozy","Zesty"
];
const ANIMALS = [
  "Otter","Flamingo","Panda","Capybara","Axolotl","Penguin","Quokka",
  "Marmot","Narwhal","Manatee","Platypus","Wombat","Lemur","Gecko",
  "Corgi","Alpaca","Hedgehog","Sloth","Blobfish","Tapir","Okapi",
  "Fennec","Lorikeet","Pangolin","Kinkajou","Binturong","Fossa","Meerkat"
];

function randomName() {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num    = Math.floor(Math.random() * 900) + 100;
  return `${adj}${animal}${num}`;
}

// ─── IDENTITY ─────────────────────────────────────────────
function getOrCreateIdentity() {
  let name = localStorage.getItem("gt_display_name");
  if (!name) { name = randomName(); localStorage.setItem("gt_display_name", name); }
  return name;
}
function saveIdentityName(name) {
  const clean = name.trim().replace(/[^a-zA-Z0-9_\- ]/g, "").substring(0, 24);
  if (!clean) return;
  localStorage.setItem("gt_display_name", clean);
  document.getElementById("displayNameBadge").textContent = clean;
  syncUserDoc(clean);
  showToast("✅ Name updated to " + clean);
}
function getDisplayName() {
  return localStorage.getItem("gt_display_name") || "AnonymousFriend";
}

// ─── FIREBASE ANONYMOUS AUTH ──────────────────────────────
let currentUID = null;

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUID = user.uid;
    const name = getOrCreateIdentity();
    document.getElementById("displayNameBadge").textContent = name;
    await syncUserDoc(name);
  }
});

async function syncUserDoc(name) {
  if (!currentUID) return;
  const userRef = doc(db, "users", currentUID);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { username: name, memeCount: 0, totalLikes: 0, joinedAt: serverTimestamp() });
  } else {
    await updateDoc(userRef, { username: name });
  }
}

signInAnonymously(auth).catch(err => {
  console.warn("Anonymous auth failed — Firebase not configured yet.", err.message);
});

// ─── NAME POPOVER ─────────────────────────────────────────
const namePopover = document.getElementById("namePopover");

document.getElementById("editNameBtn").addEventListener("click", e => {
  e.stopPropagation();
  namePopover.classList.toggle("hidden");
  document.getElementById("nameInput").value = getDisplayName();
  document.getElementById("nameInput").focus();
});
document.getElementById("displayNameBadge").addEventListener("click", e => {
  e.stopPropagation();
  namePopover.classList.toggle("hidden");
  document.getElementById("nameInput").value = getDisplayName();
});
document.addEventListener("click", e => {
  if (!namePopover.contains(e.target) && e.target.id !== "editNameBtn" && e.target.id !== "displayNameBadge") {
    namePopover.classList.add("hidden");
  }
});
document.getElementById("saveNameBtn").addEventListener("click", () => {
  saveIdentityName(document.getElementById("nameInput").value);
  namePopover.classList.add("hidden");
});
document.getElementById("nameInput").addEventListener("keydown", e => {
  if (e.key === "Enter") { saveIdentityName(e.target.value); namePopover.classList.add("hidden"); }
});
document.getElementById("randomNameBtn").addEventListener("click", () => {
  document.getElementById("nameInput").value = randomName();
});

// ─── STATE ────────────────────────────────────────────────
const state = {
  image: null,
  textLayers: [
    { text: "WHEN YOU DONATE $5",  x: 0.5, y: 0.1,  fontSize: 42, color: "#ffffff" },
    { text: "AND BECOME A LEGEND", x: 0.5, y: 0.88, fontSize: 42, color: "#FFD60A" },
  ],
  activeFontFamily:   "'Bebas Neue'",
  activeOutline:      4,
  activeOutlineColor: "#000000",
  textAnimation:      "none",
  overlay:            "none",
  hashtag:            "#GivingTuesday",
  activeLayerIndex:   0,
  currentFilter:      "all",
};

const canvas       = document.getElementById("memeCanvas");
const ctx          = canvas.getContext("2d");
const stickerLayer = document.getElementById("stickerLayer");
const animLayer    = document.getElementById("animTextLayer");
const canvasWrap   = document.getElementById("canvasWrap");

// ─── MAIN DRAW ────────────────────────────────────────────
function drawMeme() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.image) {
    document.getElementById("canvasHint").classList.add("hidden");
    const { width: iw, height: ih } = state.image;
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / iw, ch / ih);
    ctx.drawImage(state.image, (cw - iw * scale) / 2, (ch - ih * scale) / 2, iw * scale, ih * scale);
  } else {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "#1a1a2e"); g.addColorStop(1, "#16213e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawOverlay();

  if (state.textAnimation === "none") {
    animLayer.innerHTML = "";
    state.textLayers.forEach(l => { if (l.text.trim()) drawLayerText(l); });
  } else {
    renderAnimDOM();
  }

  renderHandles();
}

// ─── CAPTURE-SAFE EXPORT ──────────────────────────────────
// Always bakes text onto the canvas regardless of animation mode,
// then restores the live state after capturing.
function captureCanvas() {
  const savedAnim = state.textAnimation;
  state.textAnimation = "none";
  animLayer.innerHTML = "";
  hideHandles();

  // Full redraw with everything on canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.image) {
    const { width: iw, height: ih } = state.image;
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / iw, ch / ih);
    ctx.drawImage(state.image, (cw - iw * scale) / 2, (ch - ih * scale) / 2, iw * scale, ih * scale);
  } else {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "#1a1a2e"); g.addColorStop(1, "#16213e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawOverlay();
  state.textLayers.forEach(l => { if (l.text.trim()) drawLayerText(l); });

  const dataUrl = canvas.toDataURL("image/png");

  // Restore live state
  state.textAnimation = savedAnim;
  showHandles();
  drawMeme();

  return dataUrl;
}

// ─── CANVAS TEXT RENDERING ────────────────────────────────
function drawLayerText(layer) {
  const size = layer.fontSize;
  ctx.font         = `900 ${size}px ${state.activeFontFamily}, Impact`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin     = "round";

  const maxW   = canvas.width - 40;
  const lines  = wrapText(layer.text.toUpperCase(), maxW, size);
  const lineH  = size * 1.2;
  const totalH = lines.length * lineH;
  const cx     = layer.x * canvas.width;
  const cy     = layer.y * canvas.height;

  lines.forEach((line, i) => {
    const y = cy - totalH / 2 + lineH * i + lineH / 2;
    if (+state.activeOutline > 0) {
      ctx.lineWidth   = +state.activeOutline * 2;
      ctx.strokeStyle = state.activeOutlineColor;
      ctx.strokeText(line, cx, y, maxW);
    }
    ctx.fillStyle = layer.color;
    ctx.fillText(line, cx, y, maxW);
  });
}

function wrapText(text, maxW, size) {
  ctx.font = `900 ${size}px ${state.activeFontFamily}, Impact`;
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ─── ANIMATED TEXT DOM OVERLAY ────────────────────────────
function renderAnimDOM() {
  animLayer.innerHTML = "";
  const scaleY = canvas.offsetHeight / canvas.height;
  state.textLayers.forEach((l, i) => {
    if (!l.text.trim()) return;
    const el = document.createElement("div");
    el.className = `anim-text-el anim-${state.textAnimation}`;
    const size = Math.round(l.fontSize * scaleY);
    el.style.cssText = `
      font-size: ${size}px;
      font-family: ${state.activeFontFamily}, Impact;
      color: ${l.color};
      -webkit-text-stroke: ${Math.round(+state.activeOutline * scaleY * 0.5)}px ${state.activeOutlineColor};
      left: ${l.x * 100}%;
      top: ${l.y * 100}%;
      transform: translate(-50%, -50%);
      animation-delay: ${i * 0.15}s;
      width: 90%;
      text-align: center;
    `;
    if (state.textAnimation === "scroll") {
      el.style.left = "-100%";
      el.style.transform = "translateY(-50%)";
    }
    el.textContent = l.text.toUpperCase();
    animLayer.appendChild(el);
  });
}

// ─── DRAG + RESIZE HANDLE OVERLAY ────────────────────────
let handleLayer = null;

function getHandleLayer() {
  if (handleLayer) return handleLayer;
  handleLayer = document.createElement("div");
  handleLayer.className = "handle-layer";
  canvasWrap.appendChild(handleLayer);
  return handleLayer;
}

function hideHandles() { if (handleLayer) handleLayer.style.display = "none"; }
function showHandles() { if (handleLayer) handleLayer.style.display = ""; }

function renderHandles() {
  const layer  = getHandleLayer();
  layer.innerHTML = "";

  const scaleX = canvas.offsetWidth  / canvas.width;
  const scaleY = canvas.offsetHeight / canvas.height;

  state.textLayers.forEach((tl, i) => {
    if (!tl.text.trim()) return;

    const size  = tl.fontSize;
    ctx.font    = `900 ${size}px ${state.activeFontFamily}, Impact`;
    const maxW  = canvas.width - 40;
    const lines = wrapText(tl.text.toUpperCase(), maxW, size);
    const lineH = size * 1.2;
    const rawW  = Math.min(maxW, Math.max(...lines.map(ln => ctx.measureText(ln).width)));
    const rawH  = lines.length * lineH;

    const boxW = (rawW * scaleX / canvas.offsetWidth)  * 100;
    const boxH = (rawH * scaleY / canvas.offsetHeight) * 100;

    const isActive = i === state.activeLayerIndex;

    const box = document.createElement("div");
    box.className = "text-handle-box" + (isActive ? " active" : "");
    box.style.cssText = `
      left: ${tl.x * 100}%;
      top: ${tl.y * 100}%;
      width: ${boxW}%;
      height: ${boxH}%;
      transform: translate(-50%, -50%);
    `;

    attachDrag(box, i);

    ["nw", "ne", "sw", "se"].forEach(corner => {
      const h = document.createElement("div");
      h.className = `resize-handle resize-${corner}`;
      attachResize(h, i, corner);
      box.appendChild(h);
    });

    layer.appendChild(box);
  });
}

// ─── DRAG LOGIC ───────────────────────────────────────────
function attachDrag(box, layerIndex) {
  let dragging = false;
  let startClientX, startClientY, startLX, startLY;

  box.addEventListener("pointerdown", e => {
    if (e.target.classList.contains("resize-handle")) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startLX = state.textLayers[layerIndex].x;
    startLY = state.textLayers[layerIndex].y;
    box.setPointerCapture(e.pointerId);
    selectLayer(layerIndex);
  });

  box.addEventListener("pointermove", e => {
    if (!dragging) return;
    e.preventDefault();
    const rect = canvasWrap.getBoundingClientRect();
    const dx = (e.clientX - startClientX) / rect.width;
    const dy = (e.clientY - startClientY) / rect.height;
    state.textLayers[layerIndex].x = Math.max(0.02, Math.min(0.98, startLX + dx));
    state.textLayers[layerIndex].y = Math.max(0.02, Math.min(0.98, startLY + dy));
    drawMeme();
  });

  box.addEventListener("pointerup",     () => { dragging = false; });
  box.addEventListener("pointercancel", () => { dragging = false; });
}

// ─── RESIZE LOGIC ─────────────────────────────────────────
function attachResize(handle, layerIndex, corner) {
  let resizing = false;
  let startClientX, startClientY, startSize;

  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startSize = state.textLayers[layerIndex].fontSize;
    handle.setPointerCapture(e.pointerId);
    selectLayer(layerIndex);
  });

  handle.addEventListener("pointermove", e => {
    if (!resizing) return;
    e.preventDefault();
    const rect = canvasWrap.getBoundingClientRect();
    const dx = (e.clientX - startClientX) / rect.width;
    const dy = (e.clientY - startClientY) / rect.height;
    let delta;
    if      (corner === "se") delta =  dx - dy;
    else if (corner === "sw") delta = -dx - dy;
    else if (corner === "ne") delta =  dx + dy;
    else                      delta = -dx + dy;
    const newSize = Math.max(12, Math.min(120, Math.round(startSize + delta * 300)));
    state.textLayers[layerIndex].fontSize = newSize;
    if (layerIndex === state.activeLayerIndex) {
      document.getElementById("activeFontSize").value = newSize;
      document.getElementById("fontSizeVal").textContent = newSize;
    }
    drawMeme();
  });

  handle.addEventListener("pointerup",     () => { resizing = false; });
  handle.addEventListener("pointercancel", () => { resizing = false; });
}

// ─── LAYER SELECTION ──────────────────────────────────────
function selectLayer(i) {
  state.activeLayerIndex = i;
  const layer = state.textLayers[i];
  if (layer) {
    document.getElementById("activeFontSize").value = layer.fontSize;
    document.getElementById("fontSizeVal").textContent = layer.fontSize;
  }
  document.querySelectorAll(".text-layer-row input").forEach((el, idx) => {
    el.classList.toggle("layer-active", idx === i);
  });
}

canvas.addEventListener("pointerdown", () => {
  state.activeLayerIndex = -1;
  drawMeme();
});

// ─── DRAW OVERLAY ─────────────────────────────────────────
function drawOverlay() {
  const ov = state.overlay;
  if (ov === "none") return;
  const cw = canvas.width, ch = canvas.height;

  if (ov === "vignette") {
    const g = ctx.createRadialGradient(cw/2, ch/2, ch*0.3, cw/2, ch/2, ch*0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  } else if (ov === "badge") {
    const bx = cw-130, by = ch-130, br = 50;
    ctx.beginPath(); ctx.arc(bx+br, by+br, br, 0, Math.PI*2);
    ctx.fillStyle = "#E63946"; ctx.fill();
    ctx.font = "bold 26px Syne, sans-serif"; ctx.fillStyle = "#fff";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("❤️", bx+br, by+br-8);
    ctx.font = "bold 10px Syne, sans-serif";
    ctx.fillText("GIVING", bx+br, by+br+12);
    ctx.fillText("TUESDAY", bx+br, by+br+24);
  } else if (ov === "banner") {
    ctx.fillStyle = "rgba(230,57,70,0.92)"; ctx.fillRect(0, ch-52, cw, 52);
    ctx.font = `bold 20px 'Bebas Neue', Impact`; ctx.fillStyle = "#fff";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("❤️  " + (state.hashtag || "#GivingTuesday") + "  ❤️", cw/2, ch-26);
  } else if (ov === "corner") {
    ctx.save(); ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(160,0); ctx.lineTo(0,160);
    ctx.closePath(); ctx.fillStyle = "#E63946"; ctx.fill();
    ctx.save(); ctx.translate(50,50); ctx.rotate(-Math.PI/4);
    ctx.font = "bold 12px Syne, sans-serif"; ctx.fillStyle = "#fff";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("❤️ GIVING", 0, -8); ctx.fillText("TUESDAY", 0, 8);
    ctx.restore(); ctx.restore();
  }
}

// ─── STICKER DRAG ─────────────────────────────────────────
function addSticker(emoji) {
  const el = document.createElement("div");
  el.className = "sticker-el";
  el.textContent = emoji;
  el.style.left = (15 + Math.random() * 65) + "%";
  el.style.top  = (15 + Math.random() * 65) + "%";
  makeDraggableSticker(el);
  stickerLayer.appendChild(el);
}

function makeDraggableSticker(el) {
  let ox = 0, oy = 0, dragging = false;
  el.addEventListener("pointerdown", e => {
    e.stopPropagation();
    dragging = true;
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    el.setPointerCapture(e.pointerId); el.style.zIndex = 99;
  });
  el.addEventListener("pointermove", e => {
    if (!dragging) return;
    const wrap = canvasWrap.getBoundingClientRect();
    el.style.left = Math.max(0, Math.min(90, ((e.clientX - ox - wrap.left) / wrap.width)  * 100)) + "%";
    el.style.top  = Math.max(0, Math.min(90, ((e.clientY - oy - wrap.top)  / wrap.height) * 100)) + "%";
  });
  el.addEventListener("pointerup", () => { dragging = false; el.style.zIndex = ""; });
}

// ─── TEMPLATES ────────────────────────────────────────────
const TEMPLATES = [
  { label:"Kind Energy", emoji:"🤝", bg:["#2d6a4f","#1b4332"] },
  { label:"World Saver", emoji:"🌍", bg:["#0077b6","#03045e"] },
  { label:"Heart Donor", emoji:"❤️", bg:["#c9184a","#800f2f"] },
  { label:"Chaos Giver", emoji:"🌪️", bg:["#e76f51","#264653"] },
  { label:"Volunteer",   emoji:"🙌", bg:["#480ca8","#3a0ca3"] },
  { label:"Big Hope",    emoji:"🕊️", bg:["#4cc9f0","#4361ee"] },
];

function buildTemplates() {
  const shelf = document.getElementById("templateShelf");
  TEMPLATES.forEach(t => {
    const wrap = document.createElement("div"); wrap.className = "tpl-thumb";
    const tc = Object.assign(document.createElement("canvas"), { width:80, height:80 });
    const tcx = tc.getContext("2d");
    const gr = tcx.createLinearGradient(0,0,80,80);
    gr.addColorStop(0, t.bg[0]); gr.addColorStop(1, t.bg[1]);
    tcx.fillStyle = gr; tcx.fillRect(0,0,80,80);
    tcx.font = "30px serif"; tcx.textAlign = "center"; tcx.textBaseline = "middle";
    tcx.fillText(t.emoji, 40, 34);
    tcx.font = "bold 7px Arial"; tcx.fillStyle = "rgba(255,255,255,0.65)";
    tcx.fillText("GIVING TUESDAY", 40, 67);
    const lbl = document.createElement("div"); lbl.className = "tpl-label"; lbl.textContent = t.label;
    wrap.appendChild(tc); wrap.appendChild(lbl);
    wrap.addEventListener("click", () => {
      document.querySelectorAll(".tpl-thumb").forEach(e => e.classList.remove("active"));
      wrap.classList.add("active"); loadTemplate(t);
    });
    shelf.appendChild(wrap);
  });
}

function loadTemplate(t) {
  const off = Object.assign(document.createElement("canvas"), { width:600, height:600 });
  const oct = off.getContext("2d");
  const gr = oct.createLinearGradient(0,0,600,600);
  gr.addColorStop(0, t.bg[0]); gr.addColorStop(1, t.bg[1]);
  oct.fillStyle = gr; oct.fillRect(0,0,600,600);
  oct.font = "200px serif"; oct.textAlign = "center"; oct.textBaseline = "middle";
  oct.fillText(t.emoji, 300, 300);
  const img = new Image();
  img.onload = () => { state.image = img; drawMeme(); };
  img.src = off.toDataURL();
}

// ─── SNARK ────────────────────────────────────────────────
const SNARK = [
  { top:"WHEN THE TAX DEDUCTION",          bot:"IS THE WHOLE MOTIVATION 🤫" },
  { top:"DONATING $10",                    bot:"LIKE IT'S GONNA SAVE THE WORLD. (IT MIGHT.)" },
  { top:"THE VIBES:",                      bot:"CHARITABLE BUT MAKE IT ICONIC" },
  { top:"YOUR ANNUAL REMINDER",            bot:"TO BE SLIGHTLY LESS TERRIBLE ❤️" },
  { top:"ME WAITING FOR NONPROFITS",       bot:"TO HAVE GOOD SOCIAL MEDIA 😤" },
  { top:"GIVING TUESDAY:",                 bot:"BLACK FRIDAY BUT MAKE IT WHOLESOME" },
  { top:"SPENDING MONEY I SHOULD SAVE",    bot:"ON OTHERS. GROWTH. 🌱" },
  { top:"THE ALGORITHM SHOWED ME A YACHT", bot:"I DONATED INSTEAD. I WIN." },
];

function buildSnarkGrid() {
  const grid = document.getElementById("snarkGrid");
  SNARK.forEach(s => {
    const card = document.createElement("div"); card.className = "snark-card";
    card.innerHTML = `<div class="snark-top">${s.top}</div><div class="snark-bot">${s.bot}</div>`;
    card.addEventListener("click", () => {
      state.textLayers[0].text = s.top;
      if (state.textLayers[1]) state.textLayers[1].text = s.bot;
      buildTextLayerUI(); drawMeme();
      showToast("✨ Snarky text loaded!");
    });
    grid.appendChild(card);
  });
}

// ─── TEXT LAYER UI ────────────────────────────────────────
function buildTextLayerUI() {
  const container = document.getElementById("textLayers");
  container.innerHTML = "";
  state.textLayers.forEach((layer, i) => {
    const row = document.createElement("div"); row.className = "text-layer-row";

    const input = document.createElement("input");
    input.type = "text"; input.value = layer.text;
    input.placeholder = i === 0 ? "Top text..." : i === 1 ? "Bottom text..." : "Text...";
    if (i === state.activeLayerIndex) input.classList.add("layer-active");
    input.addEventListener("focus", () => selectLayer(i));
    input.addEventListener("input", e => { layer.text = e.target.value; drawMeme(); });

    const delBtn = document.createElement("button"); delBtn.className = "text-layer-del"; delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => {
      if (state.textLayers.length <= 1) return showToast("Need at least one layer 😅");
      state.textLayers.splice(i, 1);
      state.activeLayerIndex = Math.max(0, state.activeLayerIndex - 1);
      buildTextLayerUI(); drawMeme();
    });

    row.appendChild(input); row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// ─── EMOJI PALETTE ────────────────────────────────────────
const EMOJIS = ["❤️","🌍","✨","🙌","💸","🎉","🔥","💪","😂","🤣","😭","👀","🌱","💚","🕊️","⭐","🚀","🎯","🤝","💡","🫶","😮‍💨","👏","🫡","😤","🤑","🥹","💀"];

function buildEmojiPalette() {
  const palette = document.getElementById("emojiPalette");
  EMOJIS.forEach(emoji => {
    const btn = document.createElement("div"); btn.className = "emoji-btn"; btn.textContent = emoji;
    btn.addEventListener("click", () => { addSticker(emoji); showToast(emoji + " sticker added!"); });
    palette.appendChild(btn);
  });
}

// ─── SAVE TO GALLERY ──────────────────────────────────────
document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!state.image) { showToast("Add an image first 👀"); return; }
  if (!currentUID)  { showToast("Connecting... try again!"); return; }
  try {
    showToast("🌍 Posting to gallery...");
    const dataUrl = captureCanvas();
    const storageRef = ref(storage, `memes/${currentUID}/${Date.now()}.jpg`);
    await uploadString(storageRef, dataUrl, "data_url");
    const imageUrl = await getDownloadURL(storageRef);
    await addDoc(collection(db, "memes"), {
      imageUrl, userId: currentUID, username: getDisplayName(),
      topText: state.textLayers[0]?.text || "",
      bottomText: state.textLayers[1]?.text || "",
      hashtag: state.hashtag, likes: [], likeCount: 0, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "users", currentUID), { memeCount: increment(1) });
    showToast("🎉 Meme posted! Check the gallery.");
  } catch (err) { console.error(err); showToast("Post failed — check Firebase setup."); }
});

// ─── GALLERY ──────────────────────────────────────────────
async function loadGallery(filter = "all") {
  const grid = document.getElementById("galleryGrid");
  grid.innerHTML = `<div class="gallery-empty"><p>Loading memes...</p></div>`;
  try {
    const q = query(collection(db, "memes"), orderBy("createdAt", "desc"), limit(60));
    const snap = await getDocs(q);
    if (snap.empty) {
      grid.innerHTML = `<div class="gallery-empty"><p>👀 Nothing here yet.</p><button class="btn-red" onclick="showPage('create')">Be first</button></div>`;
      return;
    }
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filter === "mine") docs = docs.filter(d => d.userId === currentUID);
    if (filter === "top")  docs.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    if (!docs.length) {
      grid.innerHTML = `<div class="gallery-empty"><p>Nothing here yet — go make one!</p></div>`;
      return;
    }
    grid.innerHTML = "";
    docs.forEach(meme => {
      const isLiked = (meme.likes || []).includes(currentUID);
      const isMine  = meme.userId === currentUID;
      const timeAgo = meme.createdAt ? formatTime(meme.createdAt.toDate()) : "just now";
      const card = document.createElement("div"); card.className = "gallery-card";
      card.innerHTML = `
        <img src="${meme.imageUrl}" alt="Meme" loading="lazy">
        <div class="gallery-card-info">
          <div class="gallery-card-user">@${meme.username || "anon"}${isMine ? ` <span class="mine-badge">you</span>` : ""}</div>
          <div class="gallery-card-date">${timeAgo}</div>
          <div class="gallery-card-actions">
            <button class="like-btn ${isLiked ? "liked" : ""}" data-id="${meme.id}" data-likes='${JSON.stringify(meme.likes || [])}'>
              ${isLiked ? "❤️" : "🤍"} ${meme.likeCount || 0}
            </button>
            <div style="display:flex;gap:8px;align-items:center;">
              <a href="${meme.imageUrl}" download="gt-meme.jpg" style="color:var(--muted);font-size:13px;font-weight:700;text-decoration:none;">⬇</a>
              ${isMine ? `<button class="delete-btn" title="Delete your meme">🗑</button>` : ""}
            </div>
          </div>
        </div>`;
      card.querySelector(".like-btn").addEventListener("click", e => {
        e.stopPropagation();
        toggleLike(meme.id, JSON.parse(e.currentTarget.dataset.likes), e.currentTarget);
      });
      const deleteBtn = card.querySelector(".delete-btn");
      if (deleteBtn) deleteBtn.addEventListener("click", e => {
        e.stopPropagation();
        openDeleteConfirm(meme.id, meme.imageUrl, card);
      });
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="gallery-empty"><p>Couldn't load gallery. Firebase may need setup.</p></div>`;
    console.error(err);
  }
}

async function toggleLike(memeId, currentLikes, btn) {
  if (!currentUID) return;
  const isLiked = currentLikes.includes(currentUID);
  const memeRef = doc(db, "memes", memeId);
  const count = parseInt(btn.textContent.replace(/\D/g, "")) || 0;
  if (isLiked) {
    await updateDoc(memeRef, { likes: arrayRemove(currentUID), likeCount: increment(-1) });
    btn.innerHTML = `🤍 ${Math.max(0, count - 1)}`; btn.classList.remove("liked");
    btn.dataset.likes = JSON.stringify(currentLikes.filter(u => u !== currentUID));
    const s = await getDoc(doc(db, "memes", memeId));
    if (s.exists()) await updateDoc(doc(db, "users", s.data().userId), { totalLikes: increment(-1) });
  } else {
    await updateDoc(memeRef, { likes: arrayUnion(currentUID), likeCount: increment(1) });
    btn.innerHTML = `❤️ ${count + 1}`; btn.classList.add("liked");
    btn.dataset.likes = JSON.stringify([...currentLikes, currentUID]);
    const s = await getDoc(doc(db, "memes", memeId));
    if (s.exists()) await updateDoc(doc(db, "users", s.data().userId), { totalLikes: increment(1) });
  }
}

// ─── LEADERBOARD ──────────────────────────────────────────
async function loadLeaderboard() {
  const table = document.getElementById("leaderboardTable");
  table.innerHTML = `<div class="lb-loading">Counting hearts... ❤️</div>`;
  try {
    const q = query(collection(db, "users"), orderBy("totalLikes", "desc"), limit(15));
    const snap = await getDocs(q);
    if (snap.empty) { table.innerHTML = `<div class="lb-loading">No data yet — post a meme and get liked!</div>`; return; }
    table.innerHTML = "";
    const medals = ["🥇","🥈","🥉"];
    snap.docs.forEach((d, i) => {
      const u = d.data(); const isMe = d.id === currentUID;
      const row = document.createElement("div"); row.className = `lb-row${isMe ? " is-me" : ""}`;
      row.innerHTML = `
        <div class="lb-rank">${medals[i] || i + 1}</div>
        <div>
          <div class="lb-name ${isMe ? "lb-name-you" : ""}">@${u.username || "anon"}${isMe ? " (you)" : ""}</div>
          <div class="lb-sub">${u.memeCount || 0} memes posted</div>
        </div>
        <div class="lb-score">${u.totalLikes || 0} ❤️</div>`;
      table.appendChild(row);
    });
  } catch (err) {
    table.innerHTML = `<div class="lb-loading">Couldn't load leaderboard — Firebase setup needed.</div>`;
    console.error(err);
  }
}

// ─── PAGE NAV ─────────────────────────────────────────────
window.showPage = function(name) {
  document.querySelectorAll(".page").forEach(p => { p.classList.remove("active"); p.classList.add("hidden"); });
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  const page = document.getElementById("page-" + name);
  const btn  = document.querySelector(`[data-page="${name}"]`);
  if (page) { page.classList.remove("hidden"); page.classList.add("active"); }
  if (btn)  btn.classList.add("active");
  if (name === "gallery")     loadGallery(state.currentFilter);
  if (name === "leaderboard") loadLeaderboard();
};

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.currentFilter = btn.dataset.filter;
    loadGallery(state.currentFilter);
  });
});

// ─── DOWNLOAD / COPY / SHARE ──────────────────────────────
document.getElementById("downloadBtn").addEventListener("click", () => {
  const dataUrl = captureCanvas();
  const a = document.createElement("a"); a.download = "givingtuesday-meme.png";
  a.href = dataUrl; a.click();
  showToast("⬇ Downloading!");
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  const dataUrl = captureCanvas();
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast("📋 Copied to clipboard!");
  } catch { showToast("⬇ Use download instead!"); }
});

document.getElementById("twitterBtn").addEventListener("click", () => {
  const t = encodeURIComponent((state.hashtag || "#GivingTuesday") + " — " + (state.textLayers[0]?.text || ""));
  window.open(`https://twitter.com/intent/tweet?text=${t}&url=https://www.givingtuesday.org`, "_blank");
});
document.getElementById("facebookBtn").addEventListener("click", () => {
  window.open("https://www.facebook.com/sharer/sharer.php?u=https://www.givingtuesday.org", "_blank");
});
document.getElementById("igBtn").addEventListener("click", () => {
  const dataUrl = captureCanvas();
  const a = document.createElement("a"); a.download = "gt-meme-ig.png";
  a.href = dataUrl; a.click();
  showToast("📸 Saved! Upload to Instagram");
});

// ─── CONTROL BINDINGS ─────────────────────────────────────
document.getElementById("imgInput").addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => { state.image = img; drawMeme(); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  document.querySelectorAll(".tpl-thumb").forEach(e => e.classList.remove("active"));
});

const uploadZone = document.getElementById("uploadZone");
uploadZone.addEventListener("dragover",  e => { e.preventDefault(); uploadZone.classList.add("dragover"); });
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", e => {
  e.preventDefault(); uploadZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0]; if (!file?.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => { state.image = img; drawMeme(); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById("addTextBtn").addEventListener("click", () => {
  const offset = state.textLayers.length * 0.1;
  state.textLayers.push({ text: "", x: 0.5, y: Math.min(0.9, 0.5 + offset), fontSize: 42, color: "#ffffff" });
  buildTextLayerUI();
  selectLayer(state.textLayers.length - 1);
  drawMeme();
});

document.getElementById("activeFontFamily").addEventListener("change", e => {
  state.activeFontFamily = e.target.value; drawMeme();
});
document.getElementById("activeFontSize").addEventListener("input", e => {
  const size = +e.target.value;
  document.getElementById("fontSizeVal").textContent = size;
  if (state.textLayers[state.activeLayerIndex]) state.textLayers[state.activeLayerIndex].fontSize = size;
  drawMeme();
});
document.getElementById("activeOutline").addEventListener("input", e => {
  state.activeOutline = e.target.value;
  document.getElementById("outlineVal").textContent = e.target.value;
  drawMeme();
});
document.querySelectorAll("[data-tc]").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll("[data-tc]").forEach(e => e.classList.remove("active"));
    el.classList.add("active");
    if (state.textLayers[state.activeLayerIndex]) state.textLayers[state.activeLayerIndex].color = el.dataset.tc;
    drawMeme();
  });
});
document.getElementById("customTextColor").addEventListener("input", e => {
  if (state.textLayers[state.activeLayerIndex]) state.textLayers[state.activeLayerIndex].color = e.target.value;
  drawMeme();
});
document.querySelectorAll("[data-oc]").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll("[data-oc]").forEach(e => e.classList.remove("active"));
    el.classList.add("active"); state.activeOutlineColor = el.dataset.oc; drawMeme();
  });
});
document.querySelectorAll(".anim-opt").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".anim-opt").forEach(e => e.classList.remove("active"));
    el.classList.add("active"); state.textAnimation = el.dataset.anim; drawMeme();
  });
});
document.querySelectorAll(".overlay-opt").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".overlay-opt").forEach(e => e.classList.remove("active"));
    el.classList.add("active"); state.overlay = el.dataset.ov; drawMeme();
  });
});
document.getElementById("hashtagInput").addEventListener("input", e => { state.hashtag = e.target.value; drawMeme(); });
document.getElementById("clearStickersBtn").addEventListener("click", () => { stickerLayer.innerHTML = ""; showToast("Stickers cleared 🧹"); });

// ─── HELPERS ──────────────────────────────────────────────
function formatTime(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

// ─── DELETE MEME ──────────────────────────────────────────
function openDeleteConfirm(memeId, imageUrl, card) {
  const existing = card.querySelector(".delete-confirm");
  if (existing) { existing.remove(); return; }
  const banner = document.createElement("div"); banner.className = "delete-confirm";
  banner.innerHTML = `
    <span>Delete this meme?</span>
    <button class="delete-confirm-yes">Yes, nuke it 💀</button>
    <button class="delete-confirm-no">Cancel</button>`;
  banner.querySelector(".delete-confirm-yes").addEventListener("click", () => deleteMeme(memeId, imageUrl, card));
  banner.querySelector(".delete-confirm-no").addEventListener("click", () => banner.remove());
  card.appendChild(banner);
}

async function deleteMeme(memeId, imageUrl, card) {
  try {
    await deleteDoc(doc(db, "memes", memeId));
    try {
      const path = decodeURIComponent(new URL(imageUrl).pathname.split("/o/")[1].split("?")[0]);
      await deleteObject(ref(storage, path));
    } catch (e) { console.warn("Storage delete skipped:", e.message); }
    await updateDoc(doc(db, "users", currentUID), { memeCount: increment(-1) });
    card.style.transition = "all 0.3s ease";
    card.style.opacity = "0"; card.style.transform = "scale(0.9)";
    setTimeout(() => card.remove(), 300);
    showToast("🗑 Meme deleted.");
  } catch (err) { console.error(err); showToast("Delete failed — check Firebase rules."); }
}

// ─── INIT ─────────────────────────────────────────────────
buildTemplates();
buildTextLayerUI();
buildEmojiPalette();
buildSnarkGrid();
drawMeme();

console.log("❤️ GivingTuesday Meme Lab v2 — export fix edition. Let's go.");
