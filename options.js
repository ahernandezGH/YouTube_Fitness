document.addEventListener('DOMContentLoaded', () => {
  const channelListEl = document.getElementById('channelList');
  let channels = [];

  chrome.storage.local.get(['channels', 'minDuration', 'sliceCount', 'offsetCount'], (data) => {
    if (data.channels) {
      channels = data.channels;
      renderChannels();
    }
    const minDurationInput = document.getElementById('minDuration');
    if (minDurationInput) {
      minDurationInput.value = data.minDuration !== undefined ? data.minDuration : 10;
    }
    const sliceCountInput = document.getElementById('sliceCount');
    if (sliceCountInput) {
      sliceCountInput.value = data.sliceCount !== undefined ? data.sliceCount : 5;
    }
    const offsetCountInput = document.getElementById('offsetCount');
    if (offsetCountInput) {
      offsetCountInput.value = data.offsetCount !== undefined ? data.offsetCount : 0;
    }
  });

  document.getElementById('addChannelBtn').addEventListener('click', () => {
    const id = document.getElementById('channelId').value.trim();
    const name = document.getElementById('channelName').value.trim();
    const priority = parseInt(document.getElementById('channelPriority').value);

    if (id && name && !isNaN(priority)) {
      channels.push({ id, name, priority });
      renderChannels();
      document.getElementById('channelId').value = '';
      document.getElementById('channelName').value = '';
      document.getElementById('channelPriority').value = '';
    }
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const minDuration = parseInt(document.getElementById('minDuration').value);
    const sliceCount = parseInt(document.getElementById('sliceCount').value);
    const offsetCount = parseInt(document.getElementById('offsetCount').value);
    
    chrome.storage.local.set({
      channels,
      minDuration: isNaN(minDuration) ? 10 : minDuration,
      sliceCount: isNaN(sliceCount) ? 5 : sliceCount,
      offsetCount: isNaN(offsetCount) ? 0 : offsetCount
    }, () => {
      alert('Configuración guardada correctamente.');
    });
  });

  // Exportar Configuración
  document.getElementById('exportBtn').addEventListener('click', () => {
    const minDuration = parseInt(document.getElementById('minDuration').value) || 10;
    const sliceCount = parseInt(document.getElementById('sliceCount').value) || 5;
    const offsetCount = parseInt(document.getElementById('offsetCount').value) || 0;
    const backupData = {
      channels: channels,
      minDuration: minDuration,
      sliceCount: sliceCount,
      offsetCount: offsetCount
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "youtube_fitness_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Importar Configuración
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
        if (importedData && Array.isArray(importedData.channels)) {
          channels = importedData.channels;
          renderChannels();

          if (importedData.minDuration !== undefined) {
            document.getElementById('minDuration').value = importedData.minDuration;
          }
          if (importedData.sliceCount !== undefined) {
            document.getElementById('sliceCount').value = importedData.sliceCount;
          }
          if (importedData.offsetCount !== undefined) {
            document.getElementById('offsetCount').value = importedData.offsetCount;
          }

          const minDuration = parseInt(document.getElementById('minDuration').value) || 10;
          const sliceCount = parseInt(document.getElementById('sliceCount').value) || 5;
          const offsetCount = parseInt(document.getElementById('offsetCount').value) || 0;
          
          chrome.storage.local.set({ channels, minDuration, sliceCount, offsetCount }, () => {
            alert('Configuración importada y guardada correctamente.');
          });
        } else {
          alert('El archivo no tiene un formato de respaldo válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    importFileEl.value = '';
  });

  function renderChannels() {
    channelListEl.innerHTML = '';
    channels.forEach((ch, index) => {
      const li = document.createElement('li');
      li.textContent = `[P: ${ch.priority}] ${ch.name} (${ch.id})`;
      const delBtn = document.createElement('button');
      delBtn.textContent = 'X';
      delBtn.style.marginLeft = '10px';
      delBtn.addEventListener('click', () => {
        channels.splice(index, 1);
        renderChannels();
      });
      li.appendChild(delBtn);
      channelListEl.appendChild(li);
    });
  }
});