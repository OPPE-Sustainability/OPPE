const track = document.getElementById('carouselTrack');
const container = document.getElementById('carouselContainer');
const dots = document.querySelectorAll('.dot');
let currentIndex = 0;
const totalSlides = 2;

function updateCarousel(index, smooth = true) {
  track.style.transition = smooth ? 'transform 0.35s ease-out' : 'none';
  currentIndex = (index + totalSlides) % totalSlides;
  track.style.transform = `translateX(-${currentIndex * 100}%)`;
  
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}

dots.forEach((dot, i) => {
  dot.addEventListener('click', () => updateCarousel(i));
});

let startX = 0;
let currentTranslate = 0;
let isDragging = false;

container.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  isDragging = true;
}, { passive: true });

container.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const moveX = e.touches[0].clientX;
  const diff = moveX - startX;
  currentTranslate = -(currentIndex * container.offsetWidth) + diff;
  track.style.transition = 'none';
  track.style.transform = `translateX(${currentTranslate}px)`;
}, { passive: true });

container.addEventListener('touchend', (e) => {
  if (!isDragging) return;
  isDragging = false;
  const endX = e.changedTouches[0].clientX;
  const diff = endX - startX;

  if (Math.abs(diff) > 40) {
    if (diff > 0) {
      updateCarousel(currentIndex - 1);
    } else {
      updateCarousel(currentIndex + 1);
    }
  } else {
    updateCarousel(currentIndex);
  }
});