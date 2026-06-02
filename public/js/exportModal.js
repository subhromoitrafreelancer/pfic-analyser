'use strict';

const modal = document.getElementById('export-modal');
const openBtn = document.getElementById('structured-export-btn');
const closeBtn = document.getElementById('modal-close');
const backdrop = modal.querySelector('.modal-backdrop');
const exportForm = document.getElementById('export-form');

function openModal() {
  // Pre-select the current active filter
  const filterSel = exportForm.querySelector('select[name="filter"]');
  const current = window.getActiveFilter ? window.getActiveFilter() : 'all';
  if (filterSel && current !== 'duplicates') filterSel.value = current;

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

openBtn.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
document.getElementById('modal-close-2').addEventListener('click', closeModal);
backdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

exportForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fd = new FormData(exportForm);
  const filter = fd.get('filter') || 'all';

  const manualFields = {
    fundClass: fd.get('fundClass') || '',
    pficStartDate: fd.get('pficStartDate') || '',
    accountNumber: fd.get('accountNumber') || '',
    bankName: fd.get('bankName') || '',
    bankAddress: fd.get('bankAddress') || '',
    bankCity: fd.get('bankCity') || '',
    bankStateProvince: fd.get('bankStateProvince') || '',
    bankCountry: fd.get('bankCountry') || '',
    ownershipPercent: fd.get('ownershipPercent') || '',
    notes: fd.get('notes') || '',
  };

  const res = await fetch(`/api/export/${SESSION_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter, exportType: 'structured', manualFields }),
  });

  if (!res.ok) { alert('Export failed. Please try again.'); return; }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
    || `pfic-structured-${SESSION_ID.slice(0,8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  closeModal();
});

// Quick full CSV export (no modal needed)
window.exportCsv = async (exportType, filter) => {
  const res = await fetch(`/api/export/${SESSION_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter, exportType, manualFields: {} }),
  });

  if (!res.ok) { alert('Export failed. Please try again.'); return; }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
    || `pfic-${filter}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
