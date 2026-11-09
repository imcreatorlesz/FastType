(() => {
  'use strict';

  const WORDS = {
    ru: ('время человек дело жизнь день рука работа слово место лицо друг глаз вопрос дом сторона ' +
      'страна мир случай голова ребенок сила конец вид система часть город отношение женщина деньги ' +
      'земля машина вода отец проблема час право нога решение дверь образ история власть закон война ' +
      'голос улица книга окно школа ночь утро ветер лето зима река море небо гора лес поле дорога ' +
      'письмо ответ мысль взгляд радость привет сегодня завтра вместе всегда иногда сейчас потом ' +
      'быстро хорошо давай можно нужно будет очень тоже еще клавиша палец печать скорость ритм').split(' '),
    en: ('time person year way day thing man world life hand part child eye woman place work week case ' +
      'point government company number group problem fact have make know take see come think look want ' +
      'give use find tell ask seem feel try leave call good new first last long great little own other ' +
      'old right big high different small large next early young important public same able quick ' +
      'keyboard practice speed finger rhythm accuracy simple typing screen phone window light water ' +
      'green house money story night').split(' ')
  };

  const ALPHA = { ru: /^[а-я]$/, en: /^[a-z]$/ };

  const $ = (s) => document.querySelector(s);
  const el = {
    text: $('#text'), stage: $('#stage'), capture: $('#capture'),
    time: $('#time'), wpm: $('#wpm'), acc: $('#acc'),
    result: $('#result'), rWpm: $('#r-wpm'), rAcc: $('#r-acc'),
    rChars: $('#r-chars'), rErr: $('#r-err'), rNote: $('#r-note'), rTitle: $('#r-title'),
    weak: $('#weak'), history: $('#history'), best: $('#best'), restart: $('#restart')
  };

  // ---------- хранилище ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };

  const settings = Object.assign({ lang: 'ru', time: 30, mode: 'normal' }, store.get('fasttype:settings', {}));
  const data = Object.assign({ keys: {}, history: [] }, store.get('fasttype:data', {}));

  // ---------- состояние попытки ----------
  let text = '';
  let typed = '';
  let startedAt = 0;
  let timerId = null;
  let finished = false;
  let keystrokes = 0;
  let mistakes = 0;
  let sessionKeys = {};

  // ---------- слабые клавиши ----------
  function weakKeys() {
    return Object.entries(data.keys)
      .filter(([k, v]) => ALPHA[settings.lang].test(k) && v.miss >= 2 && v.hit + v.miss >= 8)
      .map(([k, v]) => ({ key: k, rate: v.miss / (v.hit + v.miss) }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }

  function pickWords(n) {
    const all = WORDS[settings.lang];
    const weak = settings.mode === 'weak' ? weakKeys().map((w) => w.key) : [];
    const focused = weak.length ? all.filter((w) => weak.some((k) => w.includes(k))) : [];
    const out = [];
    let prev = '';
    while (out.length < n) {
      const src = focused.length >= 5 && Math.random() < 0.8 ? focused : all;
      const w = src[Math.floor(Math.random() * src.length)];
      if (w !== prev) { out.push(w); prev = w; }
    }
    return out.join(' ');
  }

  // ---------- отрисовка ----------
  function render() {
    if (typed.length > text.length - 150) text += ' ' + pickWords(30);

    let html = '';
    for (let i = 0; i < text.length; i++) {
      let cls = '';
      if (i < typed.length) cls = typed[i] === text[i] ? 'ok' : 'bad';
      else if (i === typed.length) cls = 'cur';
      html += `<span class="${cls}">${text[i]}</span>`;
    }
    el.text.innerHTML = html;

    const cur = el.text.querySelector('.cur');
    if (cur) {
      const line = parseFloat(getComputedStyle(el.text).lineHeight) || 36;
      el.text.scrollTop = Math.max(0, cur.offsetTop - line);
    }
  }

  function renderWeak() {
    const list = weakKeys();
    el.weak.innerHTML = list.length
      ? list.map((k) => `<li><b>${k.key}</b><span>${Math.round(k.rate * 100)}% ошибок</span></li>`).join('')
      : '<li class="empty">Пока мало данных. Сделай несколько попыток.</li>';
  }

  function renderHistory() {
    const last = data.history.slice(-15);
    if (!last.length) {
      el.history.innerHTML = '<p class="empty">График появится после первой попытки.</p>';
    } else {
      const max = Math.max(10, ...last.map((h) => h.wpm));
      el.history.innerHTML = last
        .map((h) => `<div class="bar" style="height:${Math.max(6, (h.wpm / max) * 100)}%" title="${h.wpm} слов/мин, точность ${h.acc}%"><span>${h.wpm}</span></div>`)
        .join('');
    }
    const best = Math.max(0, ...data.history.map((h) => h.wpm));
    el.best.textContent = best ? `Рекорд: ${best} слов/мин` : '';
  }

  function syncButtons() {
    document.querySelectorAll('.group').forEach((group) => {
      const key = group.dataset.setting;
      group.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String(String(settings[key]) === b.dataset.value));
      });
    });
  }

  // ---------- подсчёт ----------
  function correctChars() {
    let c = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === text[i]) c++;
    return c;
  }

  function calcWpm(seconds) {
    return seconds < 1 ? 0 : Math.round((correctChars() / 5) / (seconds / 60));
  }

  function calcAcc() {
    return keystrokes ? Math.round(((keystrokes - mistakes) / keystrokes) * 100) : 100;
  }

  // ---------- ход попытки ----------
  function start() {
    startedAt = performance.now();
    timerId = setInterval(tick, 200);
  }

  function tick() {
    const elapsed = (performance.now() - startedAt) / 1000;
    const left = Math.max(0, settings.time - elapsed);
    el.time.textContent = Math.ceil(left);
    el.wpm.textContent = calcWpm(elapsed);
    el.acc.textContent = calcAcc() + '%';
    if (left <= 0) finish();
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(timerId);
    timerId = null;
    el.capture.blur();

    const wpm = calcWpm(settings.time);
    const acc = calcAcc();
    const prevBest = Math.max(0, ...data.history.map((h) => h.wpm));

    for (const [k, v] of Object.entries(sessionKeys)) {
      const total = (data.keys[k] = data.keys[k] || { hit: 0, miss: 0 });
      total.hit += v.hit;
      total.miss += v.miss;
    }
    data.history.push({ t: Date.now(), wpm, acc, lang: settings.lang });
    data.history = data.history.slice(-30);
    store.set('fasttype:data', data);

    el.time.textContent = '0';
    el.wpm.textContent = wpm;
    el.acc.textContent = acc + '%';
    el.rWpm.textContent = wpm;
    el.rAcc.textContent = acc + '%';
    el.rChars.textContent = correctChars();
    el.rErr.textContent = mistakes;

    const isRecord = wpm > 0 && wpm > prevBest;
    el.rTitle.textContent = isRecord ? 'Новый рекорд!' : 'Результат';
    el.rNote.textContent = acc < 95
      ? 'Точность ниже 95%. Печатай чуть медленнее, скорость вырастет сама.'
      : 'Хорошая точность. Теперь можно понемногу прибавлять скорость.';
    el.result.hidden = false;

    renderWeak();
    renderHistory();
  }

  function reset(focus) {
    clearInterval(timerId);
    timerId = null;
    startedAt = 0;
    finished = false;
    typed = '';
    keystrokes = 0;
    mistakes = 0;
    sessionKeys = {};
    el.capture.value = '';
    text = pickWords(60);

    el.time.textContent = settings.time;
    el.wpm.textContent = '0';
    el.acc.textContent = '100%';
    el.result.hidden = true;
    el.text.scrollTop = 0;

    render();
    if (focus) el.capture.focus();
  }

  // ---------- ввод ----------
  el.capture.addEventListener('input', () => {
    if (finished) { el.capture.value = typed; return; }
    const value = el.capture.value;
    if (!startedAt && value.length) start();

    for (let i = typed.length; i < value.length; i++) {
      const expected = text[i];
      if (expected === undefined) break;
      keystrokes++;
      const key = expected.toLowerCase();
      const isHit = value[i] === expected;
      if (!isHit) mistakes++;
      if (key.trim()) {
        const s = (sessionKeys[key] = sessionKeys[key] || { hit: 0, miss: 0 });
        if (isHit) s.hit++; else s.miss++;
      }
    }

    typed = value;
    el.capture.setSelectionRange(value.length, value.length);
    render();
  });

  ['paste', 'cut', 'drop'].forEach((ev) =>
    el.capture.addEventListener(ev, (e) => e.preventDefault()));

  el.capture.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault();
      reset(true);
      return;
    }
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag !== 'INPUT' && tag !== 'BUTTON' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      el.capture.focus();
    }
  });

  el.capture.addEventListener('focus', () => el.stage.classList.add('focused'));
  el.capture.addEventListener('blur', () => el.stage.classList.remove('focused'));
  el.stage.addEventListener('click', () => { if (!finished) el.capture.focus(); });
  el.restart.addEventListener('click', () => reset(true));

  document.querySelectorAll('.group').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const key = group.dataset.setting;
      settings[key] = key === 'time' ? Number(btn.dataset.value) : btn.dataset.value;
      store.set('fasttype:settings', settings);
      syncButtons();
      renderWeak();
      reset(false);
    });
  });

  // ---------- старт ----------
  syncButtons();
  renderWeak();
  renderHistory();
  reset(false);
})();
