// Ginomai Pro - Bento Theme Interactive Controller
// Powers all buttons, slots, tabs, library items, medley deck columns, stage preview, and AI speech feed

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. BENTO AGENDA RENDERER & DRAG/DROP REORDERING
  // ─────────────────────────────────────────────────────────────────────────────
  function renderBentoAgenda() {
    const listEl = document.getElementById('bento-agenda-list');
    const countEl = document.getElementById('bento-agenda-count');
    const cardEl = document.getElementById('bento-agenda-card');
    if (!listEl) return;

    const items = window.state && window.state.agendaItems ? window.state.agendaItems : [];
    if (countEl) countEl.textContent = items.length;

    listEl.innerHTML = '';

    // Unified drop handler for dropping items anywhere in the Agenda container
    const handleAgendaDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      listEl.classList.remove('drag-hover');
      if (cardEl) cardEl.classList.remove('drag-hover');

      let songId = e.dataTransfer ? e.dataTransfer.getData('application/song-id') : null;
      let bibleBook = e.dataTransfer ? e.dataTransfer.getData('application/bible-book') : null;
      const srcIdxStr = e.dataTransfer ? e.dataTransfer.getData('application/agenda-index') : null;

      // In-memory fallback if dataTransfer custom mime was restricted
      if (!songId && !bibleBook && window.sfDraggedItem) {
        if (window.sfDraggedItem.type === 'song') songId = window.sfDraggedItem.id;
        else if (window.sfDraggedItem.type === 'bible') bibleBook = window.sfDraggedItem.id;
      }
      if (!songId && !bibleBook && !srcIdxStr && e.dataTransfer) {
        const plain = e.dataTransfer.getData('text/plain');
        if (plain) {
          if ((window.SONGS_DATABASE || []).some(s => s.id === plain)) {
            songId = plain;
          } else if ((window.BIBLE_BOOKS || []).includes(plain)) {
            bibleBook = plain;
          }
        }
      }

      if (srcIdxStr !== '' && srcIdxStr !== null && srcIdxStr !== undefined) {
        const fromIdx = parseInt(srcIdxStr, 10);
        if (!isNaN(fromIdx) && fromIdx >= 0 && fromIdx < items.length) {
          const [moved] = window.state.agendaItems.splice(fromIdx, 1);
          window.state.agendaItems.push(moved);
          if (typeof window.renderAgenda === 'function') window.renderAgenda();
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
          return;
        }
      }

      if (songId) {
        const song = (window.SONGS_DATABASE || []).find(s => s.id === songId);
        if (song) {
          window.state.agendaItems.push({
            type: 'song',
            id: song.id,
            title: song.title,
            author: song.author || 'Unknown',
            meta: song.author || 'Song'
          });
          if (typeof window.renderAgenda === 'function') window.renderAgenda();
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
        }
      } else if (bibleBook) {
        const ver = window.state.bibleVersion || 'KJV';
        window.state.agendaItems.push({
          type: 'bible',
          id: bibleBook,
          book: bibleBook,
          chapter: window.state.activeBibleChapter || 1,
          version: ver,
          title: `${bibleBook} ${window.state.activeBibleChapter || 1}`,
          meta: `${ver} Translation`
        });
        if (typeof window.renderAgenda === 'function') window.renderAgenda();
        if (typeof window.renderLibrary === 'function') window.renderLibrary();
        if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
      }
    };

    // Container-level dropzone for dropping items into Agenda card
    listEl.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (cardEl) cardEl.classList.add('drag-hover');
    };
    listEl.ondragleave = (e) => {
      if (cardEl && !cardEl.contains(e.relatedTarget)) {
        cardEl.classList.remove('drag-hover');
      }
    };
    listEl.ondrop = handleAgendaDrop;

    if (cardEl) {
      cardEl.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        cardEl.classList.add('drag-hover');
      };
      cardEl.ondragleave = (e) => {
        if (!cardEl.contains(e.relatedTarget)) {
          cardEl.classList.remove('drag-hover');
        }
      };
      cardEl.ondrop = handleAgendaDrop;
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="bento-empty-unit compact">
          <div class="empty-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </div>
          <div class="empty-title">Agenda empty</div>
          <div class="empty-desc">Drag songs or scriptures here, or click + Agenda from AI feed.</div>
        </div>
      `;
      return;
    }

    items.forEach((item, idx) => {
      const row = document.createElement('div');

      row.className = 'bento-agenda-row';
      row.setAttribute('draggable', 'true');
      row.dataset.agendaIndex = idx;

      let icoClass = 'song';
      let icoSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      if (item.type === 'bible') {
        icoClass = 'scr';
        icoSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
      } else if (item.type === 'sermon') {
        icoClass = 'serm';
        icoSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
      }

      row.innerHTML = `
        <div class="bento-drag-handle" style="cursor:grab; opacity:0.4; font-size:12px; padding:0 4px;">⠿</div>
        <div class="bento-type-ico ${icoClass}">${icoSvg}</div>
        <div class="info" style="flex:1; min-width:0; overflow:hidden;">
          <div class="title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; font-size:12px; color:var(--txt);">${escapeHtml(item.title)}</div>
          <div class="meta" style="font-size:10.5px; color:var(--mute); font-family:var(--font-mono);">${escapeHtml(item.meta || (item.type === 'song' ? (item.author || 'Song') : (item.book || 'Scripture')))}</div>
        </div>
        <button class="bento-agenda-act-btn" style="background:none; border:none; color:var(--mute); padding:4px 6px; cursor:pointer; border-radius:4px; font-size:11px; display:flex; align-items:center;" onclick="event.stopPropagation(); window.removeAgendaItem(${idx})" title="Remove from agenda">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      // Drag & Drop Handlers for Bento Agenda Row
      row.ondragstart = (e) => {
        window.sfIsInternalDrag = true;
        window.sfDraggedItem = { type: item.type, id: item.id, item, idx };
        if (item.type === 'song') {
          e.dataTransfer.setData('text/plain', item.id);
          e.dataTransfer.setData('application/song-id', item.id);
        } else if (item.type === 'bible') {
          e.dataTransfer.setData('text/plain', item.book || item.id);
          e.dataTransfer.setData('application/bible-book', item.book || item.id);
        }
        e.dataTransfer.setData('application/agenda-index', String(idx));
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      };

      row.ondragend = () => {
        window.sfIsInternalDrag = false;
        window.sfDraggedItem = null;
        row.classList.remove('dragging');
      };

      row.ondragover = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          row.classList.add('drag-over-top');
          row.classList.remove('drag-over-bottom');
        } else {
          row.classList.add('drag-over-bottom');
          row.classList.remove('drag-over-top');
        }
      };

      row.ondragleave = () => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      };

      row.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertAfter = e.clientY >= midY;
        let targetIdx = insertAfter ? idx + 1 : idx;

        row.classList.remove('drag-over-top', 'drag-over-bottom');

        const srcIdxStr = e.dataTransfer ? e.dataTransfer.getData('application/agenda-index') : null;
        let songId = e.dataTransfer ? e.dataTransfer.getData('application/song-id') : null;
        let bibleBook = e.dataTransfer ? e.dataTransfer.getData('application/bible-book') : null;

        // Fallback to internal drag tracker if dataTransfer was restricted
        if (!songId && !bibleBook && window.sfDraggedItem) {
          if (window.sfDraggedItem.type === 'song') songId = window.sfDraggedItem.id;
          else if (window.sfDraggedItem.type === 'bible') bibleBook = window.sfDraggedItem.id;
        }
        if (!songId && !bibleBook && !srcIdxStr && e.dataTransfer) {
          const plain = e.dataTransfer.getData('text/plain');
          if (plain) {
            if ((window.SONGS_DATABASE || []).some(s => s.id === plain)) {
              songId = plain;
            } else if ((window.BIBLE_BOOKS || []).includes(plain)) {
              bibleBook = plain;
            }
          }
        }

        if (srcIdxStr !== '' && srcIdxStr !== null && srcIdxStr !== undefined) {
          const fromIdx = parseInt(srcIdxStr, 10);
          if (!isNaN(fromIdx) && fromIdx >= 0 && fromIdx < window.state.agendaItems.length) {
            if (fromIdx === idx) return;
            const [moved] = window.state.agendaItems.splice(fromIdx, 1);
            if (targetIdx > fromIdx) targetIdx--;
            window.state.agendaItems.splice(targetIdx, 0, moved);
            if (typeof window.renderAgenda === 'function') window.renderAgenda();
            if (typeof window.renderLibrary === 'function') window.renderLibrary();
            if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
          }
        } else if (songId) {
          const song = (window.SONGS_DATABASE || []).find(s => s.id === songId);
          if (song) {
            window.state.agendaItems.splice(targetIdx, 0, {
              type: 'song',
              id: song.id,
              title: song.title,
              author: song.author || 'Unknown',
              meta: song.author || 'Song'
            });
            if (typeof window.renderAgenda === 'function') window.renderAgenda();
            if (typeof window.renderLibrary === 'function') window.renderLibrary();
            if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
          }
        } else if (bibleBook) {
          const ver = window.state.bibleVersion || 'KJV';
          window.state.agendaItems.splice(targetIdx, 0, {
            type: 'bible',
            id: bibleBook,
            book: bibleBook,
            chapter: window.state.activeBibleChapter || 1,
            version: ver,
            title: `${bibleBook} ${window.state.activeBibleChapter || 1}`,
            meta: `${ver} Translation`
          });
          if (typeof window.renderAgenda === 'function') window.renderAgenda();
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
        }
      };

      row.onclick = () => {
        if (item.type === 'song') {
          window.state.activeSongId = item.id;
          window.state.currentTab = 'songs';
          syncBentoTabsUI();
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          if (typeof window.renderDeck === 'function') window.renderDeck(true);
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
        } else if (item.type === 'bible') {
          window.state.activeBibleBook = item.book || item.id;
          window.state.currentTab = 'bible';
          syncBentoTabsUI();
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          if (typeof window.renderDeck === 'function') window.renderDeck(true);
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
        }
      };

      listEl.appendChild(row);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. BENTO LIBRARY RENDERER (BIBLE & SONGS WITH [1][2][3] SLOT BUTTONS & DRAG)
  // ─────────────────────────────────────────────────────────────────────────────
  function renderBentoLibrary(filterQuery = null) {
    const listEl = document.getElementById('bento-library-list');
    if (!listEl) return;
    const savedScrollTop = listEl.scrollTop;
    listEl.innerHTML = '';

    const currentTab = window.state ? window.state.currentTab : 'songs';
    let q = '';
    if (typeof filterQuery === 'string') {
      q = filterQuery.trim().toLowerCase();
    } else {
      const searchInput = document.getElementById('bento-search-input');
      q = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : '';
    }

    // Update active translation badge
    const transLabel = document.getElementById('bento-active-version-label');
    if (transLabel) {
      transLabel.textContent = (window.state && window.state.bibleVersion) ? window.state.bibleVersion : 'KJV';
    }

    if (currentTab === 'bible') {
      const ver = (window.state && window.state.bibleVersion) ? window.state.bibleVersion : 'KJV';
      const books = typeof window.getBibleBooks === 'function' ? window.getBibleBooks(ver) : [];
      const filtered = q ? books.filter(b => b.toLowerCase().includes(q)) : books;

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="bento-empty-unit compact">
            <div class="empty-icon">
              ${q ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'}
            </div>
            <div class="empty-title">${q ? 'No matching books' : 'No Bible books'}</div>
            <div class="empty-desc">${q ? 'Check spelling or switch translation above.' : 'Import Bible translations from top toolbar.'}</div>
          </div>
        `;
        return;
      }

      const showBibleMedleyBtns = !!(window.state && (window.state.isMedleyMode || window.state.showBibleMedleyButtons));
      const slots = window.state && window.state.medleyBibleSlots ? window.state.medleyBibleSlots : [];
      const s0Book = slots[0] ? slots[0].book : null;
      const s1Book = slots[1] ? slots[1].book : null;
      const s2Book = slots[2] ? slots[2].book : null;

      filtered.forEach(book => {
        const isBookActive = window.state && window.state.activeBibleBook === book;
        const isExpanded = (window.state && window.state.expandedBibleBook === book) || (filtered.length === 1 && Boolean(q));
        const chapters = typeof window.getBibleChapters === 'function' ? window.getBibleChapters(book, ver) : [];

        const wrap = document.createElement('div');
        wrap.className = `bento-bible-wrap ${isExpanded ? 'expanded' : ''}`;

        const row = document.createElement('div');
        row.className = `bento-song-row bento-bible-book-row ${isBookActive ? 'active' : ''}`;
        row.setAttribute('draggable', 'true');

        const isS1 = s0Book === book;
        const isS2 = s1Book === book;
        const isS3 = s2Book === book;

        const slotBtnsHtml = showBibleMedleyBtns ? `
          <div class="bento-slotbtns">
            <span class="${isS1 ? 'active' : ''}" title="Assign ${escapeHtml(book)} to Slot S1" onclick="event.stopPropagation(); window.assignBibleBookToSlot('${book}', 0)">1</span>
            <span class="${isS2 ? 'active' : ''}" title="Assign ${escapeHtml(book)} to Slot S2" onclick="event.stopPropagation(); window.assignBibleBookToSlot('${book}', 1)">2</span>
            <span class="${isS3 ? 'active' : ''}" title="Assign ${escapeHtml(book)} to Slot S3" onclick="event.stopPropagation(); window.assignBibleBookToSlot('${book}', 2)">3</span>
          </div>
        ` : '';

        row.innerHTML = `
          <div class="info" style="flex:1; min-width:0;">
            <div class="n" style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
              <span>${escapeHtml(book)}</span>
              <svg class="bento-chevron ${isExpanded ? 'open' : ''}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="a">${chapters.length} chapters · ${escapeHtml(ver)}</div>
          </div>
          ${slotBtnsHtml}
        `;

        // Drag start handler for Bible book row
        row.ondragstart = (e) => {
          window.sfIsInternalDrag = true;
          window.sfDraggedItem = { type: 'bible', id: book, book };
          e.dataTransfer.setData('text/plain', book);
          e.dataTransfer.setData('application/bible-book', book);
          e.dataTransfer.setData('application/item-type', 'bible');
          e.dataTransfer.effectAllowed = 'copyMove';
          row.classList.add('dragging');
        };

        row.ondragend = () => {
          window.sfIsInternalDrag = false;
          window.sfDraggedItem = null;
          row.classList.remove('dragging');
        };

        row.onclick = () => {
          if (!window.state) window.state = {};
          const isOpening = window.state.expandedBibleBook !== book;
          if (window.state.expandedBibleBook === book) {
            window.state.expandedBibleBook = null;
          } else {
            window.state.expandedBibleBook = book;
          }
          // Only initialize activeBibleBook if none was previously active
          if (!window.state.activeBibleBook) {
            window.state.activeBibleBook = book;
            const chs = typeof window.getBibleChapters === 'function' ? window.getBibleChapters(book, ver) : [];
            window.state.activeBibleChapter = chs.length > 0 ? parseInt(chs[0], 10) : 1;
            if (typeof window.renderDeck === 'function') window.renderDeck(true);
            if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
          }
          if (typeof window.renderLibrary === 'function') window.renderLibrary();

          if (isOpening) {
            setTimeout(() => {
              const currentList = document.getElementById('bento-library-list');
              if (currentList) {
                const targetWrap = currentList.querySelector('.bento-bible-wrap.expanded');
                if (targetWrap) {
                  const wrapRect = targetWrap.getBoundingClientRect();
                  const listRect = currentList.getBoundingClientRect();
                  if (wrapRect.top < listRect.top) {
                    currentList.scrollTo({ top: Math.max(0, currentList.scrollTop + (wrapRect.top - listRect.top) - 8), behavior: 'smooth' });
                  } else if (wrapRect.bottom > listRect.bottom) {
                    currentList.scrollTo({ top: currentList.scrollTop + (wrapRect.bottom - listRect.bottom) + 8, behavior: 'smooth' });
                  }
                }
              }
            }, 30);
          }
        };

        wrap.appendChild(row);

        if (isExpanded && chapters.length > 0) {
          const drawer = document.createElement('div');
          drawer.className = 'bento-bible-drawer';

          let btnsHtml = '';
          chapters.forEach(chStr => {
            const chNum = parseInt(chStr, 10);
            const isChActive = isBookActive && parseInt(window.state.activeBibleChapter, 10) === chNum;

            btnsHtml += `
              <button type="button" class="bento-drawer-btn ${isChActive ? 'active' : ''}" onclick="event.stopPropagation(); window.selectBentoBibleChapter('${escapeHtml(book)}', ${chNum}, true, event)" title="${escapeHtml(book)} Chapter ${chNum}">
                ${chNum}
              </button>
            `;
          });

          drawer.innerHTML = `
            <div class="bento-drawer-head">
              <span>Select chapter</span>
              <span class="cnt">${chapters.length} chs</span>
            </div>
            <div class="bento-drawer-grid">
              ${btnsHtml}
            </div>
          `;

          wrap.appendChild(drawer);
        }

        listEl.appendChild(wrap);
      });

    } else {
      // SONGS MODE
      const songs = window.SONGS_DATABASE || [];
      const filtered = q 
        ? songs.filter(s => (typeof window.getSongSearchIndex === 'function' ? window.getSongSearchIndex(s) : (s.title + ' ' + (s.author || ''))).toLowerCase().includes(q))
        : songs;

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="bento-empty-unit compact">
            <div class="empty-icon">
              ${q ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'}
            </div>
            <div class="empty-title">${q ? 'No matching songs' : 'No songs in library'}</div>
            <div class="empty-desc">${q ? 'Try searching by title, artist, or lyric phrase.' : 'Import song files via the top toolbar to start.'}</div>
          </div>
        `;
        return;
      }

      const showSongsMedleyBtns = !!(window.state && (window.state.isMedleyMode || window.state.showMedleyView));
      const medleyIds = (window.state && Array.isArray(window.state.medleySongIds)) ? window.state.medleySongIds : [];
      const m0 = medleyIds[0];
      const m1 = medleyIds[1];
      const m2 = medleyIds[2];
      const activeId = window.state ? window.state.activeSongId : null;

      filtered.forEach(song => {
        const row = document.createElement('div');
        const isSelected = activeId === song.id;
        const isS1 = m0 === song.id;
        const isS2 = m1 === song.id;
        const isS3 = m2 === song.id;

        row.className = `bento-song-row ${isSelected ? 'active' : ''}`;
        row.dataset.songId = song.id;
        row.setAttribute('draggable', 'true');

        const slotBtnsHtml = showSongsMedleyBtns ? `
          <div class="bento-slotbtns">
            <span class="${isS1 ? 'active' : ''}" title="Assign to Slot S1" onclick="event.stopPropagation(); window.swapMedleySong(0, '${song.id}')">1</span>
            <span class="${isS2 ? 'active' : ''}" title="Assign to Slot S2" onclick="event.stopPropagation(); window.swapMedleySong(1, '${song.id}')">2</span>
            <span class="${isS3 ? 'active' : ''}" title="Assign to Slot S3" onclick="event.stopPropagation(); window.swapMedleySong(2, '${song.id}')">3</span>
          </div>
        ` : '';

        row.innerHTML = `
          <div class="info">
            <div class="n">${escapeHtml(song.title)}</div>
            <div class="a">${escapeHtml(song.author || 'Unknown')}</div>
          </div>
          ${slotBtnsHtml}
        `;

        // Drag start handler for Song row
        row.ondragstart = (e) => {
          window.sfIsInternalDrag = true;
          window.sfDraggedItem = { type: 'song', id: song.id, song };
          e.dataTransfer.setData('text/plain', song.id);
          e.dataTransfer.setData('application/song-id', song.id);
          e.dataTransfer.setData('application/item-type', 'song');
          e.dataTransfer.effectAllowed = 'copyMove';
          row.classList.add('dragging');
        };

        row.ondragend = () => {
          window.sfIsInternalDrag = false;
          window.sfDraggedItem = null;
          row.classList.remove('dragging');
        };

        row.onclick = () => {
          window.state.activeSongId = song.id;
          const list = row.parentElement;
          if (list) {
            list.querySelectorAll('.bento-song-row.active').forEach(el => el.classList.remove('active'));
            row.classList.add('active');
          }
          if (typeof window.renderDeck === 'function') window.renderDeck(true);
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
        };

        listEl.appendChild(row);
      });
    }

    if (savedScrollTop > 0) {
      listEl.scrollTop = savedScrollTop;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. BENTO DECK RENDERER (SINGLE OR 3-COLUMN MEDLEY WITH S1/S2/S3 HEADERS)
  // ─────────────────────────────────────────────────────────────────────────────
  let liveCardResizeObserver = null;
  window.updateBentoLiveCardShape = function(cardEl) {
    if (!cardEl) return;
    const svgPath = cardEl.querySelector('.bento-live-shape-svg path');
    if (!svgPath) return;
    const w = cardEl.offsetWidth;
    const h = cardEl.offsetHeight;
    if (w <= 0 || h <= 0) return;

    const R = 16;      // outer corner radius matching .bento-single-card
    const offset = 26; // play button center offset from right and bottom edges
    const Rc = 26;     // circular scoop radius (giving an exact uniform 8px moat around 36px button)
    const r = 12;      // smooth blend fillet radius

    if (w < 120 || h < 80) {
      svgPath.setAttribute('d', `M ${R} 0 H ${w - R} A ${R} ${R} 0 0 1 ${w} ${R} V ${h - R} A ${R} ${R} 0 0 1 ${w - R} ${h} H ${R} A ${R} ${R} 0 0 1 0 ${h - R} V ${R} A ${R} ${R} 0 0 1 ${R} 0 Z`);
      return;
    }

    // Button center
    const cx = w - offset;
    const cy = h - offset;

    const dx = offset - r;
    const dy2 = Math.pow(Rc + r, 2) - Math.pow(dx, 2);
    const dy = dy2 > 0 ? Math.sqrt(dy2) : 0;

    // Right edge fillet
    const T1y = cy - dy;
    const F1x = w - r;
    const F1y = T1y;
    const ratio = r / (Rc + r);
    const T2x = F1x + ratio * (cx - F1x);
    const T2y = F1y + ratio * (cy - F1y);

    // Bottom edge fillet
    const F2x = cx - dy;
    const F2y = h - r;
    const T3x = F2x + ratio * (cx - F2x);
    const T3y = F2y + ratio * (cy - F2y);
    const T4x = F2x;

    const d = `
      M ${R} 0
      H ${w - R}
      A ${R} ${R} 0 0 1 ${w} ${R}
      V ${T1y.toFixed(2)}
      A ${r} ${r} 0 0 1 ${T2x.toFixed(2)} ${T2y.toFixed(2)}
      A ${Rc} ${Rc} 0 0 0 ${T3x.toFixed(2)} ${T3y.toFixed(2)}
      A ${r} ${r} 0 0 1 ${T4x.toFixed(2)} ${h}
      H ${R}
      A ${R} ${R} 0 0 1 0 ${h - R}
      V ${R}
      A ${R} ${R} 0 0 1 ${R} 0
      Z
    `.replace(/\s+/g, ' ').trim();

    svgPath.setAttribute('d', d);
  };

  function setupLiveCardObserver(cardEl) {
    if (!cardEl) return;
    if (!liveCardResizeObserver && typeof ResizeObserver !== 'undefined') {
      liveCardResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target && entry.target.classList.contains('live')) {
            updateBentoLiveCardShape(entry.target);
          }
        }
      });
    }
    if (liveCardResizeObserver) {
      liveCardResizeObserver.observe(cardEl);
    }
    updateBentoLiveCardShape(cardEl);
  }
  window.setupLiveCardObserver = setupLiveCardObserver;

  window.cleanupLiveCardObserver = function(cardEl) {
    if (cardEl && liveCardResizeObserver) {
      try { liveCardResizeObserver.unobserve(cardEl); } catch(e) {}
    }
  };

  
  window._bentoSlideRegistry = window._bentoSlideRegistry || new Map();
  window.projectBentoSlide = function(slideId) {
    if (!slideId) return;
    const data = window._bentoSlideRegistry ? window._bentoSlideRegistry.get(slideId) : null;
    if (data && typeof window.projectSlide === 'function') {
      window.projectSlide(data.slideId, data.text, data.refStr);
    } else if (typeof window.projectSlide === 'function') {
      const card = document.querySelector(`[data-slide-id="${slideId}"]`);
      if (card) {
        const text = card.querySelector('.ln')?.textContent || '';
        const tag = card.querySelector('.tag span')?.textContent || '';
        window.projectSlide(slideId, text, tag);
      }
    }
  };

  function renderBentoDeck() {
    if (liveCardResizeObserver) {
      try { liveCardResizeObserver.disconnect(); } catch (e) {}
    }
    const container = document.getElementById('bento-medley-container');
    if (!container) return;
    if (window._bentoSlideRegistry) window._bentoSlideRegistry.clear();

    const state = window.state || {};
    const isMedley = !!state.isMedleyMode;
    const currentTab = state.currentTab || 'songs';

    // Topbar titles
    const titleEl = document.getElementById('bento-deck-title');
    const subEl = document.getElementById('bento-deck-sub');
    const editBtn = document.getElementById('bento-edit-btn');
    const compareBtn = document.getElementById('bento-compare-btn');

    if (editBtn) {
      editBtn.style.display = currentTab === 'songs' ? 'inline-flex' : 'none';
    }
    if (compareBtn) {
      compareBtn.style.display = currentTab === 'bible' ? 'inline-flex' : 'none';
      compareBtn.classList.toggle('active', !!state.isCompareMode);
    }

    // Single view columns segmented buttons (1 Col / 2 Col / 3 Col)
    const colsSeg = document.getElementById('bento-cols-seg');
    if (colsSeg) {
      colsSeg.style.display = isMedley ? 'none' : 'inline-flex';
      const activeCols = (state.bentoSingleCols !== undefined ? state.bentoSingleCols : 1);
      colsSeg.querySelectorAll('span').forEach(sp => {
        sp.classList.toggle('active', parseInt(sp.dataset.cols, 10) === activeCols);
      });
    }

    // Lines per slide segmented buttons
    const linesSeg = document.getElementById('bento-lines-seg');
    if (linesSeg) {
      const maxL = state.maxLinesPerSlide !== undefined ? state.maxLinesPerSlide : 0;
      linesSeg.querySelectorAll('span').forEach(sp => {
        const val = parseInt(sp.dataset.lines, 10);
        sp.classList.toggle('active', val === maxL);
      });
    }

    // Zoom label
    const zoomLabel = document.getElementById('bento-zoom-label');
    if (zoomLabel) {
      const activeZoom = isMedley 
        ? (state.bentoMedleyScale !== undefined ? state.bentoMedleyScale : 1.0)
        : (state.bentoSingleScale !== undefined ? state.bentoSingleScale : (state.deckScale || 1.0));
      zoomLabel.textContent = Math.round(activeZoom * 100) + '%';
    }

    // Medley mode segmented buttons
    const segSingle = document.getElementById('bento-seg-single');
    const segMedley = document.getElementById('bento-seg-medley');
    if (segSingle) segSingle.classList.toggle('active', !isMedley);
    if (segMedley) segMedley.classList.toggle('active', isMedley);

    container.innerHTML = '';
    container.className = isMedley ? 'bento-medley' : 'bento-single-deck';

    if (isMedley) {
      // MEDLEY 3-COLUMN DECK
      if (currentTab === 'bible') {
        if (titleEl) {
          titleEl.textContent = 'Scripture Medley';
          if (titleEl.removeAttribute) titleEl.removeAttribute('title');
          titleEl.title = '';
        }

        const slots = (state.medleyBibleSlots && state.medleyBibleSlots.length > 0) ? state.medleyBibleSlots : [
          state.activeBibleBook ? { book: state.activeBibleBook, chapter: state.activeBibleChapter || 1, version: state.bibleVersion || 'KJV' } : null,
          null,
          null
        ];

        const populatedSlotsCount = slots.filter(s => s && s.book).length;
        if (subEl) {
          subEl.textContent = populatedSlotsCount > 0 
            ? `${populatedSlotsCount} scripture passage${populatedSlotsCount > 1 ? 's' : ''} loaded · compare & multi-slot` 
            : '0 scripture passages loaded · drag or choose scriptures below';
          if (subEl.removeAttribute) subEl.removeAttribute('title');
          subEl.title = '';
        }

        for (let idx = 0; idx < 3; idx++) {
          const slot = slots[idx];
          const book = slot ? slot.book : null;
          const ch = slot ? slot.chapter : 1;
          const ver = slot ? (slot.version || state.bibleVersion || 'KJV') : (state.bibleVersion || 'KJV');
          const verses = book ? (typeof window.getBibleVerses === 'function' ? window.getBibleVerses(book, ch, ver) : []) : [];

          const isColLive = book && verses.length > 0 && verses.some(v => typeof window.isBibleSlideLive === 'function' && window.isBibleSlideLive(ver, book, ch, v.verse, idx));
          const col = document.createElement('div');
          col.className = `bento-slot-col ${isColLive ? 'active-song' : ''}`;

          // Drag & Drop for Bible Medley Slot
          col.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            col.classList.add('drag-hover');
          };
          col.ondragleave = () => {
            col.classList.remove('drag-hover');
          };
          col.ondrop = (e) => {
            e.preventDefault();
            col.classList.remove('drag-hover');
            const droppedBook = (e.dataTransfer ? e.dataTransfer.getData('application/bible-book') : null) ||
              (window.sfDraggedItem && window.sfDraggedItem.type === 'bible' ? window.sfDraggedItem.id : null) ||
              (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
            if (droppedBook && typeof window.assignBibleBookToSlot === 'function') {
              window.assignBibleBookToSlot(droppedBook, idx);
            }
          };

          let slidesHtml = '';
          if (book && verses.length > 0) {
            verses.forEach(v => {
              const slideId = `medley_bible_s${idx}_${book}_${ch}_${v.verse}`;
              const refStr = `${book} ${ch}:${v.verse} (${ver})`;
              const isLive = typeof window.isBibleSlideLive === 'function' && window.isBibleSlideLive(ver, book, ch, v.verse, idx);

              let verseBodyHtml = escapeHtml(v.text);
              if (window.state && window.state.strongsMode) {
                let taggedText = v.text;
                if (typeof BIBLE_DATABASE !== 'undefined' && BIBLE_DATABASE['KJV_STRONGS'] && BIBLE_DATABASE['KJV_STRONGS'][book] && BIBLE_DATABASE['KJV_STRONGS'][book][ch]) {
                  const tv = BIBLE_DATABASE['KJV_STRONGS'][book][ch].find(item => item.verse === v.verse);
                  if (tv && tv.text) taggedText = tv.text;
                }
                if (typeof window.formatStrongsVerseHtml === 'function') {
                  verseBodyHtml = window.formatStrongsVerseHtml(taggedText);
                }
              }

              window._bentoSlideRegistry.set(slideId, { slideId, text: v.text, refStr });
              slidesHtml += `
                <div id="bento_card_${slideId}" data-slide-id="${slideId}" class="bento-slide-card ${isLive ? 'live' : ''}" onclick="window.projectBentoSlide('${slideId}')">
                  <div class="tag">
                    <span>VERSE ${v.verse}</span>
                    ${isLive ? '<span class="bento-live-badge"></span>' : ''}
                  </div>
                  <div class="ln">${verseBodyHtml}</div>
                </div>
              `;
            });
          } else {
            slidesHtml = `
              <div class="bento-empty-unit compact" style="margin:0; padding:18px 10px;">
                <div class="empty-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
                <div class="empty-title">Slot S${idx + 1} empty</div>
                <div class="empty-desc">Drag a scripture here or click Change above.</div>
              </div>
            `;
          }

          const changeTarget = state.bibleMedleyChangeTarget || 'chapter';
          const isVersionAction = changeTarget === 'version';
          const changeOnClick = isVersionAction 
            ? `window.openVersionPicker(${idx}, event)` 
            : `window.openBiblePassagePicker(${idx}, event)`;
          const changeLabel = isVersionAction ? 'Version' : 'Change';
          const changeTip = isVersionAction ? 'Switch Bible translation for this slot' : 'Select scripture book & chapter for this slot';

          const titleContentHtml = book 
            ? `<span class="t" style="cursor:pointer;" onclick="event.stopPropagation(); window.openBiblePassagePicker(${idx}, event)" title="Click to change scripture passage">${escapeHtml(book)} ${ch} <span style="font-size:10px; opacity:0.75;" onclick="event.stopPropagation(); window.openVersionPicker(${idx}, event)" title="Click to switch translation">(${ver})</span></span>`
            : `<span class="t" style="cursor:pointer; color:var(--mute);" onclick="event.stopPropagation(); window.openBiblePassagePicker(${idx}, event)" title="Click to select scripture passage">Empty Slot</span>`;

          col.innerHTML = `
            <div class="bento-slot-col-head">
              <span class="bento-slot-badge">S${idx + 1}</span>
              ${titleContentHtml}
              <span class="change" onclick="event.stopPropagation(); ${changeOnClick}" title="${changeTip}">${changeLabel}</span>
            </div>
            <div class="bento-slides">${slidesHtml}</div>
          `;
          container.appendChild(col);
        }

      } else {
        // SONGS MEDLEY 3-COLUMN DECK
        if (titleEl) {
          titleEl.textContent = 'Worship medley';
          if (titleEl.removeAttribute) titleEl.removeAttribute('title');
          titleEl.title = '';
        }
        if (subEl) {
          subEl.textContent = '3 songs loaded · lyrics view';
          if (subEl.removeAttribute) subEl.removeAttribute('title');
          subEl.title = '';
        }

        const songIds = state.medleySongIds || [];
        for (let idx = 0; idx < 3; idx++) {
          const songId = songIds[idx];
          const song = (window.SONGS_DATABASE || []).find(s => s.id === songId);

          const isColLive = song && song.stanzas && song.stanzas.some((stanza, sIdx) => {
            const maxLines = state.maxLinesPerSlide || 4;
            const chunks = typeof window.splitStanzaIntoChunks === 'function' 
              ? window.splitStanzaIntoChunks(stanza, maxLines)
              : [{ ...stanza, chunkIndex: 0, totalChunks: 1, label: stanza.type }];
            return chunks.some((chunk, cIdx) => typeof window.isSongSlideLive === 'function' && window.isSongSlideLive(song.id, sIdx, chunks.length > 1 ? cIdx : null));
          });

          const col = document.createElement('div');
          col.className = `bento-slot-col ${isColLive ? 'active-song' : ''}`;

          // Drag & Drop for Song Medley Slot
          col.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            col.classList.add('drag-hover');
          };
          col.ondragleave = () => {
            col.classList.remove('drag-hover');
          };
          col.ondrop = (e) => {
            e.preventDefault();
            col.classList.remove('drag-hover');
            const droppedSongId = (e.dataTransfer ? e.dataTransfer.getData('application/song-id') : null) ||
              (window.sfDraggedItem && window.sfDraggedItem.type === 'song' ? window.sfDraggedItem.id : null) ||
              (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
            if (droppedSongId && typeof window.swapMedleySong === 'function') {
              window.swapMedleySong(idx, droppedSongId);
            }
          };

          let slidesHtml = '';
          if (song && song.stanzas) {
            const maxLines = state.maxLinesPerSlide || 4;
            song.stanzas.forEach((stanza, sIdx) => {
              const chunks = typeof window.splitStanzaIntoChunks === 'function' 
                ? window.splitStanzaIntoChunks(stanza, maxLines)
                : [{ ...stanza, chunkIndex: 0, totalChunks: 1, label: stanza.type }];

              chunks.forEach((chunk, cIdx) => {
                const slideId = (chunks.length > 1) ? `medley_${song.id}_${sIdx}_c${cIdx}` : `medley_${song.id}_${sIdx}`;
                const refStr = `${song.title} (${chunk.label})`;
                const isLive = typeof window.isSongSlideLive === 'function' && window.isSongSlideLive(song.id, sIdx, chunks.length > 1 ? cIdx : null);

                window._bentoSlideRegistry.set(slideId, { slideId, text: chunk.text, refStr });
                slidesHtml += `
                  <div id="bento_card_${slideId}" data-slide-id="${slideId}" class="bento-slide-card ${isLive ? 'live' : ''}" onclick="window.projectBentoSlide('${slideId}')">
                    <div class="tag">
                      <span>${escapeHtml(chunk.label || stanza.type || `VERSE ${sIdx + 1}`)}</span>
                      ${isLive ? '<span class="bento-live-badge"></span>' : ''}
                    </div>
                    <div class="ln">${escapeHtml(chunk.text).replace(/\n/g, '<br>')}</div>
                  </div>
                `;
              });
            });
          } else {
            slidesHtml = `
              <div class="bento-empty-unit compact" style="margin:0; padding:18px 10px;">
                <div class="empty-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
                <div class="empty-title">Slot S${idx + 1} empty</div>
                <div class="empty-desc">Drag a song here from library or click Change above.</div>
              </div>
            `;
          }

          col.innerHTML = `
            <div class="bento-slot-col-head">
              <span class="bento-slot-badge">S${idx + 1}</span>
              <span class="t">${song ? escapeHtml(song.title) : 'Empty Slot'}</span>
              <span class="change" onclick="event.stopPropagation(); window.openSongPicker(${idx}, event)">Change</span>
            </div>
            <div class="bento-slides">${slidesHtml}</div>
          `;
          container.appendChild(col);
        }
      }

    } else {
      // SINGLE MODE FULL-WIDTH BENTO GRID
      container.className = 'bento-single-deck';
      container.setAttribute('data-cols', state.bentoSingleCols !== undefined ? state.bentoSingleCols : 1);
      container.style.gridAutoRows = '';

      // Drag & Drop for Single Deck
      container.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        container.classList.add('drag-hover');
      };
      container.ondragleave = (e) => {
        if (!container.contains(e.relatedTarget)) container.classList.remove('drag-hover');
      };
      container.ondrop = (e) => {
        e.preventDefault();
        container.classList.remove('drag-hover');
        let songId = (e.dataTransfer ? e.dataTransfer.getData('application/song-id') : null) ||
          (window.sfDraggedItem && window.sfDraggedItem.type === 'song' ? window.sfDraggedItem.id : null);
        let book = (e.dataTransfer ? e.dataTransfer.getData('application/bible-book') : null) ||
          (window.sfDraggedItem && window.sfDraggedItem.type === 'bible' ? window.sfDraggedItem.id : null);

        if (!songId && !book && e.dataTransfer) {
          const plain = e.dataTransfer.getData('text/plain');
          if (plain) {
            if ((window.SONGS_DATABASE || []).some(s => s.id === plain)) {
              songId = plain;
            } else if ((window.BIBLE_BOOKS || []).includes(plain)) {
              book = plain;
            }
          }
        }

        if (songId) {
          window.state.activeSongId = songId;
          window.state.currentTab = 'songs';
          syncBentoTabsUI();
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          renderBentoDeck();
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
        } else if (book) {
          window.state.activeBibleBook = book;
          window.state.currentTab = 'bible';
          syncBentoTabsUI();
          if (typeof window.renderLibrary === 'function') window.renderLibrary();
          renderBentoDeck();
          if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
        }
      };

      if (currentTab === 'bible') {
        const book = state.activeBibleBook;
        const ch = state.activeBibleChapter || 1;
        const ver = state.bibleVersion || 'KJV';

        if (!book) {
          if (titleEl) {
            titleEl.textContent = 'No Scripture Selected';
            titleEl.removeAttribute('title');
          }
          if (subEl) {
            subEl.textContent = `Select a book from the library · ${ver} Translation`;
            subEl.removeAttribute('title');
          }
          container.innerHTML = `
            <div class="bento-empty-unit hero">
              <div class="empty-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <div class="empty-title">No scripture selected</div>
              <div class="empty-desc">Choose a Bible book from the library on the left to display verses.</div>
            </div>
          `;
        } else {
          const verses = typeof window.getBibleVerses === 'function' ? window.getBibleVerses(book, ch, ver) : [];
          const allChapters = typeof window.getBibleChapters === 'function' ? window.getBibleChapters(book, ver) : [];
          const chNum = parseInt(ch, 10) || 1;
          const hasPrev = chNum > 1;
          const hasNext = chNum < allChapters.length;
          const fullSub = `${verses.length} verses · ${ver} Translation`;

          if (titleEl) {
            const navStyle = (window.state && window.state.scriptureNavStyle) || localStorage.getItem('sf_scripture_nav_style') || 'option1';
            let navHtml = '';

            if (navStyle === 'option1') {
              // Option 1: Flat Text Triggers (Genesis · Ch 12 ▾ : Vs 1 ▾)
              navHtml = `
                <div class="bento-scripture-flat-nav">
                  <span class="book-title">${escapeHtml(book)}</span>
                  <span class="dot-sep">·</span>
                  <button type="button" class="bento-text-trigger" onclick="event.stopPropagation(); window.toggleBentoChapterPopover(event)" title="Jump to Chapter">Ch ${chNum} ▾</button>
                  <span class="colon-sep">:</span>
                  <button type="button" class="bento-text-trigger" id="bento-active-verse-badge" onclick="event.stopPropagation(); window.toggleBentoVersePopover(event)" title="Jump to Verse">Vs 1 ▾</button>
                </div>
              `;
            } else if (navStyle === 'option2') {
              // Option 2: Flat Sibling Buttons (No Outer Container Card)
              navHtml = `
                <div class="bento-scripture-sibling-nav">
                  <span class="book-title">${escapeHtml(book)}</span>
                  <button type="button" class="bento-sibling-btn" onclick="event.stopPropagation(); window.toggleBentoChapterPopover(event)" title="Jump to Chapter">Ch ${chNum} ▾</button>
                  <button type="button" class="bento-sibling-btn" id="bento-active-verse-badge" onclick="event.stopPropagation(); window.toggleBentoVersePopover(event)" title="Jump to Verse">Vs 1 ▾</button>
                </div>
              `;
            } else {
              // Option 3: Unified Single Reference Button
              navHtml = `
                <button type="button" class="bento-unified-ref-btn" id="bento-active-verse-badge" onclick="event.stopPropagation(); window.toggleBentoChapterPopover(event)" title="Jump to Chapter / Verse">${escapeHtml(book)} ${chNum}:1 ▾</button>
              `;
            }

            titleEl.innerHTML = `
              <div class="bento-scripture-title-wrap">
                <button type="button" class="bento-chapter-step-btn" title="Previous Chapter (Shift+Left)" onclick="event.stopPropagation(); window.bentoPrevBibleChapter(event)" ${!hasPrev ? 'disabled' : ''}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                ${navHtml}
                <button type="button" class="bento-chapter-step-btn" title="Next Chapter (Shift+Right)" onclick="event.stopPropagation(); window.bentoNextBibleChapter(event)" ${!hasNext ? 'disabled' : ''}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            `;
            titleEl.removeAttribute('title');
          }
          if (subEl) {
            subEl.textContent = fullSub;
            subEl.removeAttribute('title');
          }

          if (verses.length === 0) {
            container.innerHTML = `
              <div class="bento-empty-unit hero">
                <div class="empty-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <div class="empty-title">No verses found</div>
                <div class="empty-desc">No verses found for ${escapeHtml(book)} ${ch}. Switch translation or chapter.</div>
              </div>
            `;
          } else {
            verses.forEach(v => {
              const slideId = `bible_${book}_${ch}_${v.verse}`;
              const refStr = `${book} ${ch}:${v.verse} (${ver})`;
              const isLive = typeof window.isBibleSlideLive === 'function' && window.isBibleSlideLive(ver, book, ch, v.verse);

              let verseBodyHtml = escapeHtml(v.text);
              if (window.state && window.state.strongsMode) {
                let taggedText = v.text;
                if (typeof BIBLE_DATABASE !== 'undefined' && BIBLE_DATABASE['KJV_STRONGS'] && BIBLE_DATABASE['KJV_STRONGS'][book] && BIBLE_DATABASE['KJV_STRONGS'][book][ch]) {
                  const tv = BIBLE_DATABASE['KJV_STRONGS'][book][ch].find(item => item.verse === v.verse);
                  if (tv && tv.text) taggedText = tv.text;
                }
                if (typeof window.formatStrongsVerseHtml === 'function') {
                  verseBodyHtml = window.formatStrongsVerseHtml(taggedText);
                }
              }

              const card = document.createElement('div');
              card.id = `bento_card_${slideId}`;
              card.setAttribute('data-slide-id', slideId);
              if (card.dataset) card.dataset.slideId = slideId;
              card.className = `bento-single-card ${isLive ? 'live' : ''}`;
              card.onclick = () => window.projectSlide(slideId, v.text, refStr);

              card.innerHTML = `
                ${isLive ? `
                  <svg class="bento-live-shape-svg" aria-hidden="true">
                    <path d="" />
                  </svg>
                ` : ''}
                <div class="head-tag-row">
                  <span class="tag-title">VERSE ${v.verse}</span>
                  ${isLive ? '<div class="live-pill"><span class="dot"></span>LIVE</div>' : ''}
                </div>
                <div class="card-body-text">${verseBodyHtml}</div>
                ${isLive ? `
                  <div class="bento-corner-dock" title="Live on output">
                    <div class="play-circle-btn">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                    </div>
                  </div>
                ` : ''}
              `;
              container.appendChild(card);
              if (isLive) {
                setupLiveCardObserver(card);
              }
            });
          }
        }

      } else {
        const song = (window.SONGS_DATABASE || []).find(s => s.id === state.activeSongId);
        const stanzas = song ? (song.stanzas || []) : [];
        const songTitle = song ? song.title : 'No Song Selected';
        const songSub = song ? `${song.author || 'Unknown Author'} · ${stanzas.length} verses` : 'Select a song from the library to populate slides';
        if (titleEl) {
          titleEl.textContent = songTitle;
          titleEl.removeAttribute('title');
        }
        if (subEl) {
          subEl.textContent = songSub;
          subEl.removeAttribute('title');
        }

        if (!song || stanzas.length === 0) {
          container.innerHTML = `
            <div class="bento-empty-unit hero">
              <div class="empty-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div class="empty-title">No song selected</div>
              <div class="empty-desc">Select a song from the library on the left or press Ctrl+K to search.</div>
            </div>
          `;
        } else {
          const maxLines = state.maxLinesPerSlide || 0;
          stanzas.forEach((stanza, sIdx) => {
            const chunks = typeof window.splitStanzaIntoChunks === 'function' 
              ? window.splitStanzaIntoChunks(stanza, maxLines)
              : [{ ...stanza, chunkIndex: 0, totalChunks: 1, label: stanza.type }];

            chunks.forEach((chunk, cIdx) => {
              const slideId = (chunks.length > 1) ? `${song.id}_${sIdx}_c${cIdx}` : `${song.id}_${sIdx}`;
              const refStr = `${song.title} (${chunk.label})`;
              const isLive = typeof window.isSongSlideLive === 'function' && window.isSongSlideLive(song.id, sIdx, chunks.length > 1 ? cIdx : null);

              const card = document.createElement('div');
              card.id = `bento_card_${slideId}`;
              card.setAttribute('data-slide-id', slideId);
              if (card.dataset) card.dataset.slideId = slideId;
              card.className = `bento-single-card ${isLive ? 'live' : ''}`;
              card.onclick = () => window.projectSlide(slideId, chunk.text, refStr);

              card.innerHTML = `
                ${isLive ? `
                  <svg class="bento-live-shape-svg" aria-hidden="true">
                    <path d="" />
                  </svg>
                ` : ''}
                <div class="head-tag-row">
                  <span class="tag-title">${escapeHtml(chunk.label || stanza.type || `VERSE ${sIdx + 1}`)}</span>
                  ${isLive ? '<div class="live-pill"><span class="dot"></span>LIVE</div>' : ''}
                </div>
                <div class="card-body-text">${escapeHtml(chunk.text).replace(/\n/g, '<br>')}</div>
                ${isLive ? `
                  <div class="bento-corner-dock" title="Live on output">
                    <div class="play-circle-btn">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                    </div>
                  </div>
                ` : ''}
              `;
              container.appendChild(card);
              if (isLive) {
                setupLiveCardObserver(card);
              }
            });
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  function syncBentoStagePreview() {
    const status = document.getElementById('bento-live-status');
    const holdBtn = document.getElementById('bento-hold-btn');
    const transBtn = document.getElementById('bento-trans-btn');
    const scaleLabel = document.getElementById('bento-textscale-label');
    const modeFull = document.getElementById('bento-prev-mode-full');
    const modeLt = document.getElementById('bento-prev-mode-lt');

    const state = window.state || {};
    const liveText = (state.activeLiveText || '').trim();
    const liveRef = (state.activeLiveRef || '').trim();
    const slideId = state.activeLiveSlideId || '';

    let idleHint = document.getElementById('bento-prev-idle-hint');
    const prevBox = document.getElementById('bento-preview-box');
    if (!idleHint && prevBox) {
      idleHint = document.createElement('div');
      idleHint.id = 'bento-prev-idle-hint';
      idleHint.className = 'bento-prev-idle';
      idleHint.innerHTML = `
        <div class="empty-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
        </div>
        <div class="empty-title">Output idle</div>
        <div class="empty-desc">Click any slide or AI suggestion to project live</div>
      `;
      prevBox.insertBefore(idleHint, prevBox.firstChild);
    }

    const overlay = document.getElementById('bento-preview-text-overlay');
    const isBible = slideId.startsWith('bible_') || 
                    slideId.startsWith('medley_bible_') || 
                    slideId.startsWith('para_') || 
                    slideId.startsWith('hist_') ||
                    (slideId.startsWith('ai_') && /\b\d+\s*:\s*\d+/.test(liveRef)) ||
                    (state.currentTab === 'bible' && !slideId.includes('song'));
    const typo = state.typography || {};
    const activeAlign = isBible 
      ? (typo.textAlignBible || typo.textAlign || 'center') 
      : (typo.textAlignSongs || typo.textAlign || 'center');

    if (overlay) {
      overlay.style.textAlign = activeAlign;
      if (activeAlign === 'center') {
        overlay.style.alignItems = 'center';
      } else if (activeAlign === 'right') {
        overlay.style.alignItems = 'flex-end';
      } else {
        overlay.style.alignItems = 'flex-start';
      }

      if (liveText || liveRef) {
        if (idleHint) idleHint.style.display = 'none';

        const isLexiconSlide = Boolean(slideId.startsWith('lexicon_'));

        if (isLexiconSlide) {
          // FOR WORD STUDY / LEXICON: Crisp White Card with Bold Hero Translation
          overlay.classList.add('is-lexicon');
          overlay.classList.remove('is-bible', 'is-lyrics');

          const position = state.concordancePosition || (state.activeLexiconData && state.activeLexiconData.position) || 'right';
          overlay.classList.remove('pos-left', 'pos-center', 'pos-right');
          overlay.classList.add(`pos-${position}`);

          const lexData = state.activeLexiconData || {};
          const entry = window.currentLexiconEntry || lexData || {};
          const lemma = entry.lemma || lexData.lemma || liveText;
          const isHeb = entry.lang === 'Hebrew' || (entry.id && String(entry.id).startsWith('H')) || (lexData.id && String(lexData.id).startsWith('H'));
          const strongId = entry.id || lexData.id || (slideId.startsWith('lexicon_') ? slideId.replace('lexicon_', '').trim().toUpperCase() : '');
          const eng = window.currentLexiconEnglishWord || entry.englishWord || lexData.englishWord || entry.short_definition || lexData.short_definition || lemma;
          const translit = entry.transliteration || lexData.transliteration || '';
          const pron = entry.pronunciation || lexData.pronunciation || '';
          const pos = entry.part_of_speech || lexData.part_of_speech || '';
          const heroWord = translit ? (translit.charAt(0).toUpperCase() + translit.slice(1)) : (lemma || eng);

          overlay.innerHTML = `
            ${strongId || pos ? `
            <div class="bento-lex-meta">
              ${strongId ? `<span class="bento-lex-strong">${escapeHtml(strongId)}</span>` : ''}
              ${pos ? `<span class="bento-lex-pos">${escapeHtml(pos)}</span>` : ''}
            </div>` : ''}
            <div class="bento-lex-translation">${escapeHtml(heroWord)}</div>
            <div class="bento-lex-sub">
              <span class="bento-lex-orig" style="font-family:${isHeb ? "'David Libre', serif" : "'GFS Didot', serif"};">${escapeHtml(lemma)}</span>
              ${pron ? `<span class="bento-lex-dot">•</span><span class="bento-lex-pron">/${escapeHtml(pron)}/</span>` : ''}
              ${eng ? `<span class="bento-lex-dot">•</span><span class="bento-lex-trans">${escapeHtml(eng)}</span>` : ''}
            </div>
          `;
        } else if (!isBible) {
          // FOR LYRICS: Show all song lyric lines with uniform font weight, color, and size (all lines identical)
          overlay.classList.add('is-lyrics');
          overlay.classList.remove('is-bible', 'is-lexicon', 'pos-left', 'pos-center', 'pos-right');

          const rawLines = (liveText || '').split('\n');
          const lines = rawLines.filter(l => l.trim().length > 0);
          
          let lyricsHtml = '';
          if (state.showSongTitleInDisplay && liveRef) {
            lyricsHtml += `<div class="lyric-title-header" style="font-size:9.5px; font-weight:700; color:var(--purple-text, #c3b6ff); text-transform:uppercase; margin-bottom:4px; letter-spacing:0.04em;">${escapeHtml(liveRef)}</div>`;
          }
          if (lines.length > 0) {
            lyricsHtml += lines.map(line => `<div class="lyric-line">${escapeHtml(line.trim())}</div>`).join('');
          } else if (liveText) {
            lyricsHtml += `<div class="lyric-line">${escapeHtml(liveText)}</div>`;
          }
          overlay.innerHTML = lyricsHtml;
        } else {
          // FOR BIBLE: Retain existing scripture reference and verse layout
          overlay.classList.add('is-bible');
          overlay.classList.remove('is-lyrics', 'is-lexicon', 'pos-left', 'pos-center', 'pos-right');

          const lines = liveText.split('\n');
          const line1 = lines[0] || liveRef;
          const line2 = lines.slice(1).join(' ') || (lines[0] ? liveRef : '');
          overlay.innerHTML = `
            <div class="l1" id="bento-prev-l1">${escapeHtml(line1)}</div>
            <div class="l2" id="bento-prev-l2">${escapeHtml(line2)}</div>
          `;
        }

        const prevKey = overlay.dataset ? overlay.dataset.lastContentKey : '';
        const curKey = (liveText || '') + '|' + (liveRef || '') + '|' + isBible;
        if (prevKey !== curKey) {
          if (overlay.dataset) overlay.dataset.lastContentKey = curKey;
          const transType = (state.transitionType || 'fade').toLowerCase().replace(/[\s_]+/g, '-');
          if (transType !== 'cut') {
            overlay.classList.remove('bento-trans-anim');
            void overlay.offsetWidth;
            overlay.classList.add('bento-trans-anim');
          }
        }
      } else {
        if (overlay.dataset) overlay.dataset.lastContentKey = '';
        overlay.classList.remove('is-lyrics', 'is-bible', 'is-lexicon', 'pos-left', 'pos-center', 'pos-right', 'bento-trans-anim');
        overlay.innerHTML = `
          <div class="l1" id="bento-prev-l1"></div>
          <div class="l2" id="bento-prev-l2"></div>
        `;
        if (idleHint) idleHint.style.display = 'flex';
      }
    }

    if (status) {
      const isLive = !!(state.activeLiveSlideId && !state.isClear && !state.clear && !state.blackout);
      status.classList.toggle('idle', !isLive);
      status.style.opacity = '1';
      if (isLive) {
        status.innerHTML = `<i></i>LIVE`;
      } else {
        status.innerHTML = `<i></i>IDLE`;
      }
    }

    if (holdBtn) {
      holdBtn.classList.toggle('active', !!state.isHoldLive);
      holdBtn.textContent = state.isHoldLive ? 'Locked' : 'Hold';
    }

    if (transBtn) {
      transBtn.classList.toggle('active', !!state.transparentBg);
    }

    if (scaleLabel) {
      const scale = state.textSize || 1.0;
      scaleLabel.textContent = scale.toFixed(1) + 'x';
      if (prevBox && prevBox.style && typeof prevBox.style.setProperty === 'function') {
        prevBox.style.setProperty('--user-scale', scale);
      }
    }

    const isLt = state.currentMode === 'livestream' || state.currentMode === 'lt';

    if (prevBox) {
      prevBox.classList.toggle('mode-lt', isLt);
      prevBox.classList.toggle('mode-full', !isLt);
      prevBox.classList.toggle('trans-active', !!state.transparentBg);
      const resTag = prevBox.querySelector('.res-tag');
      if (resTag) {
        resTag.textContent = isLt ? 'Lower-third • 1080p' : 'Full display • 1080p';
      }
    }

    if (modeFull && modeLt) {
      modeFull.classList.toggle('active', !isLt);
      modeLt.classList.toggle('active', isLt);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. BENTO AI SPEECH HUD & RECOMMENDATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  function syncBentoAiHud() {
    const transcriptEl = document.getElementById('bento-ai-transcript-text');
    const listEl = document.getElementById('bento-ai-feed-list');
    const state = window.state || {};
    const isListening = !!state.aiListening;

    // ── Update live indicator dot ───────────────────────────────────────────────
    const liveDot = document.getElementById('bento-ai-live-dot');
    if (liveDot) {
      liveDot.classList.toggle('active', isListening);
    }

    // ── Update live transcript box ──────────────────────────────────────────────
    if (transcriptEl) {
      const transcript = (state.aiTranscript || '').trim();
      if (transcript && isListening) {
        transcriptEl.textContent = `"${transcript}"`;
        transcriptEl.style.fontStyle = 'italic';
        transcriptEl.style.color = 'var(--text, #f3f2f7)';
      } else if (isListening) {
        transcriptEl.textContent = 'Listening... speak scripture or sing lyrics live.';
        transcriptEl.style.fontStyle = 'normal';
        transcriptEl.style.color = 'var(--mute, #696773)';
      } else {
        transcriptEl.textContent = 'Click "AI Mic" to listen to preacher speech or choir...';
        transcriptEl.style.fontStyle = 'normal';
        transcriptEl.style.color = 'var(--mute, #696773)';
      }
    }

    // ── Update History button label ─────────────────────────────────────────────
    const docBadgeEl = document.getElementById('bento-transcript-badge-text');
    if (docBadgeEl) {
      docBadgeEl.textContent = 'History';
    }

    // ── Render unified live stream ──────────────────────────────────────────────
    if (!listEl) return;
    listEl.innerHTML = '';

    // Unified Live Stream: verses, songs, and Strong's concordance
    const verses = (state.aiDetectedVerses || []).map(v => ({ ...v, _type: 'verse' }));
    const songs = (state.aiDetectedSongs || []).map(s => ({ ...s, _type: 'song' }));
    let concordance = [];
    if (window.sermonManager && window.sermonManager.session && Array.isArray(window.sermonManager.session.paragraphs)) {
      window.sermonManager.session.paragraphs.forEach(p => {
        if (Array.isArray(p.concordance)) {
          p.concordance.forEach(c => {
            concordance.push({ ...c, _type: 'concordance', time: p.time });
          });
        }
      });
    }

    const items = [...verses, ...songs, ...concordance];

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="bento-empty-unit compact">
          <div class="empty-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          </div>
          <div class="empty-title">Listening for scriptures & songs</div>
          <div class="empty-desc">Turn on AI Mic to automatically detect spoken verses and worship lyrics live.</div>
        </div>
      `;
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bento-ai-card';

      if (item._type === 'concordance') {
        const isHebrew = (item.id && item.id.startsWith('H'));
        card.style.cursor = 'pointer';
        card.onclick = () => {
          if (window.openLexiconInspector) window.openLexiconInspector(item.id);
        };
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;gap:6px;">
            <div style="display:flex;align-items:center;gap:5px;min-width:0;">
              <span style="font-size:8.5px;font-weight:700;padding:2px 5px;border-radius:4px;background:var(--amber-dim, rgba(242, 185, 59, 0.15));color:var(--amber, #f2b93b);flex-shrink:0;">${isHebrew ? 'HEBREW' : 'GREEK'}</span>
              <span style="font-weight:700;color:var(--amber, #f2b93b);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.id)}: ${escapeHtml(item.translit || '')} (${escapeHtml(item.lemma || '')})</span>
            </div>
            ${item.time ? `<span style="font-size:9px;color:var(--mute);flex-shrink:0;">${escapeHtml(item.time)}</span>` : ''}
          </div>
          ${item.shortDef ? `<div style="font-size:10px;color:var(--dim);line-height:1.5;margin-bottom:7px;">${escapeHtml(item.shortDef)}</div>` : ''}
          <div style="display:flex;gap:6px;">
            <button class="bento-ai-btn proj" style="background:var(--amber, #f2b93b);color:#131218;border:none;border-radius:6px;padding:4px 10px;font-size:9.5px;font-weight:700;cursor:pointer;" onclick="event.stopPropagation();if(window.openLexiconInspector)window.openLexiconInspector('${escapeHtml(item.id)}')">Word Study</button>
          </div>
        `;
        listEl.appendChild(card);
        return;
      }

      const isSong = !!(item.songId || item.songTitle || item._type === 'song');
      const ref = item.rawReference || item.reference || item.title || item.songTitle || 'Reference';
      const text = item.text || item.matchedSnippet || item.fullStanzaText || '';
      const sugId = item.id || item.rawReference || item.reference || item.title || item.songId;
      const conf = item.confidence ? `${item.confidence}%` : '';
      const timeStr = item.time || '';
      const isAgenda = !!item.isAgenda;
      const isUncataloged = !!item.isUncataloged;

      const accentColor = isUncataloged ? 'var(--pink, #f178b6)' : (isSong ? 'var(--green, #3ecf7e)' : 'var(--purple-text, #c3b6ff)');
      const labelText = isSong ? 'SONG' : 'SCRIPTURE';
      const labelBg = isSong ? 'var(--green-dim, rgba(62, 207, 126, 0.15))' : 'var(--purple-dim, rgba(138, 109, 255, 0.16))';

      const actionHtml = isUncataloged
        ? `<button class="bento-ai-btn proj" style="background:var(--purple, #8a6dff);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:9.5px;font-weight:700;cursor:pointer;" onclick="event.stopPropagation();window.openAutoLyricsWithQuery('${escapeHtml(item.query || ref)}')">Search Online</button>`
        : `
          <button class="bento-ai-btn proj" style="background:var(--purple, #8a6dff);color:#fff;border:none;border-radius:6px;padding:4px 9px;font-size:9.5px;font-weight:700;cursor:pointer;" onclick="event.stopPropagation();window.projectAiSuggestion('${escapeHtml(sugId)}')">Project</button>
          <button class="bento-ai-btn add" style="background:var(--card-3);color:var(--dim);border:1px solid var(--border-strong);border-radius:6px;padding:4px 8px;font-size:9.5px;font-weight:600;cursor:pointer;" onclick="event.stopPropagation();window.addAiToAgenda('${escapeHtml(sugId)}')">+ Agenda</button>
        `;

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;gap:6px;">
          <div style="display:flex;align-items:center;gap:5px;min-width:0;">
            <span style="font-size:8.5px;font-weight:700;padding:2px 5px;border-radius:4px;background:${labelBg};color:${accentColor};flex-shrink:0;">${labelText}</span>
            <span style="font-weight:700;color:${accentColor};font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ref)}</span>
            ${isAgenda ? '<span style="font-size:8px;background:var(--purple-dim, rgba(138, 109, 255, 0.16));color:var(--purple-text, #c3b6ff);padding:1px 4px;border-radius:4px;font-weight:700;flex-shrink:0;">AGENDA</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
            ${conf ? `<span style="font-size:9px;color:var(--mute);background:var(--card-2);padding:1px 5px;border-radius:6px;">${conf}</span>` : ''}
            ${timeStr ? `<span style="font-size:9px;color:var(--mute);">${escapeHtml(timeStr)}</span>` : ''}
          </div>
        </div>
        ${text ? `<div style="font-size:10px;color:var(--dim);line-height:1.5;margin-bottom:7px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(text)}</div>` : ''}
        <div style="display:flex;gap:6px;">${actionHtml}</div>
      `;
      listEl.appendChild(card);
    });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // 6. GLOBAL HELPERS & TOPBAR CONTROLLERS
  // ─────────────────────────────────────────────────────────────────────────────
  function syncBentoTabsUI() {
    const tabBible = document.getElementById('bento-tab-bible');
    const tabSongs = document.getElementById('bento-tab-songs');
    const transSel = document.getElementById('bento-trans-sel');
    const searchInput = document.getElementById('bento-search-input');
    const curTab = window.state ? window.state.currentTab : 'songs';

    if (tabBible) tabBible.classList.toggle('active', curTab === 'bible');
    if (tabSongs) tabSongs.classList.toggle('active', curTab === 'songs');

    if (transSel) {
      transSel.style.display = (curTab === 'bible') ? 'flex' : 'none';
    }

    if (searchInput) {
      searchInput.placeholder = curTab === 'bible' ? 'Filter books & chapters (Ctrl+L)...' : 'Search title, artist, lyric line (Ctrl+L)...';
    }
  }

  window.switchBentoTab = function(tab) {
    if (typeof window.switchLibraryTab === 'function') {
      window.switchLibraryTab(tab);
      return;
    }
    if (!window.state) return;
    window.state.currentTab = tab;
    syncBentoTabsUI();
    renderBentoLibrary();
    renderBentoDeck();
    if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
  };

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        syncBentoTabsUI();
        renderBentoAgenda();
        renderBentoLibrary();
        renderBentoDeck();
        syncBentoStagePreview();
        syncBentoAiHud();
      });
    } else {
      syncBentoTabsUI();
      renderBentoAgenda();
      renderBentoLibrary();
      renderBentoDeck();
      syncBentoStagePreview();
      syncBentoAiHud();
    }
  }

  window.clearBentoSearch = function() {
    const input = document.getElementById('bento-search-input');
    const clearBtn = document.getElementById('bento-search-clear');
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    renderBentoLibrary('');
  };

  let _bentoSearchDebounceTimer = null;
  window.handleBentoSearch = function(val) {
    const clearBtn = document.getElementById('bento-search-clear');
    if (clearBtn) {
      clearBtn.style.display = (val && val.trim().length > 0) ? 'inline-block' : 'none';
    }
    if (_bentoSearchDebounceTimer) clearTimeout(_bentoSearchDebounceTimer);
    _bentoSearchDebounceTimer = setTimeout(() => {
      renderBentoLibrary(val);
    }, 120);
  };

  window.assignBibleBookToSlot = function(book, slotIdx) {
    if (!window.state) return;
    if (!Array.isArray(window.state.medleyBibleSlots)) {
      window.state.medleyBibleSlots = [null, null, null];
    }
    window.state.medleyBibleSlots[slotIdx] = {
      book: book,
      chapter: 1,
      version: window.state.bibleVersion || 'KJV'
    };
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderDeck === 'function') window.renderDeck(true);
    if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setBentoSingleCols(cols) {
    cols = parseInt(cols, 10) || 2;
    if (window.state) window.state.bentoSingleCols = cols;
    try { localStorage.setItem('sf_bento_single_cols', cols); } catch(e) {}
    const seg = document.getElementById('bento-cols-seg');
    if (seg) {
      seg.querySelectorAll('span').forEach(sp => {
        sp.classList.toggle('active', parseInt(sp.dataset.cols, 10) === cols);
      });
    }
    const deck = document.getElementById('bento-medley-container');
    if (deck) {
      deck.setAttribute('data-cols', cols);
      deck.style.gridAutoRows = 'minmax(min-content, max-content)';
    }

    // Instantly recalibrate live card SVG cutout to match the new column width
    requestAnimationFrame(() => {
      const liveCards = document.querySelectorAll('.bento-single-card.live');
      liveCards.forEach(card => {
        if (typeof window.updateBentoLiveCardShape === 'function') {
          window.updateBentoLiveCardShape(card);
        }
        if (typeof window.setupLiveCardObserver === 'function') {
          window.setupLiveCardObserver(card);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. BENTO BIBLE CHAPTER NAVIGATION & FLOATING HUD POPOVER
  // ─────────────────────────────────────────────────────────────────────────────
  window.selectBentoBibleChapter = function(book, chNum, openVerseNext = true, triggerEl = null) {
    if (!window.state) window.state = {};
    const parsedCh = parseInt(chNum, 10) || 1;
    closeBentoChapterPopover();

    // Capture button geometry immediately before any DOM updates
    let savedRect = null;
    let isDrawer = false;
    const rawEl = triggerEl && (triggerEl.currentTarget || triggerEl.target || triggerEl);
    if (rawEl && typeof rawEl.getBoundingClientRect === 'function') {
      const r = rawEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        savedRect = { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
        isDrawer = rawEl.classList && rawEl.classList.contains('bento-drawer-btn');
      }
    }

    if (openVerseNext) {
      // User clicked a chapter to pick a verse: DO NOT change the main deck yet!
      window.state.pendingVerseSelection = { book: book, chapter: parsedCh };

      // Highlight the chapter button being browsed in the drawer
      document.querySelectorAll('.bento-drawer-btn.picking-active').forEach(el => {
        el.classList.remove('picking-active');
      });
      if (rawEl && rawEl.classList && rawEl.classList.contains('bento-drawer-btn')) {
        rawEl.classList.add('picking-active');
      }

      setTimeout(() => {
        if (typeof window.toggleBentoVersePopover === 'function') {
          window.toggleBentoVersePopover({
            book: book,
            chapter: parsedCh,
            savedRect: savedRect,
            isDrawerBtn: isDrawer,
            currentTarget: rawEl || document.getElementById('bento-active-verse-badge'),
            stopPropagation: () => {}
          });
        }
      }, 10);
      return;
    }

    // Direct chapter selection (e.g. keyboard navigation without verse picker)
    window.state.activeBibleBook = book;
    window.state.activeBibleChapter = parsedCh;
    window.state.expandedBibleBook = book;
    window.state.pendingVerseSelection = null;
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderDeck === 'function') window.renderDeck(true);
    if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
  };

  window.bentoPrevBibleChapter = function(e) {
    if (e) e.stopPropagation();
    if (!window.state) return;
    const curBook = window.state.activeBibleBook;
    const ver = window.state.bibleVersion || 'KJV';
    const books = typeof window.getBibleBooks === 'function' ? window.getBibleBooks(ver) : [];
    const curBookIdx = books.indexOf(curBook);
    const curCh = parseInt(window.state.activeBibleChapter, 10) || 1;

    if (curCh > 1) {
      window.state.activeBibleChapter = curCh - 1;
    } else if (curBookIdx > 0) {
      window.state.activeBibleBook = books[curBookIdx - 1];
      const prevChs = typeof window.getBibleChapters === 'function' ? window.getBibleChapters(window.state.activeBibleBook, ver) : [1];
      window.state.activeBibleChapter = prevChs.length > 0 ? prevChs.length : 1;
      window.state.expandedBibleBook = window.state.activeBibleBook;
    }
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderDeck === 'function') window.renderDeck(true);
    if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
  };

  window.bentoNextBibleChapter = function(e) {
    if (e) e.stopPropagation();
    if (!window.state) return;
    const curBook = window.state.activeBibleBook;
    const ver = window.state.bibleVersion || 'KJV';
    const books = typeof window.getBibleBooks === 'function' ? window.getBibleBooks(ver) : [];
    const curBookIdx = books.indexOf(curBook);
    const chs = typeof window.getBibleChapters === 'function' ? window.getBibleChapters(curBook, ver) : [1];
    const curCh = parseInt(window.state.activeBibleChapter, 10) || 1;

    if (curCh < chs.length) {
      window.state.activeBibleChapter = curCh + 1;
    } else if (curBookIdx !== -1 && curBookIdx + 1 < books.length) {
      window.state.activeBibleBook = books[curBookIdx + 1];
      window.state.activeBibleChapter = 1;
      window.state.expandedBibleBook = window.state.activeBibleBook;
    }
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderDeck === 'function') window.renderDeck(true);
    if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();
  };

  function renderBentoChapterPopoverGrid(filterQ = '') {
    const list = document.getElementById('bento-chapter-popover-grid');
    if (!list) return;
    list.innerHTML = '';

    const book = (window.state && window.state.activeBibleBook) ? window.state.activeBibleBook : 'Genesis';
    const ver = (window.state && window.state.bibleVersion) ? window.state.bibleVersion : 'KJV';
    const chs = typeof window.getBibleChapters === 'function' ? window.getBibleChapters(book, ver) : [];
    const curCh = parseInt(window.state && window.state.activeBibleChapter, 10) || 1;
    const q = (filterQ || '').trim();

    const filtered = q ? chs.filter(c => c.startsWith(q) || c === q) : chs;

    if (filtered.length === 0) {
      list.innerHTML = `<div style="grid-column:1/-1; padding:12px; text-align:center; color:var(--dim); font-size:11px;">No chapters found</div>`;
      return;
    }

    filtered.forEach(chStr => {
      const chNum = parseInt(chStr, 10);
      const isActive = chNum === curCh;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bento-popover-btn ${isActive ? 'active' : ''}`;
      btn.textContent = chNum;
      btn.onclick = (e) => {
        e.stopPropagation();
        window.selectBentoBibleChapter(book, chNum, true, e.currentTarget);
      };
      list.appendChild(btn);
    });
  }

  window.toggleBentoChapterPopover = function(event) {
    if (event) event.stopPropagation();
    let popover = document.getElementById('bento-chapter-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'bento-chapter-popover';
      popover.className = 'bento-chapter-popover';
      popover.innerHTML = `
        <div class="bento-popover-search">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="bento-popover-search-input" placeholder="Type chapter number..." autocomplete="off">
        </div>
        <div class="bento-popover-grid" id="bento-chapter-popover-grid"></div>
      `;
      document.body.appendChild(popover);

      const searchInp = popover.querySelector('#bento-popover-search-input');
      if (searchInp) {
        searchInp.oninput = (e) => renderBentoChapterPopoverGrid(e.target.value);
        searchInp.onkeydown = (e) => {
          if (e.key === 'Enter') {
            const val = parseInt(e.target.value.trim(), 10);
            if (!isNaN(val) && window.state && window.state.activeBibleBook) {
              window.selectBentoBibleChapter(window.state.activeBibleBook, val);
              setTimeout(() => {
                if (typeof window.toggleBentoVersePopover === 'function') {
                  const verseTrigger = document.getElementById('bento-active-verse-badge');
                  if (verseTrigger) {
                    window.toggleBentoVersePopover({ currentTarget: verseTrigger, stopPropagation: () => {} });
                  }
                }
              }, 50);
            }
          } else if (e.key === 'Escape') {
            closeBentoChapterPopover();
          }
        };
      }
    }

    const isOpen = popover.classList.contains('open');
    if (isOpen) {
      closeBentoChapterPopover();
      return;
    }

    const targetEl = event ? (event.currentTarget || event.target) : document.querySelector('.bento-chapter-capsule .badge:not(.badge-verse)');
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      popover.style.position = 'fixed';
      popover.style.top = `${rect.bottom + 8}px`;
      popover.style.left = `${Math.max(10, Math.min(window.innerWidth - 300, rect.left))}px`;
    }

    const searchInp = popover.querySelector('#bento-popover-search-input');
    if (searchInp) searchInp.value = '';
    renderBentoChapterPopoverGrid('');
    popover.classList.add('open');
    if (searchInp && typeof searchInp.focus === 'function') {
      setTimeout(() => {
        if (typeof searchInp.focus === 'function') searchInp.focus();
      }, 60);
    }
  };

  function closeBentoChapterPopover() {
    const popover = document.getElementById('bento-chapter-popover');
    if (popover) popover.classList.remove('open');
  }
  window.closeBentoChapterPopover = closeBentoChapterPopover;

  function renderBentoVersePopoverGrid(filterQ = '') {
    const list = document.getElementById('bento-verse-popover-grid');
    const popover = document.getElementById('bento-verse-popover');
    if (!list) return;
    list.innerHTML = '';

    const book = (popover && popover._targetBook) || (window.state && (window.state.pendingVerseSelection?.book || window.state.activeBibleBook)) || 'Genesis';
    const ch = parseInt((popover && popover._targetChapter) || (window.state && (window.state.pendingVerseSelection?.chapter || window.state.activeBibleChapter)), 10) || 1;
    const ver = (window.state && window.state.bibleVersion) ? window.state.bibleVersion : 'KJV';
    const verses = typeof window.getBibleVerses === 'function' ? window.getBibleVerses(book, ch, ver) : [];
    const titleEl = document.getElementById('bento-verse-popover-title');
    const cntEl = document.getElementById('bento-verse-popover-cnt');
    if (titleEl) titleEl.textContent = `${book} ${ch} · Verses`;
    if (cntEl) cntEl.textContent = `${verses.length} vs`;

    const q = (filterQ || '').trim();
    const filtered = q ? verses.filter(v => String(v.verse).startsWith(q) || String(v.verse) === q) : verses;

    if (filtered.length === 0) {
      list.innerHTML = `<div style="grid-column:1/-1; padding:12px; text-align:center; color:var(--dim); font-size:11px;">No verses found</div>`;
      return;
    }

    filtered.forEach(v => {
      const vNum = v.verse;
      const slideId = `bible_${book}_${ch}_${vNum}`;
      const isLive = typeof window.isBibleSlideLive === 'function' && window.isBibleSlideLive(ver, book, ch, vNum);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bento-popover-btn ${isLive ? 'active' : ''}`;
      btn.textContent = vNum;
      btn.onclick = (e) => {
        e.stopPropagation();
        window.selectBentoBibleVerse(vNum, book, ch);
      };
      list.appendChild(btn);
    });
  }

  window.selectBentoBibleVerse = function(verseNum, targetBook = null, targetChapter = null) {
    const popover = document.getElementById('bento-verse-popover');
    const book = targetBook || (popover && popover._targetBook) || (window.state && (window.state.pendingVerseSelection?.book || window.state.activeBibleBook)) || 'Genesis';
    const ch = parseInt(targetChapter || (popover && popover._targetChapter) || (window.state && (window.state.pendingVerseSelection?.chapter || window.state.activeBibleChapter)), 10) || 1;

    closeBentoVersePopover();

    if (!window.state) window.state = {};
    window.state.activeBibleBook = book;
    window.state.activeBibleChapter = ch;
    window.state.expandedBibleBook = book;
    window.state.pendingVerseSelection = null;

    // Transition the main deck and library synchronously to the newly selected passage
    if (typeof window.renderLibrary === 'function') window.renderLibrary();
    if (typeof window.renderDeck === 'function') window.renderDeck(true);
    if (typeof window.syncDashboardWorkspace === 'function') window.syncDashboardWorkspace();

    const badge = document.getElementById('bento-active-verse-badge');
    if (badge) {
      if (badge.classList.contains('bento-unified-ref-btn')) {
        badge.textContent = `${book} ${ch}:${verseNum} ▾`;
      } else {
        badge.textContent = `Vs ${verseNum} ▾`;
      }
    }
    const slideId = `bible_${book}_${ch}_${verseNum}`;
    const card = document.getElementById(`bento_card_${slideId}`);
    if (card) {
      window._bentoVerseSelecting = true;
      const scrollContainer = card.closest('.bento-single-deck, .bento-slides') || document.getElementById('bento-medley-container');
      if (scrollContainer) {
        const cardRect = card.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const offset = cardRect.top - containerRect.top;
        const targetScrollTop = scrollContainer.scrollTop + offset - (containerRect.clientHeight / 2) + (cardRect.clientHeight / 2);
        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }

      // Guarantee outer deck card, center column, and page window never scroll or shift
      const deckCard = document.getElementById('bento-deck-card');
      if (deckCard && deckCard.scrollTop !== 0) deckCard.scrollTop = 0;
      const colCenter = document.getElementById('bento-col-center');
      if (colCenter && colCenter.scrollTop !== 0) colCenter.scrollTop = 0;
      if (window.scrollY !== 0) window.scrollTo(0, 0);

      card.classList.add('bento-card-pulse');
      setTimeout(() => card.classList.remove('bento-card-pulse'), 1200);
      card.click();

      setTimeout(() => {
        window._bentoVerseSelecting = false;
        if (deckCard && deckCard.scrollTop !== 0) deckCard.scrollTop = 0;
        if (colCenter && colCenter.scrollTop !== 0) colCenter.scrollTop = 0;
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      }, 400);
    } else {
      if (typeof window.projectSlide === 'function') {
        window.projectSlide(slideId);
      }
    }
  };

  window.toggleBentoVersePopover = function(event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    closeBentoChapterPopover();
    let popover = document.getElementById('bento-verse-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'bento-verse-popover';
      popover.className = 'bento-chapter-popover bento-verse-popover';
      popover.innerHTML = `
        <div class="bento-drawer-head" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <span id="bento-verse-popover-title" style="font-size:11px; font-weight:700; color:var(--purple-text, #c4b5fd);">Select verse</span>
          <span id="bento-verse-popover-cnt" class="cnt" style="font-size:10px; color:var(--dim, #a3a1ae);"></span>
        </div>
        <div class="bento-popover-search">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="bento-verse-popover-search-input" placeholder="Type verse number..." autocomplete="off">
        </div>
        <div class="bento-popover-grid" id="bento-verse-popover-grid"></div>
      `;
      document.body.appendChild(popover);

      const searchInp = popover.querySelector('#bento-verse-popover-search-input');
      if (searchInp) {
        searchInp.oninput = (e) => renderBentoVersePopoverGrid(e.target.value);
        searchInp.onkeydown = (e) => {
          if (e.key === 'Enter') {
            const val = parseInt(e.target.value.trim(), 10);
            if (!isNaN(val)) {
              window.selectBentoBibleVerse(val, popover._targetBook, popover._targetChapter);
            }
          } else if (e.key === 'Escape') {
            closeBentoVersePopover();
          }
        };
      }
    }

    const targetBook = (event && event.book) || (window.state && window.state.pendingVerseSelection?.book) || (window.state && window.state.activeBibleBook) || 'Genesis';
    const targetChapter = parseInt((event && event.chapter) || (window.state && window.state.pendingVerseSelection?.chapter) || (window.state && window.state.activeBibleChapter), 10) || 1;

    const isOpen = popover.classList.contains('open');
    if (isOpen && popover._targetBook === targetBook && popover._targetChapter === targetChapter && !event?.savedRect) {
      closeBentoVersePopover();
      return;
    }

    popover._targetBook = targetBook;
    popover._targetChapter = targetChapter;

    // Render contents first so popover has actual rendered elements to measure
    const searchInp = popover.querySelector('#bento-verse-popover-search-input');
    if (searchInp) searchInp.value = '';
    renderBentoVersePopoverGrid('');

    // Open so real rendered height and width can be accurately calculated
    popover.classList.add('open');

    const targetEl = (event && (event.currentTarget || event.target)) || document.getElementById('bento-active-verse-badge');
    const isDrawerBtn = (event && event.isDrawerBtn) || (targetEl && targetEl.classList && targetEl.classList.contains('bento-drawer-btn'));
    const rect = (event && event.savedRect) || (targetEl && typeof targetEl.getBoundingClientRect === 'function' ? targetEl.getBoundingClientRect() : null);

    // Measure actual rendered dimensions dynamically
    const popoverHeight = popover.offsetHeight || 300;
    const popoverWidth = popover.offsetWidth || 290;

    if (rect) {
      popover.style.position = 'fixed';
      if (isDrawerBtn) {
        let left = rect.right + 12;
        let top = rect.top - 12;

        // Check horizontal screen overflow (flip arrow if near right edge)
        if (left + popoverWidth > window.innerWidth - 12) {
          left = Math.max(12, rect.left - popoverWidth - 12);
          popover.classList.remove('flyout-left-arrow');
          popover.classList.add('flyout-right-arrow');
        } else {
          popover.classList.remove('flyout-right-arrow');
          popover.classList.add('flyout-left-arrow');
        }

        // Strict vertical clamping: NEVER go outside the screen
        const maxTop = window.innerHeight - popoverHeight - 16;
        if (top > maxTop) {
          top = maxTop;
        }
        if (top < 12) {
          top = 12;
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;

        // Arrow vertical alignment directly to clicked chapter button center
        const btnCenterY = rect.top + (rect.height / 2);
        const arrowTop = Math.max(16, Math.min(popoverHeight - 24, btnCenterY - top - 7));
        popover.style.setProperty('--arrow-top', `${arrowTop}px`);
      } else {
        popover.classList.remove('flyout-left-arrow', 'flyout-right-arrow');
        let top = rect.bottom + 8;
        let left = Math.max(10, Math.min(window.innerWidth - popoverWidth - 12, rect.left));
        const maxTop = window.innerHeight - popoverHeight - 16;
        if (top > maxTop) {
          const topAbove = rect.top - popoverHeight - 8;
          top = topAbove >= 12 ? topAbove : Math.max(12, maxTop);
        }
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
      }
    } else {
      popover.classList.remove('flyout-left-arrow', 'flyout-right-arrow');
      popover.style.position = 'fixed';
      popover.style.top = '100px';
      popover.style.left = '320px';
    }

    if (searchInp && typeof searchInp.focus === 'function') {
      setTimeout(() => {
        if (typeof searchInp.focus === 'function') searchInp.focus();
      }, 60);
    }
  };

  function closeBentoVersePopover() {
    const popover = document.getElementById('bento-verse-popover');
    if (popover) {
      popover.classList.remove('open');
      popover.classList.remove('flyout-left-arrow', 'flyout-right-arrow');
    }
    if (window.state) {
      window.state.pendingVerseSelection = null;
    }
    document.querySelectorAll('.bento-drawer-btn.picking-active').forEach(el => {
      el.classList.remove('picking-active');
    });
  }
  window.closeBentoVersePopover = closeBentoVersePopover;

  // Global outside click and escape listeners
  document.addEventListener('click', (e) => {
    const chPopover = document.getElementById('bento-chapter-popover');
    if (chPopover && chPopover.classList.contains('open')) {
      if (!chPopover.contains(e.target) && !e.target.closest('.bento-text-trigger, .bento-sibling-btn, .bento-unified-ref-btn, .bento-chapter-capsule')) {
        closeBentoChapterPopover();
      }
    }
    const vsPopover = document.getElementById('bento-verse-popover');
    if (vsPopover && vsPopover.classList.contains('open')) {
      if (!vsPopover.contains(e.target) && !e.target.closest('#bento-active-verse-badge, .bento-drawer-btn')) {
        closeBentoVersePopover();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBentoChapterPopover();
      closeBentoVersePopover();
    }
  });

  window.setScriptureNavStyle = function(style) {
    if (!window.state) window.state = {};
    window.state.scriptureNavStyle = style;
    try { localStorage.setItem('sf_scripture_nav_style', style); } catch (e) {}
    if (typeof window.renderBentoDeck === 'function') {
      window.renderBentoDeck();
    }
  };

  // Lock outer deck container and middle column against any inadvertent browser scroll
  const setupDeckScrollGuards = () => {
    const deckCard = document.getElementById('bento-deck-card');
    if (deckCard) {
      deckCard.addEventListener('scroll', () => {
        if (deckCard.scrollTop !== 0) deckCard.scrollTop = 0;
        if (deckCard.scrollLeft !== 0) deckCard.scrollLeft = 0;
      }, { passive: true });
    }
    const colCenter = document.getElementById('bento-col-center');
    if (colCenter) {
      colCenter.addEventListener('scroll', () => {
        if (colCenter.scrollTop !== 0) colCenter.scrollTop = 0;
        if (colCenter.scrollLeft !== 0) colCenter.scrollLeft = 0;
      }, { passive: true });
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDeckScrollGuards);
  } else {
    setupDeckScrollGuards();
  }

  // Export renderers to global window object
  window.setBentoSingleCols = setBentoSingleCols;
  window.renderBentoAgenda = renderBentoAgenda;
  window.renderBentoLibrary = renderBentoLibrary;
  window.renderBentoDeck = renderBentoDeck;
  window.syncBentoStagePreview = syncBentoStagePreview;
  window.syncBentoAiHud = syncBentoAiHud;
  window.syncBentoTabsUI = syncBentoTabsUI;

})();

