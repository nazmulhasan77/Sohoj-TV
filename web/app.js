const API_URL = 'sohoj-tv-api.json';
const FAVORITES_KEY = 'sohoj-tv-favorites';

const state = {
  channels: [],
  filtered: [],
  categories: [],
  selectedCategory: 'All',
  selectedChannel: null,
  search: '',
  sort: 'az',
  favorites: new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')),
  hls: null,
};

const els = {
  video: document.getElementById('videoPlayer'),
  playerMessage: document.getElementById('playerMessage'),
  searchInput: document.getElementById('searchInput'),
  categoryList: document.getElementById('categoryList'),
  clearFilters: document.getElementById('clearFilters'),
  channelGrid: document.getElementById('channelGrid'),
  emptyState: document.getElementById('emptyState'),
  channelCount: document.getElementById('channelCount'),
  sortSelect: document.getElementById('sortSelect'),
  nowLogo: document.getElementById('nowLogo'),
  nowGroup: document.getElementById('nowGroup'),
  nowName: document.getElementById('nowName'),
  nowUrl: document.getElementById('nowUrl'),
  favoriteCurrent: document.getElementById('favoriteCurrent'),
  copyUrl: document.getElementById('copyUrl'),
  openUrl: document.getElementById('openUrl'),
};

async function init() {
  bindEvents();

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`API load failed: ${response.status}`);
    const data = await response.json();
    state.channels = normalizeChannels(data.channels || []);
    buildCategories();
    applyFilters();

    if (state.channels.length) {
      selectChannel(state.channels[0], false);
    }
  } catch (error) {
    els.channelCount.textContent = 'Could not load channels';
    els.playerMessage.innerHTML = '<strong>API load failed</strong><span>Check sohoj-tv-api.json file.</span>';
    console.error(error);
  }
}

function normalizeChannels(channels) {
  return channels
    .filter((channel) => channel && channel.name && channel.url)
    .map((channel, index) => ({
      id: String(channel.id || `${channel.name}-${index}`),
      name: String(channel.name).trim(),
      group: String(channel.group || 'Undefined').trim() || 'Undefined',
      logo: String(channel.logo || '').trim(),
      url: String(channel.url || '').trim(),
    }));
}

function buildCategories() {
  const counts = new Map();

  state.channels.forEach((channel) => {
    splitGroups(channel.group).forEach((group) => {
      counts.set(group, (counts.get(group) || 0) + 1);
    });
  });

  state.categories = [
    ['All', state.channels.length],
    ['Favorites', state.favorites.size],
    ...[...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  ];

  renderCategories();
}

function renderCategories() {
  els.categoryList.innerHTML = '';

  state.categories.forEach(([name, count]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-btn${state.selectedCategory === name ? ' active' : ''}`;
    button.innerHTML = `<span>${escapeHtml(name)}</span><small>${count}</small>`;
    button.addEventListener('click', () => {
      state.selectedCategory = name;
      renderCategories();
      applyFilters();
    });
    els.categoryList.appendChild(button);
  });
}

function applyFilters() {
  const query = state.search.toLowerCase();
  let channels = state.channels.filter((channel) => {
    const matchesSearch =
      channel.name.toLowerCase().includes(query) ||
      channel.group.toLowerCase().includes(query);

    const matchesCategory =
      state.selectedCategory === 'All' ||
      (state.selectedCategory === 'Favorites' && state.favorites.has(channel.id)) ||
      splitGroups(channel.group).includes(state.selectedCategory);

    return matchesSearch && matchesCategory;
  });

  channels = sortChannels(channels);
  state.filtered = channels;
  renderChannels();
}

function sortChannels(channels) {
  const sorted = [...channels];

  if (state.sort === 'za') {
    return sorted.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (state.sort === 'favorites') {
    return sorted.sort((a, b) => {
      const favoriteScore = Number(state.favorites.has(b.id)) - Number(state.favorites.has(a.id));
      return favoriteScore || a.name.localeCompare(b.name);
    });
  }

  return sorted.sort((a, b) => a.name.localeCompare(b.name));
}

function renderChannels() {
  els.channelGrid.innerHTML = '';
  els.emptyState.hidden = state.filtered.length > 0;
  els.channelCount.textContent = `${state.filtered.length.toLocaleString()} of ${state.channels.length.toLocaleString()} channels`;

  const fragment = document.createDocumentFragment();
  state.filtered.forEach((channel) => {
    const card = document.createElement('article');
    card.className = `channel-card${state.selectedChannel?.id === channel.id ? ' active' : ''}`;
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="channel-logo">${logoMarkup(channel)}</div>
      <div class="channel-info">
        <h4 title="${escapeHtml(channel.name)}">${escapeHtml(channel.name)}</h4>
        <p title="${escapeHtml(channel.group)}">${escapeHtml(channel.group)}</p>
      </div>
      <button class="favorite${state.favorites.has(channel.id) ? ' active' : ''}" type="button" title="Favorite">★</button>
    `;

    card.addEventListener('click', () => selectChannel(channel));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') selectChannel(channel);
    });
    card.querySelector('.favorite').addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(channel);
    });

    fragment.appendChild(card);
  });

  els.channelGrid.appendChild(fragment);
}

function selectChannel(channel, shouldPlay = true) {
  state.selectedChannel = channel;
  els.playerMessage.classList.add('hidden');
  els.nowGroup.textContent = channel.group;
  els.nowName.textContent = channel.name;
  els.nowUrl.textContent = channel.url;
  els.openUrl.href = channel.url;
  els.favoriteCurrent.classList.toggle('active', state.favorites.has(channel.id));
  els.nowLogo.innerHTML = logoMarkup(channel);

  loadStream(channel.url, shouldPlay);
  renderChannels();
}

function loadStream(url, shouldPlay) {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }

  els.video.pause();
  els.video.removeAttribute('src');
  els.video.load();

  if (window.Hls && Hls.isSupported()) {
    state.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    state.hls.loadSource(url);
    state.hls.attachMedia(els.video);
    state.hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) showPlayerError('This stream could not be played.');
    });
  } else if (els.video.canPlayType('application/vnd.apple.mpegurl')) {
    els.video.src = url;
  } else {
    showPlayerError('This browser needs HLS support to play the stream.');
    return;
  }

  if (shouldPlay) {
    els.video.play().catch(() => {
      els.playerMessage.classList.remove('hidden');
      els.playerMessage.innerHTML = '<strong>Press play</strong><span>Your browser blocked autoplay.</span>';
    });
  }
}

function showPlayerError(message) {
  els.playerMessage.classList.remove('hidden');
  els.playerMessage.innerHTML = `<strong>Playback issue</strong><span>${escapeHtml(message)}</span>`;
}

function toggleFavorite(channel) {
  if (state.favorites.has(channel.id)) {
    state.favorites.delete(channel.id);
  } else {
    state.favorites.add(channel.id);
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  buildCategories();
  applyFilters();

  if (state.selectedChannel?.id === channel.id) {
    els.favoriteCurrent.classList.toggle('active', state.favorites.has(channel.id));
  }
}

function bindEvents() {
  els.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value.trim();
    applyFilters();
  });

  els.sortSelect.addEventListener('change', (event) => {
    state.sort = event.target.value;
    applyFilters();
  });

  els.clearFilters.addEventListener('click', () => {
    state.search = '';
    state.selectedCategory = 'All';
    els.searchInput.value = '';
    renderCategories();
    applyFilters();
  });

  els.favoriteCurrent.addEventListener('click', () => {
    if (state.selectedChannel) toggleFavorite(state.selectedChannel);
  });

  els.copyUrl.addEventListener('click', async () => {
    if (!state.selectedChannel) return;
    await navigator.clipboard.writeText(state.selectedChannel.url);
    els.copyUrl.textContent = 'Copied';
    setTimeout(() => {
      els.copyUrl.textContent = 'Copy URL';
    }, 1200);
  });
}

function splitGroups(group) {
  return String(group || 'Undefined')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function logoMarkup(channel) {
  if (!channel.logo) {
    return `<span>${escapeHtml(channel.name.slice(0, 2).toUpperCase())}</span>`;
  }

  return `<img src="${escapeHtml(channel.logo)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('TV'))">`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

init();
