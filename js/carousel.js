// js/carousel.js
(function () {
  window.initCarousel = function () {
    const track = document.getElementById('carouselTrack');
    const container = document.getElementById('carouselContainer');
    const dots = document.querySelectorAll('.dot');

    if (!track || !container) return;

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

    dots.forEach((dot, i) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        updateCarousel(i);
      });
    });

    let startX = 0;
    let startY = 0;
    let currentTranslate = 0;
    let isDragging = false;
    let isHorizontalSwipe = null;

    function onTouchStart(e) {
      if (['INPUT', 'BUTTON', 'A'].includes(e.target.tagName)) return;

      isDragging = true;
      isHorizontalSwipe = null;
      const clientX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

      startX = clientX;
      startY = clientY;
      track.style.transition = 'none';
    }

    function onTouchMove(e) {
      if (!isDragging) return;

      const clientX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

      const diffX = clientX - startX;
      const diffY = clientY - startY;

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
        if (e.cancelable) e.preventDefault();
        currentTranslate = -(currentIndex * container.offsetWidth) + diffX;
        track.style.transform = `translateX(${currentTranslate}px)`;
      }
    }

    function onTouchEnd(e) {
      if (!isDragging) return;
      isDragging = false;

      const endX = e.type.includes('mouse') ? e.pageX : (e.changedTouches ? e.changedTouches[0].clientX : startX);
      const diffX = endX - startX;

      if (isHorizontalSwipe && Math.abs(diffX) > 40) {
        if (diffX < 0) {
          updateCarousel(currentIndex + 1);
        } else {
          updateCarousel(currentIndex - 1);
        }
      } else {
        updateCarousel(currentIndex);
      }
      isHorizontalSwipe = null;
    }

    // Unbind เดิมก่อน Bind ใหม่ป้องกัน Event ซ้อน
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchEnd);
    container.removeEventListener('mousedown', onTouchStart);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    container.addEventListener('mousedown', onTouchStart);
    window.addEventListener('mousemove', onTouchMove);
    window.addEventListener('mouseup', onTouchEnd);
  };

  // เรียกทำงานทันทีหาก DOM ของหน้าพร้อมอยู่แล้ว
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.initCarousel();
  }
})();