const vscode = acquireVsCodeApi();

let customCommands = [];
let currentLang = 'en';
let formOpen = false;

function createCmdContent(icon, label) {
  const iconSpan = document.createElement('span');
  iconSpan.className = 'cmd-icon';
  iconSpan.textContent = icon;
  const labelSpan = document.createElement('span');
  labelSpan.className = 'cmd-label';
  labelSpan.textContent = label;
  return [iconSpan, labelSpan];
}

function applyTranslations(lang) {
  currentLang = lang;
  const dict = i18n[lang] || i18n['en'];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.innerText = dict[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) el.placeholder = dict[key];
  });

  document.getElementById('toggle-text').innerText = formOpen ? dict.btnCancel : dict.btnAddCustom;
  renderCustom();
}

vscode.postMessage({ type: 'getCustomCommands' });
vscode.postMessage({ type: 'getSettings' });

window.addEventListener('message', e => {
  if (e.data.type === 'initSettings') {
    const pm = e.data.packageManager || 'npm';
    const lang = e.data.language || 'en';
    let cli = e.data.cli;

    if (!cli) {
      cli = e.data.hasNx ? 'nx' : 'ng';
    }

    document.getElementById('modal-pm-select').value = pm;
    document.getElementById('modal-lang-select').value = lang;
    document.getElementById('modal-cli-select').value = cli;

    applyTranslations(lang);
    renderDefaultCommands(pm, cli);

    if (!e.data.packageManager) {
      openSettings();
    }
  }

  if (e.data.type === 'customCommands') {
    customCommands = e.data.commands || [];
    renderCustom();
  }

  if (e.data.type === 'projectScripts') {
    const scripts = e.data.scripts || [];
    const grid = document.getElementById('project-grid');
    grid.innerHTML = '';

    if (scripts.length === 0) {
      grid.innerHTML = '<div style="color: #ef4444; grid-column: span 2; padding: 4px;">' + i18n[currentLang].noScripts + '</div>';
    } else {
      scripts.forEach(cmd => {
        const btn = document.createElement('button');
        btn.className = 'cmd-btn custom';
        btn.style.setProperty('--accent', cmd.color);
        btn.title = cmd.command;
        createCmdContent(cmd.icon, cmd.label).forEach(el => btn.appendChild(el));
        btn.onclick = () => {
          vscode.postMessage({ type: 'run', command: cmd.command });
        };
        grid.appendChild(btn);
      });
    }
  }
});

function openSettings() {
  document.getElementById('settings-modal').classList.add('open');
}

function saveSettings() {
  const pm = document.getElementById('modal-pm-select').value;
  const lang = document.getElementById('modal-lang-select').value;
  const cli = document.getElementById('modal-cli-select').value;

  vscode.postMessage({ type: 'saveSettings', packageManager: pm, language: lang, cli: cli });
  document.getElementById('settings-modal').classList.remove('open');

  applyTranslations(lang);
  renderDefaultCommands(pm, cli);
}

function switchTab(tabId, e) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  e.currentTarget.classList.add('active');
}

function scanProject() {
  document.getElementById('project-grid').innerHTML = '<div style="color: var(--muted); grid-column: span 2; text-align: center; padding: 10px;">' + i18n[currentLang].scanning + '</div>';
  vscode.postMessage({ type: 'getProjectScripts' });
}

function renderDefaultCommands(pm, cli) {
  const groups = { 'Angular': 'angular-grid', 'Lint & Format': 'lint-grid', 'Package Manager': 'npm-grid' };
  const colorMap = { '#dd0031': 'red', '#f59e0b': 'amber', '#22c55e': 'green' };

  Object.values(groups).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  DEFAULT_COMMANDS.forEach(cmd => {
    if (cmd.id === 'nx-lint-all' && cli !== 'nx') return;

    const gridId = groups[cmd.group];
    if (!gridId) return;

    let finalCommand = cmd.command;
    let finalLabel = cmd.label;

    if (cli === 'nx' && finalCommand.startsWith('ng ')) {
      let nxPrefix = 'npx nx ';
      if (pm === 'yarn') nxPrefix = 'yarn nx ';
      if (pm === 'pnpm') nxPrefix = 'pnpm nx ';

      finalCommand = finalCommand.replace(/^ng /, nxPrefix);
    }

    if (cmd.group === 'Package Manager') {
      if (pm === 'yarn') {
        if (cmd.id === 'pm-install') { finalCommand = 'yarn install'; finalLabel = 'yarn install'; }
        if (cmd.id === 'pm-update') { finalCommand = 'yarn upgrade'; finalLabel = 'yarn upgrade'; }
        if (cmd.id === 'pm-audit') { finalCommand = 'yarn audit'; finalLabel = 'yarn audit'; }
      } else if (pm === 'pnpm') {
        if (cmd.id === 'pm-install') { finalCommand = 'pnpm install'; finalLabel = 'pnpm install'; }
        if (cmd.id === 'pm-update') { finalCommand = 'pnpm update'; finalLabel = 'pnpm update'; }
        if (cmd.id === 'pm-audit') { finalCommand = 'pnpm audit'; finalLabel = 'pnpm audit'; }
      }
    }

    const grid = document.getElementById(gridId);
    const btn = document.createElement('button');
    btn.className = 'cmd-btn ' + (colorMap[cmd.color] || 'custom');
    btn.title = finalCommand;
    createCmdContent(cmd.icon, finalLabel).forEach(el => btn.appendChild(el));
    btn.onclick = () => {
      if (finalCommand.endsWith(' ')) {
        vscode.postMessage({ type: 'runWithInput', command: finalCommand, prompt: finalLabel, placeholder: 'Name...' });
      } else {
        vscode.postMessage({ type: 'run', command: finalCommand });
      }
    };
    grid.appendChild(btn);
  });
}

function renderCustom() {
  const list = document.getElementById('custom-list');
  list.innerHTML = '';

  if (customCommands.length === 0) {
    list.innerHTML = '<div id="no-custom">' + i18n[currentLang].noCustom + '</div>';
    return;
  }

  const globalCmds = customCommands.map((cmd, index) => ({ cmd, index })).filter(item => item.cmd.scope !== 'local');
  const localCmds = customCommands.map((cmd, index) => ({ cmd, index })).filter(item => item.cmd.scope === 'local');

  function renderCommandGroup(title, items) {
    const header = document.createElement('h3');
    header.className = 'custom-group-header';
    header.textContent = title;
    list.appendChild(header);

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'custom-item';

      const cmdBtn = document.createElement('button');
      cmdBtn.className = 'cmd-btn ' + (item.cmd.color || 'custom');
      cmdBtn.title = item.cmd.command;
      cmdBtn.onclick = () => runCustom(item.index);
      createCmdContent(item.cmd.icon || '⚡', item.cmd.label).forEach(el => cmdBtn.appendChild(el));

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn';
      editBtn.title = 'Edit';
      editBtn.textContent = '✏️';
      editBtn.onclick = () => editCustom(item.index);

      const delBtn = document.createElement('button');
      delBtn.className = 'del-btn';
      delBtn.textContent = '✕';
      delBtn.onclick = () => deleteCustom(item.index);

      row.appendChild(cmdBtn);
      row.appendChild(editBtn);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  if (globalCmds.length > 0) {
    renderCommandGroup('Global', globalCmds);
  }

  if (localCmds.length > 0) {
    renderCommandGroup('Lokal', localCmds);
  }
}

function runCustom(i) {
  const cmd = customCommands[i];
  vscode.postMessage({ type: 'run', command: cmd.command, cwd: cmd.cwd });
}

function editCustom(i) {
  const cmd = customCommands[i];
  document.getElementById('f-label').value = cmd.label;
  document.getElementById('f-command').value = cmd.command;
  document.getElementById('f-color').value = cmd.color || 'custom';
  document.getElementById('f-icon').value = cmd.icon || '';
  document.getElementById('f-cwd').value = cmd.cwd || '';
  document.getElementById('f-scope').value = cmd.scope || 'global';

  document.getElementById('add-form').setAttribute('data-editing', i.toString());
  document.getElementById('formBtnSubmit').textContent = i18n[currentLang].formBtnEdit || 'Edit';

  if (!formOpen) toggleForm();
}

function deleteCustom(i) {
  customCommands.splice(i, 1);
  vscode.postMessage({ type: 'saveCustomCommands', commands: customCommands });
  renderCustom();
}

function toggleForm() {
  formOpen = !formOpen;
  document.getElementById('add-form').classList.toggle('open', formOpen);
  document.getElementById('toggle-icon').textContent = formOpen ? '−' : '＋';

  if (!formOpen) {
    document.getElementById('f-label').value = '';
    document.getElementById('f-command').value = '';
    document.getElementById('f-icon').value = '';
    document.getElementById('f-cwd').value = '';
    document.getElementById('f-label').style.borderColor = '';
    document.getElementById('f-command').style.borderColor = '';
    document.getElementById('add-form').removeAttribute('data-editing');
    document.getElementById('formBtnSubmit').textContent = i18n[currentLang].formBtnSubmit;
  }

  document.getElementById('toggle-text').textContent = formOpen ? i18n[currentLang].btnCancel : i18n[currentLang].btnAddCustom;
}

function addCustom() {
  const label = document.getElementById('f-label').value.trim();
  const command = document.getElementById('f-command').value.trim();
  const color = document.getElementById('f-color').value;
  const icon = document.getElementById('f-icon').value.trim() || '⚡';
  const cwd = document.getElementById('f-cwd').value.trim();
  const scope = document.getElementById('f-scope').value;

  if (!label || !command) {
    document.getElementById('f-label').style.borderColor = label ? '' : '#ef4444';
    document.getElementById('f-command').style.borderColor = command ? '' : '#ef4444';
    return;
  }

  const editingIndex = document.getElementById('add-form').getAttribute('data-editing');

  if (editingIndex !== null) {
    const index = parseInt(editingIndex);
    customCommands[index] = {
      ...customCommands[index],
      label,
      command,
      color,
      icon,
      cwd: cwd || undefined,
      scope: scope || undefined
    };
  } else {
    customCommands.push({
      id: 'custom-' + Date.now(),
      label,
      command,
      group: 'Custom',
      color,
      icon,
      cwd: cwd || undefined,
      scope: scope || undefined
    });
  }

  vscode.postMessage({ type: 'saveCustomCommands', commands: customCommands });
  renderCustom();

  document.getElementById('f-label').value = '';
  document.getElementById('f-command').value = '';
  document.getElementById('f-icon').value = '';
  document.getElementById('f-cwd').value = '';
  document.getElementById('f-label').style.borderColor = '';
  document.getElementById('f-command').style.borderColor = '';
  document.getElementById('add-form').removeAttribute('data-editing');
  document.getElementById('formBtnSubmit').textContent = i18n[currentLang].formBtnSubmit;
  toggleForm();
}
