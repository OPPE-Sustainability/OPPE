// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbydEOvHOmfeFkZBb4Wo98ftjblap5Avp42amLV63LPoU4ewjYhh2h9-YdbjV0_0lJvyig/exec";

  let buildingChartInstance = null;
  let allLightRecords = []; // ข้อมูลทั้งหมดจาก Sheet
  let allBuildingStats = {}; // สถิติภาพรวมจาก Sheet

  window.initLightDashboard = function () {
    fetchLightDashboardData();
    bindFilterEvents();
  };

  // ดักจับ Event ปุ่มกรองอาคาร และปุ่ม Export
  function bindFilterEvents() {
    // 1. ติ๊ก Checkbox รายอาคาร
    document.addEventListener('change', function (e) {
      if (e.target.classList.contains('bld-checkbox')) {
        applyBuildingFilter();
      }
    });

    // 2. ปุ่มเลือกทั้งหมด
    document.addEventListener('click', function (e) {
      if (e.target.id === 'btnSelectAllBuildings') {
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = true);
        applyBuildingFilter();
      } else if (e.target.id === 'btnDeselectAllBuildings') {
        document.querySelectorAll('.bld-checkbox').forEach(cb => cb.checked = false);
        applyBuildingFilter();
      }
    });

    // 3. ปุ่ม Export Excel (.csv)
    document.addEventListener('click', function (e) {
      const btnExcel = e.target.closest('#btnExportLightExcel');
      if (btnExcel) {
        e.preventDefault();
        const filtered = getFilteredRecords();
        if (filtered.length === 0) {
          alert('กรุณาเลือกอาคารอย่างน้อย 1 อาคาร หรือยังไม่มีข้อมูลสำหรับ Export');
          return;
        }
        exportToExcel(filtered);
      }
    });

    // 4. ปุ่ม Export PDF (ตามแบบฟอร์มทางการ .docx)
    document.addEventListener('click', function (e) {
      const btnPdf = e.target.closest('#btnExportLightPdf');
      if (btnPdf) {
        e.preventDefault();
        const filtered = getFilteredRecords();
        if (filtered.length === 0) {
          alert('กรุณาเลือกอาคารอย่างน้อย 1 อาคาร หรือยังไม่มีข้อมูลสำหรับ Export');
          return;
        }
        generateOfficialPdfReport(filtered);
      }
    });
  }

  // ดึงรายชื่ออาคารที่ถูกติ๊กเลือกอยู่
  function getSelectedBuildings() {
    const checkboxes = document.querySelectorAll('.bld-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value.trim());
  }

  // กรองชุดข้อมูลตามอาคารที่เลือก
  function getFilteredRecords() {
    const selected = getSelectedBuildings();
    if (selected.length === 0) return [];
    return allLightRecords.filter(item => {
      const bld = (item.building || "").trim();
      return selected.includes(bld);
    });
  }

  // ใช้ตัวกรองอัปเดต ตาราง, สถิติ และกราฟ พร้อมกัน
  function applyBuildingFilter() {
    const filteredList = getFilteredRecords();
    updateTableAndStats(filteredList);
    updateChartWithFilter();
  }

  async function fetchLightDashboardData() {
    const tbody = document.getElementById('lightTableBody');
    try {
      // ดึงทั้งข้อมูลตารางและสถิติกราฟพร้อมกัน
      const [summaryRes, statsRes] = await Promise.all([
        fetch(`${LIGHT_API_URL}?action=getLightSummary`),
        fetch(`${LIGHT_API_URL}?action=getBuildingStats`)
      ]);

      allLightRecords = await summaryRes.json() || [];
      allBuildingStats = await statsRes.json() || {};

      applyBuildingFilter();
    } catch (err) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading-td text-fail">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
  }

  function updateTableAndStats(list) {
    const tbody = document.getElementById('lightTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลตามอาคารที่เลือก</td></tr>';
      if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = "0";
      if (document.getElementById('statPass')) document.getElementById('statPass').textContent = "0";
      if (document.getElementById('statFail')) document.getElementById('statFail').textContent = "0";
      return;
    }

    let pass = 0;
    let fail = 0;

    tbody.innerHTML = list.map(item => {
      const isPass = item.evaluation === "ผ่าน" || 
                     (item.evaluation && item.evaluation.indexOf("ผ่าน") !== -1 && item.evaluation.indexOf("ไม่ผ่าน") === -1) || 
                     Number(item.measuredLux) >= Number(item.standardLux);
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
  }

  function updateChartWithFilter() {
    const canvas = document.getElementById('buildingLightChart');
    if (!canvas) return;

    const selected = getSelectedBuildings();
    // กรองเฉพาะอาคารที่เลือกและมีในฐานข้อมูล
    const buildings = Object.keys(allBuildingStats).filter(b => selected.includes(b));

    const passData = buildings.map(b => allBuildingStats[b].pass);
    const failData = buildings.map(b => allBuildingStats[b].fail);

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
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { precision: 0, stepSize: 1, font: { size: 11 } },
            grid: { color: '#f1f5f9' }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  }

  // Export Excel (.csv)
  function exportToExcel(dataList) {
    const headers = [
      "ลำดับ",
      "วัน/เดือน/ปี ที่ตรวจวัด",
      "เวลาตรวจวัด",
      "แผนก/ส่วนงาน",
      "อาคาร",
      "ห้อง/พื้นที่ตรวจวัด",
      "ลักษณะงาน/ลักษณะพื้นที่",
      "ชื่อ-นามสกุลลูกจ้าง (SEG) / จุดตรวจ",
      "เครื่องมือตรวจวัด (ยี่ห้อ/S/N)",
      "ค่ามาตรฐานตามเกณฑ์ (Lux)",
      "ค่าเฉลี่ยที่วัดได้ (Lux)",
      "ผลการประเมิน",
      "ข้อเสนอแนะและวิธีการปรับปรุงแก้ไข"
    ];

    const rows = dataList.map((item, index) => {
      const isPass = item.evaluation === "ผ่าน" || 
                     (item.evaluation && item.evaluation.indexOf("ผ่าน") !== -1 && item.evaluation.indexOf("ไม่ผ่าน") === -1) || 
                     Number(item.measuredLux) >= Number(item.standardLux);

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
        clean(item.recommendation || "-")
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `แบบรายงานผลการตรวจวัดแสงสว่าง_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // สร้างไฟล์ PDF ตามแม่แบบ .docx (จัดเลย์เอาต์ Area & Spot Measurement ครบถ้วน)
// ฟังก์ชันสร้างหน้ารายงานทางการ A4 แนวนอน พร้อมโลโก้ และสั่งพิมพ์/บันทึก PDF ผ่าน Iframe
  function generateOfficialPdfReport(dataList) {
    const sample = dataList[0] || {};
    const auditDate = sample.date || new Date().toLocaleDateString('th-TH');
    const equipName = (sample.equipment && sample.equipment !== "-") ? sample.equipment : "Lux Meter (เครื่องตรวจวัดความเข้มของแสงสว่าง)";
    const serialNum = (sample.serialNo && sample.serialNo !== "-") ? sample.serialNo : "-";
    const calibDate = (sample.calDate && sample.calDate !== "-") ? sample.calDate : "-";
    const reportDate = new Date().toLocaleDateString('th-TH');

    // แยกข้อมูลเป็นกลุ่ม Area และ Spot
    const areaRecords = [];
    const spotRecords = [];

    dataList.forEach(item => {
      const wp = (item.workerOrPoint || "").trim();
      const isSpot = wp && wp !== "-" && !wp.toLowerCase().startsWith("r-") && !wp.toLowerCase().startsWith("e-");
      if (isSpot) {
        spotRecords.push(item);
      } else {
        areaRecords.push(item);
      }
    });

    // 1. แถวตาราง Area Measurement
    const areaRowsHtml = areaRecords.length > 0 ? areaRecords.map((item, idx) => {
      const isPass = item.evaluation === "ผ่าน" || 
                     (item.evaluation && item.evaluation.indexOf("ผ่าน") !== -1 && item.evaluation.indexOf("ไม่ผ่าน") === -1) || 
                     Number(item.measuredLux) >= Number(item.standardLux);
      const auditTime = item.time || (item.timestamp ? item.timestamp.toString().substring(11, 16) : "-");
      const dept = item.department || "กองกายภาพและสิ่งแวดล้อม";
      const area = `${item.building || "-"} (ห้อง ${item.room || "-"})`;
      const remark = (item.recommendation && item.recommendation !== "-") ? item.recommendation : "-";

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${dept}</td>
          <td style="text-align:center;">${auditTime}</td>
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
    }).join("") : '<tr><td colspan="9" style="text-align:center; color:#64748b; padding:12px;">- ไม่มีข้อมูลการตรวจวัดบนพื้นที่ในอาคารที่เลือก -</td></tr>';

    // 2. แถวตาราง Spot Measurement
    const spotRowsHtml = spotRecords.length > 0 ? spotRecords.map((item, idx) => {
      const isPass = item.evaluation === "ผ่าน" || 
                     (item.evaluation && item.evaluation.indexOf("ผ่าน") !== -1 && item.evaluation.indexOf("ไม่ผ่าน") === -1) || 
                     Number(item.measuredLux) >= Number(item.standardLux);
      const auditTime = item.time || (item.timestamp ? item.timestamp.toString().substring(11, 16) : "-");
      const dept = item.department || "กองกายภาพและสิ่งแวดล้อม";
      const workerName = item.workerOrPoint || "-";
      const areaTask = `${item.building || "-"} / ${item.task || "-"}`;
      const remark = (item.recommendation && item.recommendation !== "-") ? item.recommendation : "-";

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${dept}</td>
          <td style="text-align:center;">${auditTime}</td>
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
    }).join("") : '<tr><td colspan="10" style="text-align:center; color:#64748b; padding:12px;">- ไม่มีข้อมูลการตรวจวัดแบบจุด (Spot) ในอาคารที่เลือก -</td></tr>';

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>รายงานผลการตรวจวัดความเข้มของแสงสว่าง (Illumination Management Report)</title>
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; font-family: "TH Sarabun New", "Sarabun", Tahoma, sans-serif; }
          body { margin: 0; padding: 10px; color: #000; background: #fff; font-size: 11pt; line-height: 1.25; }
          
          .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
          .header-brand-group { display: flex; align-items: center; gap: 14px; }
          .mu-logo { width: 62px; height: 62px; object-fit: contain; }
          .org-title { font-size: 15pt; font-weight: bold; line-height: 1.2; }
          .sub-title { font-size: 13pt; font-weight: bold; margin-top: 2px; color: #1F5A44; }
          .meta-info { text-align: right; font-size: 11pt; }

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
        <!-- หัวเอกสาร หน้า 1 (Area Measurement) -->
        <div class="report-header">
          <div class="header-brand-group">
            <img src="Mahidol_U.png" alt="Mahidol Logo" class="mu-logo" onerror="this.style.display='none'">
            <div>
              <div class="org-title">กองกายภาพและสิ่งแวดล้อม มหาวิทยาลัยมหิดล ศาลายา</div>
              <div class="sub-title">รายงานผลการตรวจวัดความเข้มของแสงสว่าง (Illumination Management Report)</div>
            </div>
          </div>
          <div class="meta-info">
            <div>ฉบับที่: 01</div>
            <div>วันที่รายงานผล: ${reportDate}</div>
          </div>
        </div>

        <!-- 1. วันที่ และ 2. เครื่องมือ -->
        <div style="margin-bottom: 8px;">
          <div><strong>1. วัน เดือน ปี ที่ตรวจวัด:</strong> ${auditDate}</div>
          <div style="margin-top: 3px;"><strong>2. เครื่องมือที่ใช้ในการตรวจวัด:</strong></div>
          <table>
            <thead>
              <tr>
                <th>เครื่องตรวจวัด</th>
                <th>ยี่ห้อ/รุ่น</th>
                <th>หมายเลขเครื่อง (Serial Number)</th>
                <th>มาตรฐานเครื่องตรวจวัด</th>
                <th>ค่าการปรับศูนย์ (Zeroing) ณ วันที่ตรวจวัด</th>
                <th>วัน/เดือน/ปี (ปรับเทียบความถูกต้อง)</th>
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

        <!-- 3. ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างบนพื้นที่ (Area Measurement) -->
        <div class="section-title">ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างบนพื้นที่ (Area Measurement)</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 4%;">ลำดับ</th>
              <th rowspan="2" style="width: 14%;">แผนก</th>
              <th rowspan="2" style="width: 8%;">เวลาตรวจวัด</th>
              <th rowspan="2" style="width: 18%;">พื้นที่ตรวจวัด</th>
              <th rowspan="2" style="width: 18%;">ลักษณะงาน</th>
              <th colspan="2" style="width: 14%;">ผลตรวจวัด (ลักซ์)</th>
              <th rowspan="2" style="width: 12%;">ผลการประเมิน</th>
              <th rowspan="2" style="width: 12%;">ข้อเสนอแนะและวิธีปรับปรุง</th>
            </tr>
            <tr>
              <th style="width: 7%;">ค่าที่วัดได้</th>
              <th style="width: 7%;">เกณฑ์มาตรฐาน</th>
            </tr>
          </thead>
          <tbody>
            ${areaRowsHtml}
          </tbody>
        </table>

        <!-- หมายเหตุและลงนามของส่วน Area -->
        <div class="notes-box">
          <strong>หมายเหตุ:</strong>
          <div>1) พื้นที่ตรวจวัดให้แนบแผนผังพื้นที่ที่ดำเนินการตรวจวัด ระบุตำแหน่งดวงไฟ แหล่งแสงธรรมชาติเป็นเอกสารแนบ</div>
          <div>2) ผลการประเมินใช้เกณฑ์มาตรฐานความปลอดภัยตามกฎกระทรวง กำหนดมาตรฐานในการบริหาร จัดการ และดำเนินการด้านความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงานเกี่ยวกับความร้อน แสงสว่าง และเสียง พ.ศ. 2559</div>
          <div>3) กรณีผลการประเมินเป็นไปตามเกณฑ์แต่แสงสว่างมีผลกระทบต่อการปฏิบัติงานของลูกจ้าง และกรณีไม่เป็นไปตามเกณฑ์มาตรฐาน ให้ระบุข้อเสนอแนะและวิธีการปรับปรุงแก้ไข</div>
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

        <!-- หน้าที่ 2: ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างแบบจุด (Spot Measurement) -->
        <div class="page-break"></div>

        <!-- หัวเอกสาร หน้า 2 -->
        <div class="report-header">
          <div class="header-brand-group">
            <img src="Mahidol_U.png" alt="Mahidol Logo" class="mu-logo" onerror="this.style.display='none'">
            <div>
              <div class="org-title">กองกายภาพและสิ่งแวดล้อม มหาวิทยาลัยมหิดล ศาลายา</div>
              <div class="sub-title">รายงานผลการตรวจวัดความเข้มของแสงสว่าง (Illumination Management Report)</div>
            </div>
          </div>
          <div class="meta-info">
            <div>ฉบับที่: 01</div>
            <div>วันที่รายงานผล: ${reportDate}</div>
          </div>
        </div>

        <div class="section-title">ผลการตรวจวัดสภาวะการทำงานเกี่ยวกับแสงสว่างแบบจุด (Spot Measurement)</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 4%;">ลำดับ</th>
              <th rowspan="2" style="width: 12%;">แผนก</th>
              <th rowspan="2" style="width: 8%;">เวลาตรวจวัด</th>
              <th rowspan="2" style="width: 16%;">ชื่อ-นามสกุลของลูกจ้าง (SEG)</th>
              <th rowspan="2" style="width: 18%;">ลักษณะงาน / พื้นที่</th>
              <th rowspan="2" style="width: 8%;">ค่าที่วัดได้ (ลักซ์)<br>พื้นที่ 1</th>
              <th colspan="2" style="width: 12%;">แสงสว่างโดยรอบ (ลักซ์)</th>
              <th rowspan="2" style="width: 11%;">ผลการประเมิน</th>
              <th rowspan="2" style="width: 11%;">ข้อเสนอแนะและวิธีปรับปรุง</th>
            </tr>
            <tr>
              <th style="width: 6%;">พื้นที่ 2</th>
              <th style="width: 6%;">พื้นที่ 3</th>
            </tr>
          </thead>
          <tbody>
            ${spotRowsHtml}
          </tbody>
        </table>

        <!-- หมายเหตุและลงนามของส่วน Spot -->
        <div class="notes-box">
          <strong>หมายเหตุ:</strong>
          <div>1) พื้นที่ตรวจวัดให้แนบแผนผังพื้นที่ที่ดำเนินการตรวจวัด ระบุตำแหน่งดวงไฟ แหล่งแสงธรรมชาติเป็นเอกสารแนบ</div>
          <div>2) ค่าความเข้มของแสงสว่างบริเวณพื้นที่โดยรอบ กรณีความเข้มของแสงสว่างในบริเวณใช้สายตามองเฉพาะจุด (พื้นที่ 1) มีความเข้มของแสงสว่างตั้งแต่ 1,000 ลักซ์</div>
          <div>3) ผลการประเมินใช้เกณฑ์มาตรฐานความปลอดภัยตามประกาศกรมสวัสดิการและคุ้มครองแรงงาน เรื่อง มาตรฐานความเข้มของแสงสว่าง ลงวันที่ 27 พฤศจิกายน พ.ศ. 2560 ข้อ 4</div>
          <div>4) กรณีผลการประเมินเป็นไปตามเกณฑ์แต่แสงสว่างมีผลกระทบต่อการปฏิบัติงานของลูกจ้าง และกรณีไม่เป็นไปตามเกณฑ์มาตรฐาน ให้ระบุข้อเสนอแนะและวิธีการปรับปรุงแก้ไข</div>
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

      </body>
      </html>
    `;

    // สั่ง Print ผ่าน Hidden Iframe
    let printFrame = document.getElementById('pdfPrintFrame');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'pdfPrintFrame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow || printFrame.contentDocument;
    const doc = printFrame.contentDocument || printFrame.contentWindow.document;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    setTimeout(() => {
      frameDoc.focus();
      frameDoc.print();
    }, 450);
  }

})();