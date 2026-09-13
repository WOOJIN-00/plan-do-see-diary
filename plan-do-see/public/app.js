const state = {
  plans: [],
  todosByPlan: {}, // planId -> array
  expanded: new Set(),
  editingPlanId: null,
  calYear: null,
  calMonth: null, // 0-11
  certByDate: {},
};

const priorityLabel = { high: '높음', mid: '보통', low: '낮음' };

function todaySeoul() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

const CATEGORY_META = {
  apply: { label: '원서접수', desc: '이 기간 안에 접수해야 시험을 볼 수 있어요' },
  written: { label: '필기시험', desc: '필기시험을 보는 날' },
  practical: { label: '실기시험', desc: '실기시험을 보는 날' },
  result: { label: '합격 발표', desc: '필기/실기 합격 여부를 확인하는 날' },
};

// ---------- 삭제 확인 팝업 ----------
function confirmDialog(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    document.getElementById('confirm-modal-message').textContent = message;

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlay);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onOverlay = (e) => { if (e.target === modal) onCancel(); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlay);
    modal.classList.remove('hidden');
  });
}

// ---------- 공통 ----------
async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || '요청 실패');
  return data;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// ---------- 뷰 전환 ----------
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
  });
});

// ---------- 계획 ----------
async function loadPlans() {
  state.plans = await api('/api/plans');
  // 진행률/완료 여부 계산을 위해 모든 계획의 할 일을 미리 불러온다
  await Promise.all(
    state.plans.map(async (plan) => {
      state.todosByPlan[plan.id] = await api(`/api/plans/${plan.id}/todos`);
    })
  );
  renderPlans();
}

function planProgress(plan) {
  const todos = state.todosByPlan[plan.id];
  if (!todos || todos.length === 0) return 0;
  const done = todos.filter((t) => t.status === 'done').length;
  return Math.round((done / todos.length) * 100);
}

function isPlanComplete(plan) {
  const todos = state.todosByPlan[plan.id];
  return !!todos && todos.length > 0 && todos.every((t) => t.status === 'done');
}

function renderPlans() {
  const list = document.getElementById('plan-list');
  const empty = document.getElementById('plan-empty');
  list.innerHTML = '';

  const activePlans = state.plans.filter((p) => !isPlanComplete(p));
  empty.classList.toggle('hidden', activePlans.length > 0);
  for (const plan of activePlans) {
    list.appendChild(renderPlanCard(plan));
  }

  renderCompletedPlans();
}

function renderCompletedPlans() {
  const list = document.getElementById('completed-plan-list');
  const empty = document.getElementById('completed-plan-empty');
  if (!list) return;
  list.innerHTML = '';

  const completedPlans = state.plans.filter((p) => isPlanComplete(p));
  empty.classList.toggle('hidden', completedPlans.length > 0);
  for (const plan of completedPlans) {
    list.appendChild(renderPlanCard(plan));
  }
}

function planMetaText(plan) {
  const parts = [];
  if (plan.period_start || plan.period_end) {
    parts.push(`${plan.period_start || '?'} ~ ${plan.period_end || '?'}`);
  }
  if (plan.estimated_hours != null) parts.push(`예상 ${plan.estimated_hours}시간`);
  if (plan.success_criteria) parts.push(`성공기준: ${plan.success_criteria}`);
  return parts.join(' · ');
}

function renderPlanCard(plan) {
  const isOpen = state.expanded.has(plan.id);
  const todos = state.todosByPlan[plan.id] || [];
  const doneCount = todos.filter((t) => t.status === 'done').length;
  const pct = planProgress(plan);
  const complete = isPlanComplete(plan);

  const card = el('div', { class: 'plan-card' + (complete ? ' completed' : '') });

  const progressWrap = el('div', { class: 'plan-progress-wrap' }, [
    el('div', { class: 'progress-bar' }, [
      el('div', { class: 'progress-bar-fill' + (complete ? ' complete' : ''), style: `width:${pct}%` }),
    ]),
    el('span', { class: 'plan-progress' }, todos.length ? `${doneCount}/${todos.length} · ${pct}%` : '할 일 없음'),
  ]);

  const top = el('div', { class: 'plan-top', onclick: () => toggleExpand(plan.id) }, [
    el('div', {}, [
      el('div', { class: 'plan-title-row' }, [
        el('span', { class: 'plan-title' }, plan.title),
        plan.priority ? el('span', { class: 'badge ' + plan.priority }, priorityLabel[plan.priority] || plan.priority) : null,
        complete ? el('span', { class: 'badge complete-badge' }, '완료 ✓') : null,
      ]),
      el('div', { class: 'plan-meta' }, planMetaText(plan) || '세부 정보 없음'),
      progressWrap,
    ]),
    el('div', { class: 'plan-actions' }, [
      el('button', { class: 'icon-btn', title: '수정', onclick: (e) => { e.stopPropagation(); openPlanForm(plan); } }, '✎'),
      el('button', { class: 'icon-btn', title: '삭제', onclick: (e) => { e.stopPropagation(); deletePlan(plan.id); } }, '🗑'),
    ]),
  ]);

  card.appendChild(top);

  if (isOpen) {
    card.appendChild(renderTodoSection(plan));
    if (!state.todosByPlan[plan.id]) {
      loadTodos(plan.id);
    }
  }

  return card;
}

function renderTodoSection(plan) {
  const section = el('div', { class: 'todo-section' });
  const todos = state.todosByPlan[plan.id];

  if (!todos) {
    section.appendChild(el('p', { class: 'empty' }, '불러오는 중...'));
    return section;
  }

  const listEl = el('div', { class: 'todo-list' });
  if (todos.length === 0) {
    listEl.appendChild(el('p', { class: 'empty' }, '세부 할 일이 없습니다.'));
  }
  for (const todo of todos) {
    listEl.appendChild(renderTodoItem(plan.id, todo));
  }
  section.appendChild(listEl);

  // 할 일 추가 폼
  const form = el('form', { class: 'todo-add-form', novalidate: 'novalidate' });
  const titleInput = el('input', { type: 'text', placeholder: '새 할 일 (예: OSI 7계층 정리)', required: 'required' });
  const todayStr = todaySeoul();
  const dueAttrs = { type: 'date' };
  dueAttrs.min = plan.period_start && plan.period_start > todayStr ? plan.period_start : todayStr;
  if (plan.period_end) dueAttrs.max = plan.period_end;
  const dueInput = el('input', dueAttrs);
  const priSelect = el('select', {}, [
    el('option', { value: '' }, '우선순위'),
    el('option', { value: 'high' }, '높음'),
    el('option', { value: 'mid' }, '보통'),
    el('option', { value: 'low' }, '낮음'),
  ]);
  const tagInput = el('input', { type: 'text', placeholder: '태그' });
  const hoursInput = el('input', { type: 'number', min: '0', step: '0.5', placeholder: '예상시간' });

  const addRow = el('div', { class: 'todo-add' }, [titleInput, el('button', { class: 'btn primary small', type: 'submit' }, '추가')]);
  const extraRow = el('div', { class: 'todo-add-extra' }, [dueInput, priSelect, tagInput, hoursInput]);
  const DUE_ERROR_DEFAULT = '마감일은 계획 기간 안에서 정해야 합니다.';
  const dueError = el('p', { class: 'field-error hidden' }, DUE_ERROR_DEFAULT);
  const requiredError = el('p', { class: 'field-error hidden' }, '');

  form.appendChild(addRow);
  form.appendChild(extraRow);
  if (plan.period_start || plan.period_end) {
    form.appendChild(el('p', { class: 'field-hint' }, `계획 기간: ${plan.period_start || '?'} ~ ${plan.period_end || '?'} 안에서만 마감일을 정할 수 있어요`));
  }
  form.appendChild(requiredError);
  form.appendChild(dueError);

  const TODO_REQUIRED_FIELDS = [
    [titleInput, '할 일 제목'],
    [dueInput, '마감일'],
    [priSelect, '우선순위'],
    [tagInput, '태그'],
    [hoursInput, '예상 시간'],
  ];
  let todoSubmitAttempted = false;

  function validateTodoRequired() {
    const missing = [];
    for (const [field, label] of TODO_REQUIRED_FIELDS) {
      const empty = !field.value.trim();
      if (empty) {
        field.classList.add('input-error');
        missing.push(label);
      } else if (field !== dueInput) {
        // dueInput의 빨간 테두리는 마감일 범위 검사(validateDue)가 관리
        field.classList.remove('input-error');
      }
    }
    if (missing.length) {
      requiredError.textContent = `다음 항목을 입력해주세요: ${missing.join(', ')}`;
      requiredError.classList.remove('hidden');
    } else {
      requiredError.classList.add('hidden');
    }
    return missing.length === 0;
  }

  function validateDue() {
    const due = dueInput.value;
    if (!due) {
      dueError.classList.add('hidden');
      return true;
    }
    let invalid = false;
    let message = DUE_ERROR_DEFAULT;
    if (due < todaySeoul()) {
      invalid = true;
      message = '마감일은 오늘보다 이전일 수 없습니다.';
    } else if ((plan.period_start && due < plan.period_start) || (plan.period_end && due > plan.period_end)) {
      invalid = true;
    }
    dueError.textContent = message;
    dueError.classList.toggle('hidden', !invalid);
    dueInput.classList.toggle('input-error', invalid);
    return !invalid;
  }
  dueInput.addEventListener('input', validateDue);

  for (const [field] of TODO_REQUIRED_FIELDS) {
    field.addEventListener('input', () => { if (todoSubmitAttempted) validateTodoRequired(); });
    field.addEventListener('change', () => { if (todoSubmitAttempted) validateTodoRequired(); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    todoSubmitAttempted = true;
    if (!validateTodoRequired()) return;
    if (!validateDue()) return;
    const title = titleInput.value.trim();

    try {
      await api(`/api/plans/${plan.id}/todos`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          due_date: dueInput.value || null,
          priority: priSelect.value || null,
          tag: tagInput.value.trim() || null,
          estimated_hours: hoursInput.value ? Number(hoursInput.value) : null,
        }),
      });
    } catch (err) {
      dueError.textContent = err.message;
      dueError.classList.remove('hidden');
      dueInput.classList.add('input-error');
      return;
    }
    await loadTodos(plan.id);
    renderPlans();
  });

  section.appendChild(form);
  return section;
}

function renderTodoItem(planId, todo) {
  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = todo.status === 'done';
  checkbox.addEventListener('change', async () => {
    await api(`/api/todos/${todo.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: checkbox.checked ? 'done' : 'pending' }),
    });
    await loadTodos(planId);
    renderPlans();
  });

  const tags = [];
  if (todo.due_date) tags.push(`📅 ${todo.due_date}`);
  if (todo.priority) tags.push(priorityLabel[todo.priority] || todo.priority);
  if (todo.tag) tags.push(`#${todo.tag}`);
  if (todo.estimated_hours != null) tags.push(`${todo.estimated_hours}h`);

  const item = el('div', { class: 'todo-item' + (todo.status === 'done' ? ' done' : '') }, [
    checkbox,
    el('span', { class: 'todo-title' }, todo.title),
    el('span', { class: 'todo-tags' }, tags.join(' · ')),
    el('button', {
      class: 'icon-btn', title: '삭제', onclick: async () => {
        if (!(await confirmDialog('이 할 일을 삭제할까요?'))) return;
        await api(`/api/todos/${todo.id}`, { method: 'DELETE' });
        await loadTodos(planId);
        renderPlans();
      },
    }, '✕'),
  ]);
  return item;
}

async function loadTodos(planId) {
  state.todosByPlan[planId] = await api(`/api/plans/${planId}/todos`);
  renderPlans();
}

function toggleExpand(planId) {
  if (state.expanded.has(planId)) state.expanded.delete(planId);
  else state.expanded.add(planId);
  renderPlans();
}

async function deletePlan(planId) {
  if (!(await confirmDialog('이 계획과 딸린 할 일을 모두 삭제할까요?'))) return;
  await api(`/api/plans/${planId}`, { method: 'DELETE' });
  delete state.todosByPlan[planId];
  state.expanded.delete(planId);
  await loadPlans();
}

// ---------- 계획 생성/수정 폼 ----------
const planFormWrap = document.getElementById('plan-form-wrap');
const planForm = document.getElementById('plan-form');
const planFormTitle = document.getElementById('plan-form-title');

document.getElementById('btn-new-plan').addEventListener('click', () => openPlanForm(null));
document.getElementById('btn-cancel-plan').addEventListener('click', () => closePlanForm());

const planDateError = document.getElementById('plan-date-error');
const PLAN_DATE_ERROR_DEFAULT = planDateError.textContent;
const planRequiredError = document.getElementById('plan-required-error');

const PLAN_REQUIRED_FIELDS = [
  ['title', '제목'],
  ['period_start', '시작일'],
  ['period_end', '종료일'],
  ['priority', '우선순위'],
  ['estimated_hours', '예상 시간'],
  ['success_criteria', '성공 기준'],
];

let planSubmitAttempted = false;

function validatePlanRequired() {
  const missing = [];
  for (const [name, label] of PLAN_REQUIRED_FIELDS) {
    const field = planForm[name];
    const empty = !field.value.trim();
    field.classList.toggle('input-error', empty);
    if (empty) missing.push(label);
  }
  if (missing.length) {
    planRequiredError.textContent = `다음 항목을 입력해주세요: ${missing.join(', ')}`;
    planRequiredError.classList.remove('hidden');
  } else {
    planRequiredError.classList.add('hidden');
  }
  return missing.length === 0;
}

// 처음엔 저장을 눌렀을 때만 검사하고, 한 번 시도한 뒤부터는 입력하는 대로 바로 갱신
for (const [name] of PLAN_REQUIRED_FIELDS) {
  planForm[name].addEventListener('input', () => {
    if (planSubmitAttempted) validatePlanRequired();
  });
}

function validatePlanDates() {
  const start = planForm.period_start.value;
  const end = planForm.period_end.value;
  const today = todaySeoul();
  let startInvalid = false;
  let endInvalid = false;
  let message = PLAN_DATE_ERROR_DEFAULT;

  if (start && start < today) { startInvalid = true; message = '시작일은 오늘보다 이전일 수 없습니다.'; }
  if (end && end < today) { endInvalid = true; message = '종료일은 오늘보다 이전일 수 없습니다.'; }
  if (start && end && end < start) { startInvalid = true; endInvalid = true; message = PLAN_DATE_ERROR_DEFAULT; }

  const invalid = startInvalid || endInvalid;
  planDateError.textContent = message;
  planDateError.classList.toggle('hidden', !invalid);
  planForm.period_start.classList.toggle('input-error', startInvalid);
  planForm.period_end.classList.toggle('input-error', endInvalid);
  return !invalid;
}

function syncPlanDateMins() {
  const today = todaySeoul();
  planForm.period_start.min = today;
  planForm.period_end.min = planForm.period_start.value > today ? planForm.period_start.value : today;
}

planForm.period_start.addEventListener('input', () => {
  syncPlanDateMins();
  validatePlanDates();
});
planForm.period_end.addEventListener('input', validatePlanDates);

function openPlanForm(plan) {
  state.editingPlanId = plan ? plan.id : null;
  planFormTitle.textContent = plan ? '계획 수정' : '새 계획';
  planForm.reset();
  planForm.id.value = plan ? plan.id : '';
  if (plan) {
    planForm.title.value = plan.title || '';
    planForm.period_start.value = plan.period_start || '';
    planForm.period_end.value = plan.period_end || '';
    planForm.priority.value = plan.priority || '';
    planForm.estimated_hours.value = plan.estimated_hours != null ? plan.estimated_hours : '';
    planForm.success_criteria.value = plan.success_criteria || '';
  }
  syncPlanDateMins();
  planSubmitAttempted = false;
  for (const [name] of PLAN_REQUIRED_FIELDS) planForm[name].classList.remove('input-error');
  planRequiredError.classList.add('hidden');
  validatePlanDates();
  planFormWrap.classList.remove('hidden');
  planForm.title.focus();
}

function closePlanForm() {
  planFormWrap.classList.add('hidden');
  state.editingPlanId = null;
}

planForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  planSubmitAttempted = true;
  if (!validatePlanRequired()) return;
  if (!validatePlanDates()) return;
  const payload = {
    title: planForm.title.value.trim(),
    period_start: planForm.period_start.value || null,
    period_end: planForm.period_end.value || null,
    priority: planForm.priority.value || null,
    estimated_hours: planForm.estimated_hours.value ? Number(planForm.estimated_hours.value) : null,
    success_criteria: planForm.success_criteria.value.trim() || null,
  };
  try {
    if (state.editingPlanId) {
      await api(`/api/plans/${state.editingPlanId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/plans', { method: 'POST', body: JSON.stringify(payload) });
    }
  } catch (err) {
    planDateError.textContent = err.message;
    planDateError.classList.remove('hidden');
    return;
  }
  closePlanForm();
  await loadPlans();
});

// ---------- 자격증 캘린더 ----------
async function loadCerts() {
  const data = await api('/api/certs');
  state.certByDate = data.byDate;
}

// ---- 사용자 일정 추가 폼 ----
const eventFormWrap = document.getElementById('event-form-wrap');
const eventForm = document.getElementById('event-form');
const eventDateError = document.getElementById('event-date-error');
const EVENT_DATE_ERROR_DEFAULT = eventDateError.textContent;

function validateEventDates() {
  const start = eventForm.start_date.value;
  const end = eventForm.end_date.value;
  const invalid = !!(start && end && end < start);
  eventDateError.textContent = EVENT_DATE_ERROR_DEFAULT;
  eventDateError.classList.toggle('hidden', !invalid);
  eventForm.start_date.classList.toggle('input-error', invalid);
  eventForm.end_date.classList.toggle('input-error', invalid);
  return !invalid;
}

eventForm.start_date.addEventListener('input', () => {
  eventForm.end_date.min = eventForm.start_date.value || '';
  validateEventDates();
});
eventForm.end_date.addEventListener('input', validateEventDates);

document.getElementById('btn-new-event').addEventListener('click', () => {
  eventForm.reset();
  validateEventDates();
  eventFormWrap.classList.remove('hidden');
  eventForm.title.focus();
});
document.getElementById('btn-cancel-event').addEventListener('click', () => {
  eventFormWrap.classList.add('hidden');
});

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateEventDates()) return;
  const title = eventForm.title.value.trim();
  const start_date = eventForm.start_date.value;
  const end_date = eventForm.end_date.value || start_date;
  const category = eventForm.category.value;
  if (!title || !start_date) return;
  try {
    await api('/api/events', {
      method: 'POST',
      body: JSON.stringify({ title, start_date, end_date, category }),
    });
  } catch (err) {
    eventDateError.textContent = err.message;
    eventDateError.classList.remove('hidden');
    return;
  }
  eventFormWrap.classList.add('hidden');
  await loadCerts();
  // 새로 추가한 일정이 있는 달로 이동
  const [y, mo] = start_date.split('-').map(Number);
  state.calYear = y;
  state.calMonth = mo - 1;
  renderCalendar();
});

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('cal-title');
  grid.innerHTML = '';

  const year = state.calYear;
  const month = state.calMonth; // 0-11
  title.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < startWeekday; i++) {
    grid.appendChild(el('div', { class: 'cal-cell empty-cell' }));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = state.certByDate[dateStr] || [];
    const classes = ['cal-cell', 'has-day'];
    if (dateStr === todayStr) classes.push('today');
    if (events.length) classes.push('has-event');

    const cell = el('div', { class: classes.join(' ') + ' clickable', onclick: () => openEventModal(dateStr) }, [
      el('div', { class: 'cal-day-num' }, String(day)),
    ]);

    if (events.length) {
      const categories = [...new Set(events.map((ev) => ev.category))];
      const dots = el('div', { class: 'cal-dots' });
      for (const cat of categories) dots.appendChild(el('span', { class: 'cal-dot ' + cat }));
      cell.appendChild(dots);
    }

    grid.appendChild(cell);
  }
}

function renderLegend() {
  const legend = document.getElementById('calendar-legend');
  legend.innerHTML = '';
  for (const [cat, meta] of Object.entries(CATEGORY_META)) {
    legend.appendChild(el('div', { class: 'legend-item' }, [
      el('span', { class: 'legend-dot ' + cat }),
      el('span', {}, [
        el('strong', {}, meta.label + ' '),
        document.createTextNode('— ' + meta.desc),
      ]),
    ]));
  }
}

function openEventModal(dateStr) {
  const modal = document.getElementById('event-modal');
  const events = state.certByDate[dateStr] || [];
  document.getElementById('event-modal-date').textContent = dateStr + ' 일정';
  const body = document.getElementById('event-modal-body');
  body.innerHTML = '';

  if (events.length === 0) {
    body.appendChild(el('p', { class: 'empty modal-empty' }, '등록된 일정이 없습니다.'));
  }

  for (const ev of events) {
    const row = el('div', { class: 'event-row' }, [
      el('span', { class: 'cert-name' }, ev.cert),
      el('span', { class: 'event-type ' + ev.category }, [
        el('span', { class: 'legend-dot ' + ev.category }),
        document.createTextNode(ev.type),
      ]),
    ]);
    if (ev.source === 'custom') {
      row.appendChild(el('button', {
        class: 'icon-btn event-delete', title: '이 일정 삭제', onclick: async () => {
          if (!(await confirmDialog('이 일정을 삭제할까요?'))) return;
          await api(`/api/events/${ev.id}`, { method: 'DELETE' });
          await loadCerts();
          renderCalendar();
          openEventModal(dateStr);
        },
      }, '✕ 삭제'));
    }
    body.appendChild(row);
  }

  // 바로 추가하는 칸
  const quickForm = el('form', { class: 'quick-add-form' });
  const quickTitle = el('input', { type: 'text', placeholder: '새 일정 이름', required: 'required' });
  const quickCategory = el('select', {}, [
    el('option', { value: 'apply' }, '원서접수'),
    el('option', { value: 'written' }, '필기시험'),
    el('option', { value: 'practical' }, '실기시험'),
    el('option', { value: 'result' }, '합격 발표'),
  ]);
  quickForm.appendChild(quickTitle);
  quickForm.appendChild(quickCategory);
  quickForm.appendChild(el('button', { class: 'btn primary small', type: 'submit' }, '추가'));
  const quickError = el('p', { class: 'field-error hidden' }, '');
  quickForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = quickTitle.value.trim();
    if (!title) return;
    try {
      await api('/api/events', {
        method: 'POST',
        body: JSON.stringify({ title, start_date: dateStr, end_date: dateStr, category: quickCategory.value }),
      });
    } catch (err) {
      quickError.textContent = err.message;
      quickError.classList.remove('hidden');
      return;
    }
    await loadCerts();
    renderCalendar();
    openEventModal(dateStr);
  });
  body.appendChild(quickForm);
  body.appendChild(quickError);

  modal.classList.remove('hidden');
}

document.getElementById('event-modal-close').addEventListener('click', () => {
  document.getElementById('event-modal').classList.add('hidden');
});
document.getElementById('event-modal').addEventListener('click', (e) => {
  if (e.target.id === 'event-modal') e.target.classList.add('hidden');
});

document.getElementById('cal-prev').addEventListener('click', () => {
  state.calMonth -= 1;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear -= 1; }
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  state.calMonth += 1;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear += 1; }
  renderCalendar();
});

// ---------- 초기화 ----------
(async function init() {
  const now = new Date();
  state.calYear = now.getFullYear();
  state.calMonth = now.getMonth();
  await Promise.all([loadPlans(), loadCerts()]);
  renderCalendar();
  renderLegend();
})();
