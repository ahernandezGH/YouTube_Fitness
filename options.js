document.addEventListener('DOMContentLoaded', () => {
  const channelListEl = document.getElementById('channelList');
  let channels = [];

  chrome.storage.local.get(['channels'], (data) => {
    if (data.channels) {
      channels = data.channels;
      renderChannels();
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
    chrome.storage.local.set({ channels }, () => {
      alert('Configuración guardada correctamente.');
    });
  });

  function renderChannels() {
    channelListEl.innerHTML = '';
    channels.forEach((ch, index) => {
      const li = document.createElement('li');
      li.textContent = `[P: ${ch.priority}] ${ch.name} (${ch.id})`;
      const delBtn = document.createElement('button');
      delBtn.textContent = 'X';
      delBtn.style.marginLeft = '10px';
      delBtn.onclick = () => {
        channels.splice(index, 1);
        renderChannels();
      };
      li.appendChild(delBtn);
      channelListEl.appendChild(li);
    });
  }
});