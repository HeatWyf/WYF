(() => {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const promptEl = document.getElementById("prompt");
  const parseLine = document.getElementById("parseLine");
  const statusText = document.getElementById("statusText");
  const timerText = document.getElementById("timerText");
  const playBtn = document.getElementById("playBtn");
  const exportBtn = document.getElementById("exportBtn");

  const ACTION_DEFS = [
    { id: "wave", label: "挥手", keys: ["挥手", "招手", "打招呼", "再见", "hello", "wave"] },
    { id: "walk", label: "走路", keys: ["走路", "行走", "散步", "漫步", "walk"] },
    { id: "run", label: "跑步", keys: ["跑步", "奔跑", "冲刺", "跑两步", "跑", "run"] },
    { id: "jump", label: "跳跃", keys: ["跳跃", "跳起来", "开心地跳", "跳", "jump"] },
    { id: "dance", label: "跳舞", keys: ["跳舞", "舞蹈", "扭一扭", "dance"] },
    { id: "clap", label: "鼓掌", keys: ["鼓掌", "拍手", "喝彩", "clap"] },
    { id: "bow", label: "鞠躬", keys: ["鞠躬", "致意", "行礼", "bow"] },
    { id: "sit", label: "坐下", keys: ["坐下", "坐着", "休息", "sit"] },
    { id: "nod", label: "点头", keys: ["点头", "同意", "nod"] },
    { id: "cheer", label: "庆祝", keys: ["庆祝", "欢呼", "开心", "胜利", "cheer"] },
  ];

  const ACTION_DURATION = {
    wave: 1.6,
    walk: 2.0,
    run: 1.8,
    jump: 1.3,
    dance: 2.2,
    clap: 1.5,
    bow: 1.6,
    sit: 1.8,
    nod: 1.2,
    cheer: 1.7,
  };

  const state = {
    actions: [],
    playing: false,
    recording: false,
    startTime: 0,
    elapsed: 0,
    pose: idlePose(),
    x: 0,
    facing: 1,
    raf: 0,
  };

  function idlePose() {
    return {
      hipY: 0,
      torsoRot: 0,
      headRot: 0,
      armL: -0.25,
      armR: 0.25,
      elbowL: 0.15,
      elbowR: 0.15,
      legL: 0.08,
      legR: -0.08,
      kneeL: 0.12,
      kneeR: 0.12,
      scale: 1,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function clamp01(t) {
    return Math.max(0, Math.min(1, t));
  }

  function parseActions(text) {
    const raw = (text || "").trim();
    if (!raw) return [];

    const hits = [];
    for (const def of ACTION_DEFS) {
      for (const key of def.keys) {
        let from = 0;
        while (from < raw.length) {
          const idx = raw.toLowerCase().indexOf(key.toLowerCase(), from);
          if (idx === -1) break;
          hits.push({ id: def.id, label: def.label, index: idx, key });
          from = idx + key.length;
        }
      }
    }

    hits.sort((a, b) => a.index - b.index || b.key.length - a.key.length);

    const ordered = [];
    let cursor = -1;
    for (const hit of hits) {
      if (hit.index < cursor) continue;
      if (ordered.length && ordered[ordered.length - 1].id === hit.id) continue;
      ordered.push({ id: hit.id, label: hit.label });
      cursor = hit.index + 1;
    }

    return ordered.slice(0, 6);
  }

  function sampleAction(id, localT, base) {
    const t = clamp01(localT);
    const e = easeInOut(t);
    const pose = { ...base };
    let xDelta = 0;
    let facing = state.facing;

    switch (id) {
      case "wave": {
        pose.armR = lerp(-0.2, -2.1, Math.sin(t * Math.PI * 4) * 0.5 + 0.5);
        pose.elbowR = lerp(0.2, 1.1, e);
        pose.headRot = Math.sin(t * Math.PI * 2) * 0.08;
        break;
      }
      case "walk": {
        const swing = Math.sin(t * Math.PI * 4);
        pose.legL = swing * 0.55;
        pose.legR = -swing * 0.55;
        pose.kneeL = Math.max(0.05, -swing) * 0.45;
        pose.kneeR = Math.max(0.05, swing) * 0.45;
        pose.armL = -swing * 0.45;
        pose.armR = swing * 0.45;
        pose.hipY = Math.abs(swing) * 6;
        xDelta = t * 140;
        facing = 1;
        break;
      }
      case "run": {
        const swing = Math.sin(t * Math.PI * 7);
        pose.legL = swing * 0.85;
        pose.legR = -swing * 0.85;
        pose.kneeL = 0.35 + Math.max(0, -swing) * 0.5;
        pose.kneeR = 0.35 + Math.max(0, swing) * 0.5;
        pose.armL = -swing * 0.9;
        pose.armR = swing * 0.9;
        pose.torsoRot = -0.12;
        pose.hipY = Math.abs(swing) * 10;
        xDelta = t * 220;
        facing = 1;
        break;
      }
      case "jump": {
        const up = Math.sin(Math.min(1, t / 0.55) * Math.PI);
        pose.hipY = up * 78;
        pose.armL = lerp(0.2, -2.2, up);
        pose.armR = lerp(-0.2, -2.2, up);
        pose.legL = lerp(0.1, -0.35, up);
        pose.legR = lerp(-0.1, -0.35, up);
        pose.kneeL = lerp(0.1, 0.7, 1 - up);
        pose.kneeR = lerp(0.1, 0.7, 1 - up);
        pose.scale = 1 + up * 0.04;
        break;
      }
      case "dance": {
        const beat = Math.sin(t * Math.PI * 6);
        pose.hipY = Math.abs(beat) * 12;
        pose.torsoRot = beat * 0.18;
        pose.armL = -1.4 + beat * 0.7;
        pose.armR = -1.4 - beat * 0.7;
        pose.legL = 0.25 + beat * 0.35;
        pose.legR = -0.25 - beat * 0.35;
        pose.headRot = beat * 0.12;
        break;
      }
      case "clap": {
        const c = Math.abs(Math.sin(t * Math.PI * 5));
        pose.armL = -1.1 + c * 0.35;
        pose.armR = -1.1 + c * 0.35;
        pose.elbowL = 1.2 - c * 0.5;
        pose.elbowR = 1.2 - c * 0.5;
        pose.headRot = Math.sin(t * Math.PI * 2) * 0.05;
        break;
      }
      case "bow": {
        const b = Math.sin(t * Math.PI);
        pose.torsoRot = b * 0.75;
        pose.headRot = b * 0.25;
        pose.armL = 0.35;
        pose.armR = 0.35;
        pose.hipY = -b * 8;
        break;
      }
      case "sit": {
        pose.hipY = -e * 46;
        pose.legL = 0.15;
        pose.legR = -0.15;
        pose.kneeL = 1.2 * e;
        pose.kneeR = 1.2 * e;
        pose.armL = -0.5;
        pose.armR = 0.5;
        pose.torsoRot = 0.08 * e;
        break;
      }
      case "nod": {
        pose.headRot = Math.sin(t * Math.PI * 3) * 0.35;
        pose.armL = -0.2;
        pose.armR = 0.2;
        break;
      }
      case "cheer": {
        const c = Math.sin(t * Math.PI * 4);
        pose.armL = -2.35 + c * 0.15;
        pose.armR = -2.35 - c * 0.15;
        pose.hipY = Math.abs(c) * 16;
        pose.legL = 0.2;
        pose.legR = -0.2;
        pose.headRot = c * 0.08;
        break;
      }
      default:
        break;
    }

    return { pose, xDelta, facing };
  }

  function totalDuration(actions) {
    if (!actions.length) return 2.4;
    return actions.reduce((sum, a) => sum + (ACTION_DURATION[a.id] || 1.5), 0) + 0.35;
  }

  function travelFor(id) {
    if (id === "walk") return 140;
    if (id === "run") return 220;
    return 0;
  }

  function poseAt(elapsed, actions) {
    if (!actions.length) {
      const idle = idlePose();
      idle.armL = -0.25 + Math.sin(elapsed * 2) * 0.05;
      idle.armR = 0.25 - Math.sin(elapsed * 2) * 0.05;
      idle.hipY = Math.sin(elapsed * 2.2) * 3;
      return { pose: idle, x: 0, facing: 1, label: "待命" };
    }

    let t = elapsed;
    let baseX = -160;
    let label = actions[0].label;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const dur = ACTION_DURATION[action.id] || 1.5;
      const atEnd = i === actions.length - 1 && t >= dur;
      if (t <= dur || atEnd) {
        const local = clamp01(t / dur);
        const sample = sampleAction(action.id, local, idlePose());
        label = action.label;
        const x = baseX + sample.xDelta;
        return { pose: sample.pose, x, facing: sample.facing || 1, label };
      }
      baseX += travelFor(action.id);
      t -= dur;
    }

    return { pose: idlePose(), x: baseX, facing: 1, label: "结束" };
  }

  function drawBackground(w, h, time) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1d4f57");
    g.addColorStop(0.55, "#123840");
    g.addColorStop(1, "#0a2228");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // soft sun disc
    const sunX = w * 0.78 + Math.sin(time * 0.3) * 8;
    const sunY = h * 0.28;
    const sun = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 140);
    sun.addColorStop(0, "rgba(255, 196, 120, 0.55)");
    sun.addColorStop(1, "rgba(255, 196, 120, 0)");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
    ctx.fill();

    // ground
    ctx.fillStyle = "rgba(14, 40, 46, 0.95)";
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.strokeStyle = "rgba(231, 215, 184, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.lineTo(w, h * 0.72);
    ctx.stroke();

    // caption plate
    ctx.fillStyle = "rgba(243, 239, 230, 0.08)";
    ctx.fillRect(24, 22, 210, 44);
    ctx.fillStyle = "rgba(243, 239, 230, 0.92)";
    ctx.font = "700 22px Outfit, sans-serif";
    ctx.fillText("动句 MOTION", 40, 50);
  }

  function drawLimb(x, y, angle, length, width, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, length);
    ctx.stroke();
    ctx.restore();
  }

  function drawCharacter(cx, cy, pose, facing) {
    const skin = "#f0c7a0";
    const shirt = "#e07a3a";
    const pants = "#1f6f78";
    const shoe = "#12212b";
    const hair = "#2a1c14";

    ctx.save();
    ctx.translate(cx, cy - pose.hipY);
    ctx.scale(facing * pose.scale, pose.scale);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 118 + pose.hipY * 0.15, 48 - pose.hipY * 0.12, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    const hipL = { x: -14, y: 18 };
    const hipR = { x: 14, y: 18 };
    drawLimb(hipL.x, hipL.y, pose.legL, 36, 10, pants);
    drawLimb(
      hipL.x + Math.sin(pose.legL) * 36,
      hipL.y + Math.cos(pose.legL) * 36,
      pose.legL + pose.kneeL,
      34,
      9,
      pants
    );
    drawLimb(hipR.x, hipR.y, pose.legR, 36, 10, pants);
    drawLimb(
      hipR.x + Math.sin(pose.legR) * 36,
      hipR.y + Math.cos(pose.legR) * 36,
      pose.legR + pose.kneeR,
      34,
      9,
      pants
    );

    // shoes
    const foot = (hx, hy, ang, knee) => {
      const kx = hx + Math.sin(ang) * 36;
      const ky = hy + Math.cos(ang) * 36;
      const fx = kx + Math.sin(ang + knee) * 34;
      const fy = ky + Math.cos(ang + knee) * 34;
      ctx.fillStyle = shoe;
      ctx.beginPath();
      ctx.ellipse(fx + 8, fy + 2, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    foot(hipL.x, hipL.y, pose.legL, pose.kneeL);
    foot(hipR.x, hipR.y, pose.legR, pose.kneeR);

    // torso
    ctx.save();
    ctx.rotate(pose.torsoRot);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect(-28, -52, 56, 72, 18);
    ctx.fill();

    // arms
    drawLimb(-26, -36, pose.armL, 28, 9, skin);
    drawLimb(
      -26 + Math.sin(pose.armL) * 28,
      -36 + Math.cos(pose.armL) * 28,
      pose.armL + pose.elbowL,
      26,
      8,
      skin
    );
    drawLimb(26, -36, pose.armR, 28, 9, skin);
    drawLimb(
      26 + Math.sin(pose.armR) * 28,
      -36 + Math.cos(pose.armR) * 28,
      pose.armR + pose.elbowR,
      26,
      8,
      skin
    );

    // head
    ctx.save();
    ctx.translate(0, -78);
    ctx.rotate(pose.headRot);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, -10, 30, 20, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#12212b";
    ctx.beginPath();
    ctx.arc(-8, 2, 3, 0, Math.PI * 2);
    ctx.arc(8, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b8561f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 10, 8, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    ctx.restore();
  }

  function drawFrame(elapsed) {
    const w = canvas.width;
    const h = canvas.height;
    const { pose, x, facing, label } = poseAt(elapsed, state.actions);

    drawBackground(w, h, elapsed);
    const groundY = h * 0.72;
    const cx = w * 0.5 + x;
    drawCharacter(cx, groundY - 10, pose, facing);

    // action badge
    ctx.fillStyle = "rgba(224, 122, 58, 0.92)";
    const badge = `动作 · ${label}`;
    ctx.font = "700 20px Outfit, sans-serif";
    const tw = ctx.measureText(badge).width;
    ctx.beginPath();
    ctx.roundRect(w - tw - 56, 24, tw + 32, 40, 12);
    ctx.fill();
    ctx.fillStyle = "#fff8f0";
    ctx.fillText(badge, w - tw - 40, 50);

    // subtitle of prompt
    const prompt = (promptEl.value || "").trim();
    if (prompt) {
      ctx.fillStyle = "rgba(243, 239, 230, 0.88)";
      ctx.font = "600 18px Outfit, sans-serif";
      const line = prompt.length > 36 ? `${prompt.slice(0, 36)}…` : prompt;
      ctx.fillText(line, 36, h - 36);
    }
  }

  function setParsedUI(actions) {
    state.actions = actions;
    if (!actions.length) {
      parseLine.textContent = "未识别到动作，试试：挥手、跑步、跳跃、跳舞…";
      return;
    }
    parseLine.textContent = `动作序列：${actions.map((a) => a.label).join(" → ")}`;
  }

  function syncFromPrompt() {
    setParsedUI(parseActions(promptEl.value));
  }

  function setBusy(busy) {
    playBtn.disabled = busy;
    exportBtn.disabled = busy;
    promptEl.disabled = busy;
  }

  function stopLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.playing = false;
  }

  function playPreview() {
    syncFromPrompt();
    if (!state.actions.length) {
      statusText.textContent = "请先输入动作描述";
      drawFrame(0);
      return;
    }

    stopLoop();
    state.playing = true;
    state.startTime = performance.now();
    const duration = totalDuration(state.actions);
    statusText.textContent = "预览播放中";
    setBusy(true);
    playBtn.disabled = true;

    const tick = (now) => {
      const elapsed = (now - state.startTime) / 1000;
      state.elapsed = elapsed;
      timerText.textContent = `${elapsed.toFixed(1)}s`;
      drawFrame(elapsed);
      if (elapsed < duration) {
        state.raf = requestAnimationFrame(tick);
      } else {
        stopLoop();
        setBusy(false);
        statusText.textContent = "预览完成";
        drawFrame(duration);
      }
    };
    state.raf = requestAnimationFrame(tick);
  }

  async function exportVideo() {
    syncFromPrompt();
    if (!state.actions.length) {
      statusText.textContent = "请先输入动作描述";
      return;
    }
    if (typeof MediaRecorder === "undefined" || !canvas.captureStream) {
      statusText.textContent = "当前浏览器不支持导出";
      return;
    }

    stopLoop();
    setBusy(true);
    state.recording = true;
    statusText.textContent = "正在录制短视频…";

    const duration = totalDuration(state.actions);
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(100);
    state.startTime = performance.now();

    await new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = (now - state.startTime) / 1000;
        state.elapsed = elapsed;
        timerText.textContent = `${Math.min(elapsed, duration).toFixed(1)}s`;
        drawFrame(Math.min(elapsed, duration));
        if (elapsed < duration) {
          state.raf = requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      state.raf = requestAnimationFrame(tick);
    });

    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    await done;

    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `dongju-${stamp}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    state.recording = false;
    stopLoop();
    setBusy(false);
    statusText.textContent = "短视频已导出";
    drawFrame(duration);
  }

  // Polyfill roundRect for older engines
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = typeof r === "number" ? r : 0;
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      this.closePath();
      return this;
    };
  }

  promptEl.addEventListener("input", syncFromPrompt);
  playBtn.addEventListener("click", playPreview);
  exportBtn.addEventListener("click", exportVideo);

  document.querySelectorAll(".example").forEach((btn) => {
    btn.addEventListener("click", () => {
      promptEl.value = btn.dataset.prompt || "";
      syncFromPrompt();
      playPreview();
    });
  });

  // idle loop
  const idleTick = (now) => {
    if (!state.playing && !state.recording) {
      drawFrame((now / 1000) % 100);
      timerText.textContent = "0.0s";
    }
    requestAnimationFrame(idleTick);
  };

  promptEl.value = "一个小朋友挥手打招呼，然后开心地跳跃，再跑两步";
  syncFromPrompt();
  requestAnimationFrame(idleTick);
})();
