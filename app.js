/* =========================================================
   TaskFlow — Application Logic
   ========================================================= */

(function () {
  'use strict';

  // ---- Constants ----
  const STORAGE_KEY = 'taskflow_tasks';
  const THEME_KEY = 'taskflow_theme';
  const CATEGORY_ICONS = { general:'📋', work:'💼', personal:'🏠', health:'💪', learning:'📚', finance:'💰' };
  const CIRCUMFERENCE = 2 * Math.PI * 34; // SVG ring r=34

  // ---- DOM References ----
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const taskForm     = $('#taskForm');
  const taskTitle    = $('#taskTitle');
  const taskDesc     = $('#taskDesc');
  const taskCategory = $('#taskCategory');
  const taskDue      = $('#taskDue');
  const taskList     = $('#taskList');
  const emptyState   = $('#emptyState');
  const searchInput  = $('#searchInput');
  const sortSelect   = $('#sortSelect');
  const toggleFormBtn = $('#toggleFormBtn');
  const themeToggle  = $('#themeToggle');
  const editModal    = $('#editModal');
  const editForm     = $('#editForm');
  const toastContainer = $('#toastContainer');
  const confettiCanvas = $('#confettiCanvas');
  const navTime      = $('#navTime');

  // Stats
  const numTotal     = $('#numTotal');
  const numCompleted = $('#numCompleted');
  const numPending   = $('#numPending');
  const numOverdue   = $('#numOverdue');
  const ringTotal    = $('#ringTotal');
  const ringCompleted = $('#ringCompleted');
  const ringPending  = $('#ringPending');
  const ringOverdue  = $('#ringOverdue');

  // ---- State ----
  let tasks = [];
  let currentFilter = 'all';
  let currentPriority = 'low';

  // ---- Init ----
  function init() {
    loadTasks();
    loadTheme();
    initParticles();
    initClock();
    bindEvents();
    render();
  }

  // ---- LocalStorage ----
  function loadTasks() {
    try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { tasks = []; }
  }
  function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

  // ---- Theme ----
  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light') document.body.classList.add('light');
  }
  function toggleTheme() {
    document.body.classList.toggle('light');
    localStorage.setItem(THEME_KEY, document.body.classList.contains('light') ? 'light' : 'dark');
  }

  // ---- Clock ----
  function initClock() {
    function tick() {
      const now = new Date();
      navTime.textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    }
    tick();
    setInterval(tick, 30000);
  }

  // ---- Background Particles ----
  function initParticles() {
    const container = $('#bgParticles');
    const colors = ['#6C63FF','#FF6584','#FFD740','#4FC3F7','#00E676'];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.classList.add('particle');
      const size = Math.random() * 4 + 2;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDuration = (Math.random() * 20 + 15) + 's';
      p.style.animationDelay = (Math.random() * 20) + 's';
      container.appendChild(p);
    }
  }

  // ---- Events ----
  function bindEvents() {
    // Add task
    taskForm.addEventListener('submit', e => { e.preventDefault(); addTask(); });

    // Priority buttons
    $$('.priority-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.priority-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPriority = btn.dataset.priority;
      });
    });

    // Toggle form
    toggleFormBtn.addEventListener('click', () => {
      toggleFormBtn.classList.toggle('collapsed');
      taskForm.classList.toggle('collapsed');
    });

    // Theme
    themeToggle.addEventListener('click', toggleTheme);

    // Filter chips
    $$('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        render();
      });
    });

    // Search
    searchInput.addEventListener('input', () => render());

    // Sort
    sortSelect.addEventListener('change', () => render());

    // Edit modal
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalCancel').addEventListener('click', closeModal);
    editModal.addEventListener('click', e => { if (e.target === editModal) closeModal(); });
    editForm.addEventListener('submit', e => { e.preventDefault(); saveEdit(); });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'n' && !isTyping(e)) { e.preventDefault(); taskTitle.focus(); }
    });
  }

  function isTyping(e) {
    const tag = e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
  }

  // ---- CRUD ----
  function addTask() {
    const title = taskTitle.value.trim();
    if (!title) { shake(taskTitle); return; }
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      title,
      description: taskDesc.value.trim(),
      category: taskCategory.value,
      priority: currentPriority,
      dueDate: taskDue.value || null,
      completed: false,
      createdAt: new Date().toISOString()
    };
    tasks.unshift(task);
    saveTasks();
    taskForm.reset();
    $$('.priority-btn').forEach(b => b.classList.remove('active'));
    $$('.priority-btn')[0].classList.add('active');
    currentPriority = 'low';
    render();
    toast('Task added successfully!', 'success');
  }

  function toggleComplete(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.completed = !t.completed;
    saveTasks();
    if (t.completed) fireConfetti();
    render();
    toast(t.completed ? 'Task completed! 🎉' : 'Task reopened', 'info');
  }

  function deleteTask(id) {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('removing');
      setTimeout(() => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        render();
        toast('Task deleted', 'error');
      }, 400);
    }
  }

  function openEdit(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    $('#editId').value = t.id;
    $('#editTitle').value = t.title;
    $('#editDesc').value = t.description;
    $('#editCategory').value = t.category;
    $('#editPriority').value = t.priority;
    $('#editDue').value = t.dueDate || '';
    editModal.classList.add('active');
  }

  function closeModal() { editModal.classList.remove('active'); }

  function saveEdit() {
    const id = $('#editId').value;
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.title = $('#editTitle').value.trim();
    t.description = $('#editDesc').value.trim();
    t.category = $('#editCategory').value;
    t.priority = $('#editPriority').value;
    t.dueDate = $('#editDue').value || null;
    saveTasks();
    closeModal();
    render();
    toast('Task updated!', 'info');
  }

  // ---- Render ----
  function render() {
    let filtered = filterTasks(tasks);
    filtered = sortTasks(filtered);
    taskList.innerHTML = '';
    if (filtered.length === 0) {
      emptyState.classList.add('visible');
    } else {
      emptyState.classList.remove('visible');
      filtered.forEach((t, i) => {
        const el = createTaskElement(t, i);
        taskList.appendChild(el);
      });
    }
    updateStats();
  }

  function filterTasks(list) {
    const query = searchInput.value.toLowerCase().trim();
    return list.filter(t => {
      if (query && !t.title.toLowerCase().includes(query) && !t.description.toLowerCase().includes(query)) return false;
      if (currentFilter === 'pending') return !t.completed;
      if (currentFilter === 'completed') return t.completed;
      if (currentFilter === 'overdue') return !t.completed && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
      return true;
    });
  }

  function sortTasks(list) {
    const val = sortSelect.value;
    const copy = [...list];
    const prioMap = { high:3, medium:2, low:1 };
    switch (val) {
      case 'oldest': copy.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'priority': copy.sort((a,b) => prioMap[b.priority] - prioMap[a.priority]); break;
      case 'due': copy.sort((a,b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate) - new Date(b.dueDate); }); break;
      case 'alpha': copy.sort((a,b) => a.title.localeCompare(b.title)); break;
      default: copy.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return copy;
  }

  function createTaskElement(t) {
    const div = document.createElement('div');
    div.className = `task-item priority-${t.priority}${t.completed ? ' completed' : ''}`;
    div.dataset.id = t.id;

    const isOverdue = !t.completed && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
    const dueBadge = t.dueDate
      ? `<span class="task-tag ${isOverdue ? 'tag-overdue' : 'tag-due'}">${isOverdue ? '⚠ Overdue' : '📅 ' + formatDate(t.dueDate)}</span>`
      : '';

    div.innerHTML = `
      <div class="task-check ${t.completed ? 'checked' : ''}" data-action="toggle">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
        <div class="task-meta">
          <span class="task-tag tag-category">${CATEGORY_ICONS[t.category] || '📋'} ${t.category}</span>
          <span class="task-tag tag-priority-${t.priority}">${t.priority}</span>
          ${dueBadge}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn edit" data-action="edit" aria-label="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="task-action-btn delete" data-action="delete" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    `;

    // Events via delegation
    div.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'toggle') toggleComplete(t.id);
      if (action === 'edit') openEdit(t.id);
      if (action === 'delete') deleteTask(t.id);
    });

    return div;
  }

  // ---- Stats ----
  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length;
    const overdue = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString())).length;

    animateNumber(numTotal, total);
    animateNumber(numCompleted, completed);
    animateNumber(numPending, pending);
    animateNumber(numOverdue, overdue);

    const maxVal = Math.max(total, 1);
    setRing(ringTotal, total, maxVal);
    setRing(ringCompleted, completed, maxVal);
    setRing(ringPending, pending, maxVal);
    setRing(ringOverdue, overdue, maxVal);
  }

  function setRing(el, value, max) {
    const pct = value / max;
    el.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
  }

  function animateNumber(el, target) {
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;
    const duration = 500;
    const startTime = performance.now();
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      el.textContent = Math.round(start + (target - start) * easeOut(progress));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // ---- Utilities ----
  function formatDate(d) {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  }

  function escapeHtml(str) {
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
  }

  function shake(el) {
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'shake 0.4s ease';
    setTimeout(() => el.style.animation = '', 400);
  }

  // ---- Toast ----
  function toast(msg, type = 'info') {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${icons[type] || icons.info} ${escapeHtml(msg)}`;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ---- Confetti ----
  function fireConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#6C63FF','#FF6584','#FFD740','#4FC3F7','#00E676','#FF5252'];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * confettiCanvas.height * 0.5 - confettiCanvas.height * 0.2,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 4 + 2,
        rot: Math.random() * 360,
        rv: (Math.random() - 0.5) * 10,
        life: 1
      });
    }
    let frame;
    function draw() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.rv; p.life -= 0.012;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
    cancelAnimationFrame(frame);
    draw();
  }

  // ---- Start ----
  document.addEventListener('DOMContentLoaded', init);
})();
