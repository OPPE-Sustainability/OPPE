// js/light-data.js
(function () {
  const modal = document.getElementById('lightModal');
  const btnOpen = document.getElementById('btnOpenLightModal');
  const btnClose = document.getElementById('btnCloseLightModal');
  const tbody = document.getElementById('lightTableBody');

  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbydEOvHOmfeFkZBb4Wo98ftjblap5Avp42amLV63LPoU4ewjYhh2h9-YdbjV0_0lJvyig/exec";

  let buildingChartInstance = null;

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener('click', () => {
    modal.classList.add('active');
    setTimeout(() => {
      fetchLightRecords();
      renderBuildingChart();
    }, 150);
  });

  if (btnClose) {
    btnClose.addEventListener('click', () => modal.classList.remove('active'));
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

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
      if (buildingChartInstance) buildingChartInstance.destroy();

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
              label: 'ไม่ผ่านเกณฑ์',
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
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0, stepSize: 1 } }
          },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            title: {
              display: true,
              text: 'สรุปผลตรวจวัดระดับแสงสว่างแยกตามอาคาร (ISO 45001)',
              font: { size: 12, weight: 'bold' }
            }
          }
        }
      });
    } catch (err) {
      console.error("ไม่สามารถวาดกราฟได้:", err);
    }
  }

  async function fetchLightRecords() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#64748b;">กำลังโหลดข้อมูลล่าสุด...</td></tr>';

    try {
      const res = await fetch(`${LIGHT_API_URL}?action=getLightSummary`);
      const list = await res.json();

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#64748b;">ไม่พบข้อมูลบันทึกในระบบ</td></tr>';
        return;
      }

      let pass = 0;
      let fail = 0;

      tbody.innerHTML = list.map(item => {
        const isPass = item.evaluation === "ผ่าน" || Number(item.measuredLux) >= Number(item.standardLux);
        if (isPass) pass++; else fail++;

        const pointInfo = item.workerOrPoint && item.workerOrPoint !== "-" 
          ? `<span style="font-size:10px; color:#0288D1;">(${item.workerOrPoint})</span>` 
          : "";

        return `
          <tr>
            <td>
              <strong>${item.building || "-"}</strong><br>
              <span style="color:#64748b;">ห้อง ${item.room || "-"}</span>
            </td>
            <td style="max-width: 120px; font-size: 11px;">
              <div>${item.task || "-"}</div>
              ${pointInfo}
            </td>
            <td>${item.standardLux}</td>
            <td><strong>${item.measuredLux}</strong></td>
            <td>
              <span class="status-tag ${isPass ? 'pass' : 'fail'}">
                ${isPass ? 'ผ่าน' : 'ไม่ผ่าน'}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = list.length;
      if (document.getElementById('statPass')) document.getElementById('statPass').textContent = pass;
      if (document.getElementById('statFail')) document.getElementById('statFail').textContent = fail;

    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:15px;">โหลดตารางข้อมูลไม่สำเร็จ</td></tr>';
    }
  }
})();