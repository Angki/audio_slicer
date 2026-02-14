/**
 * AutoSlice — Discogs UI Module
 * Search releases, display tracklist, apply to markers.
 */

let _state = null;

export function initDiscogs(state) {
    _state = state;

    const $btnSearch = document.getElementById('btnDiscogsSearch');
    const $artist = document.getElementById('discogsArtist');
    const $album = document.getElementById('discogsAlbum');
    const $token = document.getElementById('discogsToken');
    const $results = document.getElementById('discogsResults');
    const $tracklist = document.getElementById('discogsTracklist');

    // Load saved token from localStorage
    const savedToken = localStorage.getItem('autoslice_discogs_token');
    if (savedToken) $token.value = savedToken;

    // ── Search ──
    $btnSearch.addEventListener('click', async () => {
        const artist = $artist.value.trim();
        const album = $album.value.trim();
        const token = $token.value.trim();

        if (!artist && !album) {
            alert('Enter at least an artist or album name');
            return;
        }

        // Save token for future use
        if (token) localStorage.setItem('autoslice_discogs_token', token);

        try {
            $btnSearch.disabled = true;
            $btnSearch.textContent = 'Searching...';
            $results.innerHTML = '<div class="empty-state">Searching Discogs...</div>';
            $tracklist.classList.add('hidden');

            const results = await window.api.discogsSearch({ artist, album, token });

            if (results.length === 0) {
                $results.innerHTML = '<div class="empty-state">No results found</div>';
                return;
            }

            renderResults(results, token);
        } catch (err) {
            console.error('Discogs search error:', err);
            $results.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
        } finally {
            $btnSearch.disabled = false;
            $btnSearch.textContent = 'Search';
        }
    });

    // Allow Enter key to trigger search
    [$artist, $album].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $btnSearch.click();
        });
    });
}

function renderResults(results, token) {
    const $results = document.getElementById('discogsResults');

    $results.innerHTML = results.map((r, idx) => `
    <div class="discogs-result-item" data-id="${r.id}" data-index="${idx}">
      <img class="discogs-result-thumb" src="${r.thumb || ''}" alt="" onerror="this.style.display='none'">
      <div class="discogs-result-info">
        <div class="discogs-result-title">${escapeHtml(r.title)}</div>
        <div class="discogs-result-meta">${r.year} · ${r.format} · ${r.label}</div>
      </div>
    </div>
  `).join('');

    // Click to load tracklist
    $results.querySelectorAll('.discogs-result-item').forEach(item => {
        item.addEventListener('click', async () => {
            // Highlight selected
            $results.querySelectorAll('.discogs-result-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            const releaseId = item.dataset.id;
            await loadTracklist(releaseId, token);
        });
    });
}

async function loadTracklist(releaseId, token) {
    const $tracklist = document.getElementById('discogsTracklist');

    try {
        $tracklist.classList.remove('hidden');
        $tracklist.innerHTML = '<div class="empty-state">Loading tracklist...</div>';

        const data = await window.api.discogsGetTracklist(releaseId, token);

        if (!data.tracklist || data.tracklist.length === 0) {
            $tracklist.innerHTML = '<div class="empty-state">No tracks found</div>';
            return;
        }

        // Store Discogs info
        _state.discogsInfo = data.info;

        // Auto-fill export fields
        if (data.info.artists) {
            document.getElementById('exportArtist').value = data.info.artists;
            document.getElementById('discogsArtist').value = data.info.artists;
        }
        if (data.info.title) {
            // Title is "Artist - Album", extract album part
            const parts = data.info.title.split(' - ');
            const albumName = parts.length > 1 ? parts.slice(1).join(' - ') : data.info.title;
            document.getElementById('exportAlbum').value = albumName;
        }
        if (data.info.year) {
            document.getElementById('exportYear').value = data.info.year;
        }

        // Match tracklist to detected segments
        const markers = _state.markers;
        const duration = _state.audioInfo ? _state.audioInfo.duration : 0;
        const segments = [];
        for (let i = 0; i <= markers.length; i++) {
            const start = i === 0 ? 0 : markers[i - 1];
            const end = i === markers.length ? duration : markers[i];
            segments.push({ start, end, duration: end - start });
        }

        // Simple match: compare durations
        const matched = matchTracklist(segments, data.tracklist);

        renderTracklist(matched, data.tracklist);
    } catch (err) {
        console.error('Tracklist load error:', err);
        $tracklist.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
}

function matchTracklist(segments, tracklist) {
    const result = [];
    const maxLen = Math.max(segments.length, tracklist.length);

    for (let i = 0; i < maxLen; i++) {
        const seg = segments[i] || null;
        const track = tracklist[i] || null;

        let confidence = 'none';
        if (seg && track && track.durationSeconds > 0) {
            const diff = Math.abs(seg.duration - track.durationSeconds);
            if (diff <= 3) confidence = 'high';
            else if (diff <= 10) confidence = 'medium';
            else confidence = 'low';
        }

        result.push({ segment: seg, track, confidence, index: i });
    }

    return result;
}

function renderTracklist(matched, tracklist) {
    const $tracklist = document.getElementById('discogsTracklist');

    let html = matched.map(m => {
        const t = m.track;
        const badgeClass = m.confidence !== 'none' ? `match-${m.confidence}` : '';
        const badgeText = m.confidence !== 'none' ? m.confidence : '';

        return `
      <div class="discogs-track-row">
        <span class="discogs-track-pos">${t ? t.position : '-'}</span>
        <span class="discogs-track-title">${t ? escapeHtml(t.title) : 'N/A'}</span>
        <span class="discogs-track-duration">${t ? t.duration : '-'}</span>
        ${badgeText ? `<span class="discogs-match-badge ${badgeClass}">${badgeText}</span>` : ''}
      </div>
    `;
    }).join('');

    html += `<button class="btn btn-accent btn-apply-tracklist" id="btnApplyTracklist">Apply Track Names</button>`;

    $tracklist.innerHTML = html;

    // Apply button
    document.getElementById('btnApplyTracklist').addEventListener('click', () => {
        window.applyDiscogsNames(tracklist);
    });
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
