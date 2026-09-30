/* New / edit session (/gymlog/new/ , /gymlog/new/?id=123).
   State lives in `st`; inputs write into it directly (no re-render while typing),
   structural changes re-render. Every change is autosaved to localStorage. */
(function () {
  "use strict";

  var el = Gym.el;
  var root = document.getElementById("app");
  var editId = new URLSearchParams(location.search).get("id");
  var DRAFT_KEY = "gymlog:draft:" + (editId || "new");

  var cat = { exercises: [], groups: [], templates: [] };
  var groupById = {};
  var st = null;        // {date, templateId, notes, rows:[row], formError}
  var restored = false; // draft banner
  var keySeq = 0;

  /* ---------- draft (localStorage, always try/catch) ---------- */
  function readDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      return d && typeof d.date === "string" && Array.isArray(d.rows) ? d : null;
    } catch (e) { return null; }
  }
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        date: st.date, templateId: st.templateId, notes: st.notes, rows: st.rows
      }));
    } catch (e) { /* storage unavailable */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- rows ---------- */
  function setStr(s) { return { reps: String(s.reps), weight: Gym.fmtKg(s.weight) }; }

  function rowFromDefaults(d) {
    return {
      key: ++keySeq, slotGroupId: d.slot_group_id, exercise: d.exercise,
      activeId: d.active_exercise_id, isActive: d.is_active_variation,
      sets: d.sets.map(setStr), lastTime: d.last_time, cycleMax: d.cycle_max, error: ""
    };
  }

  function rowFromSession(e) {
    var g = groupById[e.group_id];
    var stamped = e.sets.some(function (s) { return s.cycle_id != null; });
    return {
      key: ++keySeq, slotGroupId: e.is_cycling ? e.group_id : null,
      exercise: { id: e.exercise_id, name: e.name, per_hand: e.per_hand, is_cycling: e.is_cycling, group_id: e.group_id },
      activeId: g ? g.active_exercise_id : null,
      isActive: stamped || !!(g && g.active_exercise_id === e.exercise_id),
      sets: e.sets.map(setStr), lastTime: null, cycleMax: null, error: ""
    };
  }

  function fetchRow(exerciseId, slotGroupId) {
    var q = "defaults?exercise_id=" + exerciseId + "&date=" + encodeURIComponent(st.date);
    if (slotGroupId) q += "&slot_group_id=" + slotGroupId;
    return Gym.api(q).then(rowFromDefaults);
  }

  function loadTemplate(id) {
    if (!id) { st.rows = []; render(); return Promise.resolve(); }
    return Gym.api("defaults?template_id=" + id + "&date=" + encodeURIComponent(st.date)).then(function (d) {
      st.rows = d.rows.map(rowFromDefaults);
      render();
    });
  }

  /* ---------- exercise dropdown ---------- */
  function optionGroups(firstGroupId) {
    var ex = cat.exercises;
    var out = [];
    function cycling(g) {
      return ex.filter(function (e) { return e.is_cycling && e.group_id === g.id; });
    }
    var aux = { label: "Auxiliary", items: ex.filter(function (e) { return !e.is_cycling; }) };
    var first = firstGroupId ? groupById[firstGroupId] : null;
    if (first) out.push({ label: first.name, items: cycling(first) });
    else out.push(aux);
    cat.groups.forEach(function (g) {
      if (!first || g.id !== first.id) out.push({ label: g.name, items: cycling(g) });
    });
    if (first) out.push(aux);
    return out;
  }

  function exerciseSelect(row, onPick) {
    var sel = el("select", "inp");
    sel.setAttribute("aria-label", "Exercise");
    var firstGroup = row ? (row.slotGroupId || (row.exercise.is_cycling ? row.exercise.group_id : null)) : null;
    var known = false;
    var groupsEl = optionGroups(firstGroup).map(function (g) {
      var og = el("optgroup");
      og.label = g.label;
      g.items.forEach(function (e) {
        var o = el("option", null, e.name);
        o.value = e.id;
        if (row && e.id === row.exercise.id) { o.selected = true; known = true; }
        og.appendChild(o);
      });
      return og;
    });
    if (row && !known) { // archived exercise from a saved session
      var o = el("option", null, row.exercise.name + " (archived)");
      o.value = row.exercise.id;
      o.selected = true;
      sel.appendChild(o);
    }
    if (!row) {
      var ph = el("option", null, "+ Add exercise");
      ph.value = "";
      ph.selected = true;
      sel.appendChild(ph);
    }
    groupsEl.forEach(function (og) { if (og.children.length) sel.appendChild(og); });
    sel.onchange = function () { if (sel.value) onPick(+sel.value, sel); };
    return sel;
  }

  /* ---------- rendering ---------- */
  function setRow(row, si, grid) {
    var s = row.sets[si];
    var reps = el("input", "inp");
    reps.type = "text";
    reps.setAttribute("inputmode", "numeric");
    reps.setAttribute("aria-label", "Set " + (si + 1) + " reps");
    reps.value = s.reps;
    reps.onfocus = function () { reps.select(); };
    reps.oninput = function () { s.reps = reps.value; saveDraft(); };

    var w = el("input", "inp");
    w.type = "text";
    w.setAttribute("inputmode", "decimal");
    w.setAttribute("aria-label", "Set " + (si + 1) + (row.exercise.per_hand ? " kg per dumbbell" : " kg"));
    w.value = s.weight;
    w.onfocus = function () { w.select(); };
    w.oninput = function () { s.weight = w.value; saveDraft(); };

    var rm = el("button", "iconbtn", "×");
    rm.type = "button";
    rm.setAttribute("aria-label", "Remove set " + (si + 1));
    rm.onclick = function () { row.sets.splice(si, 1); saveDraft(); render(); };

    grid.appendChild(el("div", "n", si + 1));
    grid.appendChild(reps);
    grid.appendChild(w);
    grid.appendChild(rm);
  }

  function rowCard(row, i) {
    var ex = row.exercise;
    var g = groupById[ex.group_id];
    var card = el("article", "card exrow");
    card.style.setProperty("--accent", ex.is_cycling && g ? g.color : "var(--ink-soft)");

    var head = el("div", "card-head");
    var pick = el("div", "pick");
    if (ex.is_cycling && g) pick.appendChild(Gym.chip(g.name, g.color));
    pick.appendChild(exerciseSelect(row, function (id, sel) {
      sel.disabled = true;
      fetchRow(id, row.slotGroupId).then(function (nr) {
        st.rows[i] = nr;
        saveDraft();
        render();
      }).catch(function (e) { row.error = e.message; render(); });
    }));
    head.appendChild(el("div", "title-wrap", pick));
    var del = el("button", "iconbtn", "×");
    del.type = "button";
    del.setAttribute("aria-label", "Remove " + ex.name);
    del.onclick = function () { st.rows.splice(i, 1); saveDraft(); render(); };
    head.appendChild(del);
    card.appendChild(head);

    if (ex.is_cycling && !row.isActive) {
      card.appendChild(el("p", "warnnote", "Not the active variation, won't count toward the cycle"));
    }
    var hints = [];
    if (row.lastTime) hints.push(["Last time ", Gym.fmtDate(row.lastTime.date) + " · " + Gym.fmtSets(row.lastTime.sets)]);
    if (row.cycleMax != null) hints.push(["Cycle max ", Gym.fmtKg(row.cycleMax) + (ex.per_hand ? " kg/db" : " kg")]);
    hints.forEach(function (h) { card.appendChild(el("p", "hint", [h[0], el("b", null, h[1])])); });

    var grid = el("div", "sets");
    ["Set", "Reps", ex.per_hand ? "Kg / dumbbell" : "Kg", ""].forEach(function (t) { grid.appendChild(el("div", "lab", t)); });
    row.sets.forEach(function (_, si) { setRow(row, si, grid); });
    card.appendChild(grid);

    var add = el("button", "btn small addset", "+ Add set");
    add.type = "button";
    add.onclick = function () {
      var last = row.sets[row.sets.length - 1];
      row.sets.push(last ? { reps: last.reps, weight: last.weight } : { reps: "8", weight: "0" });
      saveDraft();
      render();
    };
    card.appendChild(add);
    if (row.error) card.appendChild(el("div", "error", row.error));
    return card;
  }

  function payload() {
    return {
      date: st.date,
      template_id: st.templateId || null,
      notes: st.notes,
      exercises: st.rows.map(function (r) {
        return { exercise_id: r.exercise.id, sets: r.sets.map(function (s) { return { reps: s.reps, weight: s.weight }; }) };
      })
    };
  }

  function save(btn) {
    st.formError = "";
    st.rows.forEach(function (r) { r.error = ""; });
    btn.disabled = true;
    var req = editId
      ? Gym.api("sessions/" + editId, { method: "PUT", body: payload() })
      : Gym.api("sessions", { method: "POST", body: payload() });
    req.then(function () {
      clearDraft();
      location.href = "/gymlog/";
    }).catch(function (e) {
      // "exercises[1].sets[2]: reps must…" -> shown on row 2 as "Set 3: reps must…"
      var m = /^exercises\[(\d+)\][.:]?\s*(.*)$/.exec(e.message);
      if (m && st.rows[+m[1]]) {
        st.rows[+m[1]].error = m[2].replace(/^sets\[(\d+)\]:\s*/, function (_, n) { return "Set " + (+n + 1) + ": "; });
      }
      else st.formError = e.message;
      render();
      var first = document.querySelector(".error");
      if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function remove(btn) {
    if (!window.confirm("Delete this session? This can't be undone.")) return;
    btn.disabled = true;
    Gym.api("sessions/" + editId, { method: "DELETE" }).then(function () {
      clearDraft();
      location.href = "/gymlog/";
    }).catch(function (e) {
      btn.disabled = false;
      st.formError = e.message;
      render();
    });
  }

  function render() {
    Gym.clear(root);

    if (restored) {
      var discard = el("button", "link", "Discard");
      discard.type = "button";
      discard.onclick = function () { clearDraft(); location.reload(); };
      var close = el("button", "iconbtn", "×");
      close.type = "button";
      close.setAttribute("aria-label", "Dismiss");
      close.onclick = function () { restored = false; render(); };
      root.appendChild(el("div", "banner", [el("span", null, "Restored unsaved session"), discard, close]));
    }

    // date + template
    var date = el("input", "inp");
    date.type = "date";
    date.value = st.date;
    date.onchange = function () { if (date.value) { st.date = date.value; saveDraft(); } };
    var tsel = el("select", "inp");
    tsel.setAttribute("aria-label", "Template");
    var none = el("option", null, "No template");
    none.value = "";
    tsel.appendChild(none);
    cat.templates.forEach(function (t) {
      var o = el("option", null, t.name);
      o.value = t.id;
      if (t.id === st.templateId) o.selected = true;
      tsel.appendChild(o);
    });
    tsel.onchange = function () {
      st.templateId = tsel.value ? +tsel.value : null;
      saveDraft();
      if (editId) return; // editing keeps its rows; only the label changes
      tsel.disabled = true;
      loadTemplate(st.templateId).then(saveDraft).catch(function (e) { st.formError = e.message; render(); });
    };
    root.appendChild(el("div", "panel", [
      el("div", "field", [el("label", null, "Date"), date]),
      el("div", "field", [el("label", null, "Template"), tsel])
    ]));

    st.rows.forEach(function (row, i) { root.appendChild(rowCard(row, i)); });
    if (!st.rows.length) root.appendChild(el("div", "state empty", "No exercises yet. Add one below."));

    // append an exercise
    var addSel = exerciseSelect(null, function (id, sel) {
      sel.disabled = true;
      fetchRow(id, null).then(function (nr) { st.rows.push(nr); saveDraft(); render(); })
        .catch(function (e) { st.formError = e.message; render(); });
    });
    root.appendChild(el("div", "addrow", addSel));

    // notes
    var notes = el("textarea", "inp");
    notes.setAttribute("aria-label", "Notes");
    notes.placeholder = "How did it feel?";
    notes.value = st.notes || "";
    notes.oninput = function () { st.notes = notes.value; saveDraft(); };
    root.appendChild(el("div", "field", [el("label", null, "Notes (optional)"), notes]));

    if (st.formError) root.appendChild(el("div", "error", st.formError));

    // sticky save bar
    var saveBtn = el("button", "btn primary", editId ? "Save changes" : "Save session");
    saveBtn.type = "button";
    saveBtn.onclick = function () { save(saveBtn); };
    var bar = el("div", "savebar", saveBtn);
    if (editId) {
      var delBtn = el("button", "btn danger", "Delete");
      delBtn.type = "button";
      delBtn.onclick = function () { remove(delBtn); };
      bar.appendChild(delBtn);
    }
    root.appendChild(bar);
  }

  /* ---------- boot ---------- */
  function fail(msg) {
    Gym.clear(root);
    root.appendChild(el("div", "error", msg));
  }

  function start() {
    var title = document.getElementById("pageTitle");
    if (editId) {
      if (title) title.textContent = "Edit session";
      document.title = "Edit session — Gym log";
    }

    var loads = [Gym.api("groups"), Gym.api("exercises"), Gym.api("templates")];
    if (editId) loads.push(Gym.api("sessions/" + editId));

    Promise.all(loads).then(function (r) {
      cat.groups = r[0].groups;
      cat.exercises = r[1].exercises;
      cat.templates = r[2].templates;
      cat.groups.forEach(function (g) { groupById[g.id] = g; });

      var draft = readDraft();
      if (draft) {
        st = { date: draft.date, templateId: draft.templateId, notes: draft.notes || "", rows: draft.rows, formError: "" };
        st.rows.forEach(function (row) { keySeq = Math.max(keySeq, row.key || 0); row.error = ""; });
        restored = true;
        render();
        return;
      }

      if (editId) {
        var s = r[3].session;
        st = { date: s.date, templateId: s.template_id, notes: s.notes || "", rows: s.exercises.map(rowFromSession), formError: "" };
        render();
        return;
      }

      st = { date: Gym.todayLocal(), templateId: r[2].default_template_id, notes: "", rows: [], formError: "" };
      return loadTemplate(st.templateId);
    }).catch(function (e) {
      if (e.status === 404 && editId) fail("That session doesn't exist (it may have been deleted).");
      else fail("Couldn't load the form: " + e.message);
    });
  }

  Gym.ready(start);
})();
