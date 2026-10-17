  const KEY = "odelis-tasks-v1";
  const LEGACY_KEY = "studyos-tasks-v1";
  const $ = id => document.getElementById(id);
  let tasks = load();
  let filter = "All";

  function load() {
    try {
      const current = localStorage.getItem(KEY);
      const old = current === null ? localStorage.getItem(LEGACY_KEY) : null;
      const data = JSON.parse(current ?? old ?? "[]");
      return Array.isArray(data) ? data.filter(t => t && typeof t.id === "string" && typeof t.title === "string").map(t => ({
        id: t.id, title: t.title, category: ["School","Acadeca","Personal","Project","Other","Sports"].includes(t.category) ? t.category : "Other",
        priority: ["High","Medium","Low"].includes(t.priority) ? t.priority : "Medium",
        deadline: typeof t.deadline === "string" ? t.deadline : "",
        duration: Number.isFinite(Number(t.duration)) ? Number(t.duration) : 30,
        done: Boolean(t.done)
      })) : [];
    } catch { return []; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(tasks)); return true; }
    catch { alert("Odelis could not save in this browser. Please export a backup before continuing."); return false; }
  }

  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  }

  function overdue(t) { return !t.done && t.deadline && t.deadline < todayString(); }

  $("today").textContent = new Date().toLocaleDateString(undefined, {weekday:"long", month:"long", day:"numeric"});
  if (localStorage.getItem(KEY) === null && localStorage.getItem(LEGACY_KEY) !== null) save();

  $("taskForm").addEventListener("submit", e => {
    e.preventDefault();
    const title = $("title").value.trim();
    if (!title) return;
    tasks.push({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(), title,
      category: $("category").value, priority:$("priority").value, deadline:$("deadline").value, duration:30, done:false});
    if (save()) { e.target.reset(); filter = "All"; render(); $("title").focus(); }
  });

  $("filters").addEventListener("click", e => {
    const button = e.target.closest("[data-filter]");
    if (!button) return;
    filter = button.dataset.filter;
    render();
  });

  $("tasks").addEventListener("change", e => {
    const cb = e.target.closest("[data-check]");
    if (!cb) return;
    const task = tasks.find(t => t.id === cb.dataset.check);
    if (!task) return;
    task.done = cb.checked;
    if (save()) render();
  });

  $("tasks").addEventListener("click", e => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    tasks = tasks.filter(t => t.id !== btn.dataset.delete);
    if (save()) render();
  });

  $("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({version:1,tasks},null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "odelis-backup.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("importButton").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.tasks) || !data.tasks.every(t => t && typeof t.id === "string" && typeof t.title === "string")) throw new Error("Invalid backup");
      if (!confirm("Replace your current Odelis tasks with this backup?")) return;
      const previous = tasks;
      tasks = data.tasks.map(t => ({id:t.id,title:t.title,category:t.category || "Other",priority:t.priority || "Medium",deadline:t.deadline || "",duration:Number(t.duration) || 30,done:Boolean(t.done)}));
      if (!save()) tasks = previous;
      render();
    } catch { alert("That file doesn't look like a valid Odelis task backup."); }
    finally { e.target.value = ""; }
  });

  function render() {
    const today = todayString();
    const active = tasks.filter(t => !t.done);
    $("total").textContent = active.length;
    $("due").textContent = active.filter(t => t.deadline === today).length;
    $("completed").textContent = tasks.filter(t => t.done).length;

    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
    const visible = tasks.filter(t => {
      if (filter === "Active") return !t.done;
      if (filter === "Completed") return t.done;
      if (filter === "Today") return !t.done && t.deadline === today;
      if (["School","Acadeca","Personal","Project","Other","Sports"].includes(filter)) return t.category === filter;
      return true;
    }).sort((a,b) => {
      if (a.done !== b.done) return Number(a.done)-Number(b.done);
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

    $("tasks").innerHTML = visible.length ? visible.map(t => `
      <div class="task ${t.done ? "done" : ""}">
        <input class="task-check" type="checkbox" data-check="${esc(t.id)}" aria-label="Mark ${esc(t.title)} complete" ${t.done ? "checked" : ""}>
        <div class="task-info"><div class="task-title">${esc(t.title)}</div>
          <div class="task-meta"><span class="priority ${t.priority === "High" ? "high" : ""}">${esc(t.priority || "Medium")}</span>${esc(t.category || "Other")}${t.deadline ? " · Due " + esc(t.deadline) : ""}${overdue(t) ? " · Overdue" : ""}</div>
        </div>
        <button class="delete" data-delete="${esc(t.id)}" aria-label="Delete ${esc(t.title)}" title="Delete task">×</button>
      </div>`).join("") : `<div class="empty"><div class="empty-symbol">∿</div>${filter === "All" ? "Nothing here just yet. Add a task above to begin." : "No tasks match this view. Try another filter or add a task."}</div>`;

    const rank = {High:0,Medium:1,Low:2};
    const orderedActive = [...active].sort((a,b) => {
      const ad = a.deadline || "9999-12-31";
      const bd = b.deadline || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
    });
    const nextSteps = orderedActive.slice(0, 3);
    $("overviewNextSteps").innerHTML = nextSteps.length ? nextSteps.map((t, index) => `
      <div class="overview-task-row">
        <span class="overview-task-number">${index + 1}</span>
        <div class="overview-task-copy"><div class="overview-task-title">${esc(t.title)}</div><div class="task-meta"><span class="priority ${t.priority === "High" ? "high" : ""}">${esc(t.priority || "Medium")}</span>${esc(t.category || "Other")}</div></div>
        <button class="text-button overview-complete" type="button" data-overview-complete="${esc(t.id)}" aria-label="Mark ${esc(t.title)} complete">Done</button>
      </div>`).join("") : `<div class="overview-empty"><strong>Room to breathe.</strong><span>No active tasks right now. Add one when you're ready.</span></div>`;

    const deadlineTasks = active.filter(t => t.deadline).sort((a,b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
    $("overviewDeadlines").innerHTML = deadlineTasks.length ? deadlineTasks.map(t => {
      const date = new Date(t.deadline + "T00:00:00");
      const dateLabel = t.deadline === today ? "Today" : t.deadline < today ? "Overdue" : date.toLocaleDateString(undefined, {month:"short",day:"numeric"});
      const status = t.deadline < today ? "overdue" : t.deadline === today ? "today" : "";
      return `<div class="overview-deadline-row"><div class="overview-deadline-date ${status}"><strong>${esc(dateLabel)}</strong><span>${esc(t.deadline < today ? "Needs attention" : t.deadline === today ? "Due today" : date.toLocaleDateString(undefined,{weekday:"short"}))}</span></div><div class="overview-deadline-title">${esc(t.title)}</div></div>`;
    }).join("") : `<div class="overview-empty"><strong>No deadlines set.</strong><span>Add a due date to a task to see it here.</span></div>`;

    const dueSoon = active.filter(t => t.deadline).sort((a,b) => a.deadline.localeCompare(b.deadline));
    $("plannerSummary").innerHTML = `<div class="stats" style="margin:20px 0 0"><div class="stat"><div class="stat-top">Active tasks</div><div class="stat-number">${active.length}</div></div><div class="stat"><div class="stat-top">Due today</div><div class="stat-number">${active.filter(t => t.deadline === today).length}</div></div><div class="stat"><div class="stat-top">Overdue</div><div class="stat-number">${active.filter(t => t.deadline && t.deadline < today).length}</div></div></div>`;

    const plannerView = $("plannerView").value;
    const plannerTasks = tasks.filter(t => plannerView === "all" ? true : plannerView === "completed" ? t.done : !t.done);
    plannerTasks.sort((a,b) => {
      if (a.done !== b.done) return Number(a.done)-Number(b.done);
      const ad = a.deadline || "9999-12-31";
      const bd = b.deadline || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      const rank = {High:0,Medium:1,Low:2};
      return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
    });
    $("plannerTasks").innerHTML = plannerTasks.length ? plannerTasks.map(t => `<div class="task ${t.done ? "done" : ""}"><input class="task-check" type="checkbox" data-check="${esc(t.id)}" aria-label="Mark ${esc(t.title)} complete" ${t.done ? "checked" : ""}><div class="task-info"><div class="task-title">${esc(t.title)}</div><div class="task-meta"><span class="priority ${t.priority === "High" ? "high" : ""}">${esc(t.priority || "Medium")}</span>${esc(t.category || "Other")}${t.deadline ? " · Due " + esc(t.deadline) : " · No due date"}${overdue(t) ? " · Overdue" : ""}</div></div><button class="delete" data-delete="${esc(t.id)}" aria-label="Delete ${esc(t.title)}" title="Delete task">×</button></div>`).join("") : `<div class="empty"><div class="empty-symbol">∿</div>${plannerView === "completed" ? "Completed tasks will appear here." : "Nothing to show yet. Add a task to begin planning."}</div>`;
  }

  function goTo(page) {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    document.querySelectorAll(".page-panel").forEach(p => p.classList.toggle("active", p.id === "page-" + page));
    $("sectionLabel").textContent = ({overview:"Your workspace",planner:"Plan with intention",library:"Ideas & references",learning:"Your learning space"})[page] || "Your workspace";
    window.scrollTo({top:0,behavior:"smooth"});
  }
  document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", () => goTo(b.dataset.page)));
  document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => goTo(b.dataset.goto)));
  $("focusButton").addEventListener("click", () => {
    const next = tasks.filter(t => !t.done).sort((a,b) => (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31"))[0];
    if (!next) { goTo("overview"); $("title").focus(); return; }
    goTo("planner");
    $("plannerView").value = "upcoming";
    render();
  });
  $("overviewNextSteps").addEventListener("click", event => {
    const button = event.target.closest("[data-overview-complete]");
    if (!button) return;
    const task = tasks.find(t => t.id === button.dataset.overviewComplete);
    if (!task) return;
    const previous = tasks;
    tasks = tasks.map(t => t.id === task.id ? {...t, done:true} : t);
    if (save()) render(); else tasks = previous;
  });
  $("plannerView").addEventListener("change", render);
  render();

  // Weekly schedule — stored separately from tasks and notes in this browser.
  const SCHEDULE_KEY = "odelis-schedule-v1";
  let schedule = loadSchedule();
  let weekOffset = 0;

  function loadSchedule() {
    try {
      const data = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || "[]");
      return Array.isArray(data) ? data.filter(b => b && typeof b.id === "string" && typeof b.title === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(b.date) && /^\\d{2}:\\d{2}$/.test(b.start) && /^\\d{2}:\\d{2}$/.test(b.end) && b.start < b.end).map(b => ({
        id:b.id, title:b.title.slice(0,120), date:b.date, start:b.start, end:b.end,
        category:["Study","Break","Activity","Other"].includes(b.category) ? b.category : "Other"
      })) : [];
    } catch { return []; }
  }

  function saveSchedule() {
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); return true; }
    catch { alert("Odelis could not save your schedule in this browser. Please remove some browser data or keep a separate note of your plans."); return false; }
  }

  function localDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }

  function dateFromString(value) {
    return new Date(value + "T12:00:00");
  }

  function weekStart(offset = weekOffset) {
    const date = new Date();
    date.setHours(12,0,0,0);
    date.setDate(date.getDate() - ((date.getDay()+6)%7) + offset*7);
    return date;
  }

  function weekDates(offset = weekOffset) {
    const start = weekStart(offset);
    return Array.from({length:7}, (_,i) => {
      const date = new Date(start);
      date.setDate(start.getDate()+i);
      return {date, key:localDateString(date)};
    });
  }

  function formatTime(value) {
    const [hour, minute] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(hour,minute,0,0);
    return date.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  }

  function resetScheduleForm() {
    $("scheduleForm").reset();
    $("scheduleId").value = "";
    $("scheduleDate").value = localDateString(new Date());
    $("scheduleStart").value = "16:00";
    $("scheduleEnd").value = "16:30";
    $("scheduleEditorSummary").textContent = "Add a time block";
    $("saveScheduleButton").textContent = "Add block";
    $("cancelScheduleEdit").hidden = true;
    $("scheduleStatus").textContent = "";
  }

  function renderSchedule() {
    const dates = weekDates();
    const first = dates[0].date;
    const last = dates[6].date;
    const monthFormat = {month:"short",day:"numeric"};
    $("weekRange").textContent = first.getMonth() === last.getMonth()
      ? `${first.toLocaleDateString(undefined,{month:"long"})} ${first.getDate()}–${last.getDate()}, ${last.getFullYear()}`
      : `${first.toLocaleDateString(undefined,monthFormat)} – ${last.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}`;
    const today = todayString();
    const weekItems = schedule.filter(item => dates.some(day => day.key === item.date)).sort((a,b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    $("weekGrid").innerHTML = dates.map(day => {
      const dayItems = weekItems.filter(item => item.date === day.key);
      return `<section class="week-day ${day.key === today ? "is-today" : ""}">
        <header class="week-day-head"><span>${day.date.toLocaleDateString(undefined,{weekday:"short"})}</span><strong>${day.date.getDate()}</strong></header>
        <div class="week-day-blocks">${dayItems.length ? dayItems.map(item => `<article class="schedule-block ${item.category.toLowerCase()}" title="${esc(item.title)}">
          <div class="schedule-block-time">${esc(formatTime(item.start))}–${esc(formatTime(item.end))}</div>
          <div class="schedule-block-title">${esc(item.title)}</div>
          <div class="schedule-block-type">${esc(item.category)}</div>
          <div class="schedule-block-actions"><button type="button" data-edit-block="${esc(item.id)}" aria-label="Edit ${esc(item.title)}">Edit</button><button type="button" data-delete-block="${esc(item.id)}" aria-label="Delete ${esc(item.title)}">×</button></div>
        </article>`).join("") : `<button class="day-empty" type="button" data-add-date="${day.key}">+ Add block</button>`}</div>
      </section>`;
    }).join("");

    $("agendaCount").textContent = `${weekItems.length} ${weekItems.length === 1 ? "block" : "blocks"}`;
    $("weekAgenda").innerHTML = weekItems.length ? weekItems.map(item => {
      const date = dateFromString(item.date);
      return `<article class="agenda-row">
        <div class="agenda-date"><strong>${esc(date.toLocaleDateString(undefined,{weekday:"short"}))}</strong><span>${esc(date.toLocaleDateString(undefined,{month:"short",day:"numeric"}))}</span></div>
        <div class="agenda-time">${esc(formatTime(item.start))}<span>to</span>${esc(formatTime(item.end))}</div>
        <span class="agenda-category ${item.category.toLowerCase()}">${esc(item.category)}</span>
        <div class="agenda-title">${esc(item.title)}</div>
        <div class="agenda-actions"><button class="text-button" type="button" data-edit-block="${esc(item.id)}">Edit</button><button class="text-button" type="button" data-delete-block="${esc(item.id)}">Delete</button></div>
      </article>`;
    }).join("") : `<div class="empty"><div class="empty-symbol">∿</div>No time blocks this week yet. Add one above to give a task or break a place in your schedule.</div>`;
  }

  $("scheduleForm").addEventListener("submit", event => {
    event.preventDefault();
    const title = $("scheduleTitle").value.trim();
    const date = $("scheduleDate").value;
    const start = $("scheduleStart").value;
    const end = $("scheduleEnd").value;
    if (!title || !date || !start || !end) return;
    if (start >= end) {
      $("scheduleStatus").textContent = "Choose an end time after the start time.";
      $("scheduleEnd").focus();
      return;
    }
    const id = $("scheduleId").value;
    const previous = schedule;
    const block = {id:id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random()),title,date,start,end,category:$("scheduleCategory").value};
    schedule = id ? schedule.map(item => item.id === id ? block : item) : [...schedule,block];
    if (saveSchedule()) {
      weekOffset = Math.round((dateFromString(date)-weekStart(0))/604800000);
      renderSchedule();
      resetScheduleForm();
      $("scheduleStatus").textContent = id ? "Block updated." : "Block added.";
    } else schedule = previous;
  });

  $("cancelScheduleEdit").addEventListener("click", resetScheduleForm);
  $("previousWeek").addEventListener("click", () => { weekOffset--; renderSchedule(); });
  $("nextWeek").addEventListener("click", () => { weekOffset++; renderSchedule(); });
  $("currentWeek").addEventListener("click", () => { weekOffset = 0; renderSchedule(); });
  $("weekGrid").addEventListener("click", event => {
    const add = event.target.closest("[data-add-date]");
    if (add) {
      resetScheduleForm();
      $("scheduleDate").value = add.dataset.addDate;
      $("scheduleTitle").focus();
      $("scheduleEditor").open = true;
      $("scheduleEditor").scrollIntoView({behavior:"smooth",block:"nearest"});
      return;
    }
    const edit = event.target.closest("[data-edit-block]");
    const remove = event.target.closest("[data-delete-block]");
    if (edit) editScheduleBlock(edit.dataset.editBlock);
    if (remove) deleteScheduleBlock(remove.dataset.deleteBlock);
  });
  $("weekAgenda").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-block]");
    const remove = event.target.closest("[data-delete-block]");
    if (edit) editScheduleBlock(edit.dataset.editBlock);
    if (remove) deleteScheduleBlock(remove.dataset.deleteBlock);
  });

  function editScheduleBlock(id) {
    const item = schedule.find(block => block.id === id);
    if (!item) return;
    $("scheduleId").value = item.id;
    $("scheduleTitle").value = item.title;
    $("scheduleDate").value = item.date;
    $("scheduleStart").value = item.start;
    $("scheduleEnd").value = item.end;
    $("scheduleCategory").value = item.category;
    $("scheduleEditorSummary").textContent = "Edit time block";
    $("saveScheduleButton").textContent = "Save changes";
    $("cancelScheduleEdit").hidden = false;
    $("scheduleEditor").open = true;
    $("scheduleTitle").focus();
    $("scheduleEditor").scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function deleteScheduleBlock(id) {
    const item = schedule.find(block => block.id === id);
    if (!item || !confirm(`Delete “${item.title}” from your schedule?`)) return;
    const previous = schedule;
    schedule = schedule.filter(block => block.id !== id);
    if (saveSchedule()) renderSchedule(); else schedule = previous;
  }

  resetScheduleForm();
  renderSchedule();


// Notes & Library — kept locally in this browser, separate from task data.
const NOTES_KEY = "odelis-notes-v1";
let notes = loadNotes();
let noteFilter = "All";

function loadNotes() {
  try {
    const data = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
    return Array.isArray(data) ? data.filter(n => n && typeof n.id === "string" && typeof n.title === "string").map(n => ({
      id: n.id,
      title: n.title.slice(0, 120),
      body: typeof n.body === "string" ? n.body.slice(0, 12000) : "",
      category: ["Ideas","School","Acadeca","Projects","Reading","Reference"].includes(n.category) ? n.category : "Ideas",
      pinned: Boolean(n.pinned),
      updatedAt: typeof n.updatedAt === "string" ? n.updatedAt : new Date().toISOString()
    })) : [];
  } catch { return []; }
}

function saveNotes() {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch {
    alert("Odelis could not save your notes in this browser. Please export a backup before continuing.");
    return false;
  }
}

function noteDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently edited" : date.toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"});
}

function resetNoteForm() {
  $("noteForm").reset();
  $("noteId").value = "";
  $("noteEditorHeading").textContent = "Capture a thought";
  $("saveNoteButton").textContent = "Save note";
  $("cancelNoteEdit").hidden = true;
  $("noteSaveStatus").textContent = "";
}

function renderNotes() {
  const query = $("noteSearch").value.trim().toLocaleLowerCase();
  const visible = notes.filter(note => {
    const matchesFilter = noteFilter === "All" || (noteFilter === "Pinned" ? note.pinned : note.category === noteFilter);
    const haystack = [note.title, note.body, note.category].join(" ").toLocaleLowerCase();
    return matchesFilter && haystack.includes(query);
  }).sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  $("noteCount").textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"} saved · ${notes.filter(n => n.pinned).length} pinned`;
  document.querySelectorAll("[data-note-filter]").forEach(button => button.classList.toggle("active", button.dataset.noteFilter === noteFilter));

  $("notesList").innerHTML = visible.length ? visible.map(note => `
    <article class="note-card ${note.pinned ? "is-pinned" : ""}">
      <div class="note-card-top"><span class="note-category-chip">${esc(note.category)}</span><span class="note-date">${esc(noteDate(note.updatedAt))}</span></div>
      <h3 class="note-card-title">${esc(note.title)}</h3>
      <p class="note-card-body">${esc(note.body || "An empty page, ready for a thought.")}</p>
      <div class="note-card-actions">
        <button class="text-button" type="button" data-edit-note="${esc(note.id)}">Edit</button>
        <button class="text-button" type="button" data-pin-note="${esc(note.id)}">${note.pinned ? "Unpin" : "Pin"}</button>
        <button class="text-button note-delete" type="button" data-delete-note="${esc(note.id)}">Delete</button>
      </div>
    </article>`).join("") : `<div class="notes-empty"><div class="empty-symbol">∿</div><strong>${query || noteFilter !== "All" ? "No notes found." : "A little space for your ideas."}</strong><span>${query || noteFilter !== "All" ? "Try a different search or collection." : "Write your first note above. It will be here when you return on this device."}</span></div>`;
}

$("noteForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("noteTitle").value.trim();
  if (!title) { $("noteTitle").focus(); return; }
  const existingId = $("noteId").value;
  const previous = notes;
  const existing = notes.find(n => n.id === existingId);
  const note = {
    id: existing ? existing.id : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    title,
    body: $("noteBody").value.trim(),
    category: $("noteCategory").value,
    pinned: $("notePinned").checked,
    updatedAt: new Date().toISOString()
  };
  notes = existing ? notes.map(n => n.id === existing.id ? note : n) : [note, ...notes];
  if (saveNotes()) {
    resetNoteForm();
    noteFilter = "All";
    $("noteSearch").value = "";
    renderNotes();
    $("noteSaveStatus").textContent = "Saved";
  } else { notes = previous; }
});

$("cancelNoteEdit").addEventListener("click", resetNoteForm);
$("noteSearch").addEventListener("input", renderNotes);
$("noteCollections").addEventListener("click", event => {
  const button = event.target.closest("[data-note-filter]");
  if (!button) return;
  noteFilter = button.dataset.noteFilter;
  renderNotes();
});

$("notesList").addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-note]");
  const pin = event.target.closest("[data-pin-note]");
  const remove = event.target.closest("[data-delete-note]");
  if (edit) {
    const note = notes.find(n => n.id === edit.dataset.editNote);
    if (!note) return;
    $("noteId").value = note.id;
    $("noteTitle").value = note.title;
    $("noteBody").value = note.body;
    $("noteCategory").value = note.category;
    $("notePinned").checked = note.pinned;
    $("noteEditorHeading").textContent = "Edit your thought";
    $("saveNoteButton").textContent = "Update note";
    $("cancelNoteEdit").hidden = false;
    $("noteTitle").focus();
    document.querySelector(".library-editor").scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  if (pin) {
    const previous = notes;
    notes = notes.map(n => n.id === pin.dataset.pinNote ? {...n, pinned:!n.pinned, updatedAt:new Date().toISOString()} : n);
    if (saveNotes()) renderNotes(); else notes = previous;
    return;
  }
  if (remove) {
    const note = notes.find(n => n.id === remove.dataset.deleteNote);
    if (!note || !confirm(`Delete “${note.title}”? This cannot be undone unless you have a backup.`)) return;
    const previous = notes;
    notes = notes.filter(n => n.id !== note.id);
    if (saveNotes()) renderNotes(); else notes = previous;
  }
});

$("exportNotes").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({version:1, exportedAt:new Date().toISOString(), notes}, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "odelis-notes-backup.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("importNotesButton").addEventListener("click", () => $("importNotesFile").click());
$("importNotesFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.notes) || !data.notes.every(n => n && typeof n.id === "string" && typeof n.title === "string")) throw new Error("Invalid notes backup");
    if (!confirm("Replace your current Odelis notes with this backup?")) return;
    const previous = notes;
    notes = data.notes.map(n => ({
      id:n.id, title:n.title.slice(0,120), body:typeof n.body === "string" ? n.body.slice(0,12000) : "",
      category:["Ideas","School","Acadeca","Projects","Reading","Reference"].includes(n.category) ? n.category : "Ideas",
      pinned:Boolean(n.pinned), updatedAt:typeof n.updatedAt === "string" ? n.updatedAt : new Date().toISOString()
    }));
    if (saveNotes()) { resetNoteForm(); renderNotes(); } else { notes = previous; }
  } catch { alert("That file doesn't look like a valid Odelis notes backup."); }
  finally { event.target.value = ""; }
});

renderNotes();
