/* Interactive publication figures rendered directly from frozen camera-ready data (data.js). */
(() => {
  const data = window.MARBLE_DATA;
  if (!data) return;

  const ENV_LABELS = { all: 'Average', cube: 'CUBE', maze: 'MAZE', blox: 'BLOX' };
  const COLORS = {
    easy: '#5b7d99',
    hard: '#b45966',
    gap: '#4a6073',
    human: '#3f7a6c',
    cube: '#567c9b',
    maze: '#c88c48',
    blox: '#ba636e',
    code: '#4b6b84',
    vision: '#cf9254',
  };

  const mean = rows => rows.reduce((sum, r) => sum + r.value, 0) / rows.length;
  const pct = v => v.toFixed(1) + '%';
  const uniqueModels = rows => [...new Set(rows.map(r => r.model))];
  const readableName = m =>
    m.replace('Gemini-3.1-pro', 'Gemini 3.1 Pro')
      .replace('Gemma-4-', 'Gemma 4 ')
      .replace('Llama-4-', 'Llama 4 ')
      .replace('Kimi-', 'Kimi ');

  const MODEL_ICONS = {
    Human: 'human.svg',
    GPT: 'gpt.svg',
    Kimi: 'kimi.svg',
    Gemini: 'gemini.svg',
    Gemma: 'gemma.svg',
    Grok: 'grok.svg',
    Qwen: 'qwen.svg',
    GLM: 'zai.svg',
    Llama: 'meta.png',
  };
  const modelIcon = m => {
    const entry = Object.entries(MODEL_ICONS).find(([prefix]) => m.startsWith(prefix));
    return entry ? entry[1] : null;
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildTabs(containerId, options, initialValue, onChange) {
    const container = document.getElementById(containerId);
    let current = initialValue;
    const buttons = [];

    function setValue(next) {
      if (current === next) return;
      current = next;
      buttons.forEach(([v, b]) => b.setAttribute('aria-selected', String(v === current)));
      onChange(current);
    }

    if (container) {
      options.forEach(([value, label]) => {
        const btn = el('button', '', label);
        btn.type = 'button';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(value === current));
        btn.addEventListener('click', () => setValue(value));
        buttons.push([value, btn]);
        container.append(btn);
      });
    }
    return { get: () => current, set: setValue };
  }

  function addAxis(svg, left, width, top, bottom, ticks = [0, 50, 100]) {
    ticks.forEach(val => {
      const x = left + (width * val) / 100;
      svg.append(svgEl('line', {
        x1: x, x2: x, y1: top, y2: bottom,
        class: val === 0 ? 'chart-axis' : 'chart-grid',
      }));
      svg.append(svgEl('text', {
        x, y: top - 10, 'text-anchor': 'middle', class: 'chart-tick',
      }, val));
    });
  }

  function addModelLabel(row, model, y) {
    const icon = modelIcon(model);
    if (icon) {
      row.append(svgEl('image', {
        href: 'assets/logos/' + icon,
        x: 8, y: y - 12, width: 16, height: 16,
      }));
    }
    row.append(svgEl('text', { x: 31, y, class: 'chart-model' }, readableName(model)));
  }

  function createRow(svg, model, y, width, height, label) {
    const row = svgEl('g', {
      class: 'chart-row' + (model === 'Human' ? ' chart-human' : ''),
      tabindex: '0',
      role: 'img',
      'aria-label': label,
    });
    row.append(svgEl('title', {}, label));
    row.append(svgEl('rect', { x: 0, y, width, height, rx: 5, class: 'chart-row-hit' }));
    svg.append(row);
    return row;
  }

  function addBar(row, left, y, plotWidth, value, color, height = 10, opts = {}) {
    const len = Math.max(2, (plotWidth * value) / 100);
    row.append(svgEl('rect', {
      x: left, y, width: len, height,
      rx: value === 0 ? 0.5 : 2,
      fill: color,
      class: 'chart-bar',
    }));
    const text = opts.raw ? value.toFixed(1) : pct(value);
    row.append(svgEl('text', {
      x: left + len + 6,
      y: y + height - 1,
      class: 'chart-val' + (opts.strong ? ' chart-val-strong' : ''),
    }, text));
  }

  /* ------------------------------------------------------------------
   * FIGURE 3: Main Results (Success Rate & Easy-Hard Gap)
   * ------------------------------------------------------------------ */
  const resultsRoot = document.getElementById('results-chart');
  const resultsStrip = document.getElementById('results-strip');
  const resultsTabs = buildTabs(
    'results-tabs',
    Object.entries(ENV_LABELS),
    'all',
    () => drawResults()
  );

  function buildResultsSvg(rows, mode, width) {
    const compact = width < 520;
    const left = compact ? 132 : 164;
    const rowH = 44;
    const humanGap = 12;
    const top = 56;
    const bottom = top + rows.length * rowH + humanGap;
    const svg = svgEl('svg', {
      viewBox: `0 0 ${width} ${bottom + 6}`,
      class: 'chart-svg performance-' + mode,
      role: 'group',
      'aria-label': 'Multi-turn success rates and easy-hard gaps',
    });

    const combined = mode === 'combined';
    const rightPad = 56;
    const successW = combined ? Math.round((width - left - 114) * 0.57) : width - left - rightPad;
    const gapLeft = combined ? left + successW + 66 : left;
    const gapW = combined ? width - gapLeft - 46 : width - left - rightPad;

    if (mode !== 'gap') {
      svg.append(svgEl('text', { x: left, y: 18, class: 'chart-col-title' }, 'Success rate (%)'));
      addAxis(svg, left, successW, top - 4, bottom - 4);
    }
    if (mode !== 'success') {
      svg.append(svgEl('text', { x: gapLeft, y: 18, class: 'chart-col-title' }, 'Easy\u2212Hard gap (pp)'));
      addAxis(svg, gapLeft, gapW, top - 4, bottom - 4);
    }

    rows.forEach(({ model, group, easy, hard, gap }, i) => {
      const y = top + i * rowH + (i > 0 ? humanGap : 0);
      const kind = group === 'human' ? 'Human baseline' : group === 'closed_weight' ? 'Closed-weight' : 'Open-weight';
      const desc = `${readableName(model)} (${kind}): Easy ${pct(easy)}, Hard ${pct(hard)}, gap ${gap.toFixed(1)} pp`;
      const row = createRow(svg, model, y, width, rowH - 4, desc);
      addModelLabel(row, model, y + 23);

      if (mode !== 'gap') {
        addBar(row, left, y + 7, successW, easy, model === 'Human' ? COLORS.human : COLORS.easy, 10);
        addBar(row, left, y + 21, successW, hard, COLORS.hard, 10);
      }
      if (mode !== 'success') {
        addBar(row, gapLeft, y + 14, gapW, Math.max(0, gap), model === 'Human' ? COLORS.human : COLORS.gap, 11, {
          raw: true,
          strong: true,
        });
      }

      if (i === 0) {
        const sepY = y + rowH + 3;
        svg.append(svgEl('line', { x1: 4, x2: width - 4, y1: sepY, y2: sepY, class: 'chart-sep' }));
      }
    });
    return svg;
  }

  function drawResults() {
    if (!resultsRoot) return;
    const env = resultsTabs.get();
    const subset = data.results.filter(r => env === 'all' || r.environment === env);
    const rows = uniqueModels(subset).map(model => {
      const mRows = subset.filter(r => r.model === model);
      const easy = mean(mRows.filter(r => r.difficulty === 'easy'));
      const hard = mean(mRows.filter(r => r.difficulty === 'hard'));
      return { model, group: mRows[0]?.group || 'open_weight', easy, hard, gap: easy - hard };
    }).sort((a, b) => (a.model === 'Human' ? -1 : b.model === 'Human' ? 1 : b.easy - a.easy));

    resultsRoot.replaceChildren();
    const legend = el('div', 'chart-legend');
    [
      ['Easy (short horizon + symbolic)', COLORS.easy],
      ['Hard (long horizon, visual-only)', COLORS.hard],
      ['Human reference', COLORS.human],
    ].forEach(([label, color]) => {
      const key = el('span', 'chart-key');
      const sw = el('i', 'chart-swatch');
      sw.style.background = color;
      key.append(sw, document.createTextNode(label));
      legend.append(key);
    });
    resultsRoot.append(legend);

    const w = Math.max(300, Math.round(resultsRoot.clientWidth));
    if (w < 660) {
      resultsRoot.append(buildResultsSvg(rows, 'success', w), buildResultsSvg(rows, 'gap', w));
    } else {
      resultsRoot.append(buildResultsSvg(rows, 'combined', w));
    }

    if (resultsStrip) {
      const byModel = name => rows.find(r => r.model === name);
      const highlights = [
        { label: 'Human reference', row: byModel('Human'), human: true },
        { label: 'Top closed · GPT-5.4', row: byModel('GPT-5.4'), human: false },
        { label: 'Top open · Kimi K2.6', row: byModel('Kimi-K2.6'), human: false },
      ];
      resultsStrip.replaceChildren();
      highlights.forEach(({ label, row, human }) => {
        if (!row) return;
        const item = el('div', 'stat-item' + (human ? ' stat-item-human' : ''));
        item.append(el('div', 'stat-label', label));
        const main = el('div', 'stat-main');
        main.append(
          el('span', 'stat-score', `${pct(row.easy)} \u2192 ${pct(row.hard)}`),
          el('span', 'stat-delta', `\u2212${row.gap.toFixed(1)} pp`)
        );
        item.append(main);
        resultsStrip.append(item);
      });
    }
  }

  /* ------------------------------------------------------------------
   * FIGURE 4: Pairwise Diagnostic (Horizon vs Observation Format) + 2x2 Matrix
   * ------------------------------------------------------------------ */
  const diagRoot = document.getElementById('diagnostic-chart');
  const diagHeatmap = document.getElementById('diagnostic-heatmap');
  const diagTabs = buildTabs(
    'diagnostic-tabs',
    Object.entries(ENV_LABELS),
    'all',
    () => drawDiagnostic()
  );

  function heatColor(val, isVisual) {
    const ratio = Math.max(0, Math.min(1, val / 100));
    if (isVisual) {
      const alpha = 0.08 + ratio * 0.55;
      return { bg: `rgba(180, 89, 102, ${alpha.toFixed(2)})`, fg: ratio > 0.55 ? '#fff' : '#6c2934' };
    }
    const alpha = 0.09 + ratio * 0.68;
    return { bg: `rgba(75, 107, 132, ${alpha.toFixed(2)})`, fg: ratio > 0.58 ? '#fff' : '#1e2a35' };
  }

  function drawDiagnostic() {
    if (!diagRoot) return;
    const env = diagTabs.get();
    const subset = data.diagnostic.filter(r => env === 'all' || r.environment === env);
    const val = (model, horizon, obs) =>
      mean(subset.filter(r => r.model === model && r.horizon === horizon && r.observation === obs));

    const grid = el('div', 'diag-pair-grid');
    const panels = [
      {
        title: 'Longer planning horizon',
        pill: 'Symbolic-Aug',
        warn: false,
        desc: 'Short vs. long horizon when symbolic states are provided.',
        labels: ['Short', 'Long'],
        colors: [COLORS.easy, '#7c99b2'],
        getPair: m => [val(m, 'short', 'symbolic'), val(m, 'long', 'symbolic')],
      },
      {
        title: 'Removing symbolic states',
        pill: 'Major bottleneck',
        warn: true,
        desc: 'Symbolic-augmented vs. visual-only at matched short horizon.',
        labels: ['Symbolic', 'Visual'],
        colors: [COLORS.easy, COLORS.hard],
        getPair: m => [val(m, 'short', 'symbolic'), val(m, 'short', 'visual')],
      },
    ];

    panels.forEach(p => {
      const box = el('div', 'diag-box' + (p.warn ? ' diag-box-bottleneck' : ''));
      const head = el('div', 'diag-box-head');
      head.append(
        el('h4', 'diag-box-title', p.title),
        el('span', 'diag-pill' + (p.warn ? ' diag-pill-warn' : ''), p.pill)
      );
      box.append(head, el('p', 'diag-box-desc', p.desc));

      ['Kimi-K2.6', 'Gemma-4-31B'].forEach(model => {
        const [before, after] = p.getPair(model);
        const delta = after - before;
        const row = el('div', 'diag-model-row');

        const modelHead = el('div', 'diag-model-head');
        const id = el('div', 'diag-model-id');
        const img = el('img');
        img.src = 'assets/logos/' + modelIcon(model);
        img.alt = '';
        img.width = 16;
        img.height = 16;
        id.append(img, document.createTextNode(readableName(model)));

        const sign = delta > 0.05 ? '+' : delta < -0.05 ? '\u2212' : '';
        const deltaClass =
          Math.abs(delta) < 3 ? 'diag-delta-flat' : delta <= -35 ? 'diag-delta-drop' : 'diag-delta-mid';
        const deltaBadge = el('span', 'diag-delta ' + deltaClass, `${sign}${Math.abs(delta).toFixed(1)} pp`);
        modelHead.append(id, deltaBadge);

        const bars = el('div', 'diag-bars');
        [before, after].forEach((score, idx) => {
          const line = el('div', 'diag-bar-line');
          line.append(el('span', '', p.labels[idx]));
          const track = el('div', 'diag-track');
          const fill = el('div', 'diag-fill');
          fill.style.width = `${Math.max(score > 0 ? 1.8 : 0.9, score)}%`;
          fill.style.background = p.colors[idx];
          track.append(fill);
          line.append(track, el('span', 'diag-num', pct(score)));
          bars.append(line);
        });

        row.append(modelHead, bars);
        box.append(row);
      });

      grid.append(box);
    });

    diagRoot.replaceChildren(grid);

    if (diagHeatmap) {
      diagHeatmap.replaceChildren();
      const hHead = el('div', 'heatmap-head');
      hHead.append(
        el('p', 'heatmap-title', 'Full 2\u00d72 per-environment success rate (%)'),
        el('span', 'heatmap-sub', 'Click any environment header to filter')
      );
      diagHeatmap.append(hHead);

      const hmGrid = el('div', 'hm-grid');
      ['Kimi-K2.6', 'Gemma-4-31B'].forEach(model => {
        const mCard = el('div', 'hm-model-card');
        const mHead = el('div', 'hm-model-name');
        const img = el('img');
        img.src = 'assets/logos/' + modelIcon(model);
        img.alt = '';
        img.width = 15;
        img.height = 15;
        mHead.append(img, document.createTextNode(readableName(model)));
        mCard.append(mHead);

        const table = el('table', 'hm-table');
        const thead = document.createElement('thead');
        const trEnv = document.createElement('tr');
        trEnv.append(el('th', '', ''));
        ['cube', 'maze', 'blox'].forEach(e => {
          const th = el('th', 'hm-env-head' + (env === e ? ' active' : ''), ENV_LABELS[e]);
          th.colSpan = 2;
          th.title = env === e ? 'Show all environments' : `Filter to ${ENV_LABELS[e]}`;
          th.addEventListener('click', () => diagTabs.set(env === e ? 'all' : e));
          trEnv.append(th);
        });
        const trSub = document.createElement('tr');
        trSub.append(el('th', '', ''));
        for (let i = 0; i < 3; i++) {
          trSub.append(el('th', '', 'Short'), el('th', '', 'Long'));
        }
        thead.append(trEnv, trSub);

        const tbody = document.createElement('tbody');
        [
          ['visual', 'Visual-only'],
          ['symbolic', 'Symbolic-aug'],
        ].forEach(([obs, label]) => {
          const tr = document.createElement('tr');
          tr.append(el('th', 'hm-row-label', label));
          ['cube', 'maze', 'blox'].forEach(e => {
            ['short', 'long'].forEach(h => {
              const found = data.diagnostic.find(
                r => r.model === model && r.environment === e && r.horizon === h && r.observation === obs
              );
              const v = found ? found.value : 0;
              const td = el('td', 'hm-cell', v.toFixed(1));
              const c = heatColor(v, obs === 'visual');
              td.style.background = c.bg;
              td.style.color = c.fg;
              if (env !== 'all' && env !== e) td.style.opacity = '0.32';
              tr.append(td);
            });
          });
          tbody.append(tr);
        });

        table.append(thead, tbody);
        mCard.append(table);
        hmGrid.append(mCard);
      });
      diagHeatmap.append(hmGrid);
    }
  }

  /* ------------------------------------------------------------------
   * FIGURE 5: Spatial State Parsing Accuracy (Emphasizing Human Ceiling Gap)
   * ------------------------------------------------------------------ */
  const parsingRoot = document.getElementById('parsing-chart');
  const parsingStrip = document.getElementById('parsing-strip');
  const parsingTabs = buildTabs(
    'parsing-tabs',
    [
      ['overall', 'Overall'],
      ['avg', 'Average'],
    ],
    'overall',
    () => drawParsing()
  );

  function drawParsing() {
    if (!parsingRoot) return;
    const mode = parsingTabs.get();
    const baseline = data.parsing.filter(r => r.view !== 'flat');
    const modelList = uniqueModels(baseline);
    const humanAvg = (data.humanParsing.cube + data.humanParsing.maze + data.humanParsing.blox) / 3;

    const modelRows = modelList.map(model => {
      const getV = e => baseline.find(r => r.model === model && r.environment === e)?.value ?? 0;
      const cube = getV('cube'), maze = getV('maze'), blox = getV('blox');
      const avg = (cube + maze + blox) / 3;
      return { model, cube, maze, blox, avg, gap: humanAvg - avg };
    }).sort((a, b) => b.avg - a.avg);

    const rows = [
      {
        model: 'Human',
        cube: data.humanParsing.cube,
        maze: data.humanParsing.maze,
        blox: data.humanParsing.blox,
        avg: humanAvg,
        gap: 0,
      },
      ...modelRows,
    ];

    parsingRoot.replaceChildren();
    const w = Math.max(300, Math.round(parsingRoot.clientWidth));
    const narrow = w < 520;
    const left = narrow ? 114 : 162;
    const rightPad = narrow ? 104 : 132;
    const plotW = Math.max(96, w - left - rightPad);
    const humanGap = 14;

    if (mode === 'overall') {
      const legend = el('div', 'chart-legend');
      [
        ['CUBE', COLORS.cube],
        ['MAZE', COLORS.maze],
        ['BLOX', COLORS.blox],
      ].forEach(([label, color]) => {
        const key = el('span', 'chart-key');
        const sw = el('i', 'chart-swatch');
        sw.style.background = color;
        key.append(sw, document.createTextNode(label));
        legend.append(key);
      });
      const hKey = el('span', 'chart-key');
      hKey.append(el('i', 'chart-swatch-outline'), document.createTextNode('Human ceiling per task (98.6%\u2013100%)'));
      legend.append(hKey);
      parsingRoot.append(legend);

      const rowH = 58;
      const top = 34;
      const bottom = top + rows.length * rowH + humanGap;
      const svg = svgEl('svg', {
        viewBox: `0 0 ${w} ${bottom + 6}`,
        class: 'chart-svg' + (narrow ? ' chart-gain-compact' : ''),
        role: 'group',
        'aria-label': 'Per-cell spatial parsing accuracy across CUBE, MAZE, and BLOX compared to human ceiling',
      });
      addAxis(svg, left, plotW, top - 4, bottom - 4);
      svg.append(svgEl('text', {
        x: w - 4, y: top - 14, 'text-anchor': 'end', class: 'chart-tick',
      }, 'Avg vs. human'));

      const humanCeilingX = left + (plotW * humanAvg) / 100;
      svg.append(svgEl('line', {
        x1: humanCeilingX, x2: humanCeilingX,
        y1: top + rowH + humanGap - 4, y2: bottom - 4,
        stroke: COLORS.human, 'stroke-width': 1.2, 'stroke-dasharray': '3 3', opacity: 0.55,
      }));

      rows.forEach(({ model, cube, maze, blox, gap }, i) => {
        const isHuman = model === 'Human';
        const y = top + i * rowH + (i > 0 ? humanGap : 0);
        const desc = isHuman
          ? `Human ceiling: CUBE ${pct(cube)}, MAZE ${pct(maze)}, BLOX ${pct(blox)} (${pct(humanAvg)} average)`
          : `${readableName(model)}: CUBE ${pct(cube)}, MAZE ${pct(maze)}, BLOX ${pct(blox)} (${gap.toFixed(1)} pp below humans)`;
        const row = createRow(svg, model, y, w, rowH - 5, desc);

        const icon = modelIcon(model);
        if (icon) {
          const iconSize = narrow ? 14 : 16;
          row.append(svgEl('image', {
            href: 'assets/logos/' + icon,
            x: narrow ? 4 : 8, y: y + 18, width: iconSize, height: iconSize,
          }));
        }
        row.append(svgEl('text', { x: narrow ? 22 : 31, y: y + 30, class: 'chart-model' }, readableName(model)));

        const tasks = [
          { val: cube, cap: data.humanParsing.cube, color: COLORS.cube, dy: 7 },
          { val: maze, cap: data.humanParsing.maze, color: COLORS.maze, dy: 21 },
          { val: blox, cap: data.humanParsing.blox, color: COLORS.blox, dy: 35 },
        ];
        tasks.forEach(({ val, cap, color, dy }) => {
          if (!isHuman) {
            const capW = (plotW * cap) / 100;
            row.append(svgEl('rect', {
              x: left, y: y + dy, width: capW, height: 10, rx: 2,
              fill: 'rgba(63, 122, 108, 0.05)',
              stroke: 'rgba(63, 122, 108, 0.34)',
              'stroke-width': 0.9,
              'stroke-dasharray': '2.5 2',
            }));
          }
          if (narrow && !isHuman && val >= 55) {
            const len = Math.max(2, (plotW * val) / 100);
            row.append(svgEl('rect', { x: left, y: y + dy, width: len, height: 10, rx: 2, fill: color, class: 'chart-bar' }));
            row.append(svgEl('text', {
              x: left + len - 4, y: y + dy + 8.5, 'text-anchor': 'end',
              style: 'fill:#ffffff;font-weight:600;', class: 'chart-val',
            }, pct(val)));
          } else {
            addBar(row, left, y + dy, plotW, val, color, 10);
          }
        });

        row.append(svgEl('text', {
          x: w - 4, y: y + 30, 'text-anchor': 'end',
          class: isHuman ? 'chart-val-ceiling' : 'chart-val-gap',
        }, isHuman ? `${pct(humanAvg)} avg` : `\u2212${gap.toFixed(1)} pp`));

        if (i === 0) {
          const sepY = y + rowH + 3;
          svg.append(svgEl('line', { x1: 4, x2: w - 4, y1: sepY, y2: sepY, class: 'chart-sep' }));
        }
      });
      parsingRoot.append(svg);
    } else {
      const legend = el('div', 'chart-legend');
      [
        ['Human ceiling (99.5%)', COLORS.human, 'chart-swatch'],
        ['Model average accuracy', COLORS.easy, 'chart-swatch'],
        ['Gap to human ceiling', null, 'chart-swatch-deficit'],
      ].forEach(([label, color, cls]) => {
        const key = el('span', 'chart-key');
        const sw = el('i', cls);
        if (color) sw.style.background = color;
        key.append(sw, document.createTextNode(label));
        legend.append(key);
      });
      parsingRoot.append(legend);

      const rowH = 44;
      const top = 34;
      const bottom = top + rows.length * rowH + humanGap;
      const svg = svgEl('svg', {
        viewBox: `0 0 ${w} ${bottom + 6}`,
        class: 'chart-svg' + (narrow ? ' chart-gain-compact' : ''),
        role: 'group',
        'aria-label': 'Average spatial parsing accuracy versus human ceiling',
      });
      addAxis(svg, left, plotW, top - 4, bottom - 4);
      svg.append(svgEl('text', {
        x: w - 4, y: top - 14, 'text-anchor': 'end', class: 'chart-tick',
      }, 'Gap vs. human'));

      const humanCeilingX = left + (plotW * humanAvg) / 100;
      svg.append(svgEl('line', {
        x1: humanCeilingX, x2: humanCeilingX,
        y1: top - 4, y2: bottom - 4,
        stroke: COLORS.human, 'stroke-width': 1.4, 'stroke-dasharray': '4 3', opacity: 0.78,
      }));

      rows.forEach(({ model, avg, gap }, i) => {
        const isHuman = model === 'Human';
        const y = top + i * rowH + (i > 0 ? humanGap : 0);
        const desc = isHuman
          ? `Human ceiling: ${pct(avg)} average parsing accuracy`
          : `${readableName(model)}: ${pct(avg)} average parsing accuracy (${gap.toFixed(1)} pp below humans)`;
        const row = createRow(svg, model, y, w, rowH - 4, desc);

        const icon = modelIcon(model);
        if (icon) {
          const iconSize = narrow ? 14 : 16;
          row.append(svgEl('image', {
            href: 'assets/logos/' + icon,
            x: narrow ? 4 : 8, y: y + 12, width: iconSize, height: iconSize,
          }));
        }
        row.append(svgEl('text', { x: narrow ? 22 : 31, y: y + 24, class: 'chart-model' }, readableName(model)));

        const barW = Math.max(2, (plotW * avg) / 100);
        if (!isHuman) {
          const deficitW = Math.max(0, humanCeilingX - (left + barW));
          row.append(svgEl('rect', {
            x: left + barW, y: y + 13, width: deficitW, height: 14, rx: 2,
            fill: 'rgba(180, 89, 102, 0.13)',
            stroke: 'rgba(180, 89, 102, 0.45)',
            'stroke-width': 1,
            'stroke-dasharray': '3 2.5',
          }));
        }
        row.append(svgEl('rect', {
          x: left, y: y + 13, width: barW, height: 14, rx: 2.5,
          fill: isHuman ? COLORS.human : COLORS.easy,
          class: 'chart-bar',
        }));

        if (isHuman) {
          row.append(svgEl('text', {
            x: left + barW + 6, y: y + 24, class: 'chart-val chart-val-strong',
          }, pct(avg)));
        } else {
          // Place model score cleanly inside its solid bar (all models >= 46%) so the deficit band stays uncluttered.
          row.append(svgEl('text', {
            x: left + barW - 6, y: y + 23.5, 'text-anchor': 'end',
            fill: '#ffffff', style: 'fill:#ffffff;font-weight:600;',
            class: 'chart-val',
          }, pct(avg)));
        }

        row.append(svgEl('text', {
          x: w - 4, y: y + 24, 'text-anchor': 'end',
          class: isHuman ? 'chart-val-ceiling' : 'chart-val-gap',
        }, isHuman ? 'Ceiling' : `\u2212${gap.toFixed(1)} pp`));

        if (i === 0) {
          const sepY = y + rowH + 3;
          svg.append(svgEl('line', { x1: 4, x2: w - 4, y1: sepY, y2: sepY, class: 'chart-sep' }));
        }
      });
      parsingRoot.append(svg);
    }

    if (parsingStrip) {
      const best = modelRows[0];
      const worstMaze = Math.min(...modelRows.map(r => r.maze));
      parsingStrip.replaceChildren();
      [
        {
          label: 'Human parsing ceiling',
          score: `${pct(humanAvg)} avg`,
          delta: '98.6%\u2013100% across tasks',
          human: true,
        },
        {
          label: `Best frontier model \u00b7 ${readableName(best.model)}`,
          score: `${pct(best.avg)} avg`,
          delta: `\u2212${best.gap.toFixed(1)} pp vs. human`,
          human: false,
        },
      ].forEach(({ label, score, delta, human }) => {
        const item = el('div', 'stat-item' + (human ? ' stat-item-human' : ''));
        item.append(el('div', 'stat-label', label));
        const main = el('div', 'stat-main');
        main.append(el('span', 'stat-score', score), el('span', 'stat-delta', delta));
        item.append(main);
        parsingStrip.append(item);
      });
      void worstMaze;
    }
  }

  /* ------------------------------------------------------------------
   * FIGURE 6A & 6B: Shared Gain Chart Builder (Explicit before -> after + gain)
   * ------------------------------------------------------------------ */
  function renderGainChart(root, rows, opts) {
    root.replaceChildren();
    const legend = el('div', 'chart-legend');
    opts.legend.forEach(([label, color, border]) => {
      const key = el('span', 'chart-key');
      const sw = el('i', 'chart-swatch');
      sw.style.background = color;
      if (border) sw.style.border = `1px solid ${border}`;
      key.append(sw, document.createTextNode(label));
      legend.append(key);
    });
    root.append(legend);

    const w = Math.max(260, Math.round(root.clientWidth));
    const narrow = w < 380;
    const left = narrow ? 108 : 120;
    const gainPad = narrow ? 38 : 46;
    const pairPad = narrow ? 72 : 84;
    const rightPad = gainPad + pairPad + 8;
    const plotW = Math.max(76, w - left - rightPad);
    const rowH = 38;
    const top = 28;
    const bottom = top + rows.length * rowH;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${w} ${bottom + 4}`,
      class: 'chart-svg' + (narrow ? ' chart-gain-compact' : ''),
      role: 'group',
      'aria-label': opts.ariaLabel,
    });
    addAxis(svg, left, plotW, top - 4, bottom - 4);

    svg.append(svgEl('text', {
      x: w - gainPad - 2, y: top - 14, 'text-anchor': 'end', class: 'chart-tick',
    }, opts.pairHeader));
    svg.append(svgEl('text', {
      x: w - 2, y: top - 14, 'text-anchor': 'end', class: 'chart-tick',
    }, 'Gain'));

    rows.forEach(({ model, before, after, gain }, i) => {
      const y = top + i * rowH;
      const desc = `${readableName(model)}: ${pct(before)} to ${pct(after)} (+${gain.toFixed(1)} pp)`;
      const row = createRow(svg, model, y, w, rowH - 4, desc);
      const icon = modelIcon(model);
      if (icon) {
        const iconSize = narrow ? 13 : 14;
        row.append(svgEl('image', {
          href: 'assets/logos/' + icon,
          x: narrow ? 2 : 4, y: y + 10, width: iconSize, height: iconSize,
        }));
      }
      row.append(svgEl('text', { x: narrow ? 20 : 23, y: y + 21, class: 'chart-model' }, readableName(model)));

      const afterW = Math.max(2, (plotW * after) / 100);
      const beforeW = Math.max(2, (plotW * before) / 100);
      row.append(svgEl('rect', {
        x: left, y: y + 11, width: afterW, height: 12, rx: 2,
        fill: opts.afterFill, stroke: opts.afterStroke, 'stroke-width': 1,
      }));
      row.append(svgEl('rect', {
        x: left, y: y + 11, width: beforeW, height: 12, rx: 2,
        fill: opts.beforeFill,
      }));

      const pairText = svgEl('text', {
        x: w - gainPad - 2, y: y + 21, 'text-anchor': 'end', class: 'chart-val-pair',
      });
      pairText.append(document.createTextNode(`${before.toFixed(1)}\u2009\u2192\u2009`));
      const strongSpan = svgEl('tspan', { class: 'chart-val-strong' }, `${after.toFixed(1)}%`);
      pairText.append(strongSpan);
      row.append(pairText);

      row.append(svgEl('text', {
        x: w - 2, y: y + 21, 'text-anchor': 'end', class: 'chart-val-gain',
      }, `+${gain.toFixed(1)}`));
    });

    root.append(svg);
  }

  /* FIGURE 6A: Viewpoint Probe (Isometric 3D vs Flat 2D) */
  const viewRoot = document.getElementById('view-chart');
  const viewIsoImg = document.getElementById('view-iso-img');
  const viewFlatImg = document.getElementById('view-flat-img');
  const viewIsoCap = document.getElementById('view-iso-cap');
  const viewFlatCap = document.getElementById('view-flat-cap');
  const VIEW_EXAMPLES = {
    blox: {
      isoSrc: 'assets/blox-isometric.webp',
      flatSrc: 'assets/blox-flat.webp',
      isoAlt: 'BLOX board rendered in isometric 3D',
      flatAlt: 'Same BLOX board rendered in flat 2D top-down view',
      isoCap: 'BLOX \u00b7 Isometric 3D',
      flatCap: 'BLOX \u00b7 Flat 2D',
    },
    cube: {
      isoSrc: 'assets/cube-isometric.webp',
      flatSrc: 'assets/cube-flat.webp',
      isoAlt: 'CUBE piece rendered in isometric 3D',
      flatAlt: 'Same CUBE piece rendered in flat 2D top-down grid',
      isoCap: 'CUBE \u00b7 Isometric 3D',
      flatCap: 'CUBE \u00b7 Flat 2D',
    },
  };
  const viewTabs = buildTabs(
    'view-tabs',
    [
      ['blox', 'BLOX'],
      ['cube', 'CUBE'],
    ],
    'blox',
    () => drawView()
  );

  function drawView() {
    if (!viewRoot) return;
    const env = viewTabs.get();
    const ex = VIEW_EXAMPLES[env];
    if (ex && viewIsoImg && viewFlatImg) {
      viewIsoImg.src = ex.isoSrc;
      viewIsoImg.alt = ex.isoAlt;
      viewFlatImg.src = ex.flatSrc;
      viewFlatImg.alt = ex.flatAlt;
      if (viewIsoCap) viewIsoCap.textContent = ex.isoCap;
      if (viewFlatCap) viewFlatCap.textContent = ex.flatCap;
    }
    const subset = data.parsing.filter(r => r.environment === env);
    const rows = uniqueModels(subset).map(model => {
      const before = subset.find(r => r.model === model && r.view === 'iso')?.value ?? 0;
      const after = subset.find(r => r.model === model && r.view === 'flat')?.value ?? 0;
      return { model, before, after, gain: after - before };
    }).sort((a, b) => b.after - a.after);

    renderGainChart(viewRoot, rows, {
      ariaLabel: `${ENV_LABELS[env]} isometric 3D versus flat 2D parsing accuracy`,
      legend: [
        ['Isometric 3D', COLORS.easy],
        ['Flat 2D gain', '#d7e5f0', COLORS.easy],
      ],
      beforeFill: COLORS.easy,
      afterFill: '#d7e5f0',
      afterStroke: COLORS.easy,
      pairHeader: 'Iso \u2192 Flat',
    });
  }

  /* FIGURE 6B: Code-Assisted Agentic Vision Probe (MAZE) */
  const toolsRoot = document.getElementById('tools-chart');

  function drawTools() {
    if (!toolsRoot) return;
    const rows = [...data.tools]
      .map(r => ({ model: r.model, before: r.vision, after: r.code, gain: r.code - r.vision }))
      .sort((a, b) => b.after - a.after);

    renderGainChart(toolsRoot, rows, {
      ariaLabel: 'MAZE parsing accuracy with vision only versus code execution',
      legend: [
        ['Vision only', COLORS.vision],
        ['+ Code execution', '#dce7f0', COLORS.code],
      ],
      beforeFill: COLORS.vision,
      afterFill: '#dce7f0',
      afterStroke: COLORS.code,
      pairHeader: 'Vis \u2192 Code',
    });
  }

  /* Initial render + width-only resize observer */
  const targets = [
    [resultsRoot, drawResults],
    [diagRoot, drawDiagnostic],
    [parsingRoot, drawParsing],
    [viewRoot, drawView],
    [toolsRoot, drawTools],
  ].filter(([node]) => Boolean(node));

  const lastWidths = new Map();
  targets.forEach(([node, render]) => {
    render();
    lastWidths.set(node, node.clientWidth);
  });

  function syncWidths() {
    targets.forEach(([node, render]) => {
      const w = node.clientWidth;
      if (w > 0 && w !== lastWidths.get(node)) {
        lastWidths.set(node, w);
        render();
      }
    });
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncWidths);
    });
    targets.forEach(([node]) => ro.observe(node));
  }
  window.addEventListener('resize', () => requestAnimationFrame(syncWidths), { passive: true });
})();
