const offsets = { BRT: -3, EST: -5, CET: 1 };

function convertTime(timeStr, fromTz, toTz) {
  const [h, m] = timeStr.split(':').map(Number);
  let utc = h - offsets[fromTz];
  let target = utc + offsets[toTz];
  if (target < 0) target += 24;
  if (target >= 24) target -= 24;
  return `${target.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function updateTimes(tz) {
  document.querySelectorAll('td[data-time]').forEach(td => {
    td.textContent = convertTime(td.dataset.time, 'BRT', tz);
  });
  document.querySelectorAll('.tz-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tz-btn[data-tz="${tz}"]`).classList.add('active');
}

document.querySelectorAll('.tz-btn').forEach(btn => {
  btn.addEventListener('click', () => updateTimes(btn.dataset.tz));
});

// Set default timezone
updateTimes('BRT');

// Smooth scroll for speaker links
if (document.querySelectorAll('.speaker-link')) {
  document.querySelectorAll('.speaker-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const el = document.querySelector(link.getAttribute('href'));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight');
        setTimeout(() => el.classList.remove('highlight'), 1200);
      }
    });
  });
} 