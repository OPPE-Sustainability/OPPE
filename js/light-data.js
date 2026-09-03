// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbydEOvHOmfeFkZBb4Wo98ftjblap5Avp42amLV63LPoU4ewjYhh2h9-YdbjV0_0lJvyig/exec";

  let buildingChartInstance = null;
  let rawLightRecords = []; // ตัวแปรเก็บข้อมูลสำหรับ Export

  window.initLightDashboard = function () {
    fetchLightRecords();
    renderBuildingChart();
  };

  // ดักจับการกดปุ่ม Export Excel (.csv)
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#btnExportLightExcel');
    if (!btn) return;

    e.preventDefault();

    if (!rawLightRecords || rawLightRecords.length === 0) {
      alert('ยังไม่มีข้อมูลสำหรับ Export หรือข้อมูลกำลังโหลดอยู่');
      return;
    }

    exportToExcel(rawLightRecords);
  });

  // ฟังก์ชันสร้างและสั่งดาวน์โหลดไฟล์ Excel (.csv) รองรับภาษาไทย 100%
  function exportToExcel(dataList) {
    // กำหนดหัวตารางตามโครงสร้างแบบฟอร์มรายงานของกรมสวัสดิการฯ
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

      // จัดการ Escape เครื่องหมายคำพูดสำหรับ CSV
      const clean = (val) => `"${(val || "-").toString().replace(/"/g, '""')}"`;

      return [
        index + 1,
        clean(item.date),
        clean(item.time || item.timestamp ? (item.time || item.timestamp.toString().substring(11, 16)) : "-"),
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

    // ใส่ BOM (\uFEFF) นำหน้าเพื่อให้ Excel เปิดไฟล์ UTF-8 ภาษาไทยได้ถูกต้อง
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
// ----------------------------------------
  async function renderBuildingChart() {
    const canvas = document.getElementById('buildingLightChart');
    if (!canvas) return;

    try {
      const res = await fetch(`${LIGHT_API_URL}?action=getBuildingStats`);
      const data = await res.json();

      const buildings = Object.keys(data);
      if (buildings.length === 0) return;

      const passData = buildings.map(b => data[b].pass);
      const failData = buildings.map(b => data[b].fail);

      const ctx = canvas.getContext('2d');
      if (buildingChartInstance) {
        buildingChartInstance.destroy();
      }

      buildingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: buildings,
          datasets: [
            {
              label: 'ผ่านเกณฑ์',
              data: passData,
              backgroundColor: '#16A34A',
              borderRadius: 4
            },
            {
              label: 'ต้องปรับปรุง',
              data: failData,
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
    } catch (err) {
      console.error("Error drawing light chart:", err);
    }
  }

  async function fetchLightRecords() {
    const tbody = document.getElementById('lightTableBody');
    if (!tbody) return;

    try {
      const res = await fetch(`${LIGHT_API_URL}?action=getLightSummary`);
      const list = await res.json();

      rawLightRecords = list || []; // บันทึกข้อมูลลงแคชสำหรับ Export

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลในระบบ</td></tr>';
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

    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-td text-fail">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
  }
})();