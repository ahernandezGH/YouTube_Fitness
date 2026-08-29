document.addEventListener('DOMContentLoaded', () => {
  const channelListEl = document.getElementById('channelList');
  const customTagsContainer = document.getElementById('customTagsContainer');
  let channels = [];
  let customTags = [];
  let presetFilters = [];

  chrome.storage.local.get(['channels', 'minDuration', 'sliceCount', 'offsetCount', 'customTags', 'theme', 'presetFilters'], (data) => {
    presetFilters = data.presetFilters || [];
    renderPresetFilters();

    const currentTheme = data.theme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', currentTheme);
    const themeSelectEl = document.getElementById('themeSelect');
    if (themeSelectEl) {
      themeSelectEl.value = currentTheme;
      themeSelectEl.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        document.documentElement.setAttribute('data-theme', newTheme);
        chrome.storage.local.set({ theme: newTheme });
      });
    }

    if (data.channels) {
      channels = data.channels;
      renderChannels();
    }
    if (data.customTags) {
      customTags = data.customTags;
      renderCustomTags();
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

  document.getElementById('addTagBtn').addEventListener('click', () => {
    const newTag = document.getElementById('newTagInput').value.trim();
    if (newTag && !customTags.includes(newTag)) {
      customTags.push(newTag);
      chrome.storage.local.set({ customTags }, () => {
        renderCustomTags();
        document.getElementById('newTagInput').value = '';
      });
    }
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const minDuration = parseInt(document.getElementById('minDuration').value);
    const sliceCount = parseInt(document.getElementById('sliceCount').value);
    const offsetCount = parseInt(document.getElementById('offsetCount').value);
    
    chrome.storage.local.set({
      channels,
      customTags,
      minDuration: isNaN(minDuration) ? 10 : minDuration,
      sliceCount: isNaN(sliceCount) ? 5 : sliceCount,
      offsetCount: isNaN(offsetCount) ? 0 : offsetCount
    }, () => {
      alert('Configuración guardada correctamente.');
    });
  });

  // Exportar Configuración
  document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.storage.local.get(null, (allData) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "youtube_fitness_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
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
        if (importedData && typeof importedData === 'object') {
          chrome.storage.local.set(importedData, () => {
            alert('Configuración y biblioteca importadas y guardadas correctamente. La página se recargará.');
            window.location.reload();
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

  function renderCustomTags() {
    customTagsContainer.innerHTML = '';
    customTags.forEach((tag, index) => {
      const span = document.createElement('span');
      span.textContent = tag + ' ';
      span.style.background = '#444';
      span.style.padding = '4px 8px';
      span.style.borderRadius = '12px';
      span.style.fontSize = '12px';
      span.style.display = 'inline-flex';
      span.style.alignItems = 'center';
      span.style.gap = '4px';

      const leftBtn = document.createElement('button');
      leftBtn.textContent = '◀';
      leftBtn.style.background = 'transparent';
      leftBtn.style.border = 'none';
      leftBtn.style.color = '#aaa';
      leftBtn.style.cursor = 'pointer';
      leftBtn.style.fontSize = '10px';
      leftBtn.style.padding = '0';
      leftBtn.disabled = index === 0;
      leftBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveCustomTag(index, -1);
      });

      const rightBtn = document.createElement('button');
      rightBtn.textContent = '▶';
      rightBtn.style.background = 'transparent';
      rightBtn.style.border = 'none';
      rightBtn.style.color = '#aaa';
      rightBtn.style.cursor = 'pointer';
      rightBtn.style.fontSize = '10px';
      rightBtn.style.padding = '0';
      rightBtn.disabled = index === customTags.length - 1;
      rightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveCustomTag(index, 1);
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.style.background = 'transparent';
      delBtn.style.border = 'none';
      delBtn.style.color = '#ff6b6b';
      delBtn.style.padding = '0';
      delBtn.style.marginLeft = '2px';
      delBtn.style.fontSize = '14px';
      delBtn.style.cursor = 'pointer';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        customTags.splice(index, 1);
        chrome.storage.local.set({ customTags }, () => {
          renderCustomTags();
          renderPresetFilters();
        });
      });

      span.appendChild(leftBtn);
      span.appendChild(rightBtn);
      span.appendChild(delBtn);
      customTagsContainer.appendChild(span);
    });
    renderPresetFiltersForm();
  }

  function moveCustomTag(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= customTags.length) return;
    const [movedTag] = customTags.splice(index, 1);
    customTags.splice(newIndex, 0, movedTag);
    chrome.storage.local.set({ customTags }, () => {
      renderCustomTags();
      renderPresetFilters();
    });
  }

  const createPresetBtn = document.getElementById('createPresetBtn');
  if (createPresetBtn) {
    createPresetBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('newPresetName');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        alert('Por favor, ingresa un nombre para el filtro preconfigurado.');
        return;
      }

      const includeChecked = Array.from(document.querySelectorAll('#presetFormIncludeTags input[type="checkbox"]:checked')).map(cb => cb.value);
      const excludeChecked = Array.from(document.querySelectorAll('#presetFormExcludeTags input[type="checkbox"]:checked')).map(cb => cb.value);

      if (includeChecked.length === 0 && excludeChecked.length === 0) {
        alert('Por favor, selecciona al menos una etiqueta para incluir o excluir.');
        return;
      }

      const newPreset = {
        id: 'pf_' + Date.now(),
        name: name,
        includeTags: includeChecked,
        excludeTags: excludeChecked
      };

      presetFilters.push(newPreset);
      chrome.storage.local.set({ presetFilters }, () => {
        if (nameInput) nameInput.value = '';
        renderPresetFilters();
        alert(`Filtro "${newPreset.name}" creado con éxito.`);
      });
    });
  }

  function renderPresetFiltersForm() {
    const formInclude = document.getElementById('presetFormIncludeTags');
    const formExclude = document.getElementById('presetFormExcludeTags');

    if (formInclude) {
      formInclude.innerHTML = '';
      const noTagLabel = document.createElement('label');
      noTagLabel.style.display = 'flex';
      noTagLabel.style.alignItems = 'center';
      noTagLabel.style.gap = '4px';
      noTagLabel.style.fontSize = '11px';
      noTagLabel.innerHTML = `<input type="checkbox" value="none"> Sin etiqueta`;
      formInclude.appendChild(noTagLabel);

      customTags.forEach(tag => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '4px';
        label.style.fontSize = '11px';
        label.innerHTML = `<input type="checkbox" value="${tag}"> ${tag}`;
        formInclude.appendChild(label);
      });
    }

    if (formExclude) {
      formExclude.innerHTML = '';
      customTags.forEach(tag => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '4px';
        label.style.fontSize = '11px';
        label.innerHTML = `<input type="checkbox" value="${tag}"> ${tag}`;
        formExclude.appendChild(label);
      });
    }
  }

  function renderPresetFilters() {
    renderPresetFiltersForm();
    const listEl = document.getElementById('presetFiltersList');
    if (!listEl) return;

    if (presetFilters.length === 0) {
      listEl.innerHTML = '<div style="font-size: 12px; color: #8b949e; padding: 8px 0;">No tienes filtros preconfigurados aún.</div>';
      return;
    }

    listEl.innerHTML = '';
    presetFilters.forEach(p => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '8px 10px';
      item.style.background = 'rgba(255, 255, 255, 0.04)';
      item.style.border = '1px solid var(--card-border)';
      item.style.borderRadius = '6px';
      item.style.marginBottom = '6px';

      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '2px';

      const nameEl = document.createElement('div');
      nameEl.style.fontWeight = '600';
      nameEl.style.fontSize = '12px';
      nameEl.textContent = p.name;
      info.appendChild(nameEl);

      const tagsSummary = document.createElement('div');
      tagsSummary.style.fontSize = '10px';
      tagsSummary.style.color = '#8b949e';

      let text = '';
      if (p.includeTags && p.includeTags.length > 0) {
        text += `Incluye: ${p.includeTags.map(t => t === 'none' ? 'Sin etiqueta' : t).join(', ')}`;
      }
      if (p.excludeTags && p.excludeTags.length > 0) {
        if (text) text += ' | ';
        text += `Excluye: ${p.excludeTags.join(', ')}`;
      }
      tagsSummary.textContent = text;
      info.appendChild(tagsSummary);
      item.appendChild(info);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Eliminar';
      delBtn.style.fontSize = '10px';
      delBtn.style.padding = '3px 6px';
      delBtn.style.backgroundColor = 'transparent';
      delBtn.style.color = '#ff6b6b';
      delBtn.style.border = '1px solid rgba(255, 107, 107, 0.3)';
      delBtn.style.borderRadius = '4px';
      delBtn.style.cursor = 'pointer';
      delBtn.addEventListener('click', () => {
        if (!confirm(`¿Eliminar filtro "${p.name}"?`)) return;
        presetFilters = presetFilters.filter(item => item.id !== p.id);
        chrome.storage.local.set({ presetFilters }, () => {
          renderPresetFilters();
        });
      });
      item.appendChild(delBtn);

      listEl.appendChild(item);
    });
  }
});