// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbydEOvHOmfeFkZBb4Wo98ftjblap5Avp42amLV63LPoU4ewjYhh2h9-YdbjV0_0lJvyig/exec";

  // รหัสผ่านเข้าใช้งาน Dashboard (สามารถแก้ไขได้ตามต้องการ)
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
      document.getElementById("lightDashboardGateModal").style.display = "none";
      errorMsg.textContent = "";
      document.getElementById("gatePasscode").value = "";
      window.navigateTo('light');
    } else {
      errorMsg.textContent = "❌ รหัสผ่านไม่ถูกต้อง กรุณาติดต่อกองกายภาพและสิ่งแวดล้อม";
    }
  };

  let buildingChartInstance = null;
  let allLightRecords = []; 
  let isExporting = false;

  window.initLightDashboard = function () {
    fetchLightDashboardData();
    bindFilterEvents();
  };

  function checkIsPass(item) {
    if (!item) return false;
    const evalText = (item.evaluation || "").toString().trim();
    if (evalText === "ผ่าน") return true;
    if (evalText.indexOf("ผ่าน") !== -1 && evalText.indexOf("ไม่ผ่าน") === -1) return true;
    
    const measured = Number(item.measuredLux);
    const standard = Number(item.standardLux);
    if (!isNaN(measured) && !isNaN(standard) && standard > 0) {
      return measured >= standard;
    }
    return false;
  }

  function bindFilterEvents() {
    if (window.__isLightEventsBound) return;
    window.__isLightEventsBound = true;

    document.addEventListener('change', function (e) {
      if (e.target.classList.contains('bld-checkbox') || e.target.id === 'selectEvaluationFilter') {
        applyBuildingFilter();
      }
    });

    document.addEventListener('click', function (e) {
      if (e.target.id === 'btnSelectAllBuildings') {
        e.preventDefault();
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = true);
        applyBuildingFilter();
        return;
      } 
      
      if (e.target.id === 'btnDeselectAllBuildings') {
        e.preventDefault();
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = false);
        applyBuildingFilter();
        return;
      }

      const btnExcel = e.target.closest('#btnExportLightExcel');
      if (btnExcel) {
        e.preventDefault();
        e.stopPropagation();
        if (isExporting) return;

        const filtered = getFilteredRecords();
        if (filtered.length === 0) {
          alert('ไม่พบข้อมูลตามเงื่อนไขตัวกรองสำหรับ Export');
          return;
        }

        isExporting = true;
        try {
          exportToExcel(filtered);
        } finally {
          setTimeout(() => { isExporting = false; }, 1200);
        }
        return;
      }

      const btnPdf = e.target.closest('#btnExportLightPdf');
      if (btnPdf) {
        e.preventDefault();
        e.stopPropagation();
        if (isExporting) return;

        const filtered = getFilteredRecords();
        if (filtered.length === 0) {
          alert('ไม่พบข้อมูลตามเงื่อนไขตัวกรองสำหรับ Export');
          return;
        }

        isExporting = true;
        try {
          generateOfficialPdfReport(filtered);
        } finally {
          setTimeout(() => { isExporting = false; }, 1500);
        }
        return;
      }
    });
  }

  function getSelectedBuildings() {
    const checkboxes = document.querySelectorAll('.bld-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value.trim());
  }

  function getFilteredRecords() {
    const selected = getSelectedBuildings();
    if (selected.length === 0) return [];

    const evalFilterEl = document.getElementById('selectEvaluationFilter');
    const evalFilter = evalFilterEl ? evalFilterEl.value : 'all';

    return allLightRecords.filter(item => {
      const bld = (item.building || "").trim();
      const matchBuilding = selected.includes(bld);
      if (!matchBuilding) return false;

      const isPass = checkIsPass(item);
      if (evalFilter === 'pass') return isPass;
      if (evalFilter === 'fail') return !isPass;
      return true;
    });
  }

  function applyBuildingFilter() {
    const filteredList = getFilteredRecords();
    updateTableAndStats(filteredList);
    updateChartWithFilter(filteredList);
  }

  async function fetchLightDashboardData() {
    const tbody = document.getElementById('lightTableBody');
    try {
      const res = await fetch(`${LIGHT_API_URL}?action=getLightSummary`);
      allLightRecords = await res.json() || [];
      applyBuildingFilter();
    } catch (err) {
      console.error("Fetch light data error:", err);
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading-td text-fail">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
  }

  function updateTableAndStats(list) {
    const tbody = document.getElementById('lightTableBody');
    if (!tbody) return;

    if (document.getElementById('homeStatTotal')) document.getElementById('homeStatTotal').textContent = list.length;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>';
      if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = "0";
      if (document.getElementById('statPass')) document.getElementById('statPass').textContent = "0";
      if (document.getElementById('statFail')) document.getElementById('statFail').textContent = "0";
      if (document.getElementById('homeStatFail')) document.getElementById('homeStatFail').textContent = "0";
      return;
    }

    let pass = 0;
    let fail = 0;

    tbody.innerHTML = list.map(item => {
      const isPass = checkIsPass(item);
      if (isPass) pass++; else fail++;

      const pointInfo = item.workerOrPoint && item.workerOrPoint !== "-" 
        ? `<div class="sub-text">(${item.workerOrPoint})</div>` 
        : "";

      return `
        <tr>
          <td>
            <strong>${item.building || "-"}</strong>
            <div class="sub-text">ห้อง ${item.room || "-"}</div>
          </td>
          <td>
            <div>${item.task || "-"}</div>
            ${pointInfo}
          </td>
          <td>${item.standardLux}</td>
          <td><strong>${item.measuredLux}</strong></td>
          <td>
            <span class="status-tag ${isPass ? 'pass' : 'fail'}">
              ${isPass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = list.length;
    if (document.getElementById('statPass')) document.getElementById('statPass').textContent = pass;
    if (document.getElementById('statFail')) document.getElementById('statFail').textContent = fail;
    if (document.getElementById('homeStatFail')) document.getElementById('homeStatFail').textContent = fail;
  }

  function updateChartWithFilter(filteredList) {
    const canvas = document.getElementById('buildingLightChart');
    if (!canvas) return;

    const selected = getSelectedBuildings();
    const dynamicStats = {};
    selected.forEach(bld => {
      dynamicStats[bld] = { pass: 0, fail: 0 };
    });

    (filteredList || []).forEach(item => {
      const bld = (item.building || "").trim();
      if (dynamicStats[bld]) {
        if (checkIsPass(item)) dynamicStats[bld].pass++;
        else dynamicStats[bld].fail++;
      }
    });

    const buildings = selected.filter(b => (dynamicStats[b].pass + dynamicStats[b].fail) > 0);
    const passData = buildings.map(b => dynamicStats[b].pass);
    const failData = buildings.map(b => dynamicStats[b].fail);

    const ctx = canvas.getContext('2d');
    if (buildingChartInstance) {
      buildingChartInstance.destroy();
    }

    buildingChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buildings.length > 0 ? buildings : ['ไม่มีข้อมูล'],
        datasets: [
          {
            label: 'ผ่านเกณฑ์',
            data: buildings.length > 0 ? passData : [0],
            backgroundColor: '#16A34A',
            borderRadius: 4
          },
          {
            label: 'ต้องปรับปรุง',
            data: buildings.length > 0 ? failData : [0],
            backgroundColor: '#DC2626',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0, stepSize: 1, font: { size: 11 } }, grid: { color: '#f1f5f9' } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  function exportToExcel(dataList) {
    const headers = [
      "ลำดับ", "วัน/เดือน/ปี ที่ตรวจวัด", "เวลาตรวจวัด", "แผนก/ส่วนงาน", "อาคาร", 
      "ห้อง/พื้นที่ตรวจวัด", "ลักษณะงาน/ลักษณะพื้นที่", "ชื่อ-นามสกุลลูกจ้าง (SEG) / จุดตรวจ", 
      "เครื่องมือตรวจวัด (ยี่ห้อ/S/N)", "ค่ามาตรฐานตามเกณฑ์ (Lux)", "ค่าเฉลี่ยที่วัดได้ (Lux)", 
      "ผลการประเมิน", "หมายเหตุ/ข้อเสนอแนะ", "ผู้ตรวจวัด (Email)"
    ];

    const rows = dataList.map((item, index) => {
      const isPass = checkIsPass(item);
      const clean = (val) => `"${(val || "-").toString().replace(/"/g, '""')}"`;

      return [
        index + 1,
        clean(item.date),
        clean(item.time || (item.timestamp ? item.timestamp.toString().substring(11, 16) : "-")),
        clean(item.department),
        clean(item.building),
        clean(item.room),
        clean(item.task),
        clean(item.workerOrPoint),
        clean(item.equipment ? `${item.equipment} (${item.serialNo || '-'})` : "-"),
        item.standardLux || 0,
        item.measuredLux || 0,
        isPass ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์",
        clean(item.recommendation || "-"),
        clean(item.inspectorEmail || "Field Inspector")
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `แบบรายงานผลการตรวจวัดแสงสว่าง_${today}.csv`;
    link.style.display = "none";
    link.onclick = (e) => e.stopPropagation();

    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function generateOfficialPdfReport(dataList) {
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
      return (datePart && timePart) ? `${datePart} / ${timePart}` : (datePart || timePart || "-");
    }

    const sample = dataList[0] || {};
    const equipName = (sample.equipment && sample.equipment !== "-") ? sample.equipment : "Lux Meter (เครื่องตรวจวัดความเข้มของแสงสว่าง)";
    const serialNum = (sample.serialNo && sample.serialNo !== "-") ? sample.serialNo : "-";
    const calibDate = (sample.calDate && sample.calDate !== "-") ? sample.calDate : "-";

    const areaRecords = [];
    const spotRecords = [];

    dataList.forEach(item => {
      const wp = (item.workerOrPoint || "").trim();
      const isSpot = wp && wp !== "-" && !wp.toLowerCase().startsWith("r-") && !wp.toLowerCase().startsWith("e-");
      if (isSpot) spotRecords.push(item);
      else areaRecords.push(item);
    });

    const areaRowsHtml = areaRecords.length > 0 ? areaRecords.map((item, idx) => {
      const isPass = checkIsPass(item);
      const auditTime = formatDateTime(item);
      const dept = item.department || "กองกายภาพและสิ่งแวดล้อม";
      const area = `${item.building || "-"} (ห้อง ${item.room || "-"})`;
      const remark = (item.recommendation && item.recommendation !== "-") ? item.recommendation : "-";

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${dept}</td>
          <td style="text-align:center; white-space:nowrap;">${auditTime}</td>
          <td><strong>${area}</strong></td>
          <td>${item.task || "-"}</td>
          <td style="text-align:center; font-weight:bold;">${item.measuredLux || "0"}</td>
          <td style="text-align:center;">${item.standardLux || "0"}</td>
          <td style="text-align:center; font-weight:bold; ${isPass ? 'color:#15803d;' : 'color:#b91c1c;'}">
            ${isPass ? 'ไม่เกินเกณฑ์' : 'เกินเกณฑ์'}
          </td>
          <td>${remark}</td>
        </tr>
      `;
    }).join("") : '<tr><td colspan="9" style="text-align:center; color:#64748b; padding:12px;">- ไม่มีข้อมูลการตรวจวัดบนพื้นที่ตามเงื่อนไขที่เลือก -</td></tr>';

    const spotRowsHtml = spotRecords.length > 0 ? spotRecords.map((item, idx) => {
      const isPass = checkIsPass(item);
      const auditTime = formatDateTime(item);
      const dept = item.department || "กองกายภาพและสิ่งแวดล้อม";
      const workerName = item.workerOrPoint || "-";
      const areaTask = `${item.building || "-"} / ${item.task || "-"}`;
      const remark = (item.recommendation && item.recommendation !== "-") ? item.recommendation : "-";

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${dept}</td>
          <td style="text-align:center; white-space:nowrap;">${auditTime}</td>
          <td><strong>${workerName}</strong></td>
          <td>${areaTask}</td>
          <td style="text-align:center; font-weight:bold;">${item.measuredLux || "0"}</td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center; font-weight:bold; ${isPass ? 'color:#15803d;' : 'color:#b91c1c;'}">
            ${isPass ? 'ไม่เกินเกณฑ์' : 'เกินเกณฑ์'}
          </td>
          <td>${remark}</td>
        </tr>
      `;
    }).join("") : '<tr><td colspan="10" style="text-align:center; color:#64748b; padding:12px;">- ไม่มีข้อมูลการตรวจวัดแบบจุด (Spot) ตามเงื่อนไขที่เลือก -</td></tr>';

    const evalFilterEl = document.getElementById('selectEvaluationFilter');
    const subtitleFilterText = evalFilterEl && evalFilterEl.value === 'pass'
      ? ' (เฉพาะรายการที่ผ่านเกณฑ์มาตรฐาน)'
      : (evalFilterEl && evalFilterEl.value === 'fail' ? ' (เฉพาะรายการที่ต้องปรับปรุง / ไม่ผ่านเกณฑ์)' : '');

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>รายงานผลการตรวจวัดความเข้มของแสงสว่าง</title>
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; font-family: "TH Sarabun New", "Sarabun", Tahoma, sans-serif; }
          body { margin: 0; padding: 10px; color: #000; background: #fff; font-size: 11pt; line-height: 1.25; }
          .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
          .header-brand-group { display: flex; align-items: center; gap: 14px; }
          .mu-logo { width: 62px; height: 62px; object-fit: contain; }
          .org-title { font-size: 15pt; font-weight: bold; line-height: 1.2; }
          .section-title { font-weight: bold; margin: 8px 0 4px 0; font-size: 12pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5pt; }
          th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
          th { background-color: #f1f5f9; text-align: center; font-weight: bold; }
          .notes-box { margin-top: 8px; font-size: 9.5pt; line-height: 1.35; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 22px; padding: 0 40px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 340px; font-size: 10.5pt; }
          .page-break { page-break-before: always; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="header-brand-group">
            <img src="Mahidol_U.png" alt="Mahidol Logo" class="mu-logo" onerror="this.style.display='none'">
            <div>
              <div class="org-title">รายงานผลตรวจวัดความเข้มแสงสว่าง (Illumination Management Report)${subtitleFilterText}</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <div style="margin-top: 3px;"><strong>2. เครื่องมือที่ใช้ในการตรวจวัด:</strong></div>
          <table>
            <thead>
              <tr>
                <th>เครื่องตรวจวัด</th><th>ยี่ห้อ/รุ่น</th><th>หมายเลขเครื่อง (Serial Number)</th>
                <th>มาตรฐานเครื่องตรวจวัด</th><th>ค่าการปรับศูนย์ (Zeroing)</th><th>ปี/เดือน/วัน (ปรับเทียบ)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center;">เครื่องตรวจวัดความเข้มของแสงสว่าง</td>
                <td style="text-align:center;">${equipName}</td>
                <td style="text-align:center;">${serialNum}</td>
                <td style="text-align:center;">CIE Standard / ISO 45001</td>
                <td style="text-align:center;">0.0 Lux (สมบูรณ์)</td>
                <td style="text-align:center;">${calibDate}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section-title">ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างบนพื้นที่ (Area Measurement)</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 4%;">ลำดับ</th><th rowspan="2" style="width: 14%;">แผนก</th>
              <th rowspan="2" style="width: 12%;">เวลาตรวจวัด</th><th rowspan="2" style="width: 18%;">พื้นที่ตรวจวัด</th>
              <th rowspan="2" style="width: 18%;">ลักษณะงาน</th><th colspan="2" style="width: 14%;">ผลตรวจวัด (ลักซ์)</th>
              <th rowspan="2" style="width: 12%;">ผลการประเมิน</th><th rowspan="2" style="width: 12%;">หมายเหตุ</th>
            </tr>
            <tr>
              <th style="width: 7%;">ค่าที่วัดได้</th><th style="width: 7%;">เกณฑ์มาตรฐาน</th>
            </tr>
          </thead>
          <tbody>
            ${areaRowsHtml}
          </tbody>
        </table>

        <div class="notes-box">
          <strong>หมายเหตุ:</strong>
          <div>1) พื้นที่ตรวจวัดให้แนบแผนผังพื้นที่ที่ดำเนินการตรวจวัด ระบุตำแหน่งดวงไฟ แหล่งแสงธรรมชาติเป็นเอกสารแนบ</div>
          <div>2) ผลการประเมินใช้เกณฑ์มาตรฐานความปลอดภัยตามกฎกระทรวงฯ พ.ศ. 2559</div>
        </div>

        <div class="sig-row">
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">(............................................................................)</div>
            <div>ผู้ดำเนินการตรวจวัดและวิเคราะห์สภาวะการทำงาน</div>
          </div>
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">(............................................................................)</div>
            <div>ผู้บริหาร / ผู้มีอำนาจกระทำการแทน</div>
          </div>
        </div>

        <div class="page-break"></div>

        <div class="report-header">
          <div class="header-brand-group">
            <img src="Mahidol_U.png" alt="Mahidol Logo" class="mu-logo" onerror="this.style.display='none'">
            <div>
              <div class="org-title">รายงานผลตรวจวัดความเข้มแสงสว่าง (Illumination Management Report)${subtitleFilterText}</div>
            </div>
          </div>
        </div>

        <div class="section-title">ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างแบบจุด (Spot Measurement)</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 4%;">ลำดับ</th><th rowspan="2" style="width: 12%;">แผนก</th>
              <th rowspan="2" style="width: 12%;">เวลาตรวจวัด</th><th rowspan="2" style="width: 16%;">ชื่อลูกจ้าง (SEG)</th>
              <th rowspan="2" style="width: 18%;">ลักษณะงาน / พื้นที่</th><th rowspan="2" style="width: 8%;">ค่าที่วัดได้ (ลักซ์)<br>พื้นที่ 1</th>
              <th colspan="2" style="width: 12%;">แสงสว่างโดยรอบ (ลักซ์)</th>
              <th rowspan="2" style="width: 11%;">ผลการประเมิน</th><th rowspan="2" style="width: 11%;">ข้อเสนอแนะ</th>
            </tr>
            <tr>
              <th style="width: 6%;">พื้นที่ 2</th><th style="width: 6%;">พื้นที่ 3</th>
            </tr>
          </thead>
          <tbody>
            ${spotRowsHtml}
          </tbody>
        </table>

        <div class="sig-row">
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">(............................................................................)</div>
            <div>ผู้ดำเนินการตรวจวัดและวิเคราะห์สภาวะการทำงาน</div>
          </div>
          <div class="sig-box">
            <div>ลงชื่อ.....................................................................</div>
            <div style="margin-top: 3px;">(............................................................................)</div>
            <div>ผู้บริหาร / ผู้มีอำนาจกระทำการแทน</div>
          </div>
        </div>
      </body>
      </html>
    `;

    let oldFrame = document.getElementById('pdfPrintFrame');
    if (oldFrame && oldFrame.parentNode) oldFrame.parentNode.removeChild(oldFrame);

    const printFrame = document.createElement('iframe');
    printFrame.id = 'pdfPrintFrame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentDocument || printFrame.contentWindow.document;
    const frameDoc = printFrame.contentWindow || printFrame.contentDocument;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    setTimeout(() => {
      frameDoc.focus();
      frameDoc.print();
    }, 450);
  }

})();