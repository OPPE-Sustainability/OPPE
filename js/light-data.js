// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbyn5cMl8TJFzSEbJt89uyhnoJN7mwwLJ9ehM4RIbSx4zCpiCUjCq3rLtAREjv6puv89xA/exec";

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

  window.initLightDashboard = function () {
    bindFilterEvents();
    if (!hasLoadedOnce || (Date.now() - lastFetchTime > 10000)) {
      fetchDashboardData(false);
    } else {
      applyFilters();
    }
  };

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
          alert("⚠️ ยังไม่สามารถดึงข้อมูลจากระบบ Google Sheets ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง Web App API หรือลองรีเฟรชหน้าเว็บ");
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
          alert("⚠️ ยังไม่สามารถดึงข้อมูลแบบจุดจากระบบ Google Sheets ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง Web App API หรือลองรีเฟรชหน้าเว็บ");
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
      // เรียงลำดับจุดย่อยกลับจากจุดแรกไปจุดสุดท้าย (เช่น r-1, r-2, ...)
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

    // ตรวจสอบเงื่อนไขตัวกรองสถานะห้อง (ทั้งหมด / ผ่านเกณฑ์ / ต้องปรับปรุง)
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

  // รวมสถิติรายอาคารจากข้อมูล Area (พร้อมดึงจาก getBuildingStats เสริมหาก GAS ยังติดลิมิต 200 แถวเดิม)
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

    // กรณี GAS ฝั่ง Server ยังไม่ได้อัปเดตปลดลิมิต 200 แถว ให้ดึงยอดรวมรายอาคารจาก getBuildingStats มาแสดงให้ครบทุกอาคารทันที
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
    updateRoomTable(filteredRooms, buildingStatsMap, selected);
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

      hasLoadedOnce = true;
      lastFetchTime = Date.now();

      syncBuildingCheckboxes();
      applyFilters();
    } catch (err) {
      console.error("Fetch data error:", err);
      if (tbody && !hasLoadedOnce) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td text-fail">⚠️ โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์การ Deploy GAS (ต้องเป็น Anyone)</td></tr>';
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

  function updateBuildingTableAndChart(stats, selected) {
    const tbody = document.getElementById('buildingSummaryTbody');
    const canvas = document.getElementById('buildingLightChart');

    const active = selected.filter(b => stats[b] && stats[b].total > 0);

    if (tbody) {
      if (active.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลการตรวจวัดแบบพื้นที่ในอาคารที่เลือก</td></tr>';
      } else {
        tbody.innerHTML = active.map(b => {
          const s = stats[b];
          const rate = s.total > 0 ? ((s.pass / s.total) * 100).toFixed(1) : "0.0";
          const color = Number(rate) >= 80 ? "#16a34a" : (Number(rate) >= 50 ? "#ca8a04" : "#dc2626");
          return `
            <tr>
              <td><strong>${b}</strong></td>
              <td style="text-align:center; font-weight:bold;">${s.total}</td>
              <td style="text-align:center; font-weight:bold; color:#16a34a;">${s.pass}</td>
              <td style="text-align:center; font-weight:bold; color:#dc2626;">${s.fail}</td>
              <td style="text-align:center; font-weight:bold; color:${color};">${rate}%</td>
            </tr>
          `;
        }).join('');
      }
    }

    // วาดกราฟเฉพาะเมื่อหน้าตรวจวัดแสงแสดงผลอยู่บนจอ (เพื่อให้ขนาด Canvas คำนวณได้ถูกต้อง)
    if (canvas && typeof Chart !== 'undefined' && canvas.offsetParent !== null) {
      const ctx = canvas.getContext('2d');
      if (buildingChartInstance) {
        buildingChartInstance.destroy();
      }

      const passData = active.map(b => stats[b].pass);
      const failData = active.map(b => stats[b].fail);

      buildingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: active.length > 0 ? active : ['ไม่มีข้อมูล'],
          datasets: [
            {
              label: 'ผ่านเกณฑ์ (ห้อง)',
              data: active.length > 0 ? passData : [0],
              backgroundColor: '#16a34a',
              borderRadius: 4
            },
            {
              label: 'ต้องปรับปรุง (ห้อง)',
              data: active.length > 0 ? failData : [0],
              backgroundColor: '#dc2626',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11, family: 'Plus Jakarta Sans' } } },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0, stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
          },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, family: 'Plus Jakarta Sans' } } }
          }
        }
      });
    }
  }

  function updateRoomTable(filteredRooms, buildingStatsMap, selected) {
    const tbody = document.getElementById('lightTableBody');
    if (!tbody) return;

    if (!filteredRooms || filteredRooms.length === 0) {
      const hasTruncatedServerRooms = areaRecords.length === 200 && selected.some(b => buildingStatsMap[b] && buildingStatsMap[b].total > 0);
      if (hasTruncatedServerRooms) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ℹ️ สถิติรายอาคารด้านบนแสดงครบแล้ว (หากต้องการดูรายละเอียดรายห้องย้อนหลังทั้งหมด กรุณาอัปเดตโค้ด GAS เพื่อปลดลิมิต 200 แถว)</td></tr>';
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>';
      }
      return;
    }

    tbody.innerHTML = filteredRooms.map(r => {
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
