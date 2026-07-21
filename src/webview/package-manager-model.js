(function (root, factory) {
  const api = factory();
  root.PackageManagerModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const DEP_SECTIONS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  function normalize(value) {
    return String(value || '').replace(/\\/g, '/').toLowerCase();
  }

  function filterPackageFiles(files, query) {
    const filter = normalize(query).trim();
    if (!filter) return [...files];

    return files.filter(file =>
      normalize(file.folder).includes(filter) ||
      normalize(file.absPath).includes(filter)
    );
  }

  function getPackageScope(name) {
    if (!name.startsWith('@')) return '';
    const slashIndex = name.indexOf('/');
    return slashIndex > 0 ? name.slice(0, slashIndex) : '';
  }

  function getTargetOccurrences(files, target) {
    const occurrences = [];
    files.forEach(file => {
      file.deps.forEach(dep => {
        const matches = target.type === 'scope'
          ? getPackageScope(dep.name) === target.value
          : dep.name === target.value;

        if (matches) {
          occurrences.push({
            ...dep,
            folder: file.folder,
            absPath: file.absPath,
          });
        }
      });
    });

    return occurrences.sort((a, b) =>
      a.name.localeCompare(b.name) ||
      a.folder.localeCompare(b.folder) ||
      a.type.localeCompare(b.type)
    );
  }

  function createOccurrenceKey(item) {
    return [item.absPath, item.name, item.type].join('\u0000');
  }

  function createSelection(occurrences) {
    return new Set(occurrences.map(createOccurrenceKey));
  }

  function buildPreview(occurrences, selectedKeys, newVersion) {
    return occurrences
      .filter(item =>
        selectedKeys.has(createOccurrenceKey(item)) &&
        item.version !== newVersion
      )
      .map(item => ({
        ...item,
        oldVersion: item.version,
        newVersion,
      }));
  }

  function getSaveStatus(newVersion, selectedCount, changes) {
    if (!newVersion.trim()) return { canSave: false, reason: 'empty-version' };
    if (selectedCount === 0) return { canSave: false, reason: 'no-selection' };
    if (changes.length === 0) return { canSave: false, reason: 'no-changes' };
    return { canSave: true, reason: '' };
  }

  function parseExternalPackageJson(content) {
    let json;
    try {
      json = JSON.parse(content);
    } catch {
      throw new Error('invalid-json');
    }

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('invalid-root');
    }

    const entries = [];
    DEP_SECTIONS.forEach(section => {
      const values = json[section];
      if (values === undefined) return;
      if (!values || typeof values !== 'object' || Array.isArray(values)) {
        throw new Error('invalid-section');
      }

      Object.entries(values).forEach(([name, version]) => {
        if (typeof version !== 'string') throw new Error('invalid-version');
        entries.push({ name, version, type: section });
      });
    });

    return {
      name: typeof json.name === 'string' ? json.name : '',
      entries,
    };
  }

  function buildExternalComparison(files, externalEntries) {
    const localByName = new Map();
    files.forEach(file => {
      file.deps.forEach(dep => {
        const list = localByName.get(dep.name) || [];
        list.push({ ...dep, folder: file.folder, absPath: file.absPath });
        localByName.set(dep.name, list);
      });
    });

    const externalByName = new Map();
    externalEntries.forEach(entry => {
      const list = externalByName.get(entry.name) || [];
      list.push(entry);
      externalByName.set(entry.name, list);
    });

    const names = new Set([...localByName.keys(), ...externalByName.keys()]);
    const rows = [...names].map(name => {
      const localOccurrences = (localByName.get(name) || []).sort((a, b) =>
        a.folder.localeCompare(b.folder) || a.type.localeCompare(b.type)
      );
      const externalOccurrences = externalByName.get(name) || [];
      const externalVersions = new Set(externalOccurrences.map(item => item.version));
      const externalVersion = externalVersions.size === 1
        ? [...externalVersions][0]
        : '';

      let status;
      if (externalVersions.size > 1) status = 'ambiguous';
      else if (localOccurrences.length === 0) status = 'external-only';
      else if (externalOccurrences.length === 0) status = 'local-only';
      else if (localOccurrences.every(item => item.version === externalVersion)) status = 'equal';
      else status = 'different';

      return {
        name,
        status,
        externalVersion,
        externalOccurrences,
        localOccurrences,
      };
    });

    const statusOrder = {
      different: 0,
      ambiguous: 1,
      'external-only': 2,
      'local-only': 3,
      equal: 4,
    };

    return rows.sort((a, b) =>
      statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name)
    );
  }

  function buildExternalPreview(comparisons, selectedKeys) {
    const changes = [];
    comparisons.forEach(row => {
      if (row.status !== 'different' || !row.externalVersion) return;
      row.localOccurrences.forEach(item => {
        if (
          selectedKeys.has(createOccurrenceKey(item)) &&
          item.version !== row.externalVersion
        ) {
          changes.push({
            ...item,
            oldVersion: item.version,
            newVersion: row.externalVersion,
          });
        }
      });
    });
    return changes;
  }

  return {
    filterPackageFiles,
    getPackageScope,
    getTargetOccurrences,
    createOccurrenceKey,
    createSelection,
    buildPreview,
    getSaveStatus,
    parseExternalPackageJson,
    buildExternalComparison,
    buildExternalPreview,
  };
});
