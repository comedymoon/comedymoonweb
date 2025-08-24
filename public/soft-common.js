
// Common modal logic for all locales
const modal = document.getElementById('modal');
if (modal){
  const titleEl = modal.querySelector('.modal-title');
  const shortEl = modal.querySelector('.modal-short');
  const longEl = modal.querySelector('.modal-long');
  const actionsEl = modal.querySelector('.modal-actions');
  const sheet = document.getElementById('download-sheet');

  document.addEventListener('click', (e)=>{
    const card = e.target.closest('.program');
    if(card){
      const id = card.dataset.id;
      const p = programs[id];
      titleEl.textContent = p.title;
      shortEl.textContent = p.short;
      longEl.textContent = p.long;
      actionsEl.innerHTML = `
        <button class="btn btn-cta" id="dl">${t.download}</button>
        <a class="btn" href="${p.links.github}" target="_blank" rel="noopener">GitHub</a>
      `;
      document.getElementById('dl')?.addEventListener('click', ()=>openDownload(p));
      modal.style.display = 'flex';
    }
  });

  modal.querySelector('.close').onclick = ()=> modal.style.display = 'none';
  window.addEventListener('click', (e)=>{ if(e.target===modal) modal.style.display='none'; });

  function openDownload(p){
    const box = sheet.querySelector('.sheet-actions');
    sheet.querySelector('.sheet-title').textContent = t.choose;
    box.innerHTML = `
      <a class="btn" href="${p.links.zip}" target="_blank" rel="noopener">ZIP</a>
      <a class="btn" href="${p.links.gdrive}" target="_blank" rel="noopener">Google Drive</a>
      <a class="btn" href="${p.links.mega}" target="_blank" rel="noopener">Mega</a>
    `;
    sheet.hidden = false;
  }
}
