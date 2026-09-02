// js/carousel.js
document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('carouselTrack');
  const container = document.getElementById('carouselContainer');
  const dots = document.querySelectorAll('.dot');
  
  if (!track || !container) {
    console.error("ไม่พบอิลิเมนต์ Carousel ใน DOM");
    return;
  }

  let currentIndex = 0;
  const totalSlides = 2;

  function updateCarousel(index, smooth = true) {
    track.style.transition = smooth ? 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
    currentIndex = (index + totalSlides) % totalSlides;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  // กดที่จุด Dots เพื่อเปลี่ยนหน้า
  dots.forEach((dot, i) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      updateCarousel(i);
    });
  });

  // ตัวแปรจับพิกัด
  let startX = 0;
  let startY = 0;
  let currentTranslate = 0;
  let isDragging = false;
  let isHorizontalSwipe = null; // เช็กว่าเป็นการปัดแนวนอนหรือแนวตั้ง

  // 1. แตะหน้าจอ / คลิกเมาส์
  function onTouchStart(e) {
    // ยกเว้นเมื่อผู้ใช้แตะในช่องกรอกข้อมูล หรือกดปุ่ม
    if (['INPUT', 'BUTTON', 'A'].includes(e.target.tagName)) return;

    isDragging = true;
    isHorizontalSwipe = null;
    const clientX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

    startX = clientX;
    startY = clientY;
    track.style.transition = 'none';
  }

  // 2. ลากนิ้ว
  function onTouchMove(e) {
    if (!isDragging) return;

    const clientX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

    const diffX = clientX - startX;
    const diffY = clientY - startY;

    // ตรวจสอบทิศทางในการขยับครั้งแรก (ถ้าเลื่อนขึ้นลง ให้ปล่อยจอเลื่อนตามปกติ ไม่บล็อกหน้าเว็บ)
    if (isHorizontalSwipe === null) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
        isHorizontalSwipe = true;
      } else if (Math.abs(diffY) > 8) {
        isHorizontalSwipe = false;
        isDragging = false;
        return;
      }
    }

    if (isHorizontalSwipe) {
      if (e.cancelable) e.preventDefault(); // ป้องกันหน้าเพจขยับขณะปัดการ์ด
      currentTranslate = -(currentIndex * container.offsetWidth) + diffX;
      track.style.transform = `translateX(${currentTranslate}px)`;
    }
  }

  // 3. ปล่อยนิ้ว / ยกเมาส์
  function onTouchEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    const endX = e.type.includes('mouse') ? e.pageX : (e.changedTouches ? e.changedTouches[0].clientX : startX);
    const diffX = endX - startX;

    // ถ้าปัดเกิน 40px ให้เปลี่ยนหน้า
    if (isHorizontalSwipe && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        updateCarousel(currentIndex + 1); // ปัดซ้าย -> หน้าถัดไป
      } else {
        updateCarousel(currentIndex - 1); // ปัดขวา -> หน้าก่อนหน้า
      }
    } else {
      updateCarousel(currentIndex); // ปัดไม่พอ -> ดีดกลับที่เดิม
    }
    isHorizontalSwipe = null;
  }

  // ผูก Event ฝั่ง Touch
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd);
  container.addEventListener('touchcancel', onTouchEnd);

  // ผูก Event ฝั่ง Mouse
  container.addEventListener('mousedown', onTouchStart);
  window.addEventListener('mousemove', onTouchMove);
  window.addEventListener('mouseup', onTouchEnd);
});