const API_URL = 'sohoj-tv-api.json';
const FAVORITES_KEY = 'sohoj-tv-favorites';
const THEME_KEY = 'sohoj-tv-theme';
const ATN_BANGLA_URL = 'https://tvsen5.aynaott.com/atnbangla/index.m3u8';
const SPECIAL_CATEGORIES = ['Islamic', 'Bangla', 'Sports', 'Football', 'Cricket', 'Bangladesh'];
const CHINESE_TERMS = [
  'china',
  'chinese',
  'cctv',
  'cgtn',
  'cgntv chinese',
  'phoenix chinese',
  'zhongwen',
  'mandarin',
  '中文',
  '中国',
  '中國',
  '央视',
  '凤凰',
  '京视',
  '五星体育',
  '交城',
];
const BANGLADESH_CHANNEL_NAMES = [
  'atn bangla',
  'atn bangla uk',
  'atn news',
  'bangla tv',
  'bangla vision',
  'bijoy tv',
  'boishakhi tv',
  'channel 24',
  'dbc news',
  'deepto tv',
  'desh tv',
  'ekattor tv',
  'ekhon tv',
  'ekushey tv',
  'independent tv',
  'jamuna tv',
  'maasranga tv',
  'my tv',
  'somoy news tv',
  'star news',
];
const FOOTBALL_TERMS = ['fifa', 'football', 'soccer'];
const CRICKET_TERMS = ['cricket', 'willow sports'];
const ISLAMIC_TERMS = [
  'islam',
  'islamic',
  'muslim',
  'quran',
  'qur',
  'makkah',
  'madinah',
  'madani',
  'peace tv',
  'huda',
  'iqraa',
];
const BANGLA_TERMS = ['bangla', 'bengali', 'bangladesh'];

const state = {
  channels: [],
  filtered: [],
  categories: [],
  selectedCategory: 'All',
  selectedChannel: null,
  search: '',
  sort: 'az',
  resolution: 'all',
  preferredQuality: 'auto',
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
  channelHeading: document.getElementById('channelHeading'),
  themeToggle: document.getElementById('themeToggle'),
  qualitySelect: document.getElementById('qualitySelect'),
  resolutionSelect: document.getElementById('resolutionSelect'),
  sortSelect: document.getElementById('sortSelect'),
  nowLogo: document.getElementById('nowLogo'),
  nowGroup: document.getElementById('nowGroup'),
  nowName: document.getElementById('nowName'),
  favoriteCurrent: document.getElementById('favoriteCurrent'),
  retryStream: document.getElementById('retryStream'),
};

async function init() {
  applySavedTheme();
  bindEvents();

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`API load failed: ${response.status}`);
    const data = await response.json();
    state.channels = normalizeChannels(data.channels || []);
    buildCategories();
    state.selectedCategory = state.categories.some(([name]) => name === 'Bangla') ? 'Bangla' : 'All';
    renderCategories();
    applyFilters();

    const firstChannel = state.filtered[0] || state.channels[0];
    if (firstChannel) {
      selectChannel(firstChannel, false);
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
      url: getChannelUrl(channel),
      resolution: getChannelResolution(channel.name),
    }))
    .filter((channel) => isPlayableUrl(channel.url))
    .filter((channel) => !isMalformedChannel(channel))
    .filter((channel) => !isChineseChannel(channel));
}

function buildCategories() {
  const counts = new Map();

  state.channels.forEach((channel) => {
    splitGroups(channel.group).forEach((group) => {
      counts.set(group, (counts.get(group) || 0) + 1);
    });
  });

  state.categories = [
    ...SPECIAL_CATEGORIES.map((name) => [name, state.channels.filter((channel) => matchesSpecialCategory(channel, name)).length])
      .filter(([, count]) => count > 0),
    ['All', state.channels.length],
    ['Favorites', state.favorites.size],
    ...[...counts.entries()]
      .filter(([name]) => !SPECIAL_CATEGORIES.includes(name))
      .sort((a, b) => a[0].localeCompare(b[0])),
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
      matchesSpecialCategory(channel, state.selectedCategory) ||
      splitGroups(channel.group).includes(state.selectedCategory);

    const matchesResolution =
      state.resolution === 'all' ||
      channel.resolution === state.resolution ||
      channel.name.toLowerCase().includes(`${state.resolution}p`);

    return matchesSearch && matchesCategory && matchesResolution;
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
  els.channelHeading.textContent = state.selectedCategory === 'All'
    ? 'All Live Channels'
    : `${state.selectedCategory} Channels`;
  els.channelCount.textContent = state.selectedCategory === 'All'
    ? `${state.filtered.length.toLocaleString()} channels available`
    : `${state.filtered.length.toLocaleString()} channels in ${state.selectedCategory}`;

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
  resetQualityOptions();
  showPlayerNotice('Loading stream', 'Please wait a moment...', false);

  if (window.Hls && Hls.isSupported()) {
    state.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    state.hls.loadSource(url);
    state.hls.attachMedia(els.video);
    state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      buildQualityOptions();
      if (shouldPlay) {
        playSelectedStream();
      } else {
        showPlayerNotice('Ready to play', 'Press play in this player.', true);
      }
    });
    state.hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        state.hls.startLoad();
        showPlayerNotice('Reconnecting', 'The stream stalled, trying again...', false);
        return;
      }
      showPlayerError('This stream could not be played. Try another channel or press Retry.');
    });
  } else if (els.video.canPlayType('application/vnd.apple.mpegurl')) {
    els.video.src = url;
    resetQualityOptions('Auto quality');
    els.video.addEventListener(
      'loadedmetadata',
      () => {
        if (shouldPlay) {
          playSelectedStream();
        } else {
          showPlayerNotice('Ready to play', 'Press play in this player.', true);
        }
      },
      { once: true },
    );
  } else {
    showPlayerError('This browser needs HLS support to play the stream.');
    return;
  }

  if (!window.Hls && shouldPlay) {
    playSelectedStream();
  }
}

function playSelectedStream() {
  els.video.play().then(() => {
    els.playerMessage.classList.add('hidden');
  }).catch(() => {
    showPlayerNotice('Press play', 'Your browser blocked autoplay.', true);
  });
}

function showPlayerNotice(title, message, showButton = false) {
  els.playerMessage.classList.remove('hidden');
  els.playerMessage.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(message)}</span>
    ${showButton ? '<button class="message-action" type="button">Play stream</button>' : ''}
  `;

  const action = els.playerMessage.querySelector('.message-action');
  if (action) {
    action.addEventListener('click', playSelectedStream);
  }
}

function showPlayerError(message) {
  els.playerMessage.classList.remove('hidden');
  els.playerMessage.innerHTML = `
    <strong>Playback issue</strong>
    <span>${escapeHtml(message)}</span>
    <button class="message-action" type="button">Retry</button>
  `;
  els.playerMessage.querySelector('.message-action').addEventListener('click', retryCurrentStream);
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

  els.themeToggle.addEventListener('click', toggleTheme);

  els.qualitySelect.addEventListener('change', (event) => {
    state.preferredQuality = event.target.value;
    applyQualitySelection();
  });

  els.resolutionSelect.addEventListener('change', (event) => {
    state.resolution = event.target.value;
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

  els.retryStream.addEventListener('click', retryCurrentStream);

  els.video.addEventListener('playing', () => {
    els.playerMessage.classList.add('hidden');
  });

  els.video.addEventListener('error', () => {
    showPlayerError('The selected stream is unavailable right now.');
  });
}

function retryCurrentStream() {
  if (!state.selectedChannel) return;
  loadStream(state.selectedChannel.url, true);
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

function isPlayableUrl(url) {
  return /\.(m3u8)(\?|#|$)/i.test(url);
}

function getChannelResolution(name) {
  const match = String(name).match(/\b(1080|720|480)p\b/i);
  return match ? match[1] : 'unknown';
}

function getChannelUrl(channel) {
  const name = normalizeChannelName(channel.name);
  if (name === 'atn bangla') return ATN_BANGLA_URL;
  return String(channel.url || '').trim();
}

function isMalformedChannel(channel) {
  const haystack = `${channel.name} ${channel.group}`.toLowerCase();
  return haystack.includes('mozilla/') || haystack.includes('like gecko)') || haystack.includes('user-agent');
}

function isChineseChannel(channel) {
  return hasAnyTerm(channel, CHINESE_TERMS);
}

function matchesSpecialCategory(channel, category) {
  if (category === 'Islamic') return hasAnyTerm(channel, ISLAMIC_TERMS);
  if (category === 'Bangla') return isBanglaChannel(channel);
  if (category === 'Sports') return splitGroups(channel.group).includes('Sports') || hasAnyTerm(channel, ['sports']);
  if (category === 'Football') return hasAnyTerm(channel, FOOTBALL_TERMS);
  if (category === 'Cricket') return hasAnyTerm(channel, CRICKET_TERMS);
  if (category === 'Bangladesh') return isBangladeshChannel(channel);
  return false;
}

function isBanglaChannel(channel) {
  return hasAnyTerm(channel, BANGLA_TERMS) || isBangladeshChannel(channel);
}

function isBangladeshChannel(channel) {
  const name = normalizeChannelName(channel.name);
  const logo = channel.logo.toLowerCase();
  return BANGLADESH_CHANNEL_NAMES.includes(name) || logo.includes('bangladesh');
}

function normalizeChannelName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAnyTerm(channel, terms) {
  const haystack = `${channel.name} ${channel.group} ${channel.logo} ${channel.url}`.toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  setTheme(theme);
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  setTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.textContent = theme === 'light' ? '☀' : '☾';
  els.themeToggle.title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
}

function resetQualityOptions(label = 'Auto') {
  els.qualitySelect.innerHTML = `<option value="auto">${escapeHtml(label)}</option>`;
  els.qualitySelect.value = 'auto';
  els.qualitySelect.disabled = true;
}

function buildQualityOptions() {
  if (!state.hls?.levels?.length) {
    resetQualityOptions();
    return;
  }

  const heights = [...new Set(state.hls.levels.map((level) => level.height).filter(Boolean))]
    .sort((a, b) => b - a);
  const targetHeights = [1080, 720, 480].filter((height) => heights.some((available) => Math.abs(available - height) <= 80));

  els.qualitySelect.innerHTML = '<option value="auto">Auto</option>';
  targetHeights.forEach((height) => {
    const option = document.createElement('option');
    option.value = String(height);
    option.textContent = `${height}p`;
    els.qualitySelect.appendChild(option);
  });

  els.qualitySelect.disabled = targetHeights.length === 0;
  els.qualitySelect.value = targetHeights.includes(Number(state.preferredQuality)) ? state.preferredQuality : 'auto';
  applyQualitySelection();
}

function applyQualitySelection() {
  if (!state.hls) return;

  if (state.preferredQuality === 'auto') {
    state.hls.currentLevel = -1;
    return;
  }

  const target = Number(state.preferredQuality);
  const indexedLevels = state.hls.levels
    .map((level, index) => ({ index, height: level.height || 0 }))
    .filter((level) => level.height > 0)
    .sort((a, b) => Math.abs(a.height - target) - Math.abs(b.height - target));

  state.hls.currentLevel = indexedLevels[0]?.index ?? -1;
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
