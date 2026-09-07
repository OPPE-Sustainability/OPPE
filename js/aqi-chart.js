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
          borderColor: '#1769E0',                     /* Modern University Blue */
          backgroundColor: 'rgba(23, 105, 224, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 2.5
        },
        {
          label: 'PM2.5 (µg/m³)',
          data: pm25Points,
          borderColor: '#F59E0B',                     /* Amber Warning */
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
          labels: { boxWidth: 12, font: { size: 11, family: 'Plus Jakarta Sans' } }
        } 
      },
      scales: { 
        y: { 
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.04)' }
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

    // อัปเดตในหน้า AQI Detail
    if (document.getElementById('valAqi')) document.getElementById('valAqi').textContent = aqiVal;
    if (document.getElementById('valPm25')) document.getElementById('valPm25').textContent = pm25Val;
    if (document.getElementById('valPm10')) document.getElementById('valPm10').textContent = pm10Val;

    // อัปเดตไปยังหน้า Home Overview
    if (document.getElementById('homeValAqi')) document.getElementById('homeValAqi').textContent = aqiVal;
    if (document.getElementById('homeValPm25')) document.getElementById('homeValPm25').textContent = pm25Val;

    // ประเมินสีและข้อความสถานะตามเกณฑ์เดิม
    let statusText = "";
    let statusBg = "";
    let statusColor = "";

    if (aqiVal <= 25) {
      statusText = "อากาศดีมาก";
      statusBg = "#DCFCE7";
      statusColor = "#16A34A";
    } else if (aqiVal <= 50) {
      statusText = "อากาศดี";
      statusBg = "#DCFCE7";
      statusColor = "#16A34A";
    } else if (aqiVal <= 100) {
      statusText = "ปานกลาง";
      statusBg = "#FEF9C3";
      statusColor = "#CA8A04";
    } else if (aqiVal <= 200) {
      statusText = "เริ่มมีผลกระทบ";
      statusBg = "#FFEDD5";
      statusColor = "#EA580C";
    } else {
      statusText = "มีผลกระทบต่อสุขภาพ";
      statusBg = "#FEE2E2";
      statusColor = "#DC2626";
    }

    const setStatusStyle = (el) => {
      if (!el) return;
      el.textContent = statusText;
      el.style.background = statusBg;
      el.style.color = statusColor;
    };

    setStatusStyle(document.getElementById('lblStatus'));
    setStatusStyle(document.getElementById('homeLblStatus'));

    renderAqiChart(data);

  } catch (error) {
    console.error("ดึงข้อมูลจาก Google Sheets ล้มเหลว:", error);
    if (document.getElementById('lblStatus')) document.getElementById('lblStatus').textContent = "เชื่อมต่อล้มเหลว";
  }
}