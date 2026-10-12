(function () {
  'use strict';
  // Uses the existing study-photo collection API and its stable document binding.
  window.mountPhotosStage = function (host, {projectId, documentId, request = defaultRequest, draftCache}) {
    const binding = Object.freeze({projectId, documentId});
    const query = new URLSearchParams(binding);
    const drafts = draftCache || new Map();
    let state = null, previewId = null, available = null, busy = true, destroyed = false;
    let message = 'Loading photographs…', error = false;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
    const get = url => request(url + '?' + query);
    const photo = id => { const saved = state?.photos.find(row => row.sourceId === id); return saved ? {...saved, ...drafts.get(id)} : null; };
    function status(text, failed = false) {
      if (destroyed) return;
      message = text; error = failed;
      const node = host.querySelector('[data-status]');
      if (node) { node.textContent = text; node.setAttribute('role', failed ? 'alert' : 'status'); }
    }
    function remember() {
      if (destroyed) return;
      const detail = host.querySelector('[data-detail]');
      if (!detail) return;
      const draft = {
        selected: detail.querySelector('[data-selected]').checked,
        caption: detail.querySelector('[data-caption]').value,
        credit: detail.querySelector('[data-credit]').value
      };
      const saved = state.photos.find(row => row.sourceId === detail.dataset.detail);
      if (saved.selected === draft.selected && (saved.caption || '') === draft.caption && (saved.credit || '') === draft.credit) drafts.delete(detail.dataset.detail);
      else drafts.set(detail.dataset.detail, draft);
    }
    function paint() {
      if (destroyed) return;
      const photos = state?.photos || [];
      if (!photos.some(row => row.sourceId === previewId)) previewId = photos[0]?.sourceId || null;
      const selected = photos.filter(row => photo(row.sourceId).selected).length;
      const current = photo(previewId);
      const disabled = busy || !state ? 'disabled' : '';
      host.innerHTML = `<section class="study-photos" aria-busy="${busy}">
        <header class="photo-header"><p data-photo-count>${selected} selected · ${photos.length} in this piece</p><div class="photo-actions"><button data-add ${disabled}>Upload photos</button><button data-library ${disabled}>From library</button></div></header>
        <input data-files type="file" accept="image/jpeg,image/png,image/webp" multiple hidden ${disabled}>
        <button class="photo-drop" data-drop ${disabled}>Drop photos here <span>JPEG, PNG or WebP · up to 20 MB each</span></button>
        <p class="photo-status" data-status role="${error ? 'alert' : 'status'}">${esc(message)}</p>
        ${available ? `<section class="photo-library" aria-label="Owned library photographs"><div class="photo-actions"><h3>Owned library photographs</h3><button data-close-library ${disabled}>Close</button></div><div class="photo-library-grid">${available.photos.map(row => `<button data-retain="${esc(row.sourceId)}" ${busy || photos.some(p => p.sourceId === row.sourceId) ? 'disabled' : ''} aria-label="Add ${esc(row.name)}"><img src="${esc(row.url)}" alt="" loading="lazy"><span>${esc(row.name)}</span></button>`).join('') || '<p>No owned library photographs yet.</p>'}</div></section>` : ''}
        <div class="photo-workspace"><div class="photo-grid" aria-label="Photographs in this piece">${photos.map(row => { const p = photo(row.sourceId); return `<button class="photo-thumb ${previewId === p.sourceId ? 'active' : ''}" data-preview="${esc(p.sourceId)}" aria-pressed="${previewId === p.sourceId}" aria-label="Edit ${esc(p.name || 'unavailable photograph')}" ${disabled}>${p.missing ? '<span class="photo-unavailable">Unavailable</span>' : `<img src="${esc(p.url)}" alt="" loading="lazy">`}<span class="photo-thumb-label">${esc(p.name || 'Unavailable photograph')}</span><span class="photo-thumb-state">${p.selected ? 'Selected' : 'Not selected'}${drafts.has(p.sourceId) ? ' · Edited' : ''}</span></button>`; }).join('') || '<p class="photo-empty">Upload photographs or choose from your library.</p>'}</div>
        ${current ? `<section class="photo-detail" data-detail="${esc(current.sourceId)}" aria-label="Photo details"><div class="photo-preview">${current.missing ? '<p>Photograph unavailable. Its saved details remain here.</p>' : `<img src="${esc(current.url)}" alt="${esc(current.caption || current.name)}">`}</div><p class="photo-name">${esc(current.name || 'Unavailable photograph')}</p><fieldset ${disabled}><label class="photo-select"><input type="checkbox" data-selected ${current.selected ? 'checked' : ''}>Select for arranging</label><label>Caption<textarea data-caption rows="2" maxlength="2000">${esc(current.caption)}</textarea></label><label>Credit<input data-credit maxlength="300" value="${esc(current.credit)}"></label><button class="photo-save" data-save>Save details</button></fieldset></section>` : ''}</div>
      </section>`;
      const files = host.querySelector('[data-files]');
      host.querySelector('[data-add]').onclick = () => { if (!busy) files.click(); };
      files.onchange = event => addFiles(Array.from(event.target.files));
      const drop = host.querySelector('[data-drop]');
      drop.onclick = () => { if (!busy) files.click(); };
      drop.ondragover = event => { event.preventDefault(); if (!busy) drop.classList.add('dragging'); };
      drop.ondragleave = () => drop.classList.remove('dragging');
      drop.ondrop = event => { event.preventDefault(); drop.classList.remove('dragging'); if (!busy) addFiles(Array.from(event.dataTransfer.files)); };
      host.querySelector('[data-library]').onclick = loadLibrary;
      host.querySelector('[data-close-library]')?.addEventListener('click', () => { if (!busy) { remember(); available = null; paint(); } });
      host.querySelectorAll('[data-retain]').forEach(node => node.onclick = () => runMutation('/api/study/photos/add', {sourceId: node.dataset.retain}));
      host.querySelectorAll('[data-preview]').forEach(node => node.onclick = () => { if (!busy) { remember(); previewId = node.dataset.preview; paint(); } });
      host.querySelectorAll('[data-caption],[data-credit],[data-selected]').forEach(node => node.addEventListener(node.matches('[data-selected]') ? 'change' : 'input', () => { if (!busy) { remember(); const count = state.photos.filter(row => photo(row.sourceId).selected).length; host.querySelector('[data-photo-count]').textContent = `${count} selected · ${state.photos.length} in this piece`; const thumb = Array.from(host.querySelectorAll('[data-preview]')).find(el => el.dataset.preview === previewId); if (thumb) thumb.querySelector('.photo-thumb-state').textContent = `${photo(previewId).selected ? 'Selected' : 'Not selected'}${drafts.has(previewId) ? ' · Edited' : ''}`; status(drafts.size ? 'Unsaved details' : 'Saved to this piece'); } }));
      host.querySelector('[data-save]')?.addEventListener('click', () => { remember(); runMutation('/api/study/photos/update', {sourceId: previewId, selected: photo(previewId).selected, caption: photo(previewId).caption || '', credit: photo(previewId).credit || ''}); });
    }
    function begin(text) { remember(); busy = true; message = text; error = false; paint(); }
    function finish(text, failed = false) { if (destroyed) return; busy = false; message = text; error = failed; paint(); }
    async function mutate(url, input) {
      const result = await request(url, {...binding, expectedRevision: state.revision, ...input});
      if (destroyed) return false;
      state = result;
      if (url.endsWith('/update')) drafts.delete(input.sourceId);
      if (url.endsWith('/add')) previewId = result.photos.at(-1)?.sourceId || previewId;
      return true;
    }
    async function runMutation(url, input) {
      if (busy || destroyed || !state) return;
      begin('Saving…');
      try { if (await mutate(url, input)) finish('Saved to this piece'); }
      catch (failure) { finish(failure.message + ' Your entered details are preserved.', true); }
    }
    async function loadLibrary() {
      if (busy || destroyed || !state) return;
      begin('Loading library…');
      try { const result = await get('/api/study/photos/available'); if (destroyed) return; available = result; finish('Choose an owned photograph to add'); }
      catch (failure) { finish(failure.message, true); }
    }
    async function addFiles(files) {
      if (busy || destroyed || !state || !files.length) return;
      begin('Uploading…');
      let added = 0;
      for (const file of files) {
        try {
          if (!/\.(jpe?g|png|webp)$/i.test(file.name) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 20 * 1024 * 1024) throw Error('Use a JPEG, PNG or WebP up to 20 MB.');
          const bitmap = await window.createImageBitmap(file); bitmap.close();
          if (destroyed) return;
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (destroyed) return;
          let raw = ''; for (let i = 0; i < bytes.length; i += 16384) raw += String.fromCharCode(...bytes.subarray(i, i + 16384));
          if (!await mutate('/api/study/photos/add', {name: file.name, base64: window.btoa(raw)})) return;
          added++;
        } catch (failure) {
          finish(`${file.name}: ${failure.message} Upload stopped; ${added} added. Remaining files were not uploaded.`, true);
          return;
        }
      }
      finish(`${added} ${added === 1 ? 'photo' : 'photos'} added to this piece`);
    }
    paint();
    get('/api/study/photos').then(result => { if (destroyed) return; state = result; finish(drafts.size ? 'Unsaved details restored' : state.photos.length ? 'Saved photo details' : 'No photos added yet'); }).catch(failure => finish(failure.message, true));
    return {binding, destroy() { destroyed = true; host.replaceChildren(); }};
  };
  async function defaultRequest(url, input) {
    const response = await fetch(url, {method: input ? 'POST' : 'GET', headers: input ? {'Content-Type': 'application/json'} : undefined, body: input ? JSON.stringify(input) : undefined});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Photos could not be saved.');
    return result;
  }
}());
