const CATEGORIES = {
  upper: ['pecho', 'espalda', 'brazo', 'hombro', 'upper', 'biceps', 'triceps', 'chest', 'back'],
  lower: ['pierna', 'gluteo', 'lower', 'leg', 'squat', 'pantorrilla', 'quads'],
  full: ['completo', 'full body', 'todo el cuerpo'],
  core: ['abdomen', 'core', 'abs', 'oblicuos', 'six pack'],
  cardio: ['cardio', 'hiit', 'tabata', 'quemar', 'sudor']
};

const LEVELS = {
  basic: ['principiante', 'basico', 'sin equipo', 'beginner', 'facil', 'cero'],
  intermediate: ['intermedio', 'medio', 'intermediate'],
  advanced: ['avanzado', 'intenso', 'pro', 'advanced', 'hardcore', 'extremo']
};

let allVideos = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', loadVideos);
  document.getElementById('typeFilter').addEventListener('change', renderVideos);
  document.getElementById('levelFilter').addEventListener('change', renderVideos);
  
  loadVideos();
});

async function loadVideos() {
  const videoListEl = document.getElementById('videoList');
  videoListEl.innerHTML = 'Cargando videos...';

  chrome.storage.local.get(['channels'], async (data) => {
    if (!data.channels || data.channels.length === 0) {
      videoListEl.innerHTML = 'Falta configuración. Haz clic derecho en el ícono y ve a "Opciones" para agregar canales.';
      return;
    }

    allVideos = [];
    
    for (const channel of data.channels) {
      try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
        const response = await fetch(rssUrl);
        const text = await response.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const entries = Array.from(xmlDoc.getElementsByTagName('entry')).slice(0, 5); 
        
        entries.forEach(entry => {
          // Uso de ?. (optional chaining) para evitar errores si YouTube omite una etiqueta
          const title = entry.getElementsByTagName('title')[0]?.textContent || 'Sin título';
          const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || '';
          const date = entry.getElementsByTagName('published')[0]?.textContent || new Date().toISOString();
          
          const mediaGroup = entry.getElementsByTagName('media:group')[0];
          const desc = mediaGroup?.getElementsByTagName('media:description')[0]?.textContent || '';
          const thumbnail = mediaGroup?.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          if (videoId) {
            const textToAnalyze = (title + " " + desc).toLowerCase();
            allVideos.push({
              id: videoId,
              title: title,
              thumbnail: thumbnail,
              channelName: channel.name,
              priority: channel.priority,
              date: date,
              type: classifyText(textToAnalyze, CATEGORIES),
              level: classifyText(textToAnalyze, LEVELS) || 'basic'
            });
          }
        });
      } catch (error) {
        console.error('Error leyendo el RSS del canal:', channel.name, error);
      }
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

function renderVideos() {
  const typeFilter = document.getElementById('typeFilter').value;
  const levelFilter = document.getElementById('levelFilter').value;
  const videoListEl = document.getElementById('videoList');
  
  videoListEl.innerHTML = '';

  const filteredVideos = allVideos.filter(v => {
    const matchType = typeFilter === 'all' || v.type === typeFilter;
    const matchLevel = levelFilter === 'all' || v.level === levelFilter;
    return matchType && matchLevel;
  });

  if (filteredVideos.length === 0) {
    videoListEl.innerHTML = 'No se encontraron videos con esos filtros.';
    return;
  }

  filteredVideos.forEach(v => {
    const a = document.createElement('a');
    a.href = `https://www.youtube.com/watch?v=${v.id}`;
    a.target = '_blank';
    a.className = 'video-item';

    a.innerHTML = `
      <img src="${v.thumbnail}" class="thumbnail" alt="thumbnail">
      <div class="video-info">
        <div class="video-title">${v.title}</div>
        <div class="badges">
          <span class="badge priority">Prio: ${v.priority}</span>
          <span class="badge">${v.channelName}</span>
          <span class="badge">${v.level.toUpperCase()}</span>
        </div>
      </div>
    `;
    videoListEl.appendChild(a);
  });
}