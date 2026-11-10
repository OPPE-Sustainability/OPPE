// js/light-room-3d.js
// ระบบจำลองห้อง 3 มิติ (Three.js) แสดงตำแหน่งโคมไฟ ความสว่างจริง และจุดตรวจวัด Lux รายห้อง
(function () {
  const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
  const ORBIT_CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";

  let threeLoadPromise = null;
  let activeSession = null;

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.getAttribute("data-loaded") === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("โหลดสคริปต์ไม่สำเร็จ: " + src)));
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => {
        s.setAttribute("data-loaded", "true");
        resolve();
      };
      s.onerror = () => reject(new Error("โหลดสคริปต์ไม่สำเร็จ: " + src));
      document.head.appendChild(s);
    });
  }

  function ensureThreeLoaded() {
    if (window.THREE && window.THREE.OrbitControls) {
      return Promise.resolve(window.THREE);
    }
    if (!threeLoadPromise) {
      threeLoadPromise = loadScriptOnce(THREE_CDN)
        .then(() => loadScriptOnce(ORBIT_CDN))
        .then(() => {
          if (!window.THREE || !window.THREE.OrbitControls) {
            throw new Error("Three.js หรือ OrbitControls ไม่พร้อมใช้งาน");
          }
          return window.THREE;
        })
        .catch(err => {
          threeLoadPromise = null;
          throw err;
        });
    }
    return threeLoadPromise;
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // แยกเกณฑ์มาตรฐาน (standardLux, minLux) ออกเป็นตัวเลขเพื่อประเมินสีและสัดส่วนความสว่าง
  function parseThresholds(standardLuxStr, minLuxStr) {
    const stdRaw = (standardLuxStr || "").toString().trim();
    const minRaw = (minLuxStr || "").toString().trim();

    let stdMin = 300;
    let stdMax = Infinity;

    if (stdRaw.includes(">")) {
      stdMin = parseFloat(stdRaw.replace(">", "")) || 2400;
    } else if (stdRaw.includes("-") && !stdRaw.startsWith("-")) {
      const parts = stdRaw.split("-");
      stdMin = parseFloat(parts[0]) || 300;
      stdMax = parseFloat(parts[1]) || Infinity;
    } else {
      const parsed = parseFloat(stdRaw);
      if (!isNaN(parsed) && parsed > 0) stdMin = parsed;
    }

    let minAllow = null;
    if (minRaw && minRaw !== "-") {
      const parsedMin = parseFloat(minRaw);
      if (!isNaN(parsedMin) && parsedMin > 0) minAllow = parsedMin;
    }

    return { stdMin, stdMax, minAllow };
  }

  // ประเมินสถานะของแต่ละจุดตรวจวัด (pass / warn / fail)
  function evaluatePointStatus(lux, thresholds) {
    const { stdMin, stdMax, minAllow } = thresholds;
    if (minAllow !== null && lux < minAllow) {
      return {
        tier: "fail",
        colorHex: "#ef4444",
        threeColor: 0xef4444,
        label: `ต่ำกว่าจุดต่ำสุด (${minAllow} Lux)`
      };
    }
    if (lux > stdMax) {
      return {
        tier: "warn",
        colorHex: "#f59e0b",
        threeColor: 0xf59e0b,
        label: `สูงกว่าช่วงเกณฑ์ (${stdMax} Lux)`
      };
    }
    if (lux < stdMin) {
      if (minAllow !== null) {
        return {
          tier: "warn",
          colorHex: "#f59e0b",
          threeColor: 0xf59e0b,
          label: `ผ่านจุดต่ำสุด แต่ต่ำกว่าเกณฑ์เฉลี่ย (${stdMin} Lux)`
        };
      }
      return {
        tier: "fail",
        colorHex: "#ef4444",
        threeColor: 0xef4444,
        label: `ต่ำกว่าเกณฑ์มาตรฐาน (${stdMin} Lux)`
      };
    }
    return {
      tier: "pass",
      colorHex: "#10b981",
      threeColor: 0x10b981,
      label: "ผ่านเกณฑ์มาตรฐาน"
    };
  }

  // ตรวจจับรูปแบบการวัด (Pattern) จากข้อความคอลัมน์ pattern หรือรหัสจุดตรวจวัด
  function detectPatternType(patternText, points) {
    const pat = (patternText || "").toString();
    const codes = points.map(p => (p.pointCode || "").toString().trim().toLowerCase());

    if (pat.includes("2.1") || (codes.length === 18 && codes.includes("r-8") && codes.includes("q-4") && codes.includes("t-4"))) return "2.1";
    if (pat.includes("2.2") || (codes.length === 4 && codes.every(c => c.startsWith("p-")))) return "2.2";
    if (pat.includes("2.3") || (codes.length === 10 && codes.includes("q-8") && !codes.includes("r-1"))) return "2.3";
    if (pat.includes("2.4") || (codes.length === 12 && codes.includes("r-4") && codes.includes("t-4") && codes.includes("q-2"))) return "2.4";
    if (pat.includes("2.5") || (codes.length === 8 && codes.includes("q-6") && !codes.includes("q-7") && !codes.includes("r-1"))) return "2.5";
    if (pat.includes("2.6") || (codes.length === 9 && codes.includes("r-4") && codes.includes("t-2") && !codes.includes("t-3"))) return "2.6";
    if (pat.includes("รูปแบบที่ 3") || codes.some(c => c.startsWith("e-"))) return "3";

    return "1";
  }

  // คำนวณจำนวนจุดตามแนวกว้าง (Width) เริ่มต้นสำหรับรูปแบบที่ 1 (เดินแนวกว้างก่อน แล้วไล่ไปแนวยาวแบบสลับฟันปลา)
  function computeDefaultWidthPoints(nTotal, combinedTask) {
    if (nTotal <= 1) return 1;
    if (nTotal <= 6 && /(ทางเดิน|บันได|ระเบียง)/.test(combinedTask)) return 1;
    if (nTotal === 2) return 2;
    if (nTotal === 3) return 3;

    // หาตัวประกอบที่ทำให้จำนวนจุดแนวกว้าง <= แนวยาว อย่างสมดุล (เช่น 6->2x3, 9->3x3, 24->4x6, 30->5x6)
    const maxW = Math.floor(Math.sqrt(nTotal));
    for (let d = maxW; d >= 2; d--) {
      if (nTotal % d === 0 && (nTotal / d) <= d * 2.5) {
        return d;
      }
    }
    // กรณีหารไม่ลงตัว (เช่น 41 จุด -> แนวกว้าง 6 จุด x แนวยาว 7 แถว)
    return Math.max(2, maxW);
  }

  // เรียงลำดับจุด r-1, r-2, ..., r-n ตามตัวเลขจริงเพื่อให้เส้นทางเดินสลับฟันปลาถูกต้องเสมอ
  function sortPointsForSnakeWalk(rawPoints) {
    const canNumericSort = rawPoints.every(p => /^[a-zA-Z]+-\d+$/.test((p.pointCode || "").toString().trim()));
    if (!canNumericSort) return rawPoints.slice();

    return rawPoints.slice().sort((a, b) => {
      const na = parseInt(a.pointCode.toString().split("-")[1], 10) || 0;
      const nb = parseInt(b.pointCode.toString().split("-")[1], 10) || 0;
      return na - nb;
    });
  }

  // คำนวณขนาดห้อง ตำแหน่งโคมไฟเพดาน และพิกัดจุดตรวจวัด (X, Z) ตามผังมาตรฐานกรมสวัสดิการฯ
  function buildRoomLayout(roomData, thresholds, customWidthPoints) {
    const basePoints = (roomData.points && roomData.points.length > 0)
      ? roomData.points
      : [{ pointCode: "r-1", pointLux: roomData.measuredLux || 0, pattern: "" }];

    const firstPattern = (basePoints[0] && basePoints[0].pattern) || "";
    const patternType = detectPatternType(firstPattern, basePoints);
    const rawPoints = (patternType === "1" || patternType === "3")
      ? sortPointsForSnakeWalk(basePoints)
      : basePoints;

    const combinedTask = `${roomData.room || ""} ${roomData.task || ""} ${firstPattern}`;
    const isFloorLevel = patternType === "3" ||
      /(ทางเดิน|หนีไฟ|บันได|ลานจอด|ภายนอก|ประตูทางเข้า)/.test(combinedTask);

    const workplaneY = isFloorLevel ? 0.08 : 0.75;
    let roomW = 8.0; // แกน X: แนวยาวของห้อง (Length)
    let roomD = 6.0; // แกน Z: แนวกว้างของห้อง (Width)
    let ceilingY = 3.0;
    let patternLabel = firstPattern || "รูปแบบที่ 1 : ตรวจวัดแสงเฉลี่ยของพื้นที่ทั่วไป";

    const slotCoords = {};
    const luminaires = []; // { x, z, w, d, style: 'panel' | 'strip' | 'diffuser' | 'dome' }

    if (patternType === "2.2") {
      // โคมไฟเดี่ยว 1 ดวงกลางห้อง + 4 จุดรอบโคม (P-1..P-4)
      roomW = 6.0;
      roomD = 6.0;
      luminaires.push({ x: 0, z: 0, w: 1.1, d: 1.1, style: "dome" });
      Object.assign(slotCoords, {
        "p-1": [-1.45, -1.45],
        "p-2": [1.45, -1.45],
        "p-3": [-1.45, 1.45],
        "p-4": [1.45, 1.45]
      });
    } else if (patternType === "2.4") {
      // โคมไฟตั้งแต่ 2 แถวขึ้นไป ติดตั้งต่อกันเป็นรางยาว (12 จุด: r-1..4, q-1..2, t-1..4, p-1..2)
      roomW = 8.8;
      roomD = 6.6;
      [-1.4, 1.4].forEach(zRow => {
        [-2.2, 0, 2.2].forEach(xSeg => {
          luminaires.push({ x: xSeg, z: zRow, w: 2.05, d: 0.36, style: "strip" });
        });
      });
      Object.assign(slotCoords, {
        "r-1": [-1.0, -0.58],
        "r-2": [1.0, -0.58],
        "r-3": [-1.0, 0.58],
        "r-4": [1.0, 0.58],
        "q-1": [0, -2.45],
        "q-2": [0, 2.45],
        "t-1": [-3.35, -0.85],
        "t-2": [-3.35, 0.85],
        "t-3": [3.35, -0.85],
        "t-4": [3.35, 0.85],
        "p-1": [-3.45, -2.45],
        "p-2": [3.45, 2.45]
      });
    } else if (patternType === "2.1") {
      // โคมไฟ 2 แถวขึ้นไป ช่องไฟเท่ากัน แยกดวง (18 จุด: P-1..2, Q-1..4, R-1..8, T-1..4)
      roomW = 9.4;
      roomD = 7.0;
      [-1.45, 1.45].forEach(zRow => {
        [-2.5, 0, 2.5].forEach(xCol => {
          luminaires.push({ x: xCol, z: zRow, w: 1.2, d: 0.6, style: "panel" });
        });
      });
      Object.assign(slotCoords, {
        "r-1": [-1.8, -0.6], "r-2": [-0.6, -0.6], "r-3": [0.6, -0.6], "r-4": [1.8, -0.6],
        "r-5": [-1.8, 0.6],  "r-6": [-0.6, 0.6],  "r-7": [0.6, 0.6],  "r-8": [1.8, 0.6],
        "q-1": [-1.2, -2.55], "q-2": [1.2, -2.55],
        "q-3": [-1.2, 2.55],  "q-4": [1.2, 2.55],
        "t-1": [-3.75, -0.85], "t-2": [-3.75, 0.85],
        "t-3": [3.75, -0.85],  "t-4": [3.75, 0.85],
        "p-1": [-3.75, -2.55], "p-2": [3.75, 2.55]
      });
    } else if (patternType === "2.3") {
      // โคมไฟ 1 แถว ชุดโคมไฟแยกกัน (10 จุด: q-1..8, p-1..2)
      roomW = 8.8;
      roomD = 5.2;
      [-2.5, 0, 2.5].forEach(xCol => {
        luminaires.push({ x: xCol, z: 0, w: 1.25, d: 0.6, style: "panel" });
      });
      Object.assign(slotCoords, {
        "q-1": [-2.25, -1.15], "q-2": [-0.75, -1.15], "q-3": [0.75, -1.15], "q-4": [2.25, -1.15],
        "q-5": [-2.25, 1.15],  "q-6": [-0.75, 1.15],  "q-7": [0.75, 1.15],  "q-8": [2.25, 1.15],
        "p-1": [-3.6, -1.85],  "p-2": [3.6, 1.85]
      });
    } else if (patternType === "2.5") {
      // โคมไฟ 1 แถว ติดตั้งต่อกันเป็นรางยาว (8 จุด: q-1..6, p-1..2)
      roomW = 8.4;
      roomD = 5.0;
      [-2.1, 0, 2.1].forEach(xSeg => {
        luminaires.push({ x: xSeg, z: 0, w: 2.0, d: 0.38, style: "strip" });
      });
      Object.assign(slotCoords, {
        "q-1": [-1.9, -1.15], "q-2": [0, -1.15], "q-3": [1.9, -1.15],
        "q-4": [-1.9, 1.15],  "q-5": [0, 1.15],  "q-6": [1.9, 1.15],
        "p-1": [-3.4, -1.8],  "p-2": [3.4, 1.8]
      });
    } else if (patternType === "2.6") {
      // เพดานกระจายแสงเต็มพื้นที่ (9 จุด: r-1..4, q-1..2, t-1..2, p-1)
      roomW = 7.4;
      roomD = 6.4;
      [-1.5, 1.5].forEach(zRow => {
        [-1.8, 1.8].forEach(xCol => {
          luminaires.push({ x: xCol, z: zRow, w: 2.8, d: 2.2, style: "diffuser" });
        });
      });
      Object.assign(slotCoords, {
        "r-1": [-1.05, -0.85], "r-2": [1.05, -0.85],
        "r-3": [-1.05, 0.85],  "r-4": [1.05, 0.85],
        "q-1": [0, -2.35],     "q-2": [0, 2.35],
        "t-1": [-2.85, 0],     "t-2": [2.85, 0],
        "p-1": [-2.85, -2.35]
      });
    } else if (patternType === "3") {
      // รูปแบบที่ 3: ทางหนีไฟ E-1..E-n
      const n = rawPoints.length;
      if (n <= 10) {
        const stepX = n > 6 ? 1.45 : 1.85;
        roomW = Math.max(6.8, (n + 1) * stepX);
        roomD = 3.4;
        ceilingY = 2.85;

        const startX = -((n - 1) * stepX) / 2;
        rawPoints.forEach((pt, idx) => {
          const key = (pt.pointCode || `e-${idx + 1}`).toString().trim().toLowerCase();
          slotCoords[key] = [startX + idx * stepX, 0];
        });

        const lampCount = Math.min(Math.max(2, n), 8);
        const lampSpan = roomW - 2.2;
        for (let i = 0; i < lampCount; i++) {
          const lx = lampCount === 1 ? 0 : (-lampSpan / 2 + (i * lampSpan) / (lampCount - 1));
          luminaires.push({ x: lx, z: 0, w: 0.9, d: 0.35, style: "strip" });
        }
      }
    }

    // =========================================================================
    // รูปแบบที่ 1 (r-1..r-n): เดินตามแนวกว้างของห้องก่อน แล้วค่อยไล่ไปแนวยาวแบบสลับฟันปลา
    //   - แกน Z (หน้า <-> หลัง) = แนวกว้างของห้อง (Width: nWidth จุดต่อแถวเดิน)
    //   - แกน X (ซ้าย -> ขวา)   = แนวยาวของห้อง (Length: nLength แถว)
    // =========================================================================
    const nTotal = rawPoints.length;
    const isSnakePattern = Object.keys(slotCoords).length === 0;

    const defaultWidthPts = computeDefaultWidthPoints(nTotal, combinedTask);
    const nWidth = customWidthPoints
      ? Math.max(1, Math.min(nTotal, Math.round(customWidthPoints)))
      : defaultWidthPts;
    const nLength = Math.max(1, Math.ceil(nTotal / nWidth));

    if (isSnakePattern) {
      if (nTotal === 1) {
        roomW = 5.8;
        roomD = 4.6;
      } else {
        const cellW = nTotal > 20 ? 1.5 : (nTotal > 9 ? 1.7 : 1.85);
        // ให้ระยะแนวยาว (X) กว้างกว่าแนวกว้าง (Z) เล็กน้อยเพื่อให้เห็นสัดส่วนกว้างxยาวของห้องชัดเจน
        const cellL = (nLength >= nWidth) ? cellW * 1.18 : cellW;
        roomD = Math.max(3.8, nWidth * cellW + 1.6);
        roomW = Math.max(5.8, nLength * cellL + 1.9);
        if (nLength >= nWidth && roomW < roomD * 1.15) {
          roomW = roomD * 1.18;
        }
        if (nTotal > 16) ceilingY = 3.5;
      }
    }

    const mappedPoints = rawPoints.map((pt, idx) => {
      const origCode = (pt.pointCode && pt.pointCode !== "-") ? pt.pointCode.toString().trim() : `r-${idx + 1}`;
      const normCode = origCode.toLowerCase();
      const luxVal = Number(pt.pointLux) > 0 ? Number(pt.pointLux) : (Number(roomData.measuredLux) || 0);

      let x = 0;
      let z = 0;
      if (slotCoords[normCode]) {
        x = slotCoords[normCode][0];
        z = slotCoords[normCode][1];
      } else {
        // เดินตามแนวกว้าง (widthRow บนแกน Z) ก่อนจนสุดฝั่ง แล้วเขยิบไปแนวยาว (lengthCol บนแกน X) แบบสลับฟันปลา
        const lengthCol = Math.floor(idx / nWidth);
        const stepInWidth = idx % nWidth;
        const widthRow = (lengthCol % 2 === 0)
          ? stepInWidth
          : (nWidth - 1 - stepInWidth);

        const usableW = roomW - 2.2;
        const usableD = roomD - 1.9;
        x = nLength === 1 ? 0 : (-usableW / 2 + (lengthCol * usableW) / (nLength - 1));
        z = nWidth === 1 ? 0 : (usableD / 2 - (widthRow * usableD) / (nWidth - 1));
      }

      const status = evaluatePointStatus(luxVal, thresholds);
      return {
        index: idx,
        code: origCode,
        lux: Number(luxVal.toFixed(2)),
        x,
        z,
        y: workplaneY,
        status
      };
    });

    // หากเป็นรูปแบบที่ 1 (ยังไม่ได้วางโคมไฟเพดาน) ให้สร้างชุดโคมไฟสอดคล้องกับแนวยาว x แนวกว้างของห้อง
    if (luminaires.length === 0) {
      if (nTotal === 1) {
        luminaires.push({ x: -1.1, z: 0, w: 1.15, d: 0.55, style: "panel" });
        luminaires.push({ x: 1.1, z: 0, w: 1.15, d: 0.55, style: "panel" });
      } else if (nTotal === 2) {
        mappedPoints.forEach(mp => {
          luminaires.push({ x: mp.x, z: mp.z, w: 1.15, d: 0.55, style: "panel" });
        });
      } else if (nTotal <= 9) {
        const lCols = Math.min(nLength, 3);
        const lRows = Math.min(nWidth, 3);
        const spanW = roomW - 2.4;
        const spanD = roomD - 2.1;
        for (let r = 0; r < lRows; r++) {
          for (let c = 0; c < lCols; c++) {
            const lx = lCols === 1 ? 0 : (-spanW / 2 + (c * spanW) / (lCols - 1));
            const lz = lRows === 1 ? 0 : (-spanD / 2 + (r * spanD) / (lRows - 1));
            luminaires.push({ x: lx, z: lz, w: 1.2, d: 0.55, style: "panel" });
          }
        }
      } else {
        const lCols = Math.min(Math.max(2, nLength), 5);
        const lRows = Math.min(Math.max(2, nWidth), 4);
        const spanW = roomW - 2.6;
        const spanD = roomD - 2.3;
        for (let r = 0; r < lRows; r++) {
          for (let c = 0; c < lCols; c++) {
            const lx = lCols === 1 ? 0 : (-spanW / 2 + (c * spanW) / (lCols - 1));
            const lz = lRows === 1 ? 0 : (-spanD / 2 + (r * spanD) / (lRows - 1));
            luminaires.push({ x: lx, z: lz, w: 1.3, d: 0.58, style: "panel" });
          }
        }
      }
    }

    // คำนวณค่าความสว่างเฉพาะจุดของโคมไฟแต่ละดวงด้วย Inverse-Distance Weighting จากจุดวัดจริงใต้โคม
    luminaires.forEach(lum => {
      let weightSum = 0;
      let luxWeighted = 0;
      mappedPoints.forEach(pt => {
        const distSq = (lum.x - pt.x) ** 2 + (lum.z - pt.z) ** 2;
        const w = 1 / Math.pow(distSq + 0.85, 1.35);
        weightSum += w;
        luxWeighted += w * pt.lux;
      });
      lum.localLux = weightSum > 0 ? (luxWeighted / weightSum) : (Number(roomData.measuredLux) || 0);
    });

    return {
      patternType,
      patternLabel,
      isSnakePattern,
      nWidth,
      nLength,
      isFloorLevel,
      workplaneY,
      roomW,
      roomD,
      ceilingY,
      points: mappedPoints,
      luminaires
    };
  }

  // สร้าง Texture แผนที่ความร้อนของแสง (Lux Heatmap) บนพื้น/ระนาบทำงานจากค่าที่วัดได้จริง
  function createHeatmapTexture(THREE, layout, thresholds) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const { roomW, roomD, points } = layout;
    const { stdMin, minAllow } = thresholds;
    const lowRef = minAllow !== null ? minAllow : stdMin * 0.6;

    for (let py = 0; py < size; py++) {
      const z = ((py / (size - 1)) - 0.5) * roomD;
      for (let px = 0; px < size; px++) {
        const x = ((px / (size - 1)) - 0.5) * roomW;

        let wSum = 0;
        let luxSum = 0;
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const dx = x - p.x;
          const dz = z - p.z;
          const w = 1 / (dx * dx + dz * dz + 0.55);
          wSum += w;
          luxSum += w * p.lux;
        }
        const estLux = wSum > 0 ? luxSum / wSum : 0;

        let r = 16, g = 185, b = 129;
        if (estLux < lowRef) {
          const t = Math.max(0, Math.min(1, estLux / Math.max(lowRef, 1)));
          r = 239;
          g = Math.round(68 + t * 80);
          b = 68;
        } else if (estLux < stdMin) {
          const span = Math.max(stdMin - lowRef, 1);
          const t = Math.max(0, Math.min(1, (estLux - lowRef) / span));
          r = Math.round(245 - t * 180);
          g = Math.round(158 + t * 35);
          b = Math.round(11 + t * 95);
        } else {
          const extra = Math.min(1, (estLux - stdMin) / Math.max(stdMin, 150));
          r = Math.round(16 + extra * 50);
          g = Math.round(185 + extra * 45);
          b = Math.round(129 + extra * 75);
        }

        const idx = (py * size + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 155;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    const step = 32;
    for (let i = step; i < size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // สร้าง Radial Glow Texture สำหรับรัศมีแสงรอบหลอดไฟ
  function createGlowTexture(THREE) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255, 250, 220, 1)");
    grad.addColorStop(0.35, "rgba(254, 240, 138, 0.55)");
    grad.addColorStop(0.7, "rgba(253, 224, 71, 0.15)");
    grad.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // ปิด Modal และล้างหน่วยความจำ WebGL ทั้งหมด
  function closeRoom3DModal() {
    if (activeSession) {
      activeSession.cleanup();
      activeSession = null;
    }
    const modal = document.getElementById("lightRoom3DModal");
    if (modal) {
      modal.style.display = "none";
      document.body.style.overflow = "";
    }
  }

  function ensureModalElement() {
    let modal = document.getElementById("lightRoom3DModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "lightRoom3DModal";
    modal.className = "room3d-modal-backdrop";
    modal.style.display = "none";
    modal.innerHTML = `
      <div class="room3d-modal-card" role="dialog" aria-modal="true">
        <div class="room3d-header">
          <div class="room3d-title-wrap">
            <div class="room3d-title-row">
              <span class="room3d-badge-3d">3D TWIN</span>
              <h3 id="room3dTitle" class="room3d-title">จำลองห้องตรวจวัดแสง</h3>
              <span id="room3dStatusBadge" class="status-tag pass">ผ่านเกณฑ์</span>
            </div>
            <p id="room3dSubtitle" class="room3d-subtitle">-</p>
          </div>
          <button type="button" id="btnCloseRoom3D" class="room3d-close-btn" title="ปิดหน้าต่าง (Esc)">✕</button>
        </div>

        <div class="room3d-kpi-strip" id="room3dKpiStrip"></div>

        <div class="room3d-body">
          <div class="room3d-viewport-wrap" id="room3dViewportWrap">
            <div class="room3d-toolbar">
              <button type="button" class="room3d-tool-btn active" id="btnView3DPersp">🎥 มุมมอง 3D</button>
              <button type="button" class="room3d-tool-btn" id="btnViewTopPlan">🗺️ ผังด้านบน (2D)</button>
              <button type="button" class="room3d-tool-btn active" id="btnToggleHeatmap">🌡️ พื้น Heatmap</button>
              <button type="button" class="room3d-tool-btn active" id="btnToggleLabels">🏷️ ตัวเลขจุดวัด</button>
              <button type="button" class="room3d-tool-btn active" id="btnTogglePath" style="display:none;">👣 เส้นทางเดิน</button>
              <div class="room3d-stepper" id="snakeWidthStepper" style="display:none;" title="ปรับจำนวนจุดตรวจวัดต่อ 1 แถวแนวกว้าง (เดินสลับฟันปลา)">
                <span>แนวกว้าง:</span>
                <button type="button" class="room3d-step-btn" id="btnWidthMinus">−</button>
                <strong id="lblWidthCount" style="font-family:var(--font-mono); min-width:34px; text-align:center;">4 จุด</strong>
                <button type="button" class="room3d-step-btn" id="btnWidthPlus">+</button>
              </div>
              <button type="button" class="room3d-tool-btn" id="btnToggleBoost">🔦 เพิ่มแสงดูห้องมืด</button>
            </div>

            <div id="room3dLoadingOverlay" class="room3d-loading">
              ⏳ กำลังสร้างแบบจำลองห้อง 3 มิติ...
            </div>

            <div id="room3dCanvasMount" class="room3d-canvas-mount"></div>
            <div id="room3dLabelsLayer" class="room3d-labels-layer"></div>

            <div class="room3d-legend">
              <div class="room3d-legend-item"><span class="dot dot-bulb"></span> โคมไฟสว่างตามค่า Lux จริง</div>
              <div class="room3d-legend-item"><span class="dot dot-pass"></span> ผ่านเกณฑ์มาตรฐาน</div>
              <div class="room3d-legend-item"><span class="dot dot-warn"></span> ต่ำกว่าเฉลี่ย (ผ่านจุดต่ำสุด)</div>
              <div class="room3d-legend-item"><span class="dot dot-fail"></span> ต่ำกว่าเกณฑ์ขั้นต่ำ</div>
            </div>

            <div class="room3d-hint">🖱️ ลากหมุน 360° • เลื่อนซูม • คลิกจุดเพื่อดูรายละเอียด</div>
          </div>

          <aside class="room3d-side-panel">
            <div class="room3d-side-section">
              <div class="room3d-side-heading">📍 ค่าความเข้มแสงรายจุดในห้อง</div>
              <div id="room3dSelectedInfo" class="room3d-selected-box">
                คลิกที่หมุดในห้อง 3D หรือรายการด้านล่างเพื่อเน้นจุดตรวจวัด
              </div>
              <div id="room3dPointList" class="room3d-point-list"></div>
            </div>
            <div id="room3dNoteBox" class="room3d-note-box"></div>
          </aside>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", e => {
      if (e.target === modal) closeRoom3DModal();
    });
    document.getElementById("btnCloseRoom3D").addEventListener("click", closeRoom3DModal);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && modal.style.display !== "none") {
        closeRoom3DModal();
      }
    });

    return modal;
  }

  // เปิดหน้าต่างจำลองห้อง 3D จากข้อมูลห้องจริงในตาราง
  window.openLightRoom3D = async function (roomData, options) {
    if (!roomData) return;
    const opts = options || {};

    if (activeSession) {
      activeSession.cleanup();
      activeSession = null;
    }

    const modal = ensureModalElement();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    const loadingEl = document.getElementById("room3dLoadingOverlay");
    const canvasMount = document.getElementById("room3dCanvasMount");
    const labelsLayer = document.getElementById("room3dLabelsLayer");
    canvasMount.innerHTML = "";
    labelsLayer.innerHTML = "";
    loadingEl.style.display = "flex";
    loadingEl.textContent = "⏳ กำลังโหลดเอนจิน 3 มิติ (Three.js)...";

    const thresholds = parseThresholds(roomData.standardLux, roomData.minLux);
    const layout = buildRoomLayout(roomData, thresholds, opts.widthPoints);

    // อัปเดตหัวข้อและแถบสรุปค่าสถิติของห้อง
    document.getElementById("room3dTitle").textContent = `${roomData.building} — ห้อง ${roomData.room}`;
    const statusBadge = document.getElementById("room3dStatusBadge");
    statusBadge.className = `status-tag ${roomData.isPass ? "pass" : "fail"}`;
    statusBadge.textContent = roomData.isPass ? "ผ่านเกณฑ์" : "ต้องปรับปรุง";

    document.getElementById("room3dSubtitle").textContent =
      `${layout.patternLabel} • งาน: ${roomData.task || "-"} • วันที่วัด: ${roomData.date || "-"}`;

    const luxValues = layout.points.map(p => p.lux);
    const minPt = layout.points.reduce((acc, p) => (p.lux < acc.lux ? p : acc), layout.points[0]);
    const maxPt = layout.points.reduce((acc, p) => (p.lux > acc.lux ? p : acc), layout.points[0]);
    const passCount = layout.points.filter(p => p.status.tier === "pass").length;

    document.getElementById("room3dKpiStrip").innerHTML = `
      <div class="room3d-kpi-item">
        <span class="k-lbl">ค่าเฉลี่ยทั้งห้อง</span>
        <strong class="k-val ${roomData.isPass ? "text-success" : "text-danger"}">${roomData.measuredLux} Lux</strong>
      </div>
      <div class="room3d-kpi-item">
        <span class="k-lbl">เกณฑ์มาตรฐาน / ต่ำสุด</span>
        <strong class="k-val">${escapeHtml(roomData.standardLux)} / ${escapeHtml(roomData.minLux || "-")} Lux</strong>
      </div>
      <div class="room3d-kpi-item">
        <span class="k-lbl">จุดสว่างต่ำสุด – สูงสุด</span>
        <strong class="k-val">${minPt.lux} (${escapeHtml(minPt.code)}) – ${maxPt.lux} (${escapeHtml(maxPt.code)}) Lux</strong>
      </div>
      <div class="room3d-kpi-item">
        <span class="k-lbl">จุดตรวจวัดทั้งหมด</span>
        <strong class="k-val">${luxValues.length} จุด (ถึงเกณฑ์เฉลี่ย ${passCount} จุด)</strong>
      </div>
    `;

    // แสดงข้อเสนอแนะและคำอธิบายผังจำลองด้านขวา
    const recText = (roomData.recommendation && roomData.recommendation !== "-")
      ? `<div class="room3d-rec"><strong>📝 ข้อเสนอแนะ:</strong> ${escapeHtml(roomData.recommendation)}</div>`
      : "";
    const snakeExplain = (layout.isSnakePattern && layout.points.length >= 2)
      ? `<br>• <strong>ลำดับการเดินวัด:</strong> เริ่มจาก <code>${escapeHtml(layout.points[0].code)}</code> เดินตามแนวกว้าง (${layout.nWidth} จุด/แถว) แล้วเขยิบไล่ไปตามแนวยาว (${layout.nLength} แถว) แบบสลับฟันปลาต่อเนื่อง`
      : "";

    document.getElementById("room3dNoteBox").innerHTML = `
      ${recText}
      <div class="room3d-disclaimer">
        💡 <strong>หลักการจำลอง:</strong> จัดวางโคมไฟเพดาน (${layout.luminaires.length} ชุด) และพิกัดจุดวัดตามมาตรฐาน
        <em>${escapeHtml(layout.patternLabel)}</em> ความสว่างของหลอดไฟและพื้น Heatmap คำนวณจากค่า Lux จริง (ระนาบวัดสูง ${layout.workplaneY} ม.)${snakeExplain}
      </div>
    `;

    let THREE;
    try {
      THREE = await ensureThreeLoaded();
    } catch (err) {
      console.error(err);
      loadingEl.textContent = "⚠️ ไม่สามารถโหลด Three.js ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง";
      return;
    }

    if (modal.style.display === "none") return;
    loadingEl.style.display = "none";

    // =========================================================
    // เริ่มสร้างฉาก Three.js
    // =========================================================
    const disposables = [];
    const trackGeo = g => { disposables.push(g); return g; };
    const trackMat = m => { disposables.push(m); return m; };
    const trackTex = t => { disposables.push(t); return t; };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const width = canvasMount.clientWidth || 720;
    const height = canvasMount.clientHeight || 460;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 220);
    const maxDim = Math.max(layout.roomW, layout.roomD);
    const defaultCamPos = new THREE.Vector3(maxDim * 0.78, layout.ceilingY * 1.98, maxDim * 1.02);

    function getTopViewCamY() {
      const vFovRad = (camera.fov * Math.PI) / 180;
      const halfTan = Math.tan(vFovRad / 2);
      const fitZ = (layout.roomD * 1.48) / (2 * halfTan);
      const fitX = (layout.roomW * 1.28) / (2 * halfTan * (camera.aspect || 1.5));
      return Math.max(fitZ, fitX, maxDim * 1.35);
    }

    if (opts.viewMode === "top") {
      camera.position.set(0, getTopViewCamY(), 0.01);
    } else {
      camera.position.copy(defaultCamPos);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    canvasMount.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, opts.viewMode === "top" ? layout.workplaneY : layout.workplaneY * 0.8, 0);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 2.5;
    controls.maxDistance = maxDim * 3.2;
    controls.update();

    const avgLux = Number(roomData.measuredLux) || 0;
    const roomBrightnessRatio = Math.max(0.16, Math.min(1.25, avgLux / Math.max(thresholds.stdMin, 150)));
    let boostLightMode = false;

    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.24 + roomBrightnessRatio * 0.34);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.18 + roomBrightnessRatio * 0.22);
    scene.add(hemiLight);

    const { roomW, roomD, ceilingY, workplaneY } = layout;

    // 1. พื้นห้องหลัก
    const floorMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.82,
      metalness: 0.08
    }));
    const floorMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(roomW, roomD)), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    scene.add(floorMesh);

    // 2. ผนังห้องแบบ FrontSide หันเข้าด้านใน (หมุนกล้องมุมไหน ผนังฝั่งบังสายตาจะโปร่งอัตโนมัติ)
    const wallMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.92,
      metalness: 0.05,
      side: THREE.FrontSide
    }));

    const backWall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(roomW, ceilingY)), wallMat);
    backWall.position.set(0, ceilingY / 2, -roomD / 2);
    scene.add(backWall);

    const frontWall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(roomW, ceilingY)), wallMat);
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, ceilingY / 2, roomD / 2);
    scene.add(frontWall);

    const leftWall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(roomD, ceilingY)), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-roomW / 2, ceilingY / 2, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(roomD, ceilingY)), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(roomW / 2, ceilingY / 2, 0);
    scene.add(rightWall);

    // เส้นโครงขอบห้อง 3 มิติ
    const roomBoxGeo = trackGeo(new THREE.BoxGeometry(roomW, ceilingY, roomD));
    const roomEdges = new THREE.LineSegments(
      trackGeo(new THREE.EdgesGeometry(roomBoxGeo)),
      trackMat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 }))
    );
    roomEdges.position.y = ceilingY / 2;
    scene.add(roomEdges);

    if (layout.patternType === "3") {
      const exitSign = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.08, 0.36, 0.9)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x10b981 }))
      );
      exitSign.position.set(roomW / 2 - 0.06, ceilingY - 0.45, 0);
      scene.add(exitSign);
    }

    // 3. แผ่น Lux Heatmap บนระนาบตรวจวัด + เส้นขอบระนาบทำงาน
    const heatmapTex = trackTex(createHeatmapTexture(THREE, layout, thresholds));
    const heatmapMat = trackMat(new THREE.MeshBasicMaterial({
      map: heatmapTex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    }));
    const heatmapPlane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(roomW - 0.12, roomD - 0.12)),
      heatmapMat
    );
    heatmapPlane.rotation.x = -Math.PI / 2;
    heatmapPlane.position.y = workplaneY;
    scene.add(heatmapPlane);

    if (!layout.isFloorLevel) {
      const wpBorder = new THREE.LineSegments(
        trackGeo(new THREE.EdgesGeometry(trackGeo(new THREE.PlaneGeometry(roomW - 0.12, roomD - 0.12)))),
        trackMat(new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 }))
      );
      wpBorder.rotation.x = -Math.PI / 2;
      wpBorder.position.y = workplaneY + 0.005;
      scene.add(wpBorder);
    }

    // 3.5 เส้นทางเดินตรวจวัดแบบสลับฟันปลา (Snake Walk Path + ลูกศรบอกทิศทาง r-1 -> r-2 -> ... -> r-n)
    const snakePathGroup = new THREE.Group();
    const showSnakeFeature = layout.isSnakePattern && layout.points.length >= 2;
    if (showSnakeFeature) {
      const pathVertices = layout.points.map(p => new THREE.Vector3(p.x, workplaneY + 0.032, p.z));
      const pathLineGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(pathVertices));
      const pathLineMat = trackMat(new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.88
      }));
      snakePathGroup.add(new THREE.Line(pathLineGeo, pathLineMat));

      // หัวลูกศรชี้ทิศทางการเดินกึ่งกลางระหว่างจุดต่อจุด
      const arrowGeo = trackGeo(new THREE.ConeGeometry(0.085, 0.24, 12));
      const arrowMat = trackMat(new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.92
      }));
      const upAxis = new THREE.Vector3(0, 1, 0);
      const segDir = new THREE.Vector3();

      for (let i = 0; i < pathVertices.length - 1; i++) {
        const a = pathVertices[i];
        const b = pathVertices[i + 1];
        segDir.subVectors(b, a);
        const len = segDir.length();
        if (len > 0.25) {
          segDir.normalize();
          const cone = new THREE.Mesh(arrowGeo, arrowMat);
          cone.position.lerpVectors(a, b, 0.52);
          cone.quaternion.setFromUnitVectors(upAxis, segDir);
          snakePathGroup.add(cone);
        }
      }

      // วงแหวนพิเศษสีฟ้าสว่างรอบจุดเริ่มต้น r-1
      const startPt = layout.points[0];
      const startHalo = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(0.30, 0.38, 28)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }))
      );
      startHalo.rotation.x = -Math.PI / 2;
      startHalo.position.set(startPt.x, startPt.y + 0.016, startPt.z);
      snakePathGroup.add(startHalo);

      scene.add(snakePathGroup);
    }

    // 4. สร้างชุดโคมไฟเพดาน พร้อมความสว่างและสีตามค่า Lux ที่ตรวจวัดได้จริง
    const glowTex = trackTex(createGlowTexture(THREE));
    const housingMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.55
    }));

    const maxRealLights = 8;
    const lightStride = Math.max(1, Math.ceil(layout.luminaires.length / maxRealLights));
    const scenePointLights = [];

    layout.luminaires.forEach((lum, idx) => {
      const ratio = Math.max(0.06, Math.min(1.45, lum.localLux / Math.max(thresholds.stdMin, 120)));

      const bulbColor = new THREE.Color();
      if (ratio >= 0.9) {
        bulbColor.setHex(0xfffef0);
      } else if (ratio >= 0.55) {
        bulbColor.setHex(0xfef08a);
      } else {
        bulbColor.setHex(0xd97706).lerp(new THREE.Color(0x475569), Math.max(0, 0.55 - ratio));
      }

      const group = new THREE.Group();
      group.position.set(lum.x, ceilingY - 0.04, lum.z);

      const housingGeo = lum.style === "dome"
        ? trackGeo(new THREE.CylinderGeometry(lum.w * 0.52, lum.w * 0.54, 0.045, 24))
        : trackGeo(new THREE.BoxGeometry(lum.w, 0.045, lum.d));
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.y = 0;
      group.add(housing);

      const bulbMat = trackMat(new THREE.MeshBasicMaterial({
        color: bulbColor.clone().multiplyScalar(Math.min(1, 0.28 + ratio * 0.72))
      }));
      const diffuserGeo = lum.style === "dome"
        ? trackGeo(new THREE.CylinderGeometry(lum.w * 0.44, lum.w * 0.44, 0.075, 24))
        : trackGeo(new THREE.BoxGeometry(lum.w * 0.88, 0.075, lum.d * 0.76));
      const diffuser = new THREE.Mesh(diffuserGeo, bulbMat);
      diffuser.position.y = -0.005;
      group.add(diffuser);

      const spriteMat = trackMat(new THREE.SpriteMaterial({
        map: glowTex,
        color: bulbColor,
        transparent: true,
        opacity: Math.max(0.14, Math.min(0.92, ratio * 0.72)),
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      const glowSprite = new THREE.Sprite(spriteMat);
      const glowScale = Math.max(lum.w, lum.d) * (0.95 + ratio * 0.85);
      glowSprite.scale.set(glowScale, glowScale * 0.65, 1);
      glowSprite.position.y = -0.10;
      group.add(glowSprite);

      const coneHeight = ceilingY - workplaneY - 0.1;
      const coneMat = trackMat(new THREE.MeshBasicMaterial({
        color: bulbColor,
        transparent: true,
        opacity: Math.max(0.015, Math.min(0.085, ratio * 0.055)),
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      const coneRadius = Math.max(0.9, Math.max(lum.w, lum.d) * 0.85);
      const lightCone = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(coneRadius, coneHeight, 20, 1, true)),
        coneMat
      );
      lightCone.position.y = -coneHeight / 2 - 0.04;
      group.add(lightCone);

      scene.add(group);

      if (idx % lightStride === 0 && scenePointLights.length < maxRealLights) {
        const baseIntensity = (0.25 + ratio * 0.85) * Math.min(1.6, lightStride * 0.8);
        const ptLight = new THREE.PointLight(bulbColor, baseIntensity, maxDim * 1.6, 1.8);
        ptLight.position.set(lum.x, ceilingY - 0.22, lum.z);
        ptLight.userData.baseIntensity = baseIntensity;
        scene.add(ptLight);
        scenePointLights.push(ptLight);
      }
    });

    // 5. สร้างหมุดจุดตรวจวัด 3D + เสาตั้งจากพื้น + ป้ายตัวเลข HTML คมชัดสูง
    const markerMeshes = [];
    const labelEntries = [];
    const axisLabelEntries = [];
    const compactLabels = layout.points.length > 16;

    const ringGeo = trackGeo(new THREE.RingGeometry(0.19, 0.28, 24));
    const sphereGeo = trackGeo(new THREE.SphereGeometry(compactLabels ? 0.12 : 0.15, 20, 20));

    const selectRing = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.32, 0.44, 32)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }))
    );
    selectRing.rotation.x = -Math.PI / 2;
    selectRing.visible = false;
    scene.add(selectRing);

    const pointListEl = document.getElementById("room3dPointList");
    const selectedInfoEl = document.getElementById("room3dSelectedInfo");
    pointListEl.innerHTML = "";
    selectedInfoEl.textContent = "คลิกที่หมุดในห้อง 3D หรือรายการด้านล่างเพื่อเน้นจุดตรวจวัด";

    function selectPoint(ptIndex) {
      const pt = layout.points[ptIndex];
      if (!pt) return;

      selectRing.position.set(pt.x, pt.y + 0.02, pt.z);
      selectRing.visible = true;

      labelEntries.forEach((entry, idx) => {
        entry.el.classList.toggle("selected", idx === ptIndex);
      });
      Array.from(pointListEl.children).forEach((rowEl, idx) => {
        rowEl.classList.toggle("selected", idx === ptIndex);
      });

      selectedInfoEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong>จุด ${escapeHtml(pt.code)}</strong>
          <span style="font-family:var(--font-mono); font-size:15px; font-weight:800; color:${pt.status.colorHex};">${pt.lux} Lux</span>
        </div>
        <div style="font-size:11.5px; color:#475569; margin-top:3px;">${escapeHtml(pt.status.label)}</div>
      `;
    }

    layout.points.forEach((pt, idx) => {
      if (pt.y > 0.12) {
        const stem = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.025, 0.025, pt.y, 8)),
          trackMat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }))
        );
        stem.position.set(pt.x, pt.y / 2, pt.z);
        scene.add(stem);
      }

      const ring = new THREE.Mesh(
        ringGeo,
        trackMat(new THREE.MeshBasicMaterial({ color: pt.status.threeColor, side: THREE.DoubleSide }))
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pt.x, pt.y + 0.012, pt.z);
      scene.add(ring);

      const markerMat = trackMat(new THREE.MeshStandardMaterial({
        color: pt.status.threeColor,
        emissive: pt.status.threeColor,
        emissiveIntensity: 0.45,
        roughness: 0.25
      }));
      const marker = new THREE.Mesh(sphereGeo, markerMat);
      marker.position.set(pt.x, pt.y + 0.14, pt.z);
      marker.userData.ptIndex = idx;
      scene.add(marker);
      markerMeshes.push(marker);

      const startPrefix = (showSnakeFeature && idx === 0) ? "🚩 " : "";
      const badge = document.createElement("div");
      badge.className = `room3d-pt-label tier-${pt.status.tier}${compactLabels ? " compact" : ""}`;
      badge.innerHTML = `<span class="pt-code">${startPrefix}${escapeHtml(pt.code)}</span><span class="pt-val">${pt.lux}</span>`;
      badge.addEventListener("click", e => {
        e.stopPropagation();
        selectPoint(idx);
      });
      labelsLayer.appendChild(badge);
      labelEntries.push({
        el: badge,
        worldPos: new THREE.Vector3(pt.x, pt.y + (compactLabels ? 0.30 : 0.36), pt.z)
      });

      const itemEl = document.createElement("button");
      itemEl.type = "button";
      itemEl.className = `room3d-point-row tier-${pt.status.tier}`;
      itemEl.innerHTML = `
        <span class="p-left"><span class="p-dot" style="background:${pt.status.colorHex};"></span> <strong>${startPrefix}${escapeHtml(pt.code)}</strong></span>
        <span class="p-lux" style="color:${pt.status.colorHex};">${pt.lux} Lux</span>
      `;
      itemEl.addEventListener("click", () => selectPoint(idx));
      pointListEl.appendChild(itemEl);
    });

    // ป้ายกำกับแกน แนวกว้าง (Width) และ แนวยาว (Length) สำหรับรูปแบบที่ 1
    if (showSnakeFeature) {
      const widthAxisTag = document.createElement("div");
      widthAxisTag.className = "room3d-axis-tag";
      widthAxisTag.textContent = `↕ แนวกว้าง (${layout.nWidth} จุด)`;
      labelsLayer.appendChild(widthAxisTag);
      axisLabelEntries.push({
        el: widthAxisTag,
        worldPos: new THREE.Vector3(-roomW / 2 - 0.35, workplaneY + 0.05, 0)
      });

      const lengthAxisTag = document.createElement("div");
      lengthAxisTag.className = "room3d-axis-tag";
      lengthAxisTag.textContent = `↔ แนวยาว (${layout.nLength} แถว)`;
      labelsLayer.appendChild(lengthAxisTag);
      axisLabelEntries.push({
        el: lengthAxisTag,
        worldPos: new THREE.Vector3(0, workplaneY + 0.05, roomD / 2 + 0.42)
      });
    }

    if (minPt) {
      selectPoint(minPt.index);
    }

    // Raycaster สำหรับคลิกเลือกหมุดในฉาก 3D
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = e => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = e => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(markerMeshes, false);
      if (hits.length > 0 && hits[0].object.userData.ptIndex !== undefined) {
        selectPoint(hits[0].object.userData.ptIndex);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // =========================================================
    // ปุ่มควบคุมมุมมองและการแสดงผลบนแถบเครื่องมือ
    // =========================================================
    const btnPersp = document.getElementById("btnView3DPersp");
    const btnTop = document.getElementById("btnViewTopPlan");
    const btnHeat = document.getElementById("btnToggleHeatmap");
    const btnLabels = document.getElementById("btnToggleLabels");
    const btnPath = document.getElementById("btnTogglePath");
    const widthStepper = document.getElementById("snakeWidthStepper");
    const lblWidthCount = document.getElementById("lblWidthCount");
    const btnWidthMinus = document.getElementById("btnWidthMinus");
    const btnWidthPlus = document.getElementById("btnWidthPlus");
    const btnBoost = document.getElementById("btnToggleBoost");

    let currentViewMode = opts.viewMode === "top" ? "top" : "persp";
    btnPersp.classList.toggle("active", currentViewMode === "persp");
    btnTop.classList.toggle("active", currentViewMode === "top");
    btnHeat.classList.add("active");
    btnLabels.classList.add("active");
    btnBoost.classList.remove("active");

    if (showSnakeFeature) {
      btnPath.style.display = "inline-block";
      btnPath.classList.add("active");
      snakePathGroup.visible = true;
      btnPath.onclick = () => {
        snakePathGroup.visible = !snakePathGroup.visible;
        btnPath.classList.toggle("active", snakePathGroup.visible);
        axisLabelEntries.forEach(a => {
          a.el.style.visibility = snakePathGroup.visible ? "visible" : "hidden";
        });
      };
    } else {
      btnPath.style.display = "none";
    }

    if (layout.isSnakePattern && layout.points.length >= 3) {
      widthStepper.style.display = "inline-flex";
      lblWidthCount.textContent = `${layout.nWidth} จุด`;
      btnWidthMinus.onclick = () => {
        if (layout.nWidth > 1) {
          window.openLightRoom3D(roomData, {
            widthPoints: layout.nWidth - 1,
            viewMode: currentViewMode
          });
        }
      };
      btnWidthPlus.onclick = () => {
        if (layout.nWidth < layout.points.length) {
          window.openLightRoom3D(roomData, {
            widthPoints: layout.nWidth + 1,
            viewMode: currentViewMode
          });
        }
      };
    } else {
      widthStepper.style.display = "none";
    }

    btnPersp.onclick = () => {
      currentViewMode = "persp";
      camera.position.copy(defaultCamPos);
      controls.target.set(0, workplaneY * 0.8, 0);
      controls.update();
      btnPersp.classList.add("active");
      btnTop.classList.remove("active");
    };

    btnTop.onclick = () => {
      currentViewMode = "top";
      camera.position.set(0, getTopViewCamY(), 0.01);
      controls.target.set(0, workplaneY, 0);
      controls.update();
      btnTop.classList.add("active");
      btnPersp.classList.remove("active");
    };

    btnHeat.onclick = () => {
      heatmapPlane.visible = !heatmapPlane.visible;
      btnHeat.classList.toggle("active", heatmapPlane.visible);
    };

    let labelsVisible = true;
    btnLabels.onclick = () => {
      labelsVisible = !labelsVisible;
      labelsLayer.style.display = labelsVisible ? "block" : "none";
      btnLabels.classList.toggle("active", labelsVisible);
    };
    labelsLayer.style.display = "block";

    btnBoost.onclick = () => {
      boostLightMode = !boostLightMode;
      btnBoost.classList.toggle("active", boostLightMode);
      ambientLight.intensity = boostLightMode ? 0.95 : (0.24 + roomBrightnessRatio * 0.34);
      scenePointLights.forEach(l => {
        l.intensity = boostLightMode ? Math.max(l.userData.baseIntensity, 1.1) : l.userData.baseIntensity;
      });
    };

    const onResize = () => {
      if (!canvasMount) return;
      const w = canvasMount.clientWidth || 640;
      const h = canvasMount.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Animation Loop + คำนวณพิกัดป้ายตัวเลข 3D -> 2D
    const projVec = new THREE.Vector3();
    let animFrameId = null;
    let isDisposed = false;

    function projectOverlayItem(item, cw, ch, yAnchor) {
      projVec.copy(item.worldPos).project(camera);
      if (projVec.z > 1) {
        item.el.style.display = "none";
      } else {
        const x = (projVec.x * 0.5 + 0.5) * cw;
        const y = (-projVec.y * 0.5 + 0.5) * ch;
        item.el.style.display = "inline-flex";
        item.el.style.transform = `translate(-50%, ${yAnchor}) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }

    function animate() {
      if (isDisposed) return;
      animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      if (labelsVisible) {
        const cw = canvasMount.clientWidth;
        const ch = canvasMount.clientHeight;
        for (let i = 0; i < labelEntries.length; i++) {
          projectOverlayItem(labelEntries[i], cw, ch, "-100%");
        }
        for (let j = 0; j < axisLabelEntries.length; j++) {
          projectOverlayItem(axisLabelEntries[j], cw, ch, "-50%");
        }
      }
    }
    animate();

    activeSession = {
      cleanup() {
        isDisposed = true;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        controls.dispose();
        disposables.forEach(obj => {
          if (obj && typeof obj.dispose === "function") obj.dispose();
        });
        renderer.dispose();
        canvasMount.innerHTML = "";
        labelsLayer.innerHTML = "";
      }
    };
  };
})();
