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

  function compareVersions(left, right) {
    return left.major - right.major ||
      left.minor - right.minor ||
      left.patch - right.patch;
  }

  function parseSimpleSemverRange(value) {
    const match = String(value).trim().match(
      /^(\^|~)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
    );
    if (!match) return undefined;

    const operator = match[1] || '';
    const min = {
      major: Number(match[2]),
      minor: Number(match[3]),
      patch: Number(match[4]),
    };
    if (!operator) return { min, maxExclusive: undefined, exact: true };

    let maxExclusive;
    if (operator === '~') {
      maxExclusive = { major: min.major, minor: min.minor + 1, patch: 0 };
    } else if (min.major > 0) {
      maxExclusive = { major: min.major + 1, minor: 0, patch: 0 };
    } else if (min.minor > 0) {
      maxExclusive = { major: 0, minor: min.minor + 1, patch: 0 };
    } else {
      maxExclusive = { major: 0, minor: 0, patch: min.patch + 1 };
    }
    return { min, maxExclusive, exact: false };
  }

  function containsSemverRange(container, candidate) {
    if (!container || !candidate) return false;
    if (container.exact) {
      return candidate.exact && compareVersions(candidate.min, container.min) === 0;
    }
    if (candidate.exact) {
      return compareVersions(candidate.min, container.min) >= 0 &&
        compareVersions(candidate.min, container.maxExclusive) < 0;
    }
    return compareVersions(candidate.min, container.min) >= 0 &&
      compareVersions(candidate.maxExclusive, container.maxExclusive) <= 0;
  }

  function buildVersionStatusIndex(files) {
    const grouped = new Map();
    files.forEach(file => {
      file.deps.forEach(dep => {
        const list = grouped.get(dep.name) || [];
        list.push({ ...dep, folder: file.folder, absPath: file.absPath });
        grouped.set(dep.name, list);
      });
    });

    const result = new Map();
    grouped.forEach((items, name) => {
      const rootVersions = [
        ...new Set(
          items
            .filter(item => item.folder === 'root')
            .map(item => item.version)
        ),
      ];
      const uniqueVersions = new Set(items.map(item => item.version));
      const referenceVersion = rootVersions.length === 1 ? rootVersions[0] : '';
      const referenceRange = parseSimpleSemverRange(referenceVersion);
      const statuses = new Map();

      items.forEach(item => {
        let status = 'conflict';
        if (referenceVersion && item.version === referenceVersion) {
          status = 'identical';
        } else if (!referenceVersion && uniqueVersions.size === 1) {
          status = 'identical';
        } else if (
          referenceRange &&
          item.folder !== 'root' &&
          item.type === 'peerDependencies' &&
          containsSemverRange(
            parseSimpleSemverRange(item.version),
            referenceRange
          )
        ) {
          status = 'compatible';
        }
        statuses.set(createOccurrenceKey(item), status);
      });

      const values = [...statuses.values()];
      result.set(name, {
        referenceVersion,
        statuses,
        conflictCount: values.filter(value => value === 'conflict').length,
        compatibleCount: values.filter(value => value === 'compatible').length,
        hasConflict: values.includes('conflict'),
      });
    });
    return result;
  }

  function getOccurrenceVersionStatus(index, item) {
    return index.get(item.name)?.statuses.get(createOccurrenceKey(item)) ||
      'identical';
  }

  function getFileVersionSummary(file, index) {
    const statuses = file.deps.map(dep => getOccurrenceVersionStatus(index, {
      ...dep,
      folder: file.folder,
      absPath: file.absPath,
    }));
    return {
      packageCount: file.deps.length,
      conflictCount: statuses.filter(value => value === 'conflict').length,
      compatibleCount: statuses.filter(value => value === 'compatible').length,
    };
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
    parseSimpleSemverRange,
    containsSemverRange,
    buildVersionStatusIndex,
    getOccurrenceVersionStatus,
    getFileVersionSummary,
    createSelection,
    buildPreview,
    getSaveStatus,
    parseExternalPackageJson,
    buildExternalComparison,
    buildExternalPreview,
  };
});
