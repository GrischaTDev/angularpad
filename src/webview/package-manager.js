const vscode = acquireVsCodeApi();
const model = PackageManagerModel;
const MAX_EXTERNAL_PACKAGE_BYTES = 2 * 1024 * 1024;

const SECTION_SHORT = {
  dependencies: 'dep',
  devDependencies: 'dev',
  peerDependencies: 'peer',
  optionalDependencies: 'opt',
};

const VERSION_STATUS_KEYS = {
  identical: 'statusIdentical',
  compatible: 'statusCompatible',
  conflict: 'statusConflict',
};

const STATUS_KEYS = {
  different: 'statusDifferent',
  equal: 'statusEqual',
  'external-only': 'statusExternalOnly',
  'local-only': 'statusLocalOnly',
  ambiguous: 'statusAmbiguous',
};

let packageFiles = [];
let focusTarget;
let focusRevision = -1;
let activePath = '';
let occurrences = [];
let selectedKeys = new Set();
let newVersion = '';
let currentLang = 'en';
let activeMode = 'project';

let externalReference;
let comparisonRows = [];
let comparisonSelectedKeys = new Set();
let expandedComparisonNames = new Set();

function element(id) {
  return document.getElementById(id);
}

function t(key, values = {}) {
  const dictionary = i18n[currentLang] || i18n.en;
  let text = dictionary[key] || i18n.en[key] || key;
  Object.entries(values).forEach(([name, value]) => {
    text = text.replaceAll('{' + name + '}', String(value));
  });
  return text;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.getAttribute('data-i18n');
    node.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
    const key = node.getAttribute('data-i18n-placeholder');
    node.placeholder = t(key);
  });
}

function showMessage(message, kind = 'info') {
  const banner = element('message-banner');
  banner.textContent = message;
  banner.className = 'message-banner open' + (kind === 'error' ? ' error' : '');
}

function clearMessage() {
  const banner = element('message-banner');
  banner.textContent = '';
  banner.className = 'message-banner';
}

function createTextNode(tagName, className, value) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function setMode(mode) {
  activeMode = mode;
  element('project-mode').classList.toggle('active', mode === 'project');
  element('compare-mode').classList.toggle('active', mode === 'compare');
  element('project-mode-button').classList.toggle('active', mode === 'project');
  element('compare-mode-button').classList.toggle('active', mode === 'compare');
  if (mode === 'compare') renderComparison();
}

function handleState(data) {
  packageFiles = Array.isArray(data.packages) ? data.packages : [];
  currentLang = data.language || 'en';
  applyTranslations();

  if (data.focusRevision !== focusRevision) {
    focusRevision = data.focusRevision;
    if (data.target) {
      setFocusTarget(data.target);
    } else {
      focusTarget = undefined;
      activePath = '';
      occurrences = [];
      selectedKeys = new Set();
      newVersion = '';
      selectFirstTarget();
    }
    activeMode = 'project';
  } else if (focusTarget) {
    occurrences = model.getTargetOccurrences(packageFiles, focusTarget);
    const availableKeys = new Set(occurrences.map(model.createOccurrenceKey));
    selectedKeys = new Set(
      [...selectedKeys].filter(key => availableKeys.has(key)),
    );
  }

  if (!activePath && packageFiles.length > 0) {
    activePath = packageFiles[0].absPath;
  }
  if (!focusTarget) selectFirstTarget();

  renderExplorer();
  renderDetail();
  renderComparison();
  setMode(activeMode);
  clearMessage();
}

function renderExplorer() {
  const query = element('pkg-path-filter').value;
  const onlyConflicts = element('pkg-only-conflicts').checked;
  const showCompatible = element('pkg-show-compatible').checked;
  const versionIndex = model.buildVersionStatusIndex(packageFiles);
  const files = model
    .filterPackageFiles(packageFiles, query)
    .map(file => ({
      ...file,
      visibleDeps: onlyConflicts
        ? file.deps.filter(dep => versionIndex.get(dep.name)?.hasConflict)
        : file.deps,
    }))
    .filter(file => file.visibleDeps.length > 0);
  const container = element('pkg-explorer');
  container.replaceChildren();
  element('path-count').textContent = t('pathCount', { count: files.length });

  if (files.length === 0) {
    container.appendChild(createTextNode('div', 'empty-state', t('noMatchingPaths')));
    return;
  }

  files.forEach(file => {
    const group = document.createElement('div');
    group.className = 'path-group' + (file.absPath === activePath ? ' active' : '');

    const pathHeader = document.createElement('div');
    pathHeader.className = 'path-header';

    const pathButton = document.createElement('button');
    pathButton.type = 'button';
    pathButton.className = 'path-button';
    pathButton.title = file.absPath;
    const relativePath = file.folder === 'root'
      ? 'package.json'
      : file.folder + '/package.json';
    pathButton.appendChild(createTextNode('span', 'path-label', relativePath));
    const fileSummary = model.getFileVersionSummary(file, versionIndex);
    const summaryParts = [t('packageCount', { count: fileSummary.packageCount })];
    if (fileSummary.conflictCount > 0) {
      summaryParts.push(t('conflictCount', { count: fileSummary.conflictCount }));
    }
    if (showCompatible && fileSummary.compatibleCount > 0) {
      summaryParts.push(t('compatibleCount', { count: fileSummary.compatibleCount }));
    }
    pathButton.appendChild(createTextNode('span', 'count', summaryParts.join(' · ')));
    pathButton.addEventListener('click', () => {
      activePath = file.absPath;
      renderExplorer();
    });

    const openFileButton = document.createElement('button');
    openFileButton.type = 'button';
    openFileButton.className = 'path-open-button';
    openFileButton.textContent = '↗';
    openFileButton.title = t('openPackageJson');
    openFileButton.addEventListener('click', () => {
      vscode.postMessage({ type: 'openPackageJson', absPath: file.absPath });
    });

    pathHeader.appendChild(pathButton);
    pathHeader.appendChild(openFileButton);
    group.appendChild(pathHeader);

    if (file.absPath === activePath) {
      const packageList = document.createElement('div');
      packageList.className = 'path-packages';
      file.visibleDeps.forEach(dep => {
        const entry = document.createElement('div');
        entry.className = 'package-entry';

        const occurrence = {
          ...dep,
          folder: file.folder,
          absPath: file.absPath,
        };
        const packageSummary = versionIndex.get(dep.name);
        const occurrenceStatus = model.getOccurrenceVersionStatus(
          versionIndex,
          occurrence,
        );
        const displayStatus = packageSummary?.hasConflict
          ? 'conflict'
          : occurrenceStatus;

        const packageButton = document.createElement('button');
        packageButton.type = 'button';
        packageButton.className = 'package-button';
        packageButton.title = [
          dep.name,
          dep.version,
          t(VERSION_STATUS_KEYS[displayStatus]),
        ].join(' · ');
        packageButton.appendChild(createTextNode('span', 'package-entry-name', dep.name));
        packageButton.appendChild(
          createTextNode('span', 'type-badge', SECTION_SHORT[dep.type] || dep.type),
        );
        packageButton.appendChild(createTextNode('span', 'version', dep.version));
        if (displayStatus === 'conflict' || displayStatus === 'identical' || showCompatible) {
          const statusMarker = createTextNode(
            'span',
            'version-status-marker version-status-' + displayStatus,
            displayStatus === 'conflict' ? '⚠' : '●',
          );
          statusMarker.title = t(VERSION_STATUS_KEYS[displayStatus]);
          packageButton.appendChild(statusMarker);
        }
        packageButton.addEventListener('click', () => {
          focusManualTarget({
            type: 'package',
            value: dep.name,
            version: dep.version,
            absPath: file.absPath,
          });
        });
        entry.appendChild(packageButton);

        const scope = model.getPackageScope(dep.name);
        if (scope) {
          const scopeButton = document.createElement('button');
          scopeButton.type = 'button';
          scopeButton.className = 'scope-button';
          scopeButton.textContent = '⇄ ' + scope + '/*';
          scopeButton.title = t('btnEditScope').replace('{scope}', scope);
          scopeButton.addEventListener('click', () => {
            focusManualTarget({
              type: 'scope',
              value: scope,
              version: dep.version,
              absPath: file.absPath,
            });
          });
          entry.appendChild(scopeButton);
        }

        packageList.appendChild(entry);
      });
      group.appendChild(packageList);
    }

    container.appendChild(group);
  });
}

function focusManualTarget(target) {
  setFocusTarget(target);
  renderExplorer();
  renderDetail();
  setMode('project');
}

function setFocusTarget(target) {
  focusTarget = target;
  activePath = target.absPath;
  newVersion = target.version;
  occurrences = model.getTargetOccurrences(packageFiles, focusTarget);
  selectedKeys = model.createSelection(occurrences);
}

function selectFirstTarget() {
  const file = packageFiles.find(item => item.deps.length > 0);
  if (!file) return;
  const dep = file.deps[0];
  setFocusTarget({
    type: 'package',
    value: dep.name,
    version: dep.version,
    absPath: file.absPath,
  });
}

function renderDetail() {
  const content = element('detail-content');
  if (!focusTarget || occurrences.length === 0) {
    content.hidden = true;
    return;
  }

  content.hidden = false;
  element('detail-title').textContent = focusTarget.type === 'scope'
    ? focusTarget.value + '/*'
    : focusTarget.value;
  element('occurrence-count').textContent = t('occurrenceCount', {
    count: occurrences.length,
  });
  element('pkg-new-version').value = newVersion;

  const container = element('pkg-occurrences');
  container.replaceChildren();
  occurrences.forEach((item, index) => {
    const key = model.createOccurrenceKey(item);
    const row = document.createElement('label');
    row.className = 'occurrence-row';
    row.title = item.absPath;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'occurrence-' + index;
    checkbox.checked = selectedKeys.has(key);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedKeys.add(key);
      else selectedKeys.delete(key);
      updateManualPreview();
    });

    row.appendChild(checkbox);
    row.appendChild(createTextNode('span', 'package-name', item.name));
    row.appendChild(createTextNode('span', 'occurrence-path', item.absPath));
    row.appendChild(
      createTextNode('span', 'type-badge', SECTION_SHORT[item.type] || item.type),
    );
    row.appendChild(createTextNode('span', 'version', item.version));
    container.appendChild(row);
  });

  updateManualPreview();
}

function getSelectedCount(items, selection) {
  return items.filter(item => selection.has(model.createOccurrenceKey(item))).length;
}

function updateManualPreview() {
  const versionInput = element('pkg-new-version');
  newVersion = versionInput.value.trim();
  const selectedCount = getSelectedCount(occurrences, selectedKeys);
  const changes = model.buildPreview(occurrences, selectedKeys, newVersion);
  const status = model.getSaveStatus(newVersion, selectedCount, changes);

  element('selected-count').textContent = t('selectedCount', {
    selected: selectedCount,
    total: occurrences.length,
  });
  element('pkg-select-none').disabled = selectedCount === 0;
  element('pkg-select-all').disabled = selectedCount === occurrences.length;
  versionInput.classList.toggle('invalid', status.reason === 'empty-version');
  element('preview-count').textContent = t('changeCount', { count: changes.length });

  let emptyMessage = t('noChanges');
  if (selectedCount === 0) emptyMessage = t('noSelection');
  if (!newVersion) emptyMessage = t('enterVersion');
  renderPreview(element('pkg-preview'), changes, emptyMessage);

  const saveButton = element('pkg-save');
  saveButton.disabled = !status.canSave;
  saveButton.textContent = changes.length > 0
    ? t('saveChangesCount', { count: changes.length })
    : t('saveChanges');
}

function renderPreview(container, changes, emptyMessage) {
  container.replaceChildren();
  if (changes.length === 0) {
    container.appendChild(createTextNode('div', 'preview-empty', emptyMessage));
    return;
  }

  changes.forEach(change => {
    const row = document.createElement('div');
    row.className = 'preview-row';
    row.title = change.absPath;
    row.appendChild(createTextNode('span', 'preview-path', change.absPath));
    row.appendChild(createTextNode('span', 'package-name', change.name));
    row.appendChild(createTextNode('span', 'old-version', change.oldVersion));
    row.appendChild(createTextNode('span', 'arrow', '→'));
    row.appendChild(createTextNode('span', 'new-version', change.newVersion));
    container.appendChild(row);
  });
}

function saveChanges(changes) {
  if (changes.length === 0) return;
  vscode.postMessage({
    type: 'applyVersionChanges',
    changes: changes.map(change => ({
      absPath: change.absPath,
      name: change.name,
      type: change.type,
      newVersion: change.newVersion,
    })),
  });
}

function loadExternalContent(source, content) {
  try {
    const parsed = model.parseExternalPackageJson(content);
    externalReference = {
      source,
      name: parsed.name,
      entries: parsed.entries,
    };
    comparisonSelectedKeys = new Set();
    comparisonRows = model.buildExternalComparison(packageFiles, parsed.entries);
    expandedComparisonNames = new Set(
      comparisonRows
        .filter(row => row.status === 'different')
        .map(row => row.name),
    );
    clearMessage();
    if (parsed.entries.length === 0) showMessage(t('externalNoPackages'));
    setMode('compare');
  } catch {
    showMessage(t('externalLoadError'), 'error');
  }
}

function renderComparison() {
  const dropZone = element('external-drop-zone');
  const source = element('external-source');
  const content = element('comparison-content');

  if (!externalReference) {
    dropZone.hidden = false;
    source.hidden = true;
    content.hidden = true;
    return;
  }

  dropZone.hidden = true;
  source.hidden = false;
  content.hidden = false;
  const sourceParts = externalReference.source.split(/[\\/]/);
  element('external-source-name').textContent =
    externalReference.name || sourceParts[sourceParts.length - 1] || 'package.json';
  element('external-source-path').textContent = externalReference.source;
  element('external-source-path').title = externalReference.source;

  comparisonRows = model.buildExternalComparison(
    packageFiles,
    externalReference.entries,
  );
  const availableKeys = new Set(
    comparisonRows.flatMap(row => row.localOccurrences.map(model.createOccurrenceKey)),
  );
  comparisonSelectedKeys = new Set(
    [...comparisonSelectedKeys].filter(key => availableKeys.has(key)),
  );

  const query = element('comparison-filter').value.trim().toLowerCase();
  const onlyDifferences = element('only-differences').checked;
  const visibleRows = comparisonRows.filter(row => {
    if (onlyDifferences && row.status === 'equal') return false;
    if (!query) return true;
    return row.name.toLowerCase().includes(query) ||
      row.localOccurrences.some(item => item.absPath.toLowerCase().includes(query));
  });

  const rowsContainer = element('comparison-rows');
  rowsContainer.replaceChildren();
  if (visibleRows.length === 0) {
    rowsContainer.appendChild(
      createTextNode('div', 'preview-empty', t('comparisonEmpty')),
    );
  } else {
    visibleRows.forEach(row => renderComparisonRow(rowsContainer, row));
  }

  updateComparisonPreview();
}

function renderComparisonRow(container, row) {
  const summary = document.createElement('div');
  summary.className = 'comparison-row comparison-summary';
  summary.setAttribute('role', 'row');

  const externalVersions = [
    ...new Set(row.externalOccurrences.map(item => item.version)),
  ];
  const externalVersion = externalVersions.length > 0
    ? externalVersions.join(' / ')
    : '—';
  const workspaceSummary = row.localOccurrences.length === 0
    ? t('notInWorkspace')
    : t('occurrenceCount', { count: row.localOccurrences.length });
  const expandable = row.localOccurrences.length > 0 && row.status !== 'equal';
  const expanded = expandedComparisonNames.has(row.name);

  summary.appendChild(createTextNode('strong', 'package-name', row.name));
  summary.appendChild(createTextNode('span', 'version', externalVersion));
  summary.appendChild(createTextNode('span', 'count', workspaceSummary));
  summary.appendChild(
    createTextNode(
      'span',
      'status-badge status-' + row.status,
      t(STATUS_KEYS[row.status]),
    ),
  );
  summary.appendChild(createTextNode('span', 'count', expandable ? (expanded ? '⌃' : '⌄') : ''));

  if (expandable) {
    summary.tabIndex = 0;
    summary.setAttribute('aria-expanded', String(expanded));
    const toggle = () => {
      if (expandedComparisonNames.has(row.name)) expandedComparisonNames.delete(row.name);
      else expandedComparisonNames.add(row.name);
      renderComparison();
    };
    summary.addEventListener('click', toggle);
    summary.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  }
  container.appendChild(summary);

  if (!expanded) return;
  row.localOccurrences.forEach((item, index) => {
    const key = model.createOccurrenceKey(item);
    const canTransfer = row.status === 'different' &&
      item.version !== row.externalVersion;
    const detail = document.createElement('label');
    detail.className = 'comparison-occurrence';
    detail.title = item.absPath;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'comparison-' + row.name.replace(/[^a-z0-9]/gi, '-') + '-' + index;
    checkbox.checked = comparisonSelectedKeys.has(key);
    checkbox.disabled = !canTransfer;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) comparisonSelectedKeys.add(key);
      else comparisonSelectedKeys.delete(key);
      updateComparisonPreview();
    });
    detail.appendChild(checkbox);
    detail.appendChild(createTextNode('span', 'occurrence-path', item.absPath));
    detail.appendChild(
      createTextNode('span', 'type-badge', SECTION_SHORT[item.type] || item.type),
    );
    detail.appendChild(createTextNode('span', 'version', item.version));
    detail.appendChild(
      createTextNode(
        'span',
        canTransfer ? 'new-version' : 'count',
        canTransfer ? '→ ' + row.externalVersion : '—',
      ),
    );
    container.appendChild(detail);
  });
}

function updateComparisonPreview() {
  const changes = model.buildExternalPreview(
    comparisonRows,
    comparisonSelectedKeys,
  );
  element('comparison-preview-count').textContent = t('changeCount', {
    count: changes.length,
  });
  renderPreview(
    element('comparison-preview-list'),
    changes,
    t('externalNoSelection'),
  );

  const saveButton = element('save-comparison');
  saveButton.disabled = changes.length === 0;
  saveButton.textContent = changes.length > 0
    ? t('transferVersionsCount', { count: changes.length })
    : t('transferVersions');
}

async function handleDroppedFiles(files) {
  if (!files || files.length !== 1) {
    showMessage(t('dropOneFile'), 'error');
    return;
  }

  const file = files[0];
  if (!file.name.toLowerCase().endsWith('.json')) {
    showMessage(t('dropJsonFile'), 'error');
    return;
  }
  if (file.size > MAX_EXTERNAL_PACKAGE_BYTES) {
    showMessage(t('externalTooLarge'), 'error');
    return;
  }

  try {
    loadExternalContent(file.name, await file.text());
  } catch {
    showMessage(t('externalLoadError'), 'error');
  }
}

function removeExternalComparison() {
  externalReference = undefined;
  comparisonRows = [];
  comparisonSelectedKeys = new Set();
  expandedComparisonNames = new Set();
  element('comparison-filter').value = '';
  element('only-differences').checked = false;
  setMode('project');
}

element('scan-packages').addEventListener('click', () => {
  vscode.postMessage({ type: 'scan' });
});
element('add-comparison').addEventListener('click', () => {
  vscode.postMessage({ type: 'selectExternalPackageJson' });
});
element('replace-external').addEventListener('click', () => {
  vscode.postMessage({ type: 'selectExternalPackageJson' });
});
element('remove-external').addEventListener('click', removeExternalComparison);
element('close-comparison').addEventListener('click', removeExternalComparison);
element('project-mode-button').addEventListener('click', () => setMode('project'));
element('compare-mode-button').addEventListener('click', () => setMode('compare'));
element('pkg-path-filter').addEventListener('input', renderExplorer);
element('pkg-only-conflicts').addEventListener('change', renderExplorer);
element('pkg-show-compatible').addEventListener('change', renderExplorer);
element('pkg-new-version').addEventListener('input', updateManualPreview);
element('pkg-select-all').addEventListener('click', () => {
  selectedKeys = model.createSelection(occurrences);
  renderDetail();
});
element('pkg-select-none').addEventListener('click', () => {
  selectedKeys.clear();
  renderDetail();
});
element('pkg-save').addEventListener('click', () => {
  saveChanges(model.buildPreview(occurrences, selectedKeys, newVersion));
});
element('save-comparison').addEventListener('click', () => {
  saveChanges(model.buildExternalPreview(comparisonRows, comparisonSelectedKeys));
});
element('close-editor').addEventListener('click', () => {
  vscode.postMessage({ type: 'close' });
});
element('comparison-filter').addEventListener('input', renderComparison);
element('only-differences').addEventListener('change', renderComparison);

const comparisonPanel = element('compare-mode');
comparisonPanel.addEventListener('dragenter', event => {
  event.preventDefault();
  element('external-drop-zone').classList.add('dragging');
});
comparisonPanel.addEventListener('dragover', event => {
  event.preventDefault();
});
comparisonPanel.addEventListener('dragleave', event => {
  if (!comparisonPanel.contains(event.relatedTarget)) {
    element('external-drop-zone').classList.remove('dragging');
  }
});
comparisonPanel.addEventListener('drop', event => {
  event.preventDefault();
  element('external-drop-zone').classList.remove('dragging');
  handleDroppedFiles(event.dataTransfer.files);
});
element('external-drop-zone').addEventListener('click', () => {
  vscode.postMessage({ type: 'selectExternalPackageJson' });
});
element('external-drop-zone').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    vscode.postMessage({ type: 'selectExternalPackageJson' });
  }
});

window.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'state') handleState(data);
  if (data.type === 'externalPackageJson') {
    loadExternalContent(data.source || 'package.json', data.content || '');
  }
  if (data.type === 'error') showMessage(data.message || t('loadError'), 'error');
});

applyTranslations();
renderComparison();
vscode.postMessage({ type: 'ready' });
