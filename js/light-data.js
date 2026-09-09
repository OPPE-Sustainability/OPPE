// js/light-data.js
(function () {
  // อัปเดต URL ล่าสุดตามที่ระบุ
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbyn5cMl8TJFzSEbJt89uyhnoJN7mwwLJ9ehM4RIbSx4zCpiCUjCq3rLtAREjv6puv89xA/exec";
  const EHS_ACCESS_KEY = "OPPE"; 

  window.checkLightAccess = function () {
    return sessionStorage.getItem("light_dash_authorized") === "true";
  };

  window.verifyLightGateKey = function (e) {
    if (e) e.preventDefault();
    const enteredKey = document.getElementById("gatePasscode").value.trim();
    const errorMsg = document.getElementById("gateErrorMsg");

    if (enteredKey === EHS_ACCESS_KEY) {
      sessionStorage.setItem("light_dash_authorized", "true");
      const modal = document.getElementById("lightDashboardGateModal");
      if (modal) modal.style.display = "none";
      if (errorMsg) errorMsg.textContent = "";
      document.getElementById("gatePasscode").value = "";
      window.navigateTo('light');
    } else {
      if (errorMsg) errorMsg.textContent = "❌ รหัสผ่านไม่ถูกต้อง กรุณาติดต่อกองกายภาพและสิ่งแวดล้อม";
    }
  };

  let areaRecords = [];
  let spotRecords = [];
  let buildingChartInstance = null;
  let isExporting = false;

  window.initLightDashboard = function () {
    fetchDashboardData();
    bindFilterEvents();
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

  function bindFilterEvents() {
    if (window.__isLightEventsBound) return;
    window.__isLightEventsBound = true;

    document.addEventListener('change', e => {
      if (e.target.classList.contains('bld-checkbox') || e.target.id === 'selectEvaluationFilter') {
        applyFilters();
      }
    });

    document.addEventListener('click', e => {
      if (e.target.id === 'btnSelectAllBuildings') {
        e.preventDefault();
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = true);
        applyFilters();
        return;
      }
      if (e.target.id === 'btnDeselectAllBuildings') {
        e.preventDefault();
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = false);
        applyFilters();
        return;
      }

      // พิมพ์รายงานแบบพื้นที่
      const btnAreaPdf = e.target.closest('#btnExportAreaPdf');
      if (btnAreaPdf) {
        e.preventDefault();
        if (isExporting) return;
        const filtered = getFilteredAreaRecords();
        if (filtered.length === 0) { alert('ไม่พบข้อมูลตรวจวัดแบบพื้นที่'); return; }
        isExporting = true;
        try { generateAreaPdfReport(filtered); }
        finally { setTimeout(() => { isExporting = false; }, 1500); }
        return;
      }

      // พิมพ์รายงานแบบจุดบุคคล
      const btnSpotPdf = e.target.closest('#btnExportSpotPdf');
      if (btnSpotPdf) {
        e.preventDefault();
        if (isExporting) return;
        const filtered = getFilteredSpotRecords();
        if (filtered.length === 0) { alert('ไม่พบข้อมูลตรวจวัดแบบจุด (Spot)'); return; }
        isExporting = true;
        try { generateSpotPdfReport(filtered); }
        finally { setTimeout(() => { isExporting = false; }, 1500); }
        return;
      }
    });
  }

  function getSelectedBuildings() {
    return Array.from(document.querySelectorAll('.bld-checkbox:checked')).map(cb => cb.value.trim());
  }

  function getFilteredAreaRecords() {
    const selected = getSelectedBuildings();
    return areaRecords.filter(item => selected.includes((item.building || "").trim()));
  }

  function getFilteredSpotRecords() {
    const selected = getSelectedBuildings();
    return spotRecords.filter(item => selected.includes((item.building || "").trim()));
  }

  function groupAreaByRoom(records) {
    const map = {};
    (records || []).forEach(item => {
      const bld = (item.building || "").trim();
      const room = (item.room || "").trim();
      const date = (item.date || "").trim();
      if (!bld || !room) return;

      const key = `${bld}___${date}___${room}`;
      if (!map[key]) {
        map[key] = {
          building: bld, room: room, date: date,
          task: item.task || "-", standardLux: item.standardLux || "-",
          minLux: item.minLux || "-", measuredLux: item.measuredLux || 0,
          isPass: true, points: []
        };
      }
      map[key].points.push(item);
      if (!checkIsPass(item)) map[key].isPass = false;
    });
    return Object.values(map);
  }

  function applyFilters() {
    const filteredArea = getFilteredAreaRecords();
    const roomList = groupAreaByRoom(filteredArea);

    const evalFilter = document.getElementById('selectEvaluationFilter')?.value || 'all';
    const filteredRooms = roomList.filter(r => {
      if (evalFilter === 'pass') return r.isPass;
      if (evalFilter === 'fail') return !r.isPass;
      return true;
    });

    updateSummaryCards(roomList);
    updateBuildingTableAndChart(filteredArea);
    updateRoomTable(filteredRooms);
  }

  async function fetchDashboardData() {
    const tbody = document.getElementById('lightTableBody');
    try {
      const [areaRes, spotRes] = await Promise.all([
        fetch(`${LIGHT_API_URL}?action=getAreaSummary`),
        fetch(`${LIGHT_API_URL}?action=getSpotSummary`)
      ]);
      areaRecords = await areaRes.json() || [];
      spotRecords = await spotRes.json() || [];
      applyFilters();
    } catch (err) {
      console.error("Fetch data error:", err);
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading-td text-fail">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
  }

  function updateSummaryCards(allRooms) {
    let pass = 0, fail = 0;
    allRooms.forEach(r => { if (r.isPass) pass++; else fail++; });

    if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = allRooms.length;
    if (document.getElementById('statPass')) document.getElementById('statPass').textContent = pass;
    if (document.getElementById('statFail')) document.getElementById('statFail').textContent = fail;
    if (document.getElementById('homeStatTotal')) document.getElementById('homeStatTotal').textContent = allRooms.length;
    if (document.getElementById('homeStatFail')) document.getElementById('homeStatFail').textContent = fail;
  }

  function updateBuildingTableAndChart(filteredArea) {
    const tbody = document.getElementById('buildingSummaryTbody');
    const canvas = document.getElementById('buildingLightChart');

    const selected = getSelectedBuildings();
    const stats = {};
    selected.forEach(b => { stats[b] = { total: 0, pass: 0, fail: 0 }; });

    const rooms = groupAreaByRoom(filteredArea);
    rooms.forEach(r => {
      if (stats[r.building]) {
        stats[r.building].total++;
        if (r.isPass) stats[r.building].pass++;
        else stats[r.building].fail++;
      }
    });

    const active = selected.filter(b => stats[b].total > 0);

    // 1. อัปเดตตารางสรุป
    if (tbody) {
      if (active.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลในอาคารที่เลือก</td></tr>';
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

    // 2. อัปเดตกราฟ Chart.js
    if (canvas && typeof Chart !== 'undefined') {
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

  function updateRoomTable(filteredRooms) {
    const tbody = document.getElementById('lightTableBody');
    if (!tbody) return;

    if (!filteredRooms || filteredRooms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>';
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

  // -------------------------------------------------------------
  // REPORT 1: PDF รายงานแบบตรวจวัดพื้นที่ (Area Report)
  // -------------------------------------------------------------
  function generateAreaPdfReport(records) {
    const sample = records[0] || {};
    const grouped = {};
    records.forEach(item => {
      const key = `${item.date}_${item.building}_${item.room}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    let rowsHtml = "";
    let idx = 1;

    Object.keys(grouped).forEach(k => {
      const pts = grouped[k];
      const count = pts.length;
      const f = pts[0];
      const isPass = checkIsPass(f);
      const auditTime = `${f.date} ${f.time} น.`;

      pts.forEach((p, i) => {
        const loc = `${p.room}/${p.pointCode || 'r-' + (i+1)}`;
        if (i === 0) {
          rowsHtml += `
            <tr>
              <td rowspan="${count}" style="text-align:center;">${idx++}</td>
              <td rowspan="${count}" style="text-align:center;">${auditTime}</td>
              <td>${loc}</td>
              <td rowspan="${count}">${f.task}</td>
              <td style="text-align:center;">${p.pointLux}</td>
              <td rowspan="${count}" style="text-align:center; font-weight:bold; background:#fafafa;">${f.measuredLux}</td>
              <td rowspan="${count}" style="text-align:center;">${f.minLux || "-"}</td>
              <td rowspan="${count}" style="text-align:center;">${f.standardLux || "-"}</td>
              <td rowspan="${count}" style="text-align:center; font-weight:bold; ${isPass ? 'color:#15803d;' : 'color:#b91c1c;'}">
                ${isPass ? 'ผ่าน' : 'ไม่ผ่าน'}
              </td>
              <td rowspan="${count}">${f.recommendation || "-"}</td>
            </tr>
          `;
        } else {
          rowsHtml += `
            <tr>
              <td>${loc}</td>
              <td style="text-align:center;">${p.pointLux}</td>
            </tr>
          `;
        }
      });
    });

    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>รายงานผลตรวจวัดความเข้มแสงสว่างบนพื้นที่</title>
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; font-family: "TH Sarabun New", "Sarabun", Tahoma, sans-serif; }
          body { margin: 0; padding: 10px; font-size: 11pt; line-height: 1.2; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 10.5pt; }
          th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
          th { background: #f1f5f9; text-align: center; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 25px; padding: 0 40px; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h2 style="margin:0; font-size:16pt;">รายงานผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างบนพื้นที่ (Area Measurement)</h2>
            <div style="font-size:11pt;">กองกายภาพและสิ่งแวดล้อม มหาวิทยาลัยมหิดล • มาตรฐาน ISO 45001</div>
          </div>
          <div style="font-size:10pt;">เครื่องตรวจวัด: ${sample.equipment || 'Lux Meter'} (${sample.serialNo || '-'})</div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width:4%;">ลำดับ</th>
              <th rowspan="2" style="width:14%;">วันเวลาตรวจวัด</th>
              <th rowspan="2" style="width:17%;">สถานที่ (ห้อง/รหัสจุด)</th>
              <th rowspan="2" style="width:16%;">ลักษณะงาน</th>
              <th colspan="2" style="width:14%;">ความเข้มแสง (ลักซ์)</th>
              <th colspan="2" style="width:15%;">มาตรฐานตามกฎหมาย</th>
              <th rowspan="2" style="width:8%;">ผลประเมิน</th>
              <th rowspan="2" style="width:12%;">หมายเหตุ</th>
            </tr>
            <tr>
              <th style="width:7%;">ค่าที่วัดได้</th>
              <th style="width:7%;">ค่าเฉลี่ย</th>
              <th style="width:8%;">จุดต่ำสุด</th>
              <th style="width:7%;">เกณฑ์</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="sig-row">
          <div style="text-align:center; width:300px;">
            <div>ลงชื่อ......................................................</div>
            <div>(......................................................)</div>
            <div>ผู้ดำเนินการตรวจวัด</div>
          </div>
          <div style="text-align:center; width:300px;">
            <div>ลงชื่อ......................................................</div>
            <div>(......................................................)</div>
            <div>ผู้มีอำนาจรับรองผลการตรวจวัด</div>
          </div>
        </div>
      </body>
      </html>
    `;
    printFrameContent(html);
  }

  // -------------------------------------------------------------
  // REPORT 2: PDF รายงานแบบตรวจวัดเฉพาะจุด (Spot Report)
  // -------------------------------------------------------------
  function generateSpotPdfReport(records) {
    const sample = records[0] || {};
    const rowsHtml = records.map((r, i) => {
      const isPass = checkIsPass(r);
      return `
        <tr>
          <td style="text-align:center;">${i+1}</td>
          <td style="text-align:center;">${r.date} ${r.time} น.</td>
          <td><strong>${r.workerName}</strong></td>
          <td>${r.building} (ห้อง ${r.room}) / ${r.task}</td>
          <td style="text-align:center; font-weight:bold;">${r.luxArea1}</td>
          <td style="text-align:center;">${r.luxArea2}</td>
          <td style="text-align:center;">${r.luxArea3}</td>
          <td style="text-align:center;">${r.standardLux}</td>
          <td style="text-align:center; font-weight:bold; ${isPass ? 'color:#15803d;' : 'color:#b91c1c;'}">
            ${isPass ? 'ไม่เกินเกณฑ์' : 'เกินเกณฑ์'}
          </td>
          <td>${r.recommendation}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>รายงานผลตรวจวัดความเข้มแสงสว่างแบบจุด</title>
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; font-family: "TH Sarabun New", "Sarabun", Tahoma, sans-serif; }
          body { margin: 0; padding: 10px; font-size: 11pt; line-height: 1.2; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 10.5pt; }
          th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
          th { background: #f1f5f9; text-align: center; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 25px; padding: 0 40px; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h2 style="margin:0; font-size:16pt;">รายงานผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างแบบจุด (Spot Measurement)</h2>
            <div style="font-size:11pt;">กองกายภาพและสิ่งแวดล้อม มหาวิทยาลัยมหิดล • รูปแบบที่ 4 ตามกฎกระทรวงฯ</div>
          </div>
          <div style="font-size:10pt;">เครื่องตรวจวัด: ${sample.equipment || 'Lux Meter'} (${sample.serialNo || '-'})</div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width:4%;">ลำดับ</th>
              <th rowspan="2" style="width:13%;">วันเวลาตรวจวัด</th>
              <th rowspan="2" style="width:16%;">ชื่อลูกจ้าง (SEG)</th>
              <th rowspan="2" style="width:18%;">สถานที่ / ลักษณะงาน</th>
              <th rowspan="2" style="width:9%;">จุดทำงาน<br>พื้นที่ 1 (ลักซ์)</th>
              <th colspan="2" style="width:14%;">แสงสว่างโดยรอบ (ลักซ์)</th>
              <th rowspan="2" style="width:8%;">เกณฑ์ (Lux)</th>
              <th rowspan="2" style="width:8%;">ผลประเมิน</th>
              <th rowspan="2" style="width:10%;">ข้อเสนอแนะ</th>
            </tr>
            <tr>
              <th style="width:7%;">พื้นที่ 2</th>
              <th style="width:7%;">พื้นที่ 3</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="sig-row">
          <div style="text-align:center; width:300px;">
            <div>ลงชื่อ......................................................</div>
            <div>(......................................................)</div>
            <div>ผู้ดำเนินการตรวจวัด</div>
          </div>
          <div style="text-align:center; width:300px;">
            <div>ลงชื่อ......................................................</div>
            <div>(......................................................)</div>
            <div>ผู้มีอำนาจรับรองผลการตรวจวัด</div>
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