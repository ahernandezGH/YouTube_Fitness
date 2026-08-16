const CATEGORIES = {
  cardio: ['cardio', 'hiit', 'tabata', 'quemar', 'sudor', 'emom', 'amrap', 'aerobico', 'running', 'correr', 'lazo', 'cuerda', 'jumping', 'resistencia', 'metcon'],
  core: ['abdomen', 'core', 'abs', 'oblicuos', 'six pack', 'plank', 'plancha', 'crunch', 'abdominales', 'abdominals', 'lumbar', 'lumbares', 'sit up', 'sit-up'],
  upper: ['pecho', 'espalda', 'brazo', 'hombro', 'upper', 'biceps', 'triceps', 'chest', 'back', 'pull up', 'push up', 'dominadas', 'lagartijas', 'hombros'],
  lower: ['pierna', 'gluteo', 'lower', 'leg', 'squat', 'pantorrilla', 'quads', 'femoral', 'isquio', 'gemelos', 'zancada', 'lunges', 'peso muerto', 'deadlift'],
  full: ['completo', 'full body', 'todo el cuerpo', 'fullbody', 'cuerpo completo']
};

const LEVELS = {
  basic: ['principiante', 'basico', 'sin equipo', 'beginner', 'facil', 'cero'],
  intermediate: ['intermedio', 'medio', 'intermediate'],
  advanced: ['avanzado', 'intenso', 'pro', 'advanced', 'hardcore', 'extremo']
};

const CATEGORY_NAMES = {
  upper: 'Tren Superior',
  lower: 'Tren Inferior',
  full: 'Cuerpo Completo',
  core: 'Core',
  cardio: 'Cardio',
  unknown: 'Otros'
};

let allVideos = [];
let library = [];
let customTags = [];
let discarded = [];
let userChannels = [];
let currentActiveTabUrl = null;
let activeTab = 'feed';

document.addEventListener('DOMContentLoaded', () => {
  const feedTabBtn = document.getElementById('feedTabBtn');
  const libraryTabBtn = document.getElementById('libraryTabBtn');

  feedTabBtn.addEventListener('click', () => {
    activeTab = 'feed';
    feedTabBtn.classList.add('active');
    libraryTabBtn.classList.remove('active');
    renderVideos();
  });

  libraryTabBtn.addEventListener('click', () => {
    activeTab = 'library';
    libraryTabBtn.classList.add('active');
    feedTabBtn.classList.remove('active');
    document.getElementById('activeTabAlert').style.display = 'none'; // Hide banner in library
    renderVideos();
  });

  document.getElementById('refreshBtn').addEventListener('click', loadVideos);
  document.getElementById('typeFilter').addEventListener('change', renderVideos);
  document.getElementById('levelFilter').addEventListener('change', renderVideos);
  document.getElementById('channelFilter').addEventListener('change', renderVideos);
  document.getElementById('customTagFilter').addEventListener('change', renderVideos);

  const excludeTagFilterEl = document.getElementById('excludeTagFilter');
  if (excludeTagFilterEl) {
    excludeTagFilterEl.addEventListener('change', renderVideos);
  }

  const saveActiveTabBtn = document.getElementById('saveActiveTabBtn');
  if (saveActiveTabBtn) {
    saveActiveTabBtn.addEventListener('click', () => {
      if (currentActiveTabUrl) {
        addVideoFromUrl(currentActiveTabUrl, saveActiveTabBtn);
      }
    });
  }

  const videoListEl = document.getElementById('videoList');
  
  videoListEl.addEventListener('click', (e) => {
    const target = e.target;
    
    // Video Tag Remove Button
    if (target.classList.contains('video-tag-remove')) {
      e.preventDefault();
      e.stopPropagation();
      const id = target.getAttribute('data-id');
      const tag = target.getAttribute('data-tag');
      removeTagFromLibraryVideo(id, tag);
      return;
    }

    // Botón Guardar
    if (target.classList.contains('btn-save')) {
      e.preventDefault();
      e.stopPropagation();
      const id = target.getAttribute('data-id');
      saveToLibrary(id);
      return;
    }
    
    // Botón Ocultar/Descartar
    if (target.classList.contains('btn-discard')) {
      e.preventDefault();
      e.stopPropagation();
      const id = target.getAttribute('data-id');
      discardVideo(id);
      return;
    }
    
    // Botón Favorito (estrella)
    if (target.closest('.btn-favorite')) {
      e.preventDefault();
      e.stopPropagation();
      const btn = target.closest('.btn-favorite');
      const id = btn.getAttribute('data-id');
      toggleLibraryVideoFavorite(id);
      return;
    }
    
    // Botón Eliminar
    if (target.classList.contains('btn-remove')) {
      e.preventDefault();
      e.stopPropagation();
      const id = target.getAttribute('data-id');
      removeFromLibrary(id);
      return;
    }

    // Clic en la tarjeta para abrir el video en YouTube
    const videoItem = target.closest('.video-item');
    if (videoItem) {
      if (target.closest('select') || target.closest('button')) {
        return;
      }
      const id = videoItem.getAttribute('data-id');
      window.open(`https://www.youtube.com/watch?v=${id}`, '_blank');
    }
  });

  videoListEl.addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('library-select')) {
      const id = target.getAttribute('data-id');
      updateLibraryVideoCategory(id, target.value);
    } else if (target.classList.contains('library-level-select')) {
      const id = target.getAttribute('data-id');
      updateLibraryVideoLevel(id, target.value);
    } else if (target.classList.contains('library-add-tag-select')) {
      const id = target.getAttribute('data-id');
      const tag = target.value;
      if (tag) {
        addTagToLibraryVideo(id, tag);
      }
    } else if (target.classList.contains('library-channel-select')) {
      const id = target.getAttribute('data-id');
      updateLibraryVideoChannel(id, target.value);
    }
  });

  const addVideoUrlBtn = document.getElementById('addVideoUrlBtn');
  if (addVideoUrlBtn) {
    addVideoUrlBtn.addEventListener('click', addVideoByUrl);
  }
  
  loadVideos();
});

async function getVideoDuration(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch (e) {
    console.error('Error fetching duration for video:', videoId, e);
  }
  return null;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function loadVideos() {
  const videoListEl = document.getElementById('videoList');
  videoListEl.innerHTML = 'Cargando videos...';

  chrome.storage.local.get(['channels', 'minDuration', 'library', 'sliceCount', 'offsetCount', 'customTags', 'discarded'], async (data) => {
    library = data.library || [];
    // Normalización de etiquetas
    let hadNormalization = false;
    library.forEach(item => {
      if (item.customTags === undefined) {
        if (item.customTag && typeof item.customTag === 'string') {
          item.customTags = [item.customTag];
        } else {
          item.customTags = [];
        }
        hadNormalization = true;
      } else if (!Array.isArray(item.customTags)) {
        item.customTags = [];
        hadNormalization = true;
      }
    });
    if (hadNormalization) {
      chrome.storage.local.set({ library });
    }
    customTags = data.customTags || [];
    discarded = data.discarded || [];
    userChannels = data.channels || [];
    const sliceCount = data.sliceCount !== undefined ? data.sliceCount : 5;
    const offsetCount = data.offsetCount !== undefined ? data.offsetCount : 0;

    const channelFilterEl = document.getElementById('channelFilter');
    if (channelFilterEl && data.channels) {
      const currentSelected = channelFilterEl.value;
      channelFilterEl.innerHTML = '<option value="all">Todos los canales</option>';
      data.channels.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.name;
        opt.textContent = ch.name;
        channelFilterEl.appendChild(opt);
      });
      // Agregar opción Manual para los videos agregados por URL
      const manualOpt = document.createElement('option');
      manualOpt.value = 'Manual';
      manualOpt.textContent = 'Manual';
      channelFilterEl.appendChild(manualOpt);
      
      if (Array.from(channelFilterEl.options).some(o => o.value === currentSelected)) {
        channelFilterEl.value = currentSelected;
      }
    }

    if (!data.channels || data.channels.length === 0) {
      videoListEl.innerHTML = 'Falta configuración. Haz clic derecho en el ícono y ve a "Opciones" para agregar canales.';
      return;
    }

    const tagFilterEl = document.getElementById('customTagFilter');
    if (tagFilterEl) {
      const currentSelected = tagFilterEl.value;
      tagFilterEl.innerHTML = '<option value="all">Todas las etiquetas</option><option value="none">Sin etiqueta</option>';
      customTags.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        tagFilterEl.appendChild(opt);
      });
      if (Array.from(tagFilterEl.options).some(o => o.value === currentSelected)) {
        tagFilterEl.value = currentSelected;
      }
    }

    const excludeFilterEl = document.getElementById('excludeTagFilter');
    if (excludeFilterEl) {
      const currentExclude = excludeFilterEl.value;
      excludeFilterEl.innerHTML = '<option value="none">Excluir: Ninguna</option>';
      customTags.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        excludeFilterEl.appendChild(opt);
      });
      if (Array.from(excludeFilterEl.options).some(o => o.value === currentExclude)) {
        excludeFilterEl.value = currentExclude;
      }
    }

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs && tabs.length > 0 && tabs[0].url) {
        const url = tabs[0].url;
        const videoId = extractVideoId(url);
        if (videoId && !library.some(v => v.id === videoId)) {
          currentActiveTabUrl = url;
          if (activeTab === 'feed') {
            document.getElementById('activeTabAlert').style.display = 'flex';
          }
        } else {
          document.getElementById('activeTabAlert').style.display = 'none';
        }
      }
    });

    const minDuration = data.minDuration !== undefined ? data.minDuration : 10;
    allVideos = [];
    
    const fetchPromises = data.channels.map(async (channel) => {
      try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
        const response = await fetch(rssUrl);
        const text = await response.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const entries = Array.from(xmlDoc.getElementsByTagName('entry')).slice(offsetCount, offsetCount + sliceCount); 
        
        const entryPromises = entries.map(async (entry) => {
          const title = entry.getElementsByTagName('title')[0]?.textContent || 'Sin título';
          const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || '';
          const date = entry.getElementsByTagName('published')[0]?.textContent || new Date().toISOString();
          
          const mediaGroup = entry.getElementsByTagName('media:group')[0];
          const desc = mediaGroup?.getElementsByTagName('media:description')[0]?.textContent || '';
          const thumbnail = mediaGroup?.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          if (videoId) {
            if (library.some(libVid => libVid.id === videoId) || discarded.includes(videoId)) {
              return;
            }
            const textToAnalyze = (title + " " + desc).toLowerCase();
            const durationSeconds = await getVideoDuration(videoId);
            
            // Si tiene duración y es menor al filtro, lo omitimos
            if (durationSeconds !== null && (durationSeconds / 60) < minDuration) {
              return;
            }

            allVideos.push({
              id: videoId,
              title: title,
              thumbnail: thumbnail,
              channelName: channel.name,
              priority: channel.priority,
              date: date,
              types: classifyTextMultiple(textToAnalyze, CATEGORIES),
              level: classifyText(textToAnalyze, LEVELS) || 'basic',
              durationSeconds: durationSeconds
            });
          }
        });

        await Promise.all(entryPromises);
      } catch (error) {
        console.error('Error leyendo el RSS del canal:', channel.name, error);
      }
    });

    await Promise.all(fetchPromises);

    allVideos.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; 
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    renderVideos();
  });
}

function classifyText(text, dictionary) {
  for (const [category, keywords] of Object.entries(dictionary)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }
  return 'unknown';
}

function classifyTextMultiple(text, dictionary) {
  const matched = [];
  for (const [category, keywords] of Object.entries(dictionary)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(category);
    }
  }
  return matched.length > 0 ? matched : ['unknown'];
}

function saveToLibrary(videoId) {
  const video = allVideos.find(v => v.id === videoId);
  if (!video) return;
  const defaultCategory = video.types && video.types.length > 0 ? video.types[0] : 'unknown';
  
  const libVideo = {
    id: video.id,
    title: video.title,
    thumbnail: video.thumbnail,
    channelName: video.channelName,
    priority: video.priority,
    date: video.date,
    level: video.level,
    durationSeconds: video.durationSeconds,
    types: video.types,
    category: defaultCategory,
    favorite: false,
    customTags: []
  };

  library.push(libVideo);
  chrome.storage.local.set({ library }, () => {
    allVideos = allVideos.filter(v => v.id !== videoId);
    renderVideos();
  });
}

function removeFromLibrary(videoId) {
  library = library.filter(v => v.id !== videoId);
  chrome.storage.local.set({ library }, () => {
    loadVideos();
  });
}

function discardVideo(videoId) {
  discarded.push(videoId);
  chrome.storage.local.set({ discarded }, () => {
    allVideos = allVideos.filter(v => v.id !== videoId);
    renderVideos();
  });
}

function toggleLibraryVideoFavorite(videoId) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.favorite = !video.favorite;
    chrome.storage.local.set({ library }, () => {
      renderVideos();
    });
  }
}

function updateLibraryVideoCategory(videoId, newCategory) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.category = newCategory;
    chrome.storage.local.set({ library }, () => {
      renderVideos();
    });
  }
}

function updateLibraryVideoLevel(videoId, newLevel) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.level = newLevel;
    chrome.storage.local.set({ library }, () => {
      renderVideos();
    });
  }
}

function updateLibraryVideoChannel(videoId, newChannelName) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.channelName = newChannelName;
    chrome.storage.local.set({ library }, () => {
      renderVideos();
    });
  }
}

function addTagToLibraryVideo(videoId, tag) {
  const video = library.find(v => v.id === videoId);
  if (video && tag) {
    if (!Array.isArray(video.customTags)) {
      video.customTags = video.customTag ? [video.customTag] : [];
    }
    if (!video.customTags.includes(tag)) {
      video.customTags.push(tag);
      chrome.storage.local.set({ library }, () => {
        renderVideos();
      });
    }
  }
}

function removeTagFromLibraryVideo(videoId, tag) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    if (!Array.isArray(video.customTags)) {
      video.customTags = video.customTag ? [video.customTag] : [];
    }
    video.customTags = video.customTags.filter(t => t !== tag);
    chrome.storage.local.set({ library }, () => {
      renderVideos();
    });
  }
}

function renderVideos() {
  const typeFilter = document.getElementById('typeFilter').value;
  const levelFilter = document.getElementById('levelFilter').value;
  const channelFilter = document.getElementById('channelFilter').value;
  const customTagFilterEl = document.getElementById('customTagFilter');
  const customTagFilter = customTagFilterEl ? customTagFilterEl.value : 'all';
  const excludeTagFilterEl = document.getElementById('excludeTagFilter');
  const excludeTagFilter = excludeTagFilterEl ? excludeTagFilterEl.value : 'none';
  const videoListEl = document.getElementById('videoList');
  
  const addVideoForm = document.getElementById('addVideoForm');
  if (addVideoForm) {
    addVideoForm.style.display = activeTab === 'library' ? 'flex' : 'none';
  }

  const showTagFilters = (activeTab === 'library' && customTags.length > 0);
  if (customTagFilterEl) {
    customTagFilterEl.style.display = showTagFilters ? 'inline-block' : 'none';
  }
  if (excludeTagFilterEl) {
    excludeTagFilterEl.style.display = showTagFilters ? 'inline-block' : 'none';
  }
  
  videoListEl.innerHTML = '';

  if (activeTab === 'feed') {
    const filteredVideos = allVideos.filter(v => {
      const matchType = typeFilter === 'all' || v.types.includes(typeFilter);
      const matchLevel = levelFilter === 'all' || v.level === levelFilter;
      const matchChannel = channelFilter === 'all' || v.channelName === channelFilter;
      return matchType && matchLevel && matchChannel;
    });

    if (filteredVideos.length === 0) {
      videoListEl.innerHTML = 'No se encontraron videos con esos filtros.';
      return;
    }

    filteredVideos.forEach(v => {
      const card = document.createElement('div');
      card.className = 'video-item';
      card.setAttribute('data-id', v.id);

      const categoryBadges = v.types.map(t => {
        const name = CATEGORY_NAMES[t] || 'Otros';
        return `<span class="badge">${name.toUpperCase()}</span>`;
      }).join(' ');

      const durationBadge = v.durationSeconds ? `<span class="badge duration" style="background-color: #555;">${formatDuration(v.durationSeconds)}</span>` : '';

      card.innerHTML = `
        <img src="${v.thumbnail}" class="thumbnail" alt="thumbnail">
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div class="badges">
            <span class="badge priority">Prio: ${v.priority}</span>
            <span class="badge">${v.channelName}</span>
            ${categoryBadges}
            <span class="badge">${v.level.toUpperCase()}</span>
            ${durationBadge}
          </div>
        </div>
        <div class="video-actions" style="flex-direction: row;">
          <button class="btn-discard" data-id="${v.id}">Ocultar</button>
          <button class="btn-save" data-id="${v.id}">Guardar</button>
        </div>
      `;
      videoListEl.appendChild(card);
    });
  } else {
    // Biblioteca
    const filteredVideos = library.filter(v => {
      const matchType = typeFilter === 'all' || v.category === typeFilter;
      const matchLevel = levelFilter === 'all' || v.level === levelFilter;
      const matchChannel = channelFilter === 'all' || v.channelName === channelFilter;
      
      const videoTags = Array.isArray(v.customTags) ? v.customTags : (v.customTag ? [v.customTag] : []);
      
      let matchIncludeTag = false;
      if (customTagFilter === 'all') {
        matchIncludeTag = true;
      } else if (customTagFilter === 'none') {
        matchIncludeTag = videoTags.length === 0;
      } else {
        matchIncludeTag = videoTags.includes(customTagFilter);
      }

      let matchExcludeTag = true;
      if (excludeTagFilter !== 'none') {
        matchExcludeTag = !videoTags.includes(excludeTagFilter);
      }
      
      return matchType && matchLevel && matchChannel && matchIncludeTag && matchExcludeTag;
    });

    const sortedLibrary = [...filteredVideos].sort((a, b) => {
      if (a.favorite !== b.favorite) {
        return a.favorite ? -1 : 1;
      }
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    if (sortedLibrary.length === 0) {
      videoListEl.innerHTML = 'Tu biblioteca está vacía o no hay videos que coincidan con los filtros.';
      return;
    }

    sortedLibrary.forEach(v => {
      const card = document.createElement('div');
      card.className = 'video-item';
      card.setAttribute('data-id', v.id);

      const durationBadge = v.durationSeconds ? `<span class="badge duration" style="background-color: #555;">${formatDuration(v.durationSeconds)}</span>` : '';

      const selectOptions = Object.entries(CATEGORY_NAMES).map(([key, label]) => {
        return `<option value="${key}" ${v.category === key ? 'selected' : ''}>${label}</option>`;
      }).join('');

      const levelOptions = Object.entries(LEVELS).map(([key, labelList]) => {
        return `<option value="${key}" ${v.level === key ? 'selected' : ''}>${key.toUpperCase()}</option>`;
      }).join('');

      const channelOptions = userChannels.map(ch => {
        return `<option value="${ch.name}" ${v.channelName === ch.name ? 'selected' : ''}>${ch.name}</option>`;
      }).join('');
      const manualOption = `<option value="Manual" ${v.channelName === 'Manual' ? 'selected' : ''}>Manual</option>`;

      const videoTags = Array.isArray(v.customTags) ? v.customTags : (v.customTag ? [v.customTag] : []);
      const tagPillsHtml = videoTags.map(t => {
        return `<span class="badge video-tag-pill">${t} <span class="video-tag-remove" data-id="${v.id}" data-tag="${t}" title="Quitar etiqueta">&times;</span></span>`;
      }).join('');

      const availableTagsToAdd = customTags.filter(t => !videoTags.includes(t));
      const addTagSelectHtml = (availableTagsToAdd.length > 0) ? `
        <select class="library-add-tag-select badge" data-id="${v.id}" title="Añadir etiqueta">
          <option value="" disabled selected>+ Etiqueta</option>
          ${availableTagsToAdd.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      ` : '';

      card.innerHTML = `
        <img src="${v.thumbnail}" class="thumbnail" alt="thumbnail">
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div class="badges">
            <span class="badge priority">Prio: ${v.priority}</span>
            <select class="library-channel-select badge" data-id="${v.id}" style="background:var(--card-bg); border:1px solid #444; color:var(--text-color); cursor:pointer;">
              ${channelOptions}
              ${manualOption}
            </select>
            <select class="library-level-select badge" data-id="${v.id}" style="background:var(--card-bg); border:1px solid #444; color:var(--text-color); cursor:pointer;">
              ${levelOptions}
            </select>
            ${tagPillsHtml}
            ${addTagSelectHtml}
            ${durationBadge}
          </div>
        </div>
        <div class="video-actions">
          <button class="btn-favorite ${v.favorite ? 'active' : ''}" data-id="${v.id}">${v.favorite ? '★' : '☆'}</button>
          <select class="library-select" data-id="${v.id}">
            ${selectOptions}
          </select>
          <button class="btn-danger btn-remove" data-id="${v.id}">Eliminar</button>
        </div>
      `;
      videoListEl.appendChild(card);
    });
  }
}

function extractPlaylistId(url) {
  if (!url) return null;
  const match = url.match(/[?&]list=([^#&?]+)/);
  return (match && match[1]) ? match[1] : null;
}

function extractVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function addVideoByUrl() {
  const urlInput = document.getElementById('videoUrlInput');
  const addBtn = document.getElementById('addVideoUrlBtn');
  const url = urlInput.value.trim();
  if (!url) return;

  const playlistId = extractPlaylistId(url);
  // Si es una URL dedicada de playlist (playlist?list=...) o solo tiene list=...
  if (playlistId && (url.includes('playlist?list=') || !url.includes('watch?v='))) {
    await addPlaylistByUrl(playlistId, addBtn);
    urlInput.value = '';
    return;
  }

  const videoId = extractVideoId(url);
  if (videoId) {
    await addVideoFromUrl(url, addBtn);
    urlInput.value = '';
    return;
  }

  if (playlistId) {
    await addPlaylistByUrl(playlistId, addBtn);
    urlInput.value = '';
    return;
  }

  alert('Por favor, introduce una URL válida de video o lista de reproducción (Playlist) de YouTube.');
}

async function addPlaylistByUrl(playlistId, addBtn) {
  addBtn.disabled = true;
  addBtn.textContent = 'Importando Playlist...';
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error('No se pudo acceder a la lista de reproducción. Verifica que sea pública.');
    }
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    const playlistTitle = xmlDoc.getElementsByTagName('title')[0]?.textContent || 'Playlist de YouTube';
    const entries = Array.from(xmlDoc.getElementsByTagName('entry'));
    
    if (entries.length === 0) {
      alert('No se encontraron videos en esta lista de reproducción o la lista no es pública.');
      return;
    }

    let addedCount = 0;
    let existingCount = 0;

    entries.forEach(entry => {
      const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || '';
      if (!videoId) return;

      if (library.some(v => v.id === videoId)) {
        existingCount++;
        return;
      }

      const title = entry.getElementsByTagName('title')[0]?.textContent || `Video (${videoId})`;
      const mediaGroup = entry.getElementsByTagName('media:group')[0];
      const thumbnail = mediaGroup?.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const author = entry.getElementsByTagName('author')[0]?.getElementsByTagName('name')[0]?.textContent || playlistTitle;
      const date = entry.getElementsByTagName('published')[0]?.textContent || new Date().toISOString();

      const newVideo = {
        id: videoId,
        title: title,
        thumbnail: thumbnail,
        channelName: author || 'Playlist',
        priority: 99,
        date: date,
        level: 'basic',
        durationSeconds: null,
        types: ['unknown'],
        category: 'unknown',
        favorite: false,
        customTags: []
      };

      library.push(newVideo);
      addedCount++;
    });

    if (addedCount > 0) {
      chrome.storage.local.set({ library }, () => {
        renderVideos();
        alert(`¡Lista de reproducción importada con éxito!\nSe agregaron ${addedCount} videos nuevos a tu biblioteca.${existingCount > 0 ? ` (${existingCount} ya existían).` : ''}`);
      });
    } else {
      alert(`Todos los videos (${existingCount}) de esta lista de reproducción ya estaban en tu biblioteca.`);
    }
  } catch (error) {
    console.error('Error al importar playlist:', error);
    alert('Error al importar la lista de reproducción: ' + error.message);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = 'Añadir';
  }
}

async function addVideoFromUrl(url, addBtn) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    alert('Por favor, introduce una URL de YouTube válida.');
    return;
  }

  if (library.some(v => v.id === videoId)) {
    alert('Este video ya está guardado en tu biblioteca.');
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = 'Cargando...';

  const newVideo = {
    id: videoId,
    title: `Video Guardado (${videoId})`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    channelName: 'Manual',
    priority: 99,
    date: new Date().toISOString(),
    level: 'basic',
    durationSeconds: null,
    types: ['unknown'],
    category: 'unknown',
    favorite: false,
    customTags: []
  };

  library.push(newVideo);
  chrome.storage.local.set({ library }, () => {
    document.getElementById('activeTabAlert').style.display = 'none';
    renderVideos();
    addBtn.disabled = false;
    addBtn.textContent = 'Añadir';
  });
}