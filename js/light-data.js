// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbyn5cMl8TJFzSEbJt89uyhnoJN7mwwLJ9ehM4RIbSx4zCpiCUjCq3rLtAREjv6puv89xA/exec";
  const LIGHT_SHEET_ID = "1DGrpsmCsGjHvY9elJu9GV6PPeuw5M80GkG2QG2MB3ZA";
  const GID_DATABASE_AREA = "1272062601";
  const GID_DATABASE_SPOT = "1402451252";

  window.checkLightAccess = function () {
    return true;
  };

  let areaRecords = [];
  let spotRecords = [];
  let serverBuildingStats = {};
  let buildingChartInstance = null;
  let isExporting = false;
  let isFetching = false;
  let hasLoadedOnce = false;
  let lastFetchTime = 0;
  let currentRenderedRooms = [];
  let currentAllRoomMap = {};

  // ข้อมูลผังห้องจากแบบแปลนจริง (D:\ART\REALTIME_SERVICE\Plan\A1-02 ถึง A1-09)
  // นับเฉพาะห้องและพื้นที่ภายในอาคาร (ไม่รวมหลังคา ค.ส.ล., ถนน, ลานจอดรถ, ทางเท้า, ถังน้ำ, SUB FLOOR)
  const BUILDING_FLOOR_PLANS = {
    "อาคารสิริวิทยา": {
      planRef: "ผัง A1-02 ถึง A1-09 (ชั้นใต้ดิน – ดาดฟ้า)",
      floors: [
        {
          floor: "ชั้นใต้ดิน (A1-02)",
          rooms: [
            ["B01", "ห้องเก็บของ"], ["B02", "ห้องเครื่องไฟฟ้า"], ["B03", "โถงบันได ST-1"], ["B04", "โถงลิฟต์"],
            ["B05", "ห้อง รปภ"], ["B06", "ห้องพนักงานขับรถ"], ["B07", "ห้องเก็บของ"], ["B08", "ห้องน้ำหญิง"],
            ["B09", "ห้อง JANITOR"], ["B10", "ห้องน้ำชาย"], ["B11", "ทางเดิน"], ["B12", "ทางเดิน"],
            ["B13", "ทางเดิน"], ["B15", "โถงบันได ST-2"], ["B18", "ห้องเครื่องปั๊ม"]
          ]
        },
        {
          floor: "ชั้น 1 (A1-03)",
          rooms: [
            ["101", "โถงลิฟต์"], ["102", "ห้องไฟฟ้า"], ["103", "ห้องสื่อสาร"], ["104", "โถงบันได ST-1"],
            ["105", "โถงลิฟต์"], ["106", "ห้องพยาบาล"], ["107", "ห้องน้ำคนพิการ"], ["108", "ห้องน้ำหญิง"],
            ["109", "ห้องน้ำชาย"], ["110", "ห้อง JANITOR"], ["111", "ทางเดิน"], ["112", "ห้องละหมาด"],
            ["114", "โถงบันได ST-2"], ["115", "หน่วยบริการการศึกษา"], ["116", "ห้องพักนักศึกษาบัณฑิตฯ"], ["117", "สนง.สโมสรนักศึกษา"],
            ["118", "ห้องบริการ COM 32 ที่นั่ง"], ["119", "ทางเดิน"], ["120", "ทางเดิน"], ["121", "ทางเดิน"],
            ["127", "ห้อง COM 60 ที่นั่ง"], ["128", "ห้องเรียน 120 ที่นั่ง"], ["129", "ห้องเรียน 120 ที่นั่ง"], ["130", "ห้องเรียน 60 ที่นั่ง"],
            ["131", "ห้องเรียน 120 ที่นั่ง"], ["132", "ห้องเรียน 120 ที่นั่ง"], ["133", "ห้องเรียน 120 ที่นั่ง"], ["134", "ห้องเรียน 60 ที่นั่ง"],
            ["135", "โถงบันได ST-3"], ["136", "ทางเดิน"], ["137", "ทางเดิน"], ["138", "ทางเดิน"],
            ["140", "ห้องขยะเปียก"], ["141", "ห้องขยะแห้ง"], ["144", "ทางเดิน"], ["145", "ทางเดิน"],
            ["146", "ทางเดิน"], ["148", "ห้อง COM 56 ที่นั่ง"]
          ]
        },
        {
          floor: "ชั้น 2 (A1-04)",
          rooms: [
            ["201", "โถงลิฟต์"], ["202", "ห้องไฟฟ้า"], ["203", "ห้องสื่อสาร"], ["204", "โถงบันได ST-1"],
            ["205", "โถงลิฟต์"], ["206", "ห้องน้ำชาย"], ["207", "ห้องน้ำหญิง"], ["208", "ห้องเตรียมอาหาร"],
            ["209", "ห้องแม่บ้าน"], ["210", "ห้องน้ำหญิง"], ["211", "ห้องน้ำชาย"], ["212", "ห้องน้ำคนพิการ"],
            ["213", "ห้อง JANITOR"], ["215", "ทางเดิน"], ["216", "ทางเดิน"], ["217", "ห้องเรียน 386 ที่นั่ง"],
            ["218", "ห้องเรียน 386 ที่นั่ง"], ["219", "ห้องเรียน 386 ที่นั่ง"], ["220", "โถง PRE FUNCTION"], ["221", "โถงบันได ST-3"],
            ["222", "ทางเดิน"], ["223", "ห้องสมุด 106 ที่นั่ง"], ["224", "ห้อง SERVER"], ["225", "โถงบันได ST-2"],
            ["227", "ห้องเครื่องไฟฟ้าหลัก"], ["228", "ห้องเครื่องกำเนิดไฟฟ้าฉุกเฉิน"], ["229", "ห้องควบคุม"], ["230", "ห้อง SECURITY"]
          ]
        },
        {
          floor: "ชั้น 3 (A1-05)",
          rooms: [
            ["301", "โถงลิฟต์"], ["302", "ห้องไฟฟ้า"], ["303", "ห้องสื่อสาร"], ["304", "โถงบันได ST-1"],
            ["305", "โถงลิฟต์"], ["306", "ห้องน้ำชาย"], ["307", "ห้องน้ำหญิง"], ["308", "ห้องเตรียมอาหาร"],
            ["309", "ห้องแม่บ้าน"], ["310", "ห้องน้ำหญิง"], ["311", "ห้องน้ำชาย"], ["312", "ห้องน้ำคนพิการ"],
            ["313", "ห้อง JANITOR"], ["314", "ห้อง COM & SERVER"], ["315", "ห้องเรียน 60 ที่นั่ง"], ["316", "ทางเดิน"],
            ["317", "ห้องเครื่อง AHU."], ["318", "ระเบียง"], ["319", "ทางเดิน"], ["320", "ห้อง COM 60 ที่นั่ง"],
            ["321", "ห้อง COM 60 ที่นั่ง"], ["322", "โถงบันได ST-2"], ["324", "ห้องเรียน 60 ที่นั่ง"], ["325", "ห้องสังเกตการณ์"],
            ["326", "ห้องเรียน 60 ที่นั่ง"], ["327", "ห้องเรียน 60 ที่นั่ง"], ["328", "ห้องเรียน 60 ที่นั่ง"], ["329", "ห้องเรียน 60 ที่นั่ง"],
            ["330", "ห้องเรียน 60 ที่นั่ง"], ["334", "ห้องควบคุม"], ["335", "ห้องควบคุม"], ["336", "ห้องควบคุม"]
          ]
        },
        {
          floor: "ชั้น 4 (A1-06)",
          rooms: [
            ["401", "โถงลิฟต์"], ["402", "ห้องไฟฟ้า"], ["403", "ห้องสื่อสาร"], ["404", "โถงบันได ST-1"],
            ["405", "โถงลิฟต์"], ["406", "ห้องน้ำชาย"], ["407", "ห้องน้ำหญิง"], ["408", "ห้องเตรียมอาหาร"],
            ["409", "ห้องแม่บ้าน"], ["410", "ห้องน้ำหญิง"], ["411", "ห้องน้ำชาย"], ["412", "ห้องน้ำคนพิการ"],
            ["413", "ห้อง JANITOR"], ["414", "ทางเดิน"], ["415", "ทางเดิน"], ["416", "ห้อง COM 60 ที่นั่ง"],
            ["417", "ห้อง COM 60 ที่นั่ง"], ["418", "โถงบันได ST-2"], ["419", "ห้องเรียน 60 ที่นั่ง"], ["420", "ห้องสังเกตการณ์"],
            ["421", "ห้องเรียน 60 ที่นั่ง"], ["422", "ห้องเรียน 60 ที่นั่ง"], ["423", "ห้องเรียน 60 ที่นั่ง"], ["424", "ห้องเรียน 60 ที่นั่ง"]
          ]
        },
        {
          floor: "ชั้น 5 (A1-07)",
          rooms: [
            ["501", "โถงลิฟต์"], ["502", "ห้องไฟฟ้า"], ["503", "ห้องสื่อสาร"], ["504", "โถงบันได ST-1"],
            ["505", "โถงลิฟต์"], ["506", "ห้องน้ำชาย"], ["508", "ห้องเตรียมอาหาร"], ["509", "ห้องแม่บ้าน"],
            ["510", "ห้องน้ำหญิง"], ["512", "ห้องน้ำคนพิการ"], ["513", "ห้อง JANITOR"], ["514", "ทางเดิน"],
            ["515", "ทางเดิน"], ["516", "ศูนย์ศึกษาวรรณคดี"], ["517", "ห้องสำนักงานศูนย์การแปล"], ["518", "ห้องงานโสตทัศนศึกษา"],
            ["519", "ห้องผลิตเอกสาร"], ["520", "ห้องคลังข้อสอบ"], ["521", "โถงบันได ST-2"], ["522", "LOUNGE"],
            ["523", "ห้องพักอาจารย์ 27 ที่นั่ง"], ["524", "ห้องพักอาจารย์ 27 ที่นั่ง"]
          ]
        },
        {
          floor: "ชั้น 6 (A1-08)",
          rooms: [
            ["601", "โถงลิฟต์"], ["602", "ห้องไฟฟ้า"], ["603", "ห้องสื่อสาร"], ["604", "โถงบันได ST-1"],
            ["605", "โถงลิฟต์"], ["606", "ห้องน้ำชาย"], ["608", "ห้องเตรียมอาหาร"], ["609", "ห้องแม่บ้าน"],
            ["610", "ห้องน้ำหญิง"], ["612", "ห้องน้ำคนพิการ"], ["613", "ห้อง JANITOR"], ["614", "ทางเดิน"],
            ["615", "ทางเดิน"], ["616", "ห้องพักอาจารย์ 45 ที่นั่ง"], ["617", "ห้องรับประทานอาหาร"], ["618", "ห้องเตรียมอาหาร"],
            ["619", "โถงบันได ST-2"], ["620", "ห้องหลักสูตรธุระการ"]
          ]
        },
        {
          floor: "ชั้น 7 (A1-08)",
          rooms: [
            ["701", "โถงลิฟต์"], ["702", "ห้องไฟฟ้า"], ["703", "ห้องสื่อสาร"], ["704", "โถงบันได ST-1"],
            ["705", "โถงลิฟต์"], ["706", "ห้องน้ำชาย"], ["708", "ห้องเตรียมอาหาร"], ["709", "ห้องแม่บ้าน"],
            ["710", "ห้องน้ำหญิง"], ["712", "ห้องน้ำคนพิการ"], ["713", "ห้อง JANITOR"], ["714", "ทางเดิน"],
            ["715", "ทางเดิน"], ["716", "สำนักงานคณบดี"], ["717", "ห้องเก็บเอกสาร"], ["718", "ห้องรับประทานอาหาร"],
            ["719", "ห้องเตรียมอาหาร"], ["720", "โถงบันได ST-2"], ["721", "ทางเดิน"], ["722", "ห้องคณบดี"],
            ["723", "ห้องน้ำ"], ["724", "ห้องรองคณบดี"], ["725", "ห้องรองคณบดี"], ["726", "ห้องรองคณบดี"],
            ["727", "ห้องรองคณบดี"], ["728", "ห้องประชุม 16 ที่นั่ง"], ["729", "ห้องประชุม 40 ที่นั่ง"]
          ]
        },
        {
          floor: "ชั้นดาดฟ้า (A1-09)",
          rooms: [
            ["802", "โถงบันได ST-1"], ["803", "โถงลิฟต์"], ["804", "ห้องเครื่องปรับอากาศ"],
            ["805", "ห้องเครื่องลิฟต์"], ["806", "ทางเดิน"], ["809", "โถงบันได ST-2"]
          ]
        }
      ]
    }
  };

  const DEFAULT_BUILDING_TOTAL_ROOMS = {
    "อาคารสิริวิทยา": 210
  };
  const TOTAL_ROOMS_STORAGE_KEY = "oppe_building_total_rooms_v1";

  function getCustomBuildingTotals() {
    try {
      const raw = localStorage.getItem(TOTAL_ROOMS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getBuildingTotalRooms(bldName) {
    const custom = getCustomBuildingTotals();
    if (custom[bldName] !== undefined && custom[bldName] !== null && Number(custom[bldName]) > 0) {
      return Number(custom[bldName]);
    }
    if (DEFAULT_BUILDING_TOTAL_ROOMS[bldName]) {
      return DEFAULT_BUILDING_TOTAL_ROOMS[bldName];
    }
    return null;
  }

  function promptEditBuildingTotalRooms(bldName, currentMeasured) {
    if (!bldName) return;
    const currentTotal = getBuildingTotalRooms(bldName);
    const defaultVal = currentTotal !== null ? String(currentTotal) : String(currentMeasured || "");
    const input = prompt(
      `ระบุจำนวนห้องทั้งหมดของ "${bldName}" (ห้อง):\n(ตรวจวัดแล้วปัจจุบัน ${currentMeasured || 0} ห้อง • เว้นว่างหากต้องการคืนค่าเริ่มต้น)`,
      defaultVal
    );
    if (input === null) return;

    const custom = getCustomBuildingTotals();
    const trimmed = input.trim();
    if (trimmed === "") {
      delete custom[bldName];
    } else {
      const num = parseInt(trimmed, 10);
      if (isNaN(num) || num <= 0) {
        alert("⚠️ กรุณาระบุจำนวนห้องเป็นตัวเลขจำนวนเต็มที่มากกว่า 0");
        return;
      }
      custom[bldName] = num;
    }
    try {
      localStorage.setItem(TOTAL_ROOMS_STORAGE_KEY, JSON.stringify(custom));
    } catch (e) {
      console.warn("Could not save total rooms to localStorage:", e);
    }
    applyFilters();
  }

  window.initLightDashboard = function () {
    bindFilterEvents();
    // หากเคยโหลดข้อมูลแล้ว ให้เรนเดอร์ตารางและกราฟทันทีโดยไม่ต้องรอโหลดรอบใหม่
    if (hasLoadedOnce) {
      applyFilters();
    }
    if (!hasLoadedOnce || (Date.now() - lastFetchTime > 10000)) {
      fetchDashboardData(false);
    }
  };

  function cleanCell(val) {
    if (val === undefined || val === null) return "";
    return val.toString().replace(/^"|"$/g, "").trim();
  }

  // แปลงข้อมูล TSV จากชีต Database_Area ให้ตรงกับโครงสร้าง API ทุกคอลัมน์ (ไม่มีลิมิต 200 แถว)
  function parseAreaTsv(tsvText) {
    if (!tsvText) return [];
    const lines = tsvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length <= 1) return [];

    const dataLines = lines.slice(1).reverse(); // เรียงแถวล่าสุดขึ้นก่อน
    return dataLines.map(line => {
      const r = line.split("\t");
      return {
        timestamp: cleanCell(r[0]),
        date: cleanCell(r[1]),
        time: cleanCell(r[2]),
        weather: cleanCell(r[3]),
        equipment: cleanCell(r[4]),
        serialNo: cleanCell(r[5]),
        calDate: cleanCell(r[6]),
        department: cleanCell(r[7]),
        building: cleanCell(r[8]),
        room: cleanCell(r[9]),
        pointCode: cleanCell(r[10]),
        task: cleanCell(r[11]),
        pattern: cleanCell(r[12]),
        pointLux: Number(cleanCell(r[13])) || 0,
        standardLux: cleanCell(r[14]),
        minLux: cleanCell(r[15]),
        measuredLux: Number(cleanCell(r[16])) || 0,
        evaluation: cleanCell(r[17]),
        recommendation: cleanCell(r[18]),
        inspectorEmail: cleanCell(r[19])
      };
    }).filter(item => item.building && item.room);
  }

  // แปลงข้อมูล TSV จากชีต Database_Spot ให้ตรงกับโครงสร้าง API ทุกคอลัมน์
  function parseSpotTsv(tsvText) {
    if (!tsvText) return [];
    const lines = tsvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length <= 1) return [];

    const dataLines = lines.slice(1).reverse();
    return dataLines.map(line => {
      const r = line.split("\t");
      return {
        timestamp: cleanCell(r[0]),
        date: cleanCell(r[1]),
        time: cleanCell(r[2]),
        weather: cleanCell(r[3]),
        equipment: cleanCell(r[4]),
        serialNo: cleanCell(r[5]),
        calDate: cleanCell(r[6]),
        department: cleanCell(r[7]),
        building: cleanCell(r[8]),
        room: cleanCell(r[9]),
        workerName: cleanCell(r[10]),
        task: cleanCell(r[11]),
        luxArea1: Number(cleanCell(r[12])) || 0,
        luxArea2: Number(cleanCell(r[13])) || 0,
        luxArea3: Number(cleanCell(r[14])) || 0,
        standardLux: cleanCell(r[15]),
        evaluation: cleanCell(r[16]),
        recommendation: cleanCell(r[17]),
        inspectorEmail: cleanCell(r[18])
      };
    }).filter(item => item.building);
  }

  function checkIsPass(item) {
    if (!item) return false;
    const evalText = (item.evaluation || "").toString().trim();
    if (evalText === "ผ่าน") return true;
    if (evalText === "ไม่ผ่าน") return false;

    const measured = Number(item.measuredLux || item.pointLux || item.luxArea1);
    const stdStr = (item.standardLux || "").toString().trim();
    const minStr = (item.minLux || "").toString().trim();

    let pass = true;
    if (stdStr.includes(">")) {
      const th = parseFloat(stdStr.replace(">", "")) || 2400;
      if (measured < th) pass = false;
    } else if (stdStr.includes("-") && !stdStr.startsWith("-")) {
      const parts = stdStr.split("-");
      const min = parseFloat(parts[0]) || 0;
      const max = parseFloat(parts[1]) || 99999;
      if (measured < min || measured > max) pass = false;
    } else {
      const numStd = parseFloat(stdStr) || 0;
      if (measured < numStd) pass = false;
    }

    if (minStr && minStr !== "-") {
      const minNum = parseFloat(minStr);
      const ptLux = Number(item.pointLux);
      if (!isNaN(minNum) && ptLux > 0 && ptLux < minNum) pass = false;
    }
    return pass;
  }

  // ซิงค์รายชื่ออาคารจากฐานข้อมูลเข้ากับ Checkbox อัตโนมัติ (กรณีมีอาคารใหม่เพิ่มเข้ามา)
  function syncBuildingCheckboxes() {
    const group = document.getElementById('buildingCheckboxGroup');
    if (!group) return;

    const existing = new Set(
      Array.from(group.querySelectorAll('.bld-checkbox')).map(cb => cb.value.trim())
    );

    const incoming = new Set();
    Object.keys(serverBuildingStats || {}).forEach(b => {
      if (b && b.trim()) incoming.add(b.trim());
    });
    (areaRecords || []).forEach(r => {
      if (r && r.building && r.building.trim()) incoming.add(r.building.trim());
    });
    (spotRecords || []).forEach(r => {
      if (r && r.building && r.building.trim()) incoming.add(r.building.trim());
    });

    incoming.forEach(bld => {
      if (!existing.has(bld)) {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'bld-checkbox';
        input.value = bld;
        input.checked = true;
        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + bld));
        group.appendChild(label);
        existing.add(bld);
      }
    });
  }

  function bindFilterEvents() {
    if (window.__isLightEventsBound) return;
    window.__isLightEventsBound = true;

    document.addEventListener('change', e => {
      if (e.target && (e.target.classList.contains('bld-checkbox') || e.target.id === 'selectEvaluationFilter')) {
        applyFilters();
      }
    });

    // รีเฟรชข้อมูลอัตโนมัติเมื่อผู้ใช้งานกรอกฟอร์มจากอีกแท็บแล้วสลับกลับมาหน้านี้
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (Date.now() - lastFetchTime > 5000)) {
        fetchDashboardData(false);
      }
    });

    window.addEventListener('focus', () => {
      if (Date.now() - lastFetchTime > 5000) {
        fetchDashboardData(false);
      }
    });

    document.addEventListener('click', e => {
      const target = e.target;
      if (!target) return;

      const btnRoom3d = target.closest('.btn-room-3d');
      if (btnRoom3d) {
        e.preventDefault();
        const idx = Number(btnRoom3d.getAttribute('data-room-idx'));
        const roomObj = currentRenderedRooms[idx];
        if (roomObj && typeof window.openLightRoom3D === 'function') {
          window.openLightRoom3D(roomObj);
        } else {
          alert('⚠️ ระบบจำลองห้อง 3D กำลังโหลด กรุณาลองอีกครั้ง');
        }
        return;
      }

      const btnChipRoom = target.closest('[data-room-key]');
      if (btnChipRoom) {
        e.preventDefault();
        const rKey = btnChipRoom.getAttribute('data-room-key');
        const roomObj = currentAllRoomMap[rKey];
        if (roomObj && typeof window.openLightRoom3D === 'function') {
          window.openLightRoom3D(roomObj);
        }
        return;
      }

      const btnEditTotal = target.closest('.btn-edit-total-rooms');
      if (btnEditTotal) {
        e.preventDefault();
        const bldName = btnEditTotal.getAttribute('data-bld');
        const measured = Number(btnEditTotal.getAttribute('data-measured')) || 0;
        promptEditBuildingTotalRooms(bldName, measured);
        return;
      }

      const btnTogglePlan = target.closest('.btn-toggle-plan-roster');
      if (btnTogglePlan) {
        e.preventDefault();
        const drawerId = btnTogglePlan.getAttribute('data-target');
        const drawer = document.getElementById(drawerId);
        if (drawer) {
          const isOpen = drawer.classList.toggle('open');
          btnTogglePlan.textContent = isOpen
            ? '🔼 ซ่อนผังรายชื่อห้องทั้งหมดในอาคาร'
            : '📐 ดูผังรายชื่อห้องทั้งหมดในอาคารแยกตามชั้น (210 ห้อง)';
        }
        return;
      }

      const btnRefresh = target.closest('#btnRefreshLightData');
      if (btnRefresh) {
        e.preventDefault();
        fetchDashboardData(true);
        return;
      }

      if (target.id === 'btnSelectAllBuildings') {
        e.preventDefault();
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = true);
        applyFilters();
        return;
      }

      if (target.id === 'btnDeselectAllBuildings') {
        e.preventDefault();
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = false);
        applyFilters();
        return;
      }

      // พิมพ์รายงานแบบพื้นที่ (Area)
      const btnArea = target.closest('#btnExportAreaPdf');
      if (btnArea) {
        e.preventDefault();
        if (isExporting) return;

        if (!areaRecords || areaRecords.length === 0) {
          alert("⚠️ ยังไม่สามารถดึงข้อมูลจากระบบ Google Sheets ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงหรือลองรีเฟรชหน้าเว็บ");
          return;
        }

        const filtered = getFilteredAreaRecords();
        if (!filtered || filtered.length === 0) {
          alert('⚠️ กรุณาทำเครื่องหมายเลือกอาคารที่มีข้อมูลการตรวจวัดแบบพื้นที่อย่างน้อย 1 อาคาร');
          return;
        }

        const inputName = prompt("กรุณาระบุชื่อ-นามสกุล ผู้ดำเนินการตรวจวัด (ไม่ต้องใส่คำนำหน้า):\n(หากกดตกลงโดยไม่กรอกข้อความ ระบบจะแสดงเป็นเส้นประ)", "");
        if (inputName === null) return;

        let displaySignature = "(............................................................................)";
        if (inputName.trim() !== "") {
          displaySignature = `( ${inputName.trim()})`;
        }

        isExporting = true;
        try {
          generateAreaPdfReport(filtered, displaySignature);
        } catch (err) {
          console.error("Area PDF generation error:", err);
          alert("เกิดข้อผิดพลาดในการสร้างเอกสาร: " + err.message);
        } finally {
          setTimeout(() => { isExporting = false; }, 800);
        }
        return;
      }

      // พิมพ์รายงานแบบจุดบุคคล (Spot)
      const btnSpot = target.closest('#btnExportSpotPdf');
      if (btnSpot) {
        e.preventDefault();
        if (isExporting) return;

        if (!spotRecords || spotRecords.length === 0) {
          alert("⚠️ ยังไม่สามารถดึงข้อมูลแบบจุดจากระบบ Google Sheets ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงหรือลองรีเฟรชหน้าเว็บ");
          return;
        }

        const filtered = getFilteredSpotRecords();
        if (!filtered || filtered.length === 0) {
          alert('⚠️ กรุณาทำเครื่องหมายเลือกอาคารที่ต้องการออกรายงานอย่างน้อย 1 อาคาร');
          return;
        }

        const inputName = prompt("กรุณาระบุชื่อ-นามสกุล ผู้ดำเนินการตรวจวัด (ไม่ต้องใส่คำนำหน้า):\n(หากกดตกลงโดยไม่กรอกข้อความ ระบบจะแสดงเป็นเส้นประ)", "");
        if (inputName === null) return;

        let displaySignature = "(............................................................................)";
        if (inputName.trim() !== "") {
          displaySignature = `( ${inputName.trim()})`;
        }

        isExporting = true;
        try {
          generateSpotPdfReport(filtered, displaySignature);
        } catch (err) {
          console.error("Spot PDF generation error:", err);
          alert("เกิดข้อผิดพลาดในการสร้างเอกสาร: " + err.message);
        } finally {
          setTimeout(() => { isExporting = false; }, 800);
        }
        return;
      }
    });
  }

  function getSelectedBuildings() {
    return Array.from(document.querySelectorAll('.bld-checkbox:checked')).map(cb => cb.value.trim());
  }

  // จัดกลุ่มแบบพื้นที่เป็นรายห้อง (1 ห้องต่อ 1 อาคาร โดยยึดผลการตรวจวัดครั้งล่าสุดของห้องนั้นเสมอ)
  function groupAreaByRoom(records) {
    const map = {};
    const orderedKeys = [];

    (records || []).forEach(item => {
      const bld = (item.building || "").trim();
      const room = (item.room || "").trim();
      const date = (item.date || "").trim();
      const ptCode = (item.pointCode || "").toString().trim();
      const avgKey = item.measuredLux !== undefined ? String(item.measuredLux) : "";
      if (!bld || !room) return;

      const key = `${bld}___${room}`;
      if (!map[key]) {
        map[key] = {
          building: bld,
          room: room,
          date: date,
          time: item.time || "",
          timestamp: item.timestamp || "",
          task: item.task || "-",
          standardLux: item.standardLux || "-",
          minLux: item.minLux || "-",
          measuredLux: item.measuredLux || 0,
          recommendation: item.recommendation || "-",
          isPass: true,
          points: [],
          _seenPoints: new Set(),
          _avgKey: avgKey,
          _completed: false
        };
        orderedKeys.push(key);
      }

      const entry = map[key];
      if (entry._completed) return;

      // หากเจอรหัสจุดซ้ำ หรือวันที่/ค่าเฉลี่ยเป็นคนละรอบ แปลว่าเป็นข้อมูลการวัดครั้งเก่าในอดีตของห้องเดิม ให้ข้ามทันที
      const isDuplicatePoint = ptCode && ptCode !== "-" && entry._seenPoints.has(ptCode);
      const isDifferentBatch = (date !== entry.date) || (avgKey !== entry._avgKey);

      if (entry.points.length > 0 && (isDuplicatePoint || isDifferentBatch)) {
        entry._completed = true;
        return;
      }

      if (ptCode && ptCode !== "-") {
        entry._seenPoints.add(ptCode);
      }
      entry.points.push(item);
      if (!checkIsPass(item)) {
        entry.isPass = false;
      }
    });

    return orderedKeys.map(k => {
      const r = map[k];
      r.points.reverse();
      delete r._seenPoints;
      delete r._avgKey;
      delete r._completed;
      return r;
    });
  }

  function getFilteredAreaRecords() {
    const selected = getSelectedBuildings();
    if (selected.length === 0) return [];
    const rawFiltered = areaRecords.filter(item => selected.includes((item.building || "").trim()));
    const roomList = groupAreaByRoom(rawFiltered);

    const evalFilter = document.getElementById('selectEvaluationFilter')?.value || 'all';
    const filteredRooms = roomList.filter(r => {
      if (evalFilter === 'pass') return r.isPass;
      if (evalFilter === 'fail') return !r.isPass;
      return true;
    });

    const out = [];
    filteredRooms.forEach(r => {
      r.points.forEach(pt => out.push(pt));
    });
    return out;
  }

  function getFilteredSpotRecords() {
    const selected = getSelectedBuildings();
    if (selected.length === 0) return [];
    let records = spotRecords.filter(item => selected.includes((item.building || "").trim()));

    const evalFilter = document.getElementById('selectEvaluationFilter')?.value || 'all';
    if (evalFilter !== 'all') {
      records = records.filter(item => {
        const isPass = checkIsPass(item);
        return evalFilter === 'pass' ? isPass : !isPass;
      });
    }
    return records;
  }

  function computeBuildingRoomStats(selectedBuildings, areaRoomList) {
    const stats = {};
    selectedBuildings.forEach(b => {
      stats[b] = { total: 0, pass: 0, fail: 0 };
    });

    (areaRoomList || []).forEach(r => {
      if (stats[r.building]) {
        stats[r.building].total++;
        if (r.isPass) stats[r.building].pass++;
        else stats[r.building].fail++;
      }
    });

    // กรณี Fallback ไปใช้ GAS เดิมที่ยังติดลิมิต 200 แถว ให้เสริมยอดรายอาคารจาก serverBuildingStats
    const isLegacy200Cap = areaRecords.length === 200;
    if (isLegacy200Cap && serverBuildingStats && typeof serverBuildingStats === 'object') {
      selectedBuildings.forEach(b => {
        const srv = serverBuildingStats[b];
        if (srv && typeof srv.totalRooms === 'number' && srv.totalRooms > stats[b].total) {
          stats[b] = {
            total: srv.totalRooms,
            pass: srv.passRooms || 0,
            fail: srv.failRooms || 0
          };
        }
      });
    }

    return stats;
  }

  function applyFilters() {
    const selected = getSelectedBuildings();
    const rawAreaFiltered = areaRecords.filter(item => selected.includes((item.building || "").trim()));
    const roomList = groupAreaByRoom(rawAreaFiltered);
    const buildingStatsMap = computeBuildingRoomStats(selected, roomList);

    const evalFilter = document.getElementById('selectEvaluationFilter')?.value || 'all';
    const filteredRooms = roomList.filter(r => {
      if (evalFilter === 'pass') return r.isPass;
      if (evalFilter === 'fail') return !r.isPass;
      return true;
    });

    updateSummaryCards(buildingStatsMap, selected);
    updateBuildingTableAndChart(buildingStatsMap, selected);
    updateBuildingRoomBreakdown(selected, roomList, buildingStatsMap);
    updateSpotBuildingBreakdown(selected);
    updateRoomTable(filteredRooms);
  }

  async function fetchDashboardData(isManualRefresh) {
    if (isFetching) return;
    isFetching = true;

    const btnRefresh = document.getElementById('btnRefreshLightData');
    const tbody = document.getElementById('lightTableBody');
    if (isManualRefresh && btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.textContent = '⏳ กำลังอัปเดต...';
    }

    try {
      const ts = Date.now();
      const fetchOpts = { cache: 'no-store' };
      let loadedFromSheetDirect = false;

      // 1. ดึงข้อมูลเต็มทั้งตารางโดยตรงจาก Google Sheets TSV (รวดเร็วและไม่ติดลิมิต 200 แถว)
      try {
        const areaTsvUrl = `https://docs.google.com/spreadsheets/d/${LIGHT_SHEET_ID}/export?format=tsv&gid=${GID_DATABASE_AREA}&_t=${ts}`;
        const spotTsvUrl = `https://docs.google.com/spreadsheets/d/${LIGHT_SHEET_ID}/export?format=tsv&gid=${GID_DATABASE_SPOT}&_t=${ts}`;

        const [areaTsvRes, spotTsvRes] = await Promise.all([
          fetch(areaTsvUrl, fetchOpts),
          fetch(spotTsvUrl, fetchOpts)
        ]);

        if (areaTsvRes.ok && spotTsvRes.ok) {
          const [areaTsvText, spotTsvText] = await Promise.all([
            areaTsvRes.text(),
            spotTsvRes.text()
          ]);
          const parsedArea = parseAreaTsv(areaTsvText);
          const parsedSpot = parseSpotTsv(spotTsvText);
          if (parsedArea.length > 0 || parsedSpot.length > 0) {
            areaRecords = parsedArea;
            spotRecords = parsedSpot;
            serverBuildingStats = {};
            loadedFromSheetDirect = true;
          }
        }
      } catch (directErr) {
        console.warn("Direct Sheet TSV fetch fallback to GAS:", directErr);
      }

      // 2. Fallback ดึงผ่าน GAS Web App API กรณีชีตมีการเปลี่ยนสิทธิ์การแชร์ในอนาคต
      if (!loadedFromSheetDirect) {
        const [statsRes, areaRes, spotRes] = await Promise.all([
          fetch(`${LIGHT_API_URL}?action=getBuildingStats&_t=${ts}`, fetchOpts),
          fetch(`${LIGHT_API_URL}?action=getAreaSummary&_t=${ts}`, fetchOpts),
          fetch(`${LIGHT_API_URL}?action=getSpotSummary&_t=${ts}`, fetchOpts)
        ]);

        const statsJson = await statsRes.json();
        const areaJson = await areaRes.json();
        const spotJson = await spotRes.json();

        if (statsJson && !statsJson.error) {
          serverBuildingStats = statsJson;
        }
        areaRecords = Array.isArray(areaJson) ? areaJson : [];
        spotRecords = Array.isArray(spotJson) ? spotJson : [];
      }

      hasLoadedOnce = true;
      lastFetchTime = Date.now();

      syncBuildingCheckboxes();
      applyFilters();
    } catch (err) {
      console.error("Fetch data error:", err);
      if (tbody && !hasLoadedOnce) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-td text-fail">⚠️ โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อหรือกดรีเฟรชข้อมูลอีกครั้ง</td></tr>';
      }
    } finally {
      isFetching = false;
      if (btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.textContent = '🔄 รีเฟรชข้อมูล';
      }
    }
  }

  function updateSummaryCards(buildingStatsMap, selected) {
    let total = 0, pass = 0, fail = 0;
    selected.forEach(b => {
      const s = buildingStatsMap[b];
      if (s) {
        total += s.total;
        pass += s.pass;
        fail += s.fail;
      }
    });

    if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = total;
    if (document.getElementById('statPass')) document.getElementById('statPass').textContent = pass;
    if (document.getElementById('statFail')) document.getElementById('statFail').textContent = fail;

    // อัปเดตการ์ดหน้าแรก (Home) โดยใช้ผลรวมของทุกอาคารในระบบเสมอ
    const allCheckboxes = Array.from(document.querySelectorAll('.bld-checkbox')).map(cb => cb.value.trim());
    const allRooms = groupAreaByRoom(areaRecords);
    const allStatsMap = computeBuildingRoomStats(allCheckboxes, allRooms);
    let homeTotal = 0, homeFail = 0;
    allCheckboxes.forEach(b => {
      if (allStatsMap[b]) {
        homeTotal += allStatsMap[b].total;
        homeFail += allStatsMap[b].fail;
      }
    });

    if (document.getElementById('homeStatTotal')) document.getElementById('homeStatTotal').textContent = homeTotal;
    if (document.getElementById('homeStatFail')) document.getElementById('homeStatFail').textContent = homeFail;
  }

  function formatShortBuildingLabel(name) {
    return (name || "")
      .replace(/^อาคารภูมิทัศน์และสิ่งแวดล้อม$/, "อาคารภูมิทัศน์ฯ")
      .replace(/^อาคารระบบบำบัดน้ำเสียรวม$/, "บำบัดน้ำเสียรวม")
      .replace(/^ศูนย์การเรียนรู้มหิดล$/, "ศูนย์การเรียนรู้ฯ");
  }

  function renderBuildingBarChart(canvas, active, stats) {
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (buildingChartInstance) {
      buildingChartInstance.destroy();
      buildingChartInstance = null;
    }

    const fullLabels = active.length > 0 ? active : ['ไม่มีข้อมูล'];
    const shortLabels = fullLabels.map(formatShortBuildingLabel);
    const passData = active.length > 0 ? active.map(b => stats[b].pass) : [0];
    const failData = active.length > 0 ? active.map(b => stats[b].fail) : [0];

    buildingChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: shortLabels,
        datasets: [
          {
            label: 'ผ่านเกณฑ์ (ห้อง)',
            data: passData,
            backgroundColor: '#16a34a',
            borderRadius: 4
          },
          {
            label: 'ต้องปรับปรุง (ห้อง)',
            data: failData,
            backgroundColor: '#dc2626',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              autoSkip: false,
              maxRotation: 30,
              minRotation: 20,
              font: { size: 11, family: 'Plus Jakarta Sans' }
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { precision: 0, stepSize: 2, font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.04)' }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { size: 11, family: 'Plus Jakarta Sans' } }
          },
          tooltip: {
            callbacks: {
              title: function (items) {
                const idx = items && items[0] ? items[0].dataIndex : 0;
                return fullLabels[idx] || '';
              }
            }
          }
        }
      }
    });
  }

  function updateBuildingTableAndChart(stats, selected) {
    const tbody = document.getElementById('buildingSummaryTbody');
    const canvas = document.getElementById('buildingLightChart');

    const active = selected.filter(b => stats[b] && stats[b].total > 0);

    if (tbody) {
      if (active.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-td">ไม่พบข้อมูลการตรวจวัดแบบพื้นที่ในอาคารที่เลือก</td></tr>';
      } else {
        tbody.innerHTML = active.map(b => {
          const s = stats[b];
          const totalInBld = getBuildingTotalRooms(b);
          const rate = s.total > 0 ? ((s.pass / s.total) * 100).toFixed(1) : "0.0";
          const color = Number(rate) >= 80 ? "#16a34a" : (Number(rate) >= 50 ? "#ca8a04" : "#dc2626");

          const totalCellHtml = totalInBld
            ? `<div style="display:inline-flex; align-items:center; gap:5px;">
                 <strong>${totalInBld}</strong>
                 <button type="button" class="btn-edit-total-rooms" data-bld="${b}" data-measured="${s.total}" title="แก้ไขจำนวนห้องทั้งหมด">✏️</button>
               </div>`
            : `<button type="button" class="btn-edit-total-rooms" data-bld="${b}" data-measured="${s.total}" title="คลิกเพื่อระบุจำนวนห้องทั้งหมดของอาคารนี้">✏️ ระบุ</button>`;

          const coverageSub = totalInBld
            ? `<div class="sub-text">(${((s.total / totalInBld) * 100).toFixed(1)}% ของอาคาร)</div>`
            : "";

          return `
            <tr>
              <td><strong>${b}</strong></td>
              <td style="text-align:center;">${totalCellHtml}</td>
              <td style="text-align:center; font-weight:bold;">${s.total}${coverageSub}</td>
              <td style="text-align:center; font-weight:bold; color:#16a34a;">${s.pass}</td>
              <td style="text-align:center; font-weight:bold; color:#dc2626;">${s.fail}</td>
              <td style="text-align:center; font-weight:bold; color:${color};">${rate}%</td>
            </tr>
          `;
        }).join('');
      }
    }

    const isLightPageActive = document.getElementById('page-light')?.classList.contains('active');
    if (canvas && typeof Chart !== 'undefined' && isLightPageActive) {
      if (canvas.clientWidth === 0) {
        requestAnimationFrame(() => renderBuildingBarChart(canvas, active, stats));
      } else {
        renderBuildingBarChart(canvas, active, stats);
      }
    }
  }

  // สร้างการ์ดสรุปว่าแต่ละอาคารมีทั้งหมดกี่ห้อง ตรวจวัดไปแล้วกี่ห้อง และมีห้องไหนบ้าง
  function updateBuildingRoomBreakdown(selected, roomList, stats) {
    const container = document.getElementById('buildingRoomBreakdownList');
    if (!container) return;

    currentAllRoomMap = {};
    const roomsByBuilding = {};
    (selected || []).forEach(b => { roomsByBuilding[b] = []; });

    (roomList || []).forEach(r => {
      const rKey = `${r.building}___${r.room}`;
      currentAllRoomMap[rKey] = r;
      if (!roomsByBuilding[r.building]) roomsByBuilding[r.building] = [];
      roomsByBuilding[r.building].push(r);
    });

    // เรียงอาคารที่มีห้องตรวจวัดแล้วขึ้นก่อน ตามด้วยอาคารที่เลือกไว้
    const orderedBuildings = (selected || []).slice().sort((a, b) => {
      const ca = (stats[a] && stats[a].total) || 0;
      const cb = (stats[b] && stats[b].total) || 0;
      return cb - ca;
    });

    if (orderedBuildings.length === 0) {
      container.innerHTML = '<div class="loading-td">กรุณาเลือกอาคารด้านบนอย่างน้อย 1 อาคาร</div>';
      return;
    }

    // สร้างพจนานุกรมชื่อห้องจากผังอาคาร (เช่น "326" -> "ห้องเรียน 60 ที่นั่ง")
    const planRoomNameLookup = {};
    Object.keys(BUILDING_FLOOR_PLANS).forEach(bld => {
      planRoomNameLookup[bld] = {};
      BUILDING_FLOOR_PLANS[bld].floors.forEach(fl => {
        fl.rooms.forEach(([code, name]) => {
          planRoomNameLookup[bld][code.toLowerCase()] = name;
        });
      });
    });

    container.innerHTML = orderedBuildings.map((b, bIdx) => {
      const s = stats[b] || { total: 0, pass: 0, fail: 0 };
      const bRooms = (roomsByBuilding[b] || []).slice().sort((x, y) =>
        String(x.room).localeCompare(String(y.room), 'th', { numeric: true })
      );
      const totalRoomsInBld = getBuildingTotalRooms(b);
      const planInfo = BUILDING_FLOOR_PLANS[b];

      const denom = totalRoomsInBld ? Math.max(totalRoomsInBld, s.total) : Math.max(s.total, 1);
      const passPct = s.total > 0 ? ((s.pass / denom) * 100).toFixed(1) : 0;
      const failPct = s.total > 0 ? ((s.fail / denom) * 100).toFixed(1) : 0;
      const measuredPctText = totalRoomsInBld
        ? `${((s.total / totalRoomsInBld) * 100).toFixed(1)}%`
        : "100% ของที่บันทึก";
      const remainingRooms = totalRoomsInBld ? Math.max(0, totalRoomsInBld - s.total) : null;

      const totalBadgeHtml = totalRoomsInBld
        ? `<strong>${totalRoomsInBld} ห้อง</strong>`
        : `<span style="color:#64748b;">ยังไม่ระบุ</span>`;

      const remainingBoxHtml = remainingRooms !== null
        ? `<div class="bld-stat-box">คงเหลือยังไม่ได้ตรวจ: <strong>${remainingRooms} ห้อง</strong></div>`
        : "";

      const planBadgeHtml = planInfo
        ? `<span class="bld-plan-badge">📐 ${planInfo.planRef}</span>`
        : "";

      let chipsHtml = "";
      if (bRooms.length === 0) {
        chipsHtml = `<div class="sub-text" style="padding: 6px 0;">ยังไม่มีบันทึกการตรวจวัดแบบพื้นที่ (Area) ในอาคารนี้</div>`;
      } else {
        chipsHtml = `<div class="bld-room-chips-wrap">` + bRooms.map(r => {
          const rKey = `${r.building}___${r.room}`;
          const codeNorm = String(r.room).trim().toLowerCase();
          const planTitle = (planRoomNameLookup[b] && planRoomNameLookup[b][codeNorm])
            ? ` (${planRoomNameLookup[b][codeNorm]})`
            : "";
          const icon = r.isPass ? "🟢" : "🔴";
          const cls = r.isPass ? "pass" : "fail";
          const roomLabel = /^(ห้อง|โถง|บันได|ทางเดิน|ทางเข้า|ทางหนีไฟ|ลาน|ป้อม)/.test(String(r.room).trim())
            ? r.room
            : `ห้อง ${r.room}`;
          return `
            <button type="button" class="room-chip-btn ${cls}" data-room-key="${rKey}" title="คลิกเพื่อดูจำลองห้อง 3D • งาน: ${r.task} • เฉลี่ย ${r.measuredLux} Lux">
              <span>${icon} ${roomLabel}${planTitle}</span>
              <span class="chip-lux">${r.measuredLux} Lux</span>
            </button>
          `;
        }).join('') + `</div>`;
      }

      // หากอาคารมีข้อมูลผังห้องครบทุกชั้น (เช่น อาคารสิริวิทยา) ให้แสดงปุ่มกางดูเช็กลิสต์ทุกชั้น
      let planDrawerHtml = "";
      let planToggleBtnHtml = "";
      if (planInfo) {
        const drawerId = `planRosterDrawer_${bIdx}`;
        planToggleBtnHtml = `
          <button type="button" class="btn-toggle-plan-roster" data-target="${drawerId}">
            📐 ดูผังรายชื่อห้องทั้งหมดในอาคารแยกตามชั้น (${totalRoomsInBld || 210} ห้อง)
          </button>
        `;

        // จับคู่ห้องที่ตรวจวัดแล้วเข้ากับรหัสห้องในแบบแปลน
        const measuredByCode = {};
        bRooms.forEach(r => {
          measuredByCode[String(r.room).trim().toLowerCase()] = r;
        });

        const floorsHtml = planInfo.floors.map(fl => {
          let floorMeasuredCount = 0;
          const pills = fl.rooms.map(([code, name]) => {
            const norm = code.toLowerCase();
            let matchedRoom = measuredByCode[norm];
            // รองรับการจับคู่บันไดหนีไฟ ST-1..ST-3 และโถงทางเดินแต่ละชั้น
            if (!matchedRoom) {
              if (name.includes("ST-1") && measuredByCode["บันไดหนีไฟ st-1"]) matchedRoom = measuredByCode["บันไดหนีไฟ st-1"];
              else if (name.includes("ST-2") && measuredByCode["บันไดหนีไฟ st-2"]) matchedRoom = measuredByCode["บันไดหนีไฟ st-2"];
              else if (name.includes("ST-3") && measuredByCode["บันไดหนีไฟ st-3"]) matchedRoom = measuredByCode["บันไดหนีไฟ st-3"];
              else if (name === "ทางเดิน" && fl.floor.includes("ชั้นใต้ดิน") && measuredByCode["โถงทางเดิน ชั้นใต้ดิน"]) matchedRoom = measuredByCode["โถงทางเดิน ชั้นใต้ดิน"];
              else if (name === "ทางเดิน" && fl.floor.includes("ชั้น 1") && measuredByCode["โถงทางเดินหน้าห้องเรียน ชั้น 1"]) matchedRoom = measuredByCode["โถงทางเดินหน้าห้องเรียน ชั้น 1"];
              else if (name === "ทางเดิน" && fl.floor.includes("ชั้น 2") && (measuredByCode["โถงทางเดินส่วนกลาง ชั้น 2"] || measuredByCode["โถงทางเดินหลังห้องเรียนใหญ่ ชั้น 2"])) {
                matchedRoom = measuredByCode["โถงทางเดินส่วนกลาง ชั้น 2"] || measuredByCode["โถงทางเดินหลังห้องเรียนใหญ่ ชั้น 2"];
              }
              else if (name === "ทางเดิน" && fl.floor.includes("ชั้น 3") && measuredByCode["โถงทางเดินชั้น 3"]) matchedRoom = measuredByCode["โถงทางเดินชั้น 3"];
            }

            if (matchedRoom) {
              floorMeasuredCount++;
              const rKey = `${matchedRoom.building}___${matchedRoom.room}`;
              const mCls = matchedRoom.isPass ? "measured-pass" : "measured-fail";
              const mIcon = matchedRoom.isPass ? "🟢" : "🔴";
              return `<button type="button" class="plan-room-pill ${mCls}" data-room-key="${rKey}" title="ตรวจวัดแล้ว (${matchedRoom.measuredLux} Lux) คลิกเพื่อดู 3D">${mIcon} ${code} ${name} (${matchedRoom.measuredLux} Lux)</button>`;
            }
            return `<span class="plan-room-pill">⬜ ${code} ${name}</span>`;
          }).join('');

          return `
            <div class="plan-floor-group">
              <div class="plan-floor-title">
                <span>🏢 ${fl.floor}</span>
                <span class="sub-text">ทั้งหมด ${fl.rooms.length} ห้อง • ตรวจวัดครอบคลุมแล้ว ${floorMeasuredCount} รายการ</span>
              </div>
              <div class="bld-room-chips-wrap">${pills}</div>
            </div>
          `;
        }).join('');

        planDrawerHtml = `<div id="${drawerId}" class="plan-roster-drawer">${floorsHtml}</div>`;
      }

      return `
        <div class="bld-breakdown-card">
          <div class="bld-breakdown-top">
            <div class="bld-breakdown-name">
              <span>🏢 ${b}</span>
              ${planBadgeHtml}
            </div>
            <div class="bld-stats-pills">
              <div class="bld-stat-box">
                ห้องทั้งหมด: ${totalBadgeHtml}
                <button type="button" class="btn-edit-total-rooms" data-bld="${b}" data-measured="${s.total}">✏️ ตั้งค่า</button>
              </div>
              <div class="bld-stat-box">
                ตรวจวัดแล้ว: <strong style="color:#0284c7;">${s.total} ห้อง</strong>
                ${totalRoomsInBld ? `<span class="sub-text">(${measuredPctText})</span>` : ""}
              </div>
              <div class="bld-stat-box">
                ผ่านเกณฑ์: <strong style="color:#16a34a;">${s.pass} ห้อง</strong>
              </div>
              <div class="bld-stat-box">
                ต้องปรับปรุง: <strong style="color:#dc2626;">${s.fail} ห้อง</strong>
              </div>
              ${remainingBoxHtml}
            </div>
          </div>

          <div class="bld-progress-track" title="ผ่านเกณฑ์ ${s.pass} ห้อง • ต้องปรับปรุง ${s.fail} ห้อง">
            <div class="bld-progress-pass" style="width:${passPct}%;"></div>
            <div class="bld-progress-fail" style="width:${failPct}%;"></div>
          </div>

          <div class="bld-rooms-label">
            <span>📋 รายชื่อห้องที่ตรวจวัดแล้ว (${bRooms.length} ห้อง):</span>
            ${planToggleBtnHtml}
          </div>
          ${chipsHtml}
          ${planDrawerHtml}
        </div>
      `;
    }).join('');
  }

  // สร้างการ์ดสรุปการตรวจวัดแบบจุด (Spot): อาคาร >>> เลขห้อง >>> ผ่าน / ไม่ผ่าน กี่โต๊ะ
  function updateSpotBuildingBreakdown(selected) {
    const container = document.getElementById('spotBuildingBreakdownList');
    const kpiBar = document.getElementById('spotKpiSummaryBar');
    if (!container) return;

    const selectedSet = new Set(selected || []);
    const evalFilter = document.getElementById('selectEvaluationFilter')?.value || 'all';

    // กรองข้อมูล Spot ตามอาคารที่เลือกและตัวกรองสถานะ
    const filteredSpot = (spotRecords || []).filter(item => {
      const bld = (item.building || "").trim();
      if (!selectedSet.has(bld)) return false;
      const isPass = checkIsPass(item);
      if (evalFilter === 'pass') return isPass;
      if (evalFilter === 'fail') return !isPass;
      return true;
    });

    let grandTotal = 0, grandPass = 0, grandFail = 0;
    const bldMap = {};

    filteredSpot.forEach(item => {
      const bld = (item.building || "").trim();
      const room = (item.room || "-").trim();
      const isPass = checkIsPass(item);
      const lux1 = Number(item.luxArea1) || 0;

      grandTotal++;
      if (isPass) grandPass++;
      else grandFail++;

      if (!bldMap[bld]) {
        bldMap[bld] = { total: 0, pass: 0, fail: 0, rooms: {} };
      }
      bldMap[bld].total++;
      if (isPass) bldMap[bld].pass++;
      else bldMap[bld].fail++;

      if (!bldMap[bld].rooms[room]) {
        bldMap[bld].rooms[room] = {
          room,
          total: 0,
          pass: 0,
          fail: 0,
          minLux: Infinity,
          maxLux: -Infinity,
          standardLux: item.standardLux || "-"
        };
      }
      const rObj = bldMap[bld].rooms[room];
      rObj.total++;
      if (isPass) rObj.pass++;
      else rObj.fail++;
      if (lux1 > 0) {
        if (lux1 < rObj.minLux) rObj.minLux = lux1;
        if (lux1 > rObj.maxLux) rObj.maxLux = lux1;
      }
    });

    if (kpiBar) {
      const grandRate = grandTotal > 0 ? ((grandPass / grandTotal) * 100).toFixed(1) : "0.0";
      kpiBar.innerHTML = `
        <div class="bld-stat-box">ตรวจแล้ว: <strong style="color:#0284c7;">${grandTotal} โต๊ะ</strong></div>
        <div class="bld-stat-box">ผ่านเกณฑ์: <strong style="color:#16a34a;">${grandPass} โต๊ะ</strong></div>
        <div class="bld-stat-box">ไม่ผ่านเกณฑ์: <strong style="color:#dc2626;">${grandFail} โต๊ะ</strong></div>
        <div class="bld-stat-box">ปลอดภัย: <strong>${grandRate}%</strong></div>
      `;
    }

    const activeBlds = Object.keys(bldMap).sort((a, b) => bldMap[b].total - bldMap[a].total);
    if (activeBlds.length === 0) {
      container.innerHTML = '<div class="loading-td">ไม่พบข้อมูลการตรวจวัดแบบจุด (Spot) ในอาคารที่เลือก</div>';
      return;
    }

    container.innerHTML = activeBlds.map(b => {
      const bData = bldMap[b];
      const passPct = bData.total > 0 ? ((bData.pass / bData.total) * 100).toFixed(1) : "0.0";
      const failPct = bData.total > 0 ? ((bData.fail / bData.total) * 100).toFixed(1) : "0.0";
      const roomKeys = Object.keys(bData.rooms).sort((x, y) =>
        x.localeCompare(y, 'th', { numeric: true })
      );

      const rowsHtml = roomKeys.map(rk => {
        const rm = bData.rooms[rk];
        const roomLabel = /^(ห้อง|งาน|โถง|บันได|ทางเดิน|ลาน|ป้อม)/.test(rm.room)
          ? rm.room
          : `ห้อง ${rm.room}`;
        const luxRange = (rm.minLux !== Infinity && rm.maxLux !== -Infinity)
          ? (rm.minLux === rm.maxLux ? `${rm.minLux} Lux` : `${rm.minLux} – ${rm.maxLux} Lux`)
          : "-";
        const isAllPass = rm.fail === 0;
        const statusBadge = isAllPass
          ? `<span class="status-tag pass">ผ่านครบ</span>`
          : `<span class="status-tag fail">ไม่ผ่าน ${rm.fail} โต๊ะ</span>`;

        return `
          <tr>
            <td><strong>${roomLabel}</strong></td>
            <td style="text-align:center; font-weight:700;">${rm.total} โต๊ะ</td>
            <td style="text-align:center; font-weight:700; color:#16a34a;">${rm.pass} โต๊ะ</td>
            <td style="text-align:center; font-weight:700; color:${rm.fail > 0 ? '#dc2626' : '#94a3b8'};">${rm.fail} โต๊ะ</td>
            <td style="text-align:center; font-family:var(--font-mono); font-size:11.5px;">${luxRange} <span class="sub-text">(เกณฑ์ ${rm.standardLux})</span></td>
            <td style="text-align:center;">${statusBadge}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="bld-breakdown-card">
          <div class="bld-breakdown-top">
            <div class="bld-breakdown-name">
              <span>🏢 ${b}</span>
              <span class="bld-plan-badge">${roomKeys.length} ห้อง/พื้นที่</span>
            </div>
            <div class="bld-stats-pills">
              <div class="bld-stat-box">ตรวจแล้ว: <strong style="color:#0284c7;">${bData.total} โต๊ะ</strong></div>
              <div class="bld-stat-box">ผ่านเกณฑ์: <strong style="color:#16a34a;">${bData.pass} โต๊ะ</strong></div>
              <div class="bld-stat-box">ไม่ผ่านเกณฑ์: <strong style="color:#dc2626;">${bData.fail} โต๊ะ</strong></div>
              <div class="bld-stat-box">ปลอดภัย: <strong>${passPct}%</strong></div>
            </div>
          </div>

          <div class="bld-progress-track">
            <div class="bld-progress-pass" style="width:${passPct}%;"></div>
            <div class="bld-progress-fail" style="width:${failPct}%;"></div>
          </div>

          <div class="spot-room-table-wrap">
            <table class="spot-room-table">
              <thead>
                <tr>
                  <th style="width:32%;">เลขห้อง / พื้นที่</th>
                  <th style="text-align:center;">ตรวจทั้งหมด</th>
                  <th style="text-align:center; color:#16a34a;">ผ่านเกณฑ์</th>
                  <th style="text-align:center; color:#dc2626;">ไม่ผ่านเกณฑ์</th>
                  <th style="text-align:center;">ช่วงค่าแสงจุดทำงาน (Lux)</th>
                  <th style="text-align:center;">สรุปสถานะ</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateRoomTable(filteredRooms) {
    const tbody = document.getElementById('lightTableBody');
    if (!tbody) return;

    currentRenderedRooms = Array.isArray(filteredRooms) ? filteredRooms : [];

    if (currentRenderedRooms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-td">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>';
      return;
    }

    tbody.innerHTML = currentRenderedRooms.map((r, idx) => {
      const isPass = r.isPass;
      const ptCodes = r.points.map(p => p.pointCode).filter(c => c && c !== "-");
      const ptList = ptCodes.length > 0 ? `(${ptCodes.join(', ')})` : "";
      const minNotice = r.minLux && r.minLux !== "-" ? `<div class="sub-text">ต่ำสุด: ${r.minLux} Lux</div>` : "";

      return `
        <tr>
          <td>
            <strong>${r.building}</strong>
            <div class="sub-text">ห้อง ${r.room} • ${r.date}</div>
          </td>
          <td>
            <div>${r.task}</div>
            <div class="sub-text" style="color:#0284c7; font-weight:bold;">${r.points.length} จุดตรวจ ${ptList}</div>
          </td>
          <td>
            <strong>${r.standardLux} Lux</strong>
            ${minNotice}
          </td>
          <td>
            <strong>เฉลี่ย ${r.measuredLux} Lux</strong>
          </td>
          <td style="text-align:center;">
            <span class="status-tag ${isPass ? 'pass' : 'fail'}">${isPass ? 'ผ่านเกณฑ์' : 'ต้องปรับปรุง'}</span>
          </td>
          <td style="text-align:center;">
            <button type="button" class="btn-room-3d" data-room-idx="${idx}">
              🧊 ดูจำลองห้อง 3D
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function generateAreaPdfReport(records, displaySignature) {
    function formatDateTime(item) {
      const timePart = item.time || (item.timestamp ? item.timestamp.toString().substring(11, 16) : "");
      let datePart = item.date || "";

      if (item.timestamp && !datePart) {
        const d = new Date(item.timestamp);
        if (!isNaN(d.getTime())) datePart = d.toISOString().slice(0, 10);
      } else if (datePart.includes("/")) {
        const parts = datePart.split("/");
        if (parts.length === 3 && parts[2].length === 4) {
          datePart = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return (datePart && timePart) ? `${datePart} ${timePart} น.` : (datePart || timePart || "-");
    }

    const sample = records[0] || {};
    const equipName = (sample.equipment && sample.equipment !== "-") ? sample.equipment : "Lux Meter";
    const serialNum = (sample.serialNo && sample.serialNo !== "-") ? sample.serialNo : "-";
    const calibDate = (sample.calDate && sample.calDate !== "-") ? sample.calDate : "-";

    const evalFilter = document.getElementById('selectEvaluationFilter')?.value || 'all';
    const noteColumnHeader = (evalFilter === 'fail') ? 'ข้อเสนอแนะ/แก้ไข' : 'หมายเหตุ';

    const groupedByBuilding = {};
    records.forEach(item => {
      const bld = (item.building || "ไม่ระบุอาคาร").trim();
      if (!groupedByBuilding[bld]) groupedByBuilding[bld] = [];
      groupedByBuilding[bld].push(item);
    });

    let contentHtml = "";

    Object.keys(groupedByBuilding).forEach(bldName => {
      const bldRecords = groupedByBuilding[bldName];
      const roomsInBuilding = groupAreaByRoom(bldRecords);

      let areaRowsHtml = "";
      let rowIndex = 1;

      roomsInBuilding.forEach(roomObj => {
        const points = roomObj.points;
        const count = points.length;
        const first = points[0];
        const dateTimeStr = formatDateTime(first);
        const isPass = roomObj.isPass;

        points.forEach((pt, idx) => {
          const locationStr = `${pt.room || "-"}/${pt.pointCode || "r-" + (idx + 1)}`;
          const pointLuxVal = pt.pointLux !== undefined && pt.pointLux !== 0 ? pt.pointLux : pt.measuredLux;

          if (idx === 0) {
            areaRowsHtml += `
              <tr>
                <td rowspan="${count}" style="text-align:center;">${rowIndex++}</td>
                <td rowspan="${count}" style="text-align:center; white-space:nowrap;">${dateTimeStr}</td>
                <td>${locationStr}</td>
                <td rowspan="${count}">${first.task || "-"}</td>
                <td style="text-align:center; font-weight:600;">${pointLuxVal}</td>
                <td rowspan="${count}" style="text-align:center; font-weight:bold; background:#fafafa;">${first.measuredLux || "0"}</td>
                <td rowspan="${count}" style="text-align:center;">${first.standardLux || "-"}</td>
                <td rowspan="${count}" style="text-align:center;">${first.minLux || "-"}</td>
                <td rowspan="${count}" style="text-align:center; font-weight:bold; ${isPass ? 'color:#15803d;' : 'color:#b91c1c;'}">
                  ${isPass ? 'ผ่าน' : 'ไม่ผ่าน'}
                </td>
                <td rowspan="${count}">${first.recommendation || "-"}</td>
              </tr>
            `;
          } else {
            areaRowsHtml += `
              <tr>
                <td>${locationStr}</td>
                <td style="text-align:center; font-weight:600;">${pointLuxVal}</td>
              </tr>
            `;
          }
        });
      });

      contentHtml += `
        <div class="bld-section-title">อาคาร: ${bldName}</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 4%;">ลำดับ</th>
              <th rowspan="2" style="width: 14%;">วันเวลาที่ตรวจวัด</th>
              <th rowspan="2" style="width: 17%;">สถานที่ตรวจวัด<br><span style="font-size:9pt; font-weight:normal;">(เลขห้อง/รหัสจุดตรวจวัด)</span></th>
              <th rowspan="2" style="width: 16%;">ลักษณะงาน</th>
              <th colspan="2" style="width: 14%;">ความเข้มของแสงสว่าง (Lux)</th>
              <th colspan="2" style="width: 15%;">เกณฑ์มาตรฐาน</th>
              <th rowspan="2" style="width: 8%;">ผลประเมิน</th>
              <th rowspan="2" style="width: 12%;">${noteColumnHeader}</th>
            </tr>
            <tr>
              <th style="width: 7%;">ค่าที่วัดได้</th>
              <th style="width: 7%;">ค่าเฉลี่ย</th>
              <th style="width: 10%;">ค่าเฉลี่ยความเข้มของแสง (Lux)</th>
              <th style="width: 12%;">จุดที่ความเข้มของแสงสว่างต่ำสุด(Lux)</th>
            </tr>
          </thead>
          <tbody>
            ${areaRowsHtml}
          </tbody>
        </table>
        <div style="margin-bottom: 15px;"></div>
      `;
    });

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>รายงานผลการตรวจวัดความเข้มของแสงสว่าง</title>
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; font-family: "TH Sarabun New", "Sarabun", Tahoma, sans-serif; }
          body { margin: 0; padding: 10px; color: #000; background: #fff; font-size: 11pt; line-height: 1.2; }
          .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
          .header-brand-group { display: flex; align-items: center; gap: 14px; }
          .mu-logo { width: 52px; height: 52px; object-fit: contain; }
          .org-title { font-size: 15pt; font-weight: bold; line-height: 1.2; }
          .section-title { font-weight: bold; margin: 6px 0 3px 0; font-size: 12pt; }
          .bld-section-title { font-weight: bold; margin: 12px 0 4px 0; font-size: 12pt; color: #1769E0; background: #f8fafc; padding: 4px 8px; border-left: 4px solid #1769E0; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5pt; }
          th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
          th { background-color: #f1f5f9; text-align: center; font-weight: bold; }
          .notes-box { margin-top: 8px; font-size: 9pt; line-height: 1.35; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 20px; padding: 0 40px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 340px; font-size: 10.5pt; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="header-brand-group">
            <img src="Mahidol_U.png" alt="Mahidol Logo" class="mu-logo" onerror="this.style.display='none'">
            <div>
              <div class="org-title">รายงานผลตรวจวัดความเข้มแสงสว่าง (Illumination Management Report)</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 6px;">
          <div style="font-size: 11pt; font-weight:bold;">เครื่องมือที่ใช้ในการตรวจวัด:</div>
          <table>
            <thead>
              <tr>
                <th>เครื่องตรวจวัด</th>
                <th>ยี่ห้อ/รุ่น</th>
                <th>หมายเลขเครื่อง (Serial Number)</th>
                <th>มาตรฐานเครื่องตรวจวัด</th>
                <th>วัน/เดือน/ปี (ปรับเทียบความถูกต้อง)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center;">เครื่องตรวจวัดความเข้มของแสงสว่าง (Lux Meter)</td>
                <td style="text-align:center;">${equipName}</td>
                <td style="text-align:center;">${serialNum}</td>
                <td style="text-align:center;">CIE Standard / ISO 45001</td>
                <td style="text-align:center;">${calibDate}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section-title">ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างบนพื้นที่ (Area Measurement)</div>
        ${contentHtml}

        <div class="notes-box">
          <strong>หมายเหตุ:</strong>
          <div>1) พื้นที่ตรวจวัดให้แนบแผนผังพื้นที่ที่ดำเนินการตรวจวัด ระบุตำแหน่งดวงไฟ แหล่งแสงธรรมชาติเป็นเอกสารแนบ</div>
          <div>2) ผลการประเมินใช้เกณฑ์มาตรฐานความปลอดภัยตามกฎกระทรวงฯ พ.ศ. 2559</div>
          <div>3) กรณีไม่เป็นไปตามเกณฑ์มาตรฐาน ให้ระบุข้อเสนอแนะและวิธีการปรับปรุงแก้ไขในภายหลัง</div>
        </div>

        <div class="sig-row">
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">${displaySignature}</div>
            <div>ผู้ดำเนินการตรวจวัด</div>
          </div>
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">(............................................................................)</div>
            <div>ผู้ตรวจสอบและรับรองผล</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printFrameContent(reportHtml);
  }

  function generateSpotPdfReport(records, displaySignature) {
    const sample = records[0] || {};
    const equipName = (sample.equipment && sample.equipment !== "-") ? sample.equipment : "Lux Meter";
    const serialNum = (sample.serialNo && sample.serialNo !== "-") ? sample.serialNo : "-";
    const calibDate = (sample.calDate && sample.calDate !== "-") ? sample.calDate : "-";

    const evalFilter = document.getElementById('selectEvaluationFilter')?.value || 'all';
    const noteColumnHeader = (evalFilter === 'fail') ? 'ข้อเสนอแนะ/แก้ไข' : 'หมายเหตุ';

    const groupedByBuilding = {};
    records.forEach(item => {
      const bld = (item.building || "ไม่ระบุอาคาร").trim();
      if (!groupedByBuilding[bld]) groupedByBuilding[bld] = [];
      groupedByBuilding[bld].push(item);
    });

    let contentHtml = "";

    Object.keys(groupedByBuilding).forEach(bldName => {
      const bldRecords = groupedByBuilding[bldName];
      const rowsHtml = bldRecords.map((r, i) => {
        const isPass = checkIsPass(r);
        return `
          <tr>
            <td style="text-align:center;">${i+1}</td>
            <td style="text-align:center;">${r.date} ${r.time} น.</td>
            <td><strong>${r.workerName}</strong></td>
            <td>ห้อง ${r.room} / ${r.task}</td>
            <td style="text-align:center; font-weight:bold;">${r.luxArea1}</td>
            <td style="text-align:center;">${r.standardLux}</td>
            <td style="text-align:center; font-weight:bold; ${isPass ? 'color:#15803d;' : 'color:#b91c1c;'}">
              ${isPass ? 'ผ่าน' : 'ไม่ผ่าน'}
            </td>
            <td>${r.recommendation}</td>
          </tr>
        `;
      }).join('');

      contentHtml += `
        <div class="bld-section-title">อาคาร: ${bldName}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">ลำดับ</th>
              <th style="width: 14%;">วันเวลาตรวจวัด</th>
              <th style="width: 18%;">ชื่อ-นามสกุลของลูกจ้าง (SEG)</th>
              <th style="width: 23%;">พื้นที่ / ลักษณะงาน</th>
              <th style="width: 10%;">ค่าเฉลี่ยที่วัดได้</th>
              <th style="width: 8%;">เกณฑ์ (Lux)</th>
              <th style="width: 9%;">ผลประเมิน</th>
              <th style="width: 13%;">${noteColumnHeader}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div style="margin-bottom: 15px;"></div>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>รายงานผลการตรวจวัดความเข้มแสงสว่างแบบจุด</title>
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; font-family: "TH Sarabun New", "Sarabun", Tahoma, sans-serif; }
          body { margin: 0; padding: 10px; color: #000; background: #fff; font-size: 11pt; line-height: 1.25; }
          .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
          .header-brand-group { display: flex; align-items: center; gap: 14px; }
          .mu-logo { width: 62px; height: 62px; object-fit: contain; }
          .org-title { font-size: 15pt; font-weight: bold; line-height: 1.2; }
          .section-title { font-weight: bold; margin: 8px 0 4px 0; font-size: 12pt; }
          .bld-section-title { font-weight: bold; margin: 12px 0 4px 0; font-size: 12pt; color: #1769E0; background: #f8fafc; padding: 4px 8px; border-left: 4px solid #1769E0; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5pt; }
          th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
          th { background-color: #f1f5f9; text-align: center; font-weight: bold; }
          .notes-box { margin-top: 8px; font-size: 9.5pt; line-height: 1.35; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 22px; padding: 0 40px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 340px; font-size: 10.5pt; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="header-brand-group">
            <img src="Mahidol_U.png" alt="Mahidol Logo" class="mu-logo" onerror="this.style.display='none'">
            <div>
              <div class="org-title">รายงานผลตรวจวัดความเข้มแสงสว่าง (Illumination Management Report)</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <div style="margin-top: 3px;"><strong>2. เครื่องมือที่ใช้ในการตรวจวัด:</strong></div>
          <table>
            <thead>
              <tr>
                <th>เครื่องตรวจวัด</th>
                <th>ยี่ห้อ/รุ่น</th>
                <th>หมายเลขเครื่อง (Serial Number)</th>
                <th>มาตรฐานเครื่องตรวจวัด</th>
                <th>ปี/เดือน/วัน (ปรับเทียบความถูกต้อง)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center;">เครื่องตรวจวัดความเข้มของแสงสว่าง</td>
                <td style="text-align:center;">${equipName}</td>
                <td style="text-align:center;">${serialNum}</td>
                <td style="text-align:center;">CIE Standard / ISO 45001</td>
                <td style="text-align:center;">${calibDate}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section-title">ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างแบบจุด (Spot Measurement)</div>
        ${contentHtml}

        <div class="notes-box">
          <strong>หมายเหตุ:</strong>
          <div>1) พื้นที่ตรวจวัดให้แนบแผนผังพื้นที่ที่ดำเนินการตรวจวัด ระบุตำแหน่งที่นั่ง แหล่งแสงธรรมชาติเป็นเอกสารแนบ</div>
          <div>2) ผลการประเมินใช้เกณฑ์มาตรฐานความปลอดภัยตามกฎกระทรวงฯ พ.ศ. 2559</div>
          <div>3) กรณีไม่เป็นไปตามเกณฑ์มาตรฐาน ให้ระบุข้อเสนอแนะและวิธีการปรับปรุงแก้ไขในถายหลัง</div>
        </div>

        <div class="sig-row">
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">${displaySignature}</div>
            <div>ผู้ดำเนินการตรวจวัด</div>
          </div>
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">(............................................................................)</div>
            <div>ผู้ตรวจสอบและรับรองผล</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printFrameContent(html);
  }

  function printFrameContent(html) {
    let oldFrame = document.getElementById('pdfPrintFrame');
    if (oldFrame) oldFrame.remove();

    const frame = document.createElement('iframe');
    frame.id = 'pdfPrintFrame';
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, 450);
  }
})();
