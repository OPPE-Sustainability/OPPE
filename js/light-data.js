// js/light-data.js
(function () {
  const LIGHT_API_URL = "https://script.google.com/macros/s/AKfycbydEOvHOmfeFkZBb4Wo98ftjblap5Avp42amLV63LPoU4ewjYhh2h9-YdbjV0_0lJvyig/exec";

  let buildingChartInstance = null;
  let cachedLightRecords = []; // เก็บข้อมูลรายการตรวจวัดสำหรับ export

  window.initLightDashboard = function () {
    fetchLightRecords();
    renderBuildingChart();
    bindExportButton();
  };

  // ผูก Event ให้ปุ่ม Export PDF
  function bindExportButton() {
    const btn = document.getElementById('btnExportLightPdf');
    if (!btn) return;
    
    btn.onclick = () => {
      exportLightDataToPDF(cachedLightRecords);
    };
  }

  async function fetchLightRecords() {
    const tbody = document.getElementById('lightTableBody');
    if (!tbody) return;

    try {
      const res = await fetch(`${LIGHT_API_URL}?action=getLightSummary`);
      const list = await res.json();
      cachedLightRecords = list || []; // เก็บแคชไว้ใช้งานตอน Export

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-td">ไม่พบข้อมูลในระบบ</td></tr>';
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
      tbody.innerHTML = '<tr><td colspan="5" class="loading-td text-fail">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
  }

  // ฟังก์ชันสร้างและดาวน์โหลดไฟล์ PDF
  function exportLightDataToPDF(dataList) {
    if (!dataList || dataList.length === 0) {
      alert("ไม่พบข้อมูลที่จะ Export หรือข้อมูลกำลังโหลดอยู่");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // กำหนดฟอนต์ภาษาไทย (ถ้าโหลด THSarabunNew ไว้)
    const fontName = doc.getFontList()['THSarabunNew'] ? 'THSarabunNew' : 'helvetica';
    doc.setFont(fontName, 'bold');

    // ส่วนหัวเอกสาร (Header)
    doc.setFontSize(18);
    doc.setTextColor(31, 90, 68); // โทนเขียวหลัก (#1F5A44)
    doc.text("รายงานผลการตรวจวัดระดับความเข้มแสงสว่าง (ISO 45001 : 2018)", 14, 18);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text("กองกายภาพและสิ่งแวดล้อม มหาวิทยาลัยมหิดล ศาลายา", 14, 25);
    
    const today = new Date().toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.text(`วันที่ออกเอกสาร: ${today} น.`, 14, 31);

    // เตรียมแถวข้อมูลสำหรับตาราง AutoTable
    const tableRows = dataList.map((item, index) => {
      const isPass = item.evaluation === "ผ่าน" || Number(item.measuredLux) >= Number(item.standardLux);
      const buildingRoom = `${item.building || '-'} (${item.room || '-'})`;
      const task = item.workerOrPoint && item.workerOrPoint !== '-' 
        ? `${item.task || '-'} [${item.workerOrPoint}]` 
        : (item.task || '-');

      return [
        index + 1,
        buildingRoom,
        task,
        item.standardLux || '-',
        item.measuredLux || '-',
        isPass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'
      ];
    });

    // สร้างตารางด้วย AutoTable
    doc.autoTable({
      startY: 36,
      head: [['ลำดับ', 'อาคาร / ห้อง', 'ลักษณะงาน / จุดตรวจ', 'เกณฑ์ (Lux)', 'วัดได้ (Lux)', 'ผลการประเมิน']],
      body: tableRows,
      theme: 'grid',
      styles: {
        font: fontName,
        fontSize: 10.5,
        cellPadding: 2.5,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [31, 90, 68], // #1F5A44
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { cellWidth: 45 },
        2: { cellWidth: 55 },
        3: { halign: 'center', cellWidth: 24 },
        4: { halign: 'center', cellWidth: 24 },
        5: { halign: 'center', cellWidth: 28 }
      },
      didParseCell: function (data) {
        // ไฮไลต์สีข้อความในคอลัมน์สถานะ (ผ่านเกณฑ์ = เขียว, ไม่ผ่าน = แดง)
        if (data.section === 'body' && data.column.index === 5) {
          if (data.cell.raw === 'ผ่านเกณฑ์') {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // ดาวน์โหลดไฟล์ PDF
    const filename = `Light_Measurement_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  }

  // ฟังก์ชัน renderBuildingChart() คงเดิมตามไฟล์เดิม ...
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
            { label: 'ผ่านเกณฑ์', data: passData, backgroundColor: '#16A34A', borderRadius: 4 },
            { label: 'ต้องปรับปรุง', data: failData, backgroundColor: '#DC2626', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' } }
          }
        }
      });
    } catch (err) {
      console.error("Error drawing light chart:", err);
    }
  }

})();