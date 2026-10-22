const state = { catalog: null, study: null, selected: new Map(), rankById: new Map() };
const $ = (id) => document.getElementById(id);

function option(value, label) {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

function uniqueValues(results, key) {
  return [...new Set(results.map((result) => result[key]).filter((value) => value !== null && value !== undefined && value !== '' && value !== 'Not recorded'))].sort((a, b) => String(a).localeCompare(String(b)));
}

function populateFilter(id, values, format = String) {
  const select = $(id);
  select.replaceChildren(select.firstElementChild.cloneNode(true));
  values.forEach((value) => select.append(option(String(value), format(value))));
  select.disabled = values.length === 0;
}

function rankedResults() {
  return [...state.study.results].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function currentResults() {
  const family = $('family-filter').value;
  const sourceType = $('source-filter').value;
  const tool = $('tool-filter').value;
  const runtime = $('runtime-filter').value;
  const quantization = $('quantization-filter').value;
  const memory = $('memory-filter').value;
  return rankedResults().filter((result) =>
    (!family || result.family === family) &&
    (!sourceType || result.source_type === sourceType) &&
    (!tool || result.tool === tool) &&
    (!runtime || result.runtime === runtime) &&
    (!quantization || result.quantization === quantization) &&
    (!memory || String(result.memory_gb) === memory));
}

function clearSelection() {
  state.selected.clear();
  updateCompareButton();
}

function updateCompareButton() {
  const count = state.selected.size;
  $('selected-count').textContent = String(count);
  $('compare-button').disabled = count < 2;
  $('compare-button').setAttribute('aria-label', `Compare ${count} selected results`);
}

function showStudy() {
  state.study = state.catalog.evaluations.find((item) => item.id === $('study-filter').value);
  const study = state.study;
  $('study-title').textContent = study.title;
  $('study-description').textContent = study.description;
  $('study-brief').textContent = `“${study.brief}”`;
  const completed = study.results.filter((result) => result.images.length > 0).length;
  $('study-count').textContent = `${study.results.length} model runs · ${completed} with images`;
  state.rankById.clear();
  let rank = 0;
  let lastScore = null;
  rankedResults().forEach((result, index) => {
    if (index === 0 || result.score !== lastScore) rank = index + 1;
    state.rankById.set(result.id, rank);
    lastScore = result.score;
  });
  populateFilter('family-filter', uniqueValues(study.results, 'family'));
  populateFilter('source-filter', uniqueValues(study.results, 'source_type'));
  populateFilter('tool-filter', uniqueValues(study.results, 'tool'));
  populateFilter('runtime-filter', uniqueValues(study.results, 'runtime'));
  populateFilter('quantization-filter', uniqueValues(study.results, 'quantization'));
  populateFilter('memory-filter', uniqueValues(study.results, 'memory_gb'), (value) => `${value} GB`);
  clearSelection();
  renderGallery();
}

function tag(text) {
  const element = document.createElement('span');
  element.className = 'tag';
  element.textContent = text;
  return element;
}

function openViewer(result, image) {
  $('viewer-title').textContent = result.label;
  $('viewer-image').src = image.path;
  $('viewer-image').alt = `${result.label}: ${image.label}`;
  $('viewer-detail').textContent = [`Score ${Number(result.score).toFixed(1)}/10`, image.label, result.family, result.runtime, result.run_date].filter(Boolean).join(' · ');
  $('viewer-original').href = image.path;
  $('viewer').showModal();
}

function statusLabel(status) {
  return { invalid_svg: 'Invalid SVG', no_output: 'No SVG produced' }[status] || 'Unavailable';
}

function card(result, index) {
  const article = document.createElement('article');
  const rank = state.rankById.get(result.id);
  article.className = rank <= 3 ? 'card card-top-three' : 'card';
  const hasImage = result.images.length > 0;
  let image;
  let current = 0;
  let media;

  if (hasImage) {
    media = document.createElement('button');
    media.type = 'button';
    media.className = 'card-media';
    media.setAttribute('aria-label', `Enlarge ${result.label} result`);
    image = document.createElement('img');
    image.src = result.images[0].path;
    image.alt = `${result.label} SVG result for ${state.study.title}`;
    image.loading = index < 3 ? 'eager' : 'lazy';
    image.decoding = 'async';
    media.append(image);
    media.addEventListener('click', () => openViewer(result, result.images[current]));
  } else {
    media = document.createElement('div');
    media.className = 'card-media card-media-empty';
    const heading = document.createElement('strong');
    heading.textContent = statusLabel(result.status);
    const detail = document.createElement('span');
    detail.textContent = 'No image available for comparison';
    media.append(heading, detail);
  }

  const body = document.createElement('div');
  body.className = 'card-body';
  const topline = document.createElement('div');
  topline.className = 'card-topline';
  const number = document.createElement('span');
  number.textContent = `RANK #${String(rank).padStart(2, '0')}`;
  const sourceType = document.createElement('span');
  sourceType.textContent = result.source_type;
  topline.append(number, sourceType);
  const heading = document.createElement('div');
  heading.className = 'card-heading';
  const title = document.createElement('h3');
  title.textContent = result.label;
  const scoreBadge = document.createElement('div');
  scoreBadge.className = 'score-badge';
  scoreBadge.setAttribute('aria-label', `Score ${Number(result.score).toFixed(1)} out of 10`);
  const scoreLabel = document.createElement('span');
  scoreLabel.textContent = 'Score';
  const scoreValue = document.createElement('strong');
  scoreValue.textContent = Number(result.score).toFixed(1);
  const scoreMaximum = document.createElement('small');
  scoreMaximum.textContent = '/ 10';
  scoreBadge.append(scoreLabel, scoreValue, scoreMaximum);
  heading.append(title, scoreBadge);
  const metadata = document.createElement('div');
  metadata.className = 'metadata';
  metadata.append(tag(result.family));
  if (result.runtime && result.runtime !== result.family) metadata.append(tag(result.runtime));
  if (result.tool) metadata.append(tag(result.tool));
  if (result.method) metadata.append(tag(result.method));
  if (result.run_date) metadata.append(tag(result.run_date));
  if (result.quantization) metadata.append(tag(`Quant. ${result.quantization}`));
  if (result.memory_gb != null) metadata.append(tag(`${result.memory_gb} GB memory`));
  if (result.duration) metadata.append(tag(result.duration));
  body.append(topline, heading, metadata);
  const reason = document.createElement('p');
  reason.className = 'score-reason';
  reason.textContent = result.score_reason;
  body.append(reason);
  if (result.public_note) {
    const note = document.createElement('p');
    note.className = 'card-note';
    note.textContent = result.public_note;
    body.append(note);
  }

  const foot = document.createElement('div');
  foot.className = 'card-foot';
  if (hasImage) {
    const versionWrap = document.createElement('div');
    versionWrap.className = 'version-wrap';
    const versionLabel = document.createElement('label');
    versionLabel.textContent = `Version · ${result.images.length} ${result.images.length === 1 ? 'image' : 'images'}`;
    const version = document.createElement('select');
    version.setAttribute('aria-label', `Version for ${result.label}`);
    result.images.forEach((item, imageIndex) => version.append(option(String(imageIndex), item.label)));
    version.disabled = result.images.length === 1;
    version.addEventListener('change', () => {
      current = Number(version.value);
      image.src = result.images[current].path;
      image.alt = `${result.label}: ${result.images[current].label}`;
      if (state.selected.has(result.id)) state.selected.set(result.id, current);
    });
    versionWrap.append(versionLabel, version);
    const compareLabel = document.createElement('label');
    compareLabel.className = 'compare-label';
    const compare = document.createElement('input');
    compare.type = 'checkbox';
    compare.setAttribute('aria-label', `Select ${result.label} for comparison`);
    compare.addEventListener('change', () => {
      if (compare.checked && state.selected.size >= 4) {
        compare.checked = false;
        window.alert('Choose up to four results to compare.');
        return;
      }
      if (compare.checked) state.selected.set(result.id, current);
      else state.selected.delete(result.id);
      updateCompareButton();
    });
    compareLabel.append(compare, document.createTextNode(' Compare'));
    foot.append(versionWrap, compareLabel);
  } else {
    const unavailable = document.createElement('span');
    unavailable.className = 'card-status';
    unavailable.textContent = statusLabel(result.status);
    foot.append(unavailable);
  }
  body.append(foot);
  article.append(media, body);
  return article;
}

function renderGallery() {
  const results = currentResults();
  $('gallery').replaceChildren(...results.map(card));
  const withImages = results.filter((result) => result.images.length > 0).length;
  $('visible-count').textContent = `Showing ${results.length} of ${state.study.results.length} runs, ranked best to worst by Score · ${withImages} with images. Select two to four images for comparison.`;
  $('empty-state').hidden = results.length > 0;
}

function showComparison() {
  const selected = [...state.selected].map(([id, imageIndex]) => {
    const result = state.study.results.find((item) => item.id === id);
    return { result, image: result.images[imageIndex] };
  });
  const grid = $('comparison-grid');
  grid.style.setProperty('--compare-count', String(selected.length));
  grid.replaceChildren(...selected.map(({ result, image }) => {
    const item = document.createElement('div');
    item.className = 'comparison-item';
    const picture = document.createElement('img');
    picture.src = image.path;
    picture.alt = `${result.label}: ${image.label}`;
    const caption = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = result.label;
    const detail = document.createElement('span');
    detail.textContent = `Score ${Number(result.score).toFixed(1)}/10 · ${image.label} · ${result.family}`;
    caption.append(title, detail);
    item.append(picture, caption);
    return item;
  }));
  $('comparison').showModal();
}

async function init() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.catalog = await response.json();
    const studies = state.catalog.evaluations;
    if (!studies.length) throw new Error('The catalog has no evaluations.');
    $('evaluation-count').textContent = String(studies.length).padStart(2, '0');
    $('evaluation-plural').textContent = studies.length === 1 ? '' : 'S';
    $('result-count').textContent = String(studies.reduce((total, item) => total + item.results.length, 0)).padStart(2, '0');
    studies.forEach((item) => $('study-filter').append(option(item.id, item.title)));
    $('study-filter').addEventListener('change', showStudy);
    for (const id of ['family-filter', 'source-filter', 'tool-filter', 'runtime-filter', 'quantization-filter', 'memory-filter']) {
      $(id).addEventListener('change', () => { clearSelection(); renderGallery(); });
    }
    $('reset-button').addEventListener('click', () => {
      for (const id of ['family-filter', 'source-filter', 'tool-filter', 'runtime-filter', 'quantization-filter', 'memory-filter']) $(id).value = '';
      clearSelection();
      renderGallery();
    });
    $('compare-button').addEventListener('click', showComparison);
    $('viewer-close').addEventListener('click', () => $('viewer').close());
    $('comparison-close').addEventListener('click', () => $('comparison').close());
    for (const id of ['viewer', 'comparison']) $(id).addEventListener('click', (event) => { if (event.target === $(id)) $(id).close(); });
    showStudy();
  } catch (error) {
    $('study-title').textContent = 'Gallery unavailable';
    $('study-description').textContent = 'Could not load the gallery. Please try again later.';
    $('study-brief').textContent = '';
    $('gallery').replaceChildren();
  }
}

init();
