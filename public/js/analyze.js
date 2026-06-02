'use strict';

const form = document.getElementById('analyze-form');
const spinner = document.getElementById('spinner');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', () => {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Analyzing…';
  spinner.classList.remove('hidden');
});
