import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc } from './firebase-config.js';

// Categorías y niveles para clasificar videos
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

// Usuario actual de Firebase
let currentUser = null;

// Storage Helper dinámico (Firestore o LocalStorage)
const storage = {
  get: async (keys, callback) => {
    if (currentUser) {
      // Leer de Firestore
      try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const result = {};
          keys.forEach(key => {
            result[key] = remoteData[key] !== undefined ? remoteData[key] : undefined;
          });
          callback(result);
          return;
        }
      } catch (err) {
        console.error("Error reading from Firestore:", err);
      }
    }
    
    // Fallback LocalStorage
    const result = {};
    keys.forEach(key => {
      const val = localStorage.getItem('yt_fitness_' + key);
      try {
        result[key] = val !== null ? JSON.parse(val) : undefined;
      } catch (e) {
        result[key] = val;
      }
    });
    callback(result);
  },
  set: async (data, callback) => {
    if (currentUser) {
      // Guardar en Firestore
      try {
        const docRef = doc(db, "users", currentUser.uid);
        // Usar merge:true para no sobreescribir campos faltantes
        await setDoc(docRef, data, { merge: true });
      } catch (err) {
        console.error("Error writing to Firestore:", err);
      }
    } else {
      // Guardar en LocalStorage
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem('yt_fitness_' + key, JSON.stringify(value));
      });
    }
    if (callback) callback();
  },
  getAll: async (callback) => {
    if (currentUser) {
      try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          callback(docSnap.data());
          return;
        }
      } catch (err) {
        console.error("Error fetching all from Firestore:", err);
      }
    }
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('yt_fitness_')) {
        const cleanKey = key.replace('yt_fitness_', '');
        try {
          result[cleanKey] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          result[cleanKey] = localStorage.getItem(key);
        }
      }
    }
    callback(result);
  }
};

// Autenticación de Firebase y UI
document.addEventListener('DOMContentLoaded', () => {
  const authBtn = document.getElementById('authBtn');
  const userNameDisplay = document.getElementById('userNameDisplay');

  // Si auth existe (no falló la inicialización)
  if (auth) {
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        // Usuario logueado
        userNameDisplay.textContent = `Hola, ${user.displayName.split(' ')[0]}`;
        userNameDisplay.style.display = 'inline-block';
        authBtn.textContent = 'Cerrar Sesión';
        authBtn.classList.remove('auth-btn-login');
        authBtn.classList.add('auth-btn-logout');
        
        // Recargar el estado (ahora vendrá de Firestore)
        initLoad();
      } else {
        // Usuario desconectado
        userNameDisplay.style.display = 'none';
        authBtn.textContent = 'Iniciar Sesión';
        authBtn.classList.remove('auth-btn-logout');
        authBtn.classList.add('auth-btn-login');
        
        // Recargar el estado (ahora vendrá de LocalStorage)
        initLoad();
      }
    });

    authBtn.addEventListener('click', async () => {
      try {
        if (currentUser) {
          await signOut(auth);
        } else {
          await signInWithPopup(auth, provider);
        }
      } catch (error) {
        console.error("Error de Autenticación:", error);
        alert("Error de autenticación: " + error.message);
      }
    });
  } else {
    authBtn.style.display = 'none';
  }
});

let allVideos = [];
let library = [];
let customTags = [];
let discarded = [];
let activeTab = 'feed';
let channels = [];

// Helper function to bypass CORS using a free proxy
async function fetchProxy(url) {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  return fetch(proxyUrl);
}

document.addEventListener('DOMContentLoaded', () => {
  // Tab Elements
  const feedTabBtn = document.getElementById('feedTabBtn');
  const libraryTabBtn = document.getElementById('libraryTabBtn');
  const configTabBtn = document.getElementById('configTabBtn');
  const videosSection = document.getElementById('videosSection');
  const configSection = document.getElementById('configSection');

  // Config UI Elements
  const channelListEl = document.getElementById('channelList');
  const customTagsContainer = document.getElementById('customTagsContainer');

  // Tabs Navigation Event Listeners
  feedTabBtn.addEventListener('click', () => {
    activeTab = 'feed';
    switchTab(feedTabBtn, videosSection);
    renderVideos();
  });

  libraryTabBtn.addEventListener('click', () => {
    activeTab = 'library';
    switchTab(libraryTabBtn, videosSection);
    renderVideos();
  });

  configTabBtn.addEventListener('click', () => {
    switchTab(configTabBtn, configSection);
  });

  function switchTab(activeBtn, activePane) {
    [feedTabBtn, libraryTabBtn, configTabBtn].forEach(btn => btn.classList.remove('active'));
    [videosSection, configSection].forEach(pane => pane.classList.remove('active'));
    
    activeBtn.classList.add('active');
    activePane.classList.add('active');
  }

  // Load configuration & videos
  document.getElementById('refreshBtn').addEventListener('click', loadVideos);
  document.getElementById('typeFilter').addEventListener('change', renderVideos);
  document.getElementById('levelFilter').addEventListener('change', renderVideos);
  document.getElementById('channelFilter').addEventListener('change', renderVideos);
  
  const customTagFilterEl = document.getElementById('customTagFilter');
  if (customTagFilterEl) {
    customTagFilterEl.addEventListener('change', renderVideos);
  }

  // Manual Add Video
  document.getElementById('addVideoUrlBtn').addEventListener('click', addVideoByUrl);

  // Setup Config Page Event Listeners
  document.getElementById('addChannelBtn').addEventListener('click', () => {
    const id = document.getElementById('channelId').value.trim();
    const name = document.getElementById('channelName').value.trim();
    const priority = parseInt(document.getElementById('channelPriority').value);

    if (id && name && !isNaN(priority)) {
      channels.push({ id, name, priority });
      renderChannels();
      document.getElementById('channelId').value = '';
      document.getElementById('channelName').value = '';
      document.getElementById('channelPriority').value = '0';
    } else {
      alert('Por favor, rellena todos los campos del canal correctamente.');
    }
  });

  document.getElementById('addTagBtn').addEventListener('click', () => {
    const newTag = document.getElementById('newTagInput').value.trim();
    if (newTag && !customTags.includes(newTag)) {
      customTags.push(newTag);
      storage.set({ customTags }, () => {
        renderCustomTags();
        updateCustomTagFilters();
        document.getElementById('newTagInput').value = '';
      });
    }
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const minDuration = parseInt(document.getElementById('minDuration').value);
    const sliceCount = parseInt(document.getElementById('sliceCount').value);
    const offsetCount = parseInt(document.getElementById('offsetCount').value);
    
    storage.set({
      channels,
      minDuration: isNaN(minDuration) ? 10 : minDuration,
      sliceCount: isNaN(sliceCount) ? 5 : sliceCount,
      offsetCount: isNaN(offsetCount) ? 0 : offsetCount
    }, () => {
      alert('Configuración guardada correctamente.');
      loadVideos();
    });
  });

  // Export / Import
  document.getElementById('exportBtn').addEventListener('click', () => {
    storage.getAll((allData) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "youtube_fitness_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  });

  const importFileEl = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => {
    importFileEl.click();
  });

  importFileEl.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData && typeof importedData === 'object') {
          storage.set(importedData, () => {
            alert('Copia de seguridad importada correctamente. La página se actualizará.');
            window.location.reload();
          });
        } else {
          alert('El archivo no tiene un formato válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    importFileEl.value = '';
  });

  // Event delegation for dynamically rendered video list
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

    // Save Button
    if (target.classList.contains('btn-save')) {
      e.preventDefault();
      const id = target.getAttribute('data-id');
      saveToLibrary(id);
      return;
    }
    
    // Discard Button
    if (target.classList.contains('btn-discard')) {
      e.preventDefault();
      const id = target.getAttribute('data-id');
      discardVideo(id);
      return;
    }
    
    // Favorite Button (Star)
    if (target.closest('.btn-favorite')) {
      e.preventDefault();
      const btn = target.closest('.btn-favorite');
      const id = btn.getAttribute('data-id');
      toggleLibraryVideoFavorite(id);
      return;
    }
    
    // Remove Button
    if (target.classList.contains('btn-remove')) {
      e.preventDefault();
      const id = target.getAttribute('data-id');
      removeFromLibrary(id);
      return;
    }
    
    // Clicking Card opens Video
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
    const id = target.getAttribute('data-id');
    if (target.classList.contains('library-select')) {
      updateLibraryVideoCategory(id, target.value);
    } else if (target.classList.contains('library-level-select')) {
      updateLibraryVideoLevel(id, target.value);
    } else if (target.classList.contains('library-add-tag-select')) {
      const tag = target.value;
      if (tag) {
        addTagToLibraryVideo(id, tag);
      }
    } else if (target.classList.contains('library-channel-select')) {
      updateLibraryVideoChannel(id, target.value);
    }
  });

  // Init Data load
  initLoad();
});

// Initial config loading
function initLoad() {
  storage.get(['channels', 'minDuration', 'sliceCount', 'offsetCount', 'customTags', 'discarded', 'library'], (data) => {
    channels = data.channels || [];
    customTags = data.customTags || [];
    discarded = data.discarded || [];
    library = data.library || [];

    // Set configuration inputs
    document.getElementById('minDuration').value = data.minDuration !== undefined ? data.minDuration : 10;
    document.getElementById('sliceCount').value = data.sliceCount !== undefined ? data.sliceCount : 5;
    document.getElementById('offsetCount').value = data.offsetCount !== undefined ? data.offsetCount : 0;

    renderChannels();
    renderCustomTags();
    updateCustomTagFilters();
    loadVideos();
  });
}

function renderChannels() {
  const channelListEl = document.getElementById('channelList');
  channelListEl.innerHTML = '';
  channels.forEach((ch, index) => {
    const li = document.createElement('li');
    li.textContent = `[Prio: ${ch.priority}] ${ch.name} (${ch.id})`;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Eliminar';
    delBtn.addEventListener('click', () => {
      channels.splice(index, 1);
      renderChannels();
    });
    li.appendChild(delBtn);
    channelListEl.appendChild(li);
  });
}

function renderCustomTags() {
  const customTagsContainer = document.getElementById('customTagsContainer');
  customTagsContainer.innerHTML = '';
  customTags.forEach((tag, index) => {
    const span = document.createElement('span');
    span.className = 'tag-badge';
    
    const tagText = document.createElement('span');
    tagText.textContent = tag;
    span.appendChild(tagText);

    const orderControls = document.createElement('span');
    orderControls.className = 'tag-order-controls';

    const upBtn = document.createElement('button');
    upBtn.className = 'tag-move-btn';
    upBtn.textContent = '◀';
    upBtn.title = 'Mover a la izquierda';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveCustomTag(index, -1);
    });

    const downBtn = document.createElement('button');
    downBtn.className = 'tag-move-btn';
    downBtn.textContent = '▶';
    downBtn.title = 'Mover a la derecha';
    downBtn.disabled = index === customTags.length - 1;
    downBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveCustomTag(index, 1);
    });

    orderControls.appendChild(upBtn);
    orderControls.appendChild(downBtn);
    span.appendChild(orderControls);

    const delBtn = document.createElement('button');
    delBtn.className = 'tag-delete-btn';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Eliminar etiqueta';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      customTags.splice(index, 1);
      storage.set({ customTags }, () => {
        renderCustomTags();
        updateCustomTagFilters();
        renderVideos();
      });
    });

    span.appendChild(delBtn);
    customTagsContainer.appendChild(span);
  });
}

function moveCustomTag(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= customTags.length) return;
  const [movedTag] = customTags.splice(index, 1);
  customTags.splice(newIndex, 0, movedTag);
  storage.set({ customTags }, () => {
    renderCustomTags();
    updateCustomTagFilters();
    renderVideos();
  });
}

function updateCustomTagFilters() {
  const tagFilterEl = document.getElementById('customTagFilter');
  if (!tagFilterEl) return;
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

let durationFetchFailed = false;

async function fetchWithTimeout(url, options = {}, timeout = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function getVideoDuration(videoId) {
  try {
    let response;
    // 1. Intentamos fetch directo (rápido y funciona con extensiones CORS o localhost)
    try {
      response = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, {}, 2000);
    } catch (e) {
      // 2. Si falla (CORS o timeout), intentamos vía proxy
      response = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {}, 2500);
    }

    if (!response.ok) {
      durationFetchFailed = true;
      return null;
    }
    const html = await response.text();
    const match = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch (e) {
    console.error('Error fetching duration for video:', videoId, e);
    durationFetchFailed = true;
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
  durationFetchFailed = false; // Reset flag on reload
  const videoListEl = document.getElementById('videoList');
  videoListEl.innerHTML = '<div class="loading-placeholder">Cargando videos de YouTube...</div>';

  storage.get(['channels', 'minDuration', 'sliceCount', 'offsetCount', 'discarded', 'library'], async (data) => {
    library = data.library || [];
    // Limpieza automática de duplicados por ID y normalización de etiquetas
    const uniqueIds = new Set();
    const cleanLibrary = [];
    let hadDuplicates = false;
    let hadNormalization = false;
    library.forEach(item => {
      if (item.id && !uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
        // Normalización de etiquetas: customTag -> customTags []
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
        cleanLibrary.push(item);
      } else {
        hadDuplicates = true;
      }
    });
    if (hadDuplicates || hadNormalization) {
      library = cleanLibrary;
      storage.set({ library });
      if (hadDuplicates) console.log('Limpieza automática: Se han eliminado videos duplicados de la biblioteca.');
    }
    discarded = data.discarded || [];
    const minDuration = data.minDuration !== undefined ? data.minDuration : 10;
    const sliceCount = data.sliceCount !== undefined ? data.sliceCount : 5;
    const offsetCount = data.offsetCount !== undefined ? data.offsetCount : 0;
    const loadedChannels = data.channels || [];

    // Populate channel filter options
    const channelFilterEl = document.getElementById('channelFilter');
    if (channelFilterEl) {
      const currentSelected = channelFilterEl.value;
      channelFilterEl.innerHTML = '<option value="all">Todos los canales</option>';
      loadedChannels.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.name;
        opt.textContent = ch.name;
        channelFilterEl.appendChild(opt);
      });
      // Agregar opción Manual
      const manualOpt = document.createElement('option');
      manualOpt.value = 'Manual';
      manualOpt.textContent = 'Manual';
      channelFilterEl.appendChild(manualOpt);

      if (Array.from(channelFilterEl.options).some(o => o.value === currentSelected)) {
        channelFilterEl.value = currentSelected;
      }
    }

    if (loadedChannels.length === 0) {
      videoListEl.innerHTML = '<div class="loading-placeholder">No tienes canales configurados. Ve a la pestaña de "Configuración" para añadir algunos.</div>';
      return;
    }

    allVideos = [];
    
    const fetchPromises = loadedChannels.map(async (channel) => {
      try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
        const response = await fetchProxy(rssUrl);
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

    const corsWarningEl = document.getElementById('corsWarning');
    if (corsWarningEl) {
      corsWarningEl.style.display = durationFetchFailed ? 'block' : 'none';
    }

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
  if (library.some(v => v.id === videoId)) {
    allVideos = allVideos.filter(v => v.id !== videoId);
    renderVideos();
    return;
  }
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
  storage.set({ library }, () => {
    allVideos = allVideos.filter(v => v.id !== videoId);
    renderVideos();
  });
}

function removeFromLibrary(videoId) {
  library = library.filter(v => v.id !== videoId);
  storage.set({ library }, () => {
    loadVideos();
  });
}

function discardVideo(videoId) {
  discarded.push(videoId);
  storage.set({ discarded }, () => {
    allVideos = allVideos.filter(v => v.id !== videoId);
    renderVideos();
  });
}

function toggleLibraryVideoFavorite(videoId) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.favorite = !video.favorite;
    storage.set({ library }, () => {
      renderVideos();
    });
  }
}

function updateLibraryVideoCategory(videoId, newCategory) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.category = newCategory;
    storage.set({ library }, () => {
      renderVideos();
    });
  }
}

function updateLibraryVideoLevel(videoId, newLevel) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.level = newLevel;
    storage.set({ library }, () => {
      renderVideos();
    });
  }
}

function updateLibraryVideoChannel(videoId, newChannelName) {
  const video = library.find(v => v.id === videoId);
  if (video) {
    video.channelName = newChannelName;
    storage.set({ library }, () => {
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
      storage.set({ library }, () => {
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
    storage.set({ library }, () => {
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
  const customTagFilterContainer = document.getElementById('customTagFilterContainer');
  const videoListEl = document.getElementById('videoList');
  
  if (customTagFilterContainer) {
    customTagFilterContainer.style.display = (activeTab === 'library' && customTags.length > 0) ? 'flex' : 'none';
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
      videoListEl.innerHTML = '<div class="loading-placeholder">No se encontraron videos con esos filtros en tu feed.</div>';
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

      const durationBadge = v.durationSeconds ? `<span class="badge duration">${formatDuration(v.durationSeconds)}</span>` : '';

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
        <div class="video-actions">
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
      
      let matchCustomTag = false;
      const videoTags = Array.isArray(v.customTags) ? v.customTags : (v.customTag ? [v.customTag] : []);
      if (customTagFilter === 'all') {
        matchCustomTag = true;
      } else if (customTagFilter === 'none') {
        matchCustomTag = videoTags.length === 0;
      } else {
        matchCustomTag = videoTags.includes(customTagFilter);
      }
      
      return matchType && matchLevel && matchChannel && matchCustomTag;
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
      videoListEl.innerHTML = '<div class="loading-placeholder">Tu biblioteca está vacía o no hay videos que coincidan con los filtros.</div>';
      return;
    }

    sortedLibrary.forEach(v => {
      const card = document.createElement('div');
      card.className = 'video-item';
      card.setAttribute('data-id', v.id);

      const durationBadge = v.durationSeconds ? `<span class="badge duration">${formatDuration(v.durationSeconds)}</span>` : '';

      const selectOptions = Object.entries(CATEGORY_NAMES).map(([key, label]) => {
        return `<option value="${key}" ${v.category === key ? 'selected' : ''}>${label}</option>`;
      }).join('');

      const levelOptions = Object.entries(LEVELS).map(([key, labelList]) => {
        return `<option value="${key}" ${v.level === key ? 'selected' : ''}>${key.toUpperCase()}</option>`;
      }).join('');

      const channelOptions = channels.map(ch => {
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
            <select class="library-channel-select badge" data-id="${v.id}">
              ${channelOptions}
              ${manualOption}
            </select>
            <select class="library-level-select badge" data-id="${v.id}">
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
    const response = await fetchProxy(rssUrl);
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
      storage.set({ library }, () => {
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
    addBtn.textContent = 'Añadir a Biblioteca';
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
  storage.set({ library }, () => {
    const alertEl = document.getElementById('activeTabAlert');
    if (alertEl) alertEl.style.display = 'none';
    renderVideos();
    addBtn.disabled = false;
    addBtn.textContent = 'Añadir a Biblioteca';
  });
}
