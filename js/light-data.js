// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbydEOvHOmfeFkZBb4Wo98ftjblap5Avp42amLV63LPoU4ewjYhh2h9-YdbjV0_0lJvyig/exec";

  let buildingChartInstance = null;
  let isFetched = false;

  // เปิดให้เรียกจากภายนอกเมื่อสลับแท็บมาที่หน้าตรวจวัดแสง
  window.initLightDashboard = function () {
    if (isFetched) return;
    fetchLightRecords();
    renderBuildingChart();
    isFetched = true;
  };

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
              ticks: { font: { size: 11, family: 'inherit' } }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              ticks: { precision: 0, stepSize: 1, font: { size: 11, family: 'inherit' } },
              grid: { color: '#f1f5f9' }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { boxWidth: 12, font: { size: 11, family: 'inherit' } }
            },
            title: {
              display: false
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
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลตรวจวัดในฐานข้อมูล</td></tr>';
        return;
      }

      let pass = 0;
      let fail = 0;

      tbody.innerHTML = list.map(item => {
        const isPass = item.evaluation === "ผ่าน" || Number(item.measuredLux) >= Number(item.standardLux);
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
      tbody.innerHTML = '<tr><td colspan="5" class="loading-td text-fail">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
  }
})();