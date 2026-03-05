// フェーズ可変タイマー（静的Webアプリ）
// - フェーズ追加/削除/上下移動
// - 自動遷移（0秒で次へ）
// - 周回モード
// - 設定は localStorage 保存
// - 簡易ビープ音

const LS_KEY = "phase_timer_v1";

const elBadge = document.getElementById("badge");
const elPhaseName = document.getElementById("phaseName");
const elTime = document.getElementById("timeText");
const elNext = document.getElementById("nextText");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const addPhaseBtn = document.getElementById("addPhaseBtn");
const saveBtn = document.getElementById("saveBtn");

const loopToggle = document.getElementById("loopToggle");
const beepToggle = document.getElementById("beepToggle");

const phaseList = document.getElementById("phaseList");

let phases = [
  { name: "教材の読み込み", minutes: 5 },
  { name: "テスト", minutes: 10 },
  { name: "振り返り", minutes: 5 },
];

let phaseIndex = 0;
let remainingSec = 0;
let timerId = null;

function clampMin(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
}

function pad2(n) { return String(n).padStart(2, "0"); }
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function toSecondsFromMinutes(min) {
  return clampMin(min) * 60;
}

function beep() {
  if (!beepToggle.checked) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 140);
  } catch (_) {}
}

function stopTimer() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
  renderNow();
}

function startTimer() {
  if (timerId) return;
  // フェーズが空なら開始できない
  if (phases.length === 0) {
    alert("フェーズが0個です。まずフェーズを追加してください。");
    return;
  }
  // もし残りが0なら、現在フェーズの時間を入れる
  if (remainingSec <= 0) {
    remainingSec = toSecondsFromMinutes(phases[phaseIndex]?.minutes ?? 0);
  }
  timerId = setInterval(tick, 1000);
  renderNow();
}

function resetAll() {
  stopTimer();
  phaseIndex = 0;
  remainingSec = toSecondsFromMinutes(phases[0]?.minutes ?? 0);
  renderNow();
}

function nextPhase(manual = false) {
  if (phases.length === 0) return;

  if (!manual) beep();

  phaseIndex += 1;

  if (phaseIndex >= phases.length) {
    if (loopToggle.checked) {
      phaseIndex = 0;
      remainingSec = toSecondsFromMinutes(phases[0]?.minutes ?? 0);
      renderNow();
      return;
    } else {
      stopTimer();
      phaseIndex = phases.length - 1;
      remainingSec = 0;
      renderNow();
      alert("全フェーズ完了！");
      return;
    }
  }

  remainingSec = toSecondsFromMinutes(phases[phaseIndex]?.minutes ?? 0);
  renderNow();
}

function tick() {
  remainingSec -= 1;
  if (remainingSec <= 0) {
    nextPhase(false);
  } else {
    renderNow();
  }
}

function renderNow() {
  const total = phases.length;
  if (total === 0) {
    elBadge.textContent = "フェーズ 0 / 0";
    elPhaseName.textContent = "-";
    elTime.textContent = "00:00";
    elNext.textContent = "次：-";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resetBtn.disabled = false;
    skipBtn.disabled = true;
    return;
  }

  // phaseIndex が範囲外にならないよう保険
  phaseIndex = Math.max(0, Math.min(phaseIndex, total - 1));

  const cur = phases[phaseIndex];
  const next = phases[phaseIndex + 1];

  elBadge.textContent = `フェーズ ${phaseIndex + 1} / ${total}`;
  elPhaseName.textContent = cur?.name ?? "-";
  elTime.textContent = formatTime(Math.max(0, remainingSec));
  elNext.textContent = `次：${next ? next.name : (loopToggle.checked ? phases[0].name + "（周回）" : "なし")}`;

  const running = !!timerId;
  startBtn.disabled = running;
  pauseBtn.disabled = !running;
  skipBtn.disabled = false;
}

function renderPhaseList() {
  phaseList.innerHTML = "";

  phases.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "phaseItem";

    const row = document.createElement("div");
    row.className = "phaseRow";

    // 名前
    const nameLabel = document.createElement("label");
    nameLabel.innerHTML = `<span>フェーズ名</span>`;
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = p.name;
    nameInput.placeholder = "例：教材の読み込み";
    nameInput.addEventListener("input", () => {
      phases[idx].name = nameInput.value;
      renderNow();
    });
    nameLabel.appendChild(nameInput);

    // 分
    const minLabel = document.createElement("label");
    minLabel.innerHTML = `<span>時間（分）</span>`;
    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.min = "0";
    minInput.step = "1";
    minInput.value = p.minutes;
    minInput.addEventListener("input", () => {
      phases[idx].minutes = clampMin(minInput.value);
      // 動いていない時は現在フェーズの残りも同期
      if (!timerId && idx === phaseIndex) {
        remainingSec = toSecondsFromMinutes(phases[phaseIndex]?.minutes ?? 0);
      }
      renderNow();
    });
    minLabel.appendChild(minInput);

    // ボタン群
    const btns = document.createElement("div");
    btns.className = "itemButtons";

    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.title = "上へ";
    upBtn.disabled = (idx === 0);
    upBtn.addEventListener("click", () => movePhase(idx, idx - 1));

    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.title = "下へ";
    downBtn.disabled = (idx === phases.length - 1);
    downBtn.addEventListener("click", () => movePhase(idx, idx + 1));

    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => deletePhase(idx));

    btns.appendChild(upBtn);
    btns.appendChild(downBtn);
    btns.appendChild(delBtn);

    row.appendChild(nameLabel);
    row.appendChild(minLabel);
    row.appendChild(btns);

    item.appendChild(row);
    phaseList.appendChild(item);
  });
}

function movePhase(from, to) {
  if (to < 0 || to >= phases.length) return;

  const copy = [...phases];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  phases = copy;

  // 現在再生中のフェーズの追跡をなるべく自然にする
  // 「同じフェーズ内容」を追いたいので、移動前の phaseIndex が from の場合は to に更新
  if (phaseIndex === from) phaseIndex = to;
  else {
    // from/to の間に挟まれた場合は index をずらす
    if (from < phaseIndex && to >= phaseIndex) phaseIndex -= 1;
    else if (from > phaseIndex && to <= phaseIndex) phaseIndex += 1;
  }

  renderPhaseList();
  renderNow();
}

function deletePhase(idx) {
  if (phases.length <= 1) {
    const ok = confirm("最後の1フェーズを削除すると、タイマーが開始できなくなります。削除しますか？");
    if (!ok) return;
  }

  stopTimer();

  phases.splice(idx, 1);

  if (phases.length === 0) {
    phaseIndex = 0;
    remainingSec = 0;
  } else {
    phaseIndex = Math.min(phaseIndex, phases.length - 1);
    remainingSec = toSecondsFromMinutes(phases[phaseIndex]?.minutes ?? 0);
  }

  renderPhaseList();
  renderNow();
}

function addPhase() {
  phases.push({ name: `フェーズ${phases.length + 1}`, minutes: 5 });
  renderPhaseList();
  renderNow();
}

function saveSettings() {
  const data = {
    phases: phases.map(p => ({
      name: String(p.name ?? ""),
      minutes: clampMin(p.minutes),
    })),
    loop: !!loopToggle.checked,
    beep: !!beepToggle.checked,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
  alert("保存しました");
}

function loadSettings() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data?.phases)) {
      const cleaned = data.phases
        .map(p => ({ name: String(p.name ?? ""), minutes: clampMin(p.minutes) }))
        .filter(p => p.name.length > 0 || p.minutes >= 0);

      if (cleaned.length > 0) phases = cleaned;
    }
    loopToggle.checked = !!data.loop;
    beepToggle.checked = (data.beep === undefined) ? true : !!data.beep;
  } catch (_) {}
}

function init() {
  loadSettings();
  phaseIndex = 0;
  remainingSec = toSecondsFromMinutes(phases[0]?.minutes ?? 0);

  renderPhaseList();
  renderNow();

  startBtn.addEventListener("click", startTimer);
  pauseBtn.addEventListener("click", stopTimer);
  resetBtn.addEventListener("click", resetAll);
  skipBtn.addEventListener("click", () => {
    stopTimer();      // 手動スキップ時はいったん停止（好みで継続も可能）
    nextPhase(true);  // manual = true (ビープは鳴らさない)
  });

  addPhaseBtn.addEventListener("click", addPhase);
  saveBtn.addEventListener("click", saveSettings);

  loopToggle.addEventListener("change", renderNow);
  beepToggle.addEventListener("change", () => {});
}


init();
