'use strict';

const cards = Array.from(document.querySelectorAll('.result-card'));
const badges = Array.from(document.querySelectorAll('.badge[data-filter]'));
const dupesPanel = document.getElementById('duplicates-panel');

let activeFilter = 'all';

function applyFilter(filter) {
  activeFilter = filter;

  badges.forEach(b => b.classList.toggle('active', b.dataset.filter === filter));

  if (filter === 'duplicates') {
    cards.forEach(c => c.classList.add('hidden'));
    if (dupesPanel) dupesPanel.classList.remove('hidden');
    return;
  }

  if (dupesPanel) dupesPanel.classList.add('hidden');

  cards.forEach(c => {
    const show = filter === 'all' || c.dataset.result === filter;
    c.classList.toggle('hidden', !show);
  });
}

badges.forEach(badge => {
  badge.addEventListener('click', () => applyFilter(badge.dataset.filter));
});

// Honour ?filter= query param on load (e.g. from a direct link to a category)
const params = new URLSearchParams(location.search);
if (params.get('filter')) applyFilter(params.get('filter'));

// Expose for exportModal.js to read active filter
window.getActiveFilter = () => activeFilter;
