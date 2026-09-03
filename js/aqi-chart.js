let aqiChartInstance = null;

function formatChartTime(item) {
  try {
    if (!item) return '';
    const raw = item.Date_Time_AQI || item.Date_Time_AQI_Unix;
    if (!raw) return '';

    if (typeof raw === 'string' && raw.includes(' ')) {
      const parts = raw.split(' ');
      if (parts[1]) return parts[1].substring(0, 5);
    }

    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  } catch (e) {
    console.error('Time parse error:', e);
  }
  return '';
}

function renderAqiChart(historyData) {
  const canvas = document.getElementById('aqiChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (aqiChartInstance) {
    aqiChartInstance.destroy();
  }

  const labels = historyData.map(item => formatChartTime(item));
  const aqiPoints = historyData.map(item => Number(item.AQI) || 0);
  const pm25Points = historyData.map(item => Number(item.PM_25) || 0);

  aqiChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'AQI',
          data: aqiPoints,
          borderColor: '#1F5A44',                     /* Hijau Songkok */
          backgroundColor: 'rgba(31, 90, 68, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 2.5
        },
        {
          label: 'PM2.5 (µg/m³)',
          data: pm25Points,
          borderColor: '#F2A93B',                     /* Kuning Maghrib */
          borderDash: [4, 4],
          fill: false,
          tension: 0.35,
          pointRadius: 2.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: { 
        legend: { 
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 } }
        } 
      },
      scales: { 
        y: { 
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } }
        }
      }
    }
  });
}

async function loadAirData(gasUrl) {
  try {
    const res = await fetch(gasUrl);
    const data = await res.json();

    if (!data || data.length === 0 || data.error) {
      console.warn("ยังไม่มีข้อมูลสภาพอากาศในชีต หรือเกิดข้อผิดพลาด");
      return;
    }

    const latest = data[data.length - 1];

    const aqiVal = Math.round(Number(latest.AQI));
    const pm25Val = Number(latest.PM_25).toFixed(1);
    const pm10Val = Number(latest.PM_10).toFixed(1);

    document.getElementById('valAqi').textContent = aqiVal;
    document.getElementById('valPm25').textContent = pm25Val;
    document.getElementById('valPm10').textContent = pm10Val;

    const aqiPill = document.getElementById('lblStatus');
    if (aqiVal <= 25) {
      aqiPill.textContent = "อากาศดีมาก";
      aqiPill.style.background = "#E8F5E9";
      aqiPill.style.color = "#2E7D32";
    } else if (aqiVal <= 50) {
      aqiPill.textContent = "อากาศดี";
      aqiPill.style.background = "#E8F5E9";
      aqiPill.style.color = "#2E7D32";
    } else if (aqiVal <= 100) {
      aqiPill.textContent = "ปานกลาง";
      aqiPill.style.background = "#FFFDE7";
      aqiPill.style.color = "#F57F17";
    } else if (aqiVal <= 200) {
      aqiPill.textContent = "เริ่มมีผลกระทบ";
      aqiPill.style.background = "#FFF3E0";
      aqiPill.style.color = "#E65100";
    } else {
      aqiPill.textContent = "มีผลกระทบต่อสุขภาพ";
      aqiPill.style.background = "#FFEBEE";
      aqiPill.style.color = "#C62828";
    }

    renderAqiChart(data);

  } catch (error) {
    console.error("ดึงข้อมูลจาก Google Sheets ล้มเหลว:", error);
    document.getElementById('lblStatus').textContent = "เชื่อมต่อล้มเหลว";
  }
}