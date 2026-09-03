// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbydEOvHOmfeFkZBb4Wo98ftjblap5Avp42amLV63LPoU4ewjYhh2h9-YdbjV0_0lJvyig/exec";

  let buildingChartInstance = null;

  window.initLightDashboard = function () {
    fetchLightRecords();
    renderBuildingChart();
    bindExportPdfButton();
  };

  function bindExportPdfButton() {
    const btn = document.getElementById('btnExportLightPdf');
    if (!btn) return;

    btn.onclick = function () {
      const tableBody = document.getElementById('lightTableBody');
      if (!tableBody || tableBody.innerHTML.includes('กำลังโหลด') || tableBody.innerHTML.includes('ไม่สำเร็จ')) {
        alert('กรุณารอข้อมูลโหลดให้เสร็จสิ้นก่อนกด Export');
        return;
      }

      const total = document.getElementById('statTotal') ? document.getElementById('statTotal').textContent : '-';
      const pass = document.getElementById('statPass') ? document.getElementById('statPass').textContent : '-';
      const fail = document.getElementById('statFail') ? document.getElementById('statFail').textContent : '-';
      const now = new Date().toLocaleString('th-TH');

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="utf-8">
          <title>รายงานผลการตรวจวัดระดับความเข้มแสงสว่าง</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 10mm; }
            * { box-sizing: border-box; font-family: 'Sarabun', -apple-system, Tahoma, sans-serif; }
            body { margin: 0; padding: 20px; color: #1e293b; }
            .header { border-bottom: 2px solid #1F5A44; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title h2 { margin: 0 0 4px 0; color: #1F5A44; font-size: 18px; }
            .title p { margin: 0; color: #64748b; font-size: 13px; }
            .meta { font-size: 12px; color: #64748b; text-align: right; }
            .stat-row { display: flex; gap: 10px; margin-bottom: 16px; }
            .stat-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; text-align: center; }
            .stat-box .num { font-size: 16px; font-weight: bold; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
            th { background-color: #1F5A44; color: #fff; border: 1px solid #1F5A44; padding: 8px; text-align: center; }
            td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: middle; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .sub-text { font-size: 11px; color: #64748b; }
            .status-tag.pass { color: #15803d; font-weight: bold; }
            .status-tag.fail { color: #b91c1c; font-weight: bold; }
            .action-bar { margin-bottom: 15px; background: #f1f5f9; padding: 10px 15px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
            .btn-print { background: #1F5A44; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
            @media print { .action-bar { display: none !important; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="action-bar">
            <div><strong>💡 บันทึกผลการตรวจวัดแสงสว่าง</strong></div>
            <button class="btn-print" onclick="window.print()">🖨️ บันทึกเป็น PDF / พิมพ์</button>
          </div>
          <div class="header">
            <div class="title">
              <h2>รายงานผลการตรวจวัดระดับความเข้มแสงสว่าง (ISO 45001 : 2018)</h2>
              <p>กองกายภาพและสิ่งแวดล้อม มหาวิทยาลัยมหิดล ศาลายา</p>
            </div>
            <div class="meta">ออกเอกสารเมื่อ: ${now} น.</div>
          </div>
          <div class="stat-row">
            <div class="stat-box">จุดตรวจทั้งหมด<div class="num">${total} จุด</div></div>
            <div class="stat-box" style="background:#f0fdf4;">ผ่านเกณฑ์<div class="num" style="color:#15803d;">${pass} จุด</div></div>
            <div class="stat-box" style="background:#fef2f2;">ต้องปรับปรุง<div class="num" style="color:#b91c1c;">${fail} จุด</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">อาคาร / ห้อง</th>
                <th style="width: 35%;">ลักษณะงาน</th>
                <th style="width: 12%;">เกณฑ์ (Lux)</th>
                <th style="width: 14%;">วัดได้ (Lux)</th>
                <th style="width: 14%;">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${tableBody.innerHTML}
            </tbody>
          </table>
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() { window.print(); }, 400);
            });
          <\/script>
        </body>
        </html>
      `);
      printWindow.document.close();
    };
  }

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

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลในระบบ</td></tr>';
        return;
      }

      let pass = 0;
      let fail = 0;

      tbody.innerHTML = list.map(item => {
        const isPass = item.evaluation === "ผ่าน" || (item.evaluation && item.evaluation.indexOf("ผ่าน") !== -1 && item.evaluation.indexOf("ไม่ผ่าน") === -1) || Number(item.measuredLux) >= Number(item.standardLux);
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