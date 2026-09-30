/* Exercises page: list by movement group / Auxiliary / Archived, add form, inline edit. */
(function () {
  "use strict";

  var el = Gym.el;
  var root = document.getElementById("app");
  var groups = [];

  function checkbox(label, checked) {
    var input = el("input");
    input.type = "checkbox";
    input.checked = !!checked;
    return { input: input, node: el("label", "check", [input, label]) };
  }

  function textInput(value, mode) {
    var i = el("input", "inp");
    i.type = "text";
    i.value = value == null ? "" : value;
    if (mode) i.setAttribute("inputmode", mode);
    i.autocomplete = "off";
    return i;
  }

  function field(label, input) {
    return el("div", "field", [el("label", null, label), input]);
  }

  /* ---------- add form ---------- */
  function addForm(reload) {
    var det = el("details", "card details-card");
    det.style.setProperty("--accent", "var(--rust)");
    det.appendChild(el("summary", null, "+ Add exercise"));
    var form = el("form", "addform");
    form.style.marginTop = "10px";
    var name = textInput("");
    name.placeholder = "e.g. Cable fly";
    name.required = true;
    var cyc = checkbox("Cycling exercise (rotates in a movement group)", false);
    var grp = el("select", "inp");
    groups.forEach(function (g) {
      var o = el("option", null, g.name);
      o.value = g.id;
      grp.appendChild(o);
    });
    grp.disabled = true;
    var hand = checkbox("Per hand (dumbbell weight)", false);
    var wt = textInput("0", "decimal");
    var err = el("div", "error");
    err.hidden = true;
    var submit = el("button", "btn primary", "Add exercise");
    submit.type = "submit";

    cyc.input.onchange = function () { grp.disabled = !cyc.input.checked; };
    form.appendChild(field("Name", name));
    form.appendChild(cyc.node);
    form.appendChild(field("Movement group", grp));
    form.appendChild(hand.node);
    form.appendChild(field("Starting weight (kg)", wt));
    form.appendChild(err);
    form.appendChild(submit);

    form.onsubmit = function (ev) {
      ev.preventDefault();
      err.hidden = true;
      submit.disabled = true;
      Gym.api("exercises", {
        method: "POST",
        body: {
          name: name.value,
          is_cycling: cyc.input.checked,
          group_id: cyc.input.checked ? +grp.value : null,
          per_hand: hand.input.checked,
          starting_weight: wt.value
        }
      }).then(reload).catch(function (e) {
        submit.disabled = false;
        err.textContent = e.message;
        err.hidden = false;
      });
    };
    det.appendChild(form);
    return det;
  }

  /* ---------- rows ---------- */
  function editForm(ex, reload, cancel) {
    var form = el("form", "editform");
    var name = textInput(ex.name);
    name.required = true;
    var hand = checkbox("Per hand (dumbbell weight)", ex.per_hand);
    var wt = textInput(Gym.fmtKg(ex.starting_weight), "decimal");
    var arch = checkbox("Archived (hidden from dropdowns, kept in history)", ex.archived);
    var err = el("div", "error");
    err.hidden = true;
    var save = el("button", "btn primary small", "Save");
    save.type = "submit";
    var cancelBtn = el("button", "btn small", "Cancel");
    cancelBtn.type = "button";
    cancelBtn.onclick = cancel;

    form.appendChild(field("Name", name));
    form.appendChild(el("div", "fields", [hand.node, field("Starting weight (kg)", wt)]));
    form.appendChild(arch.node);
    form.appendChild(err);
    form.appendChild(el("div", "actions", [save, cancelBtn]));

    form.onsubmit = function (ev) {
      ev.preventDefault();
      err.hidden = true;
      save.disabled = true;
      Gym.api("exercises/" + ex.id, {
        method: "PUT",
        body: { name: name.value, per_hand: hand.input.checked, starting_weight: wt.value, archived: arch.input.checked }
      }).then(reload).catch(function (e) {
        save.disabled = false;
        err.textContent = e.message;
        err.hidden = false;
      });
    };
    return form;
  }

  function item(ex, reload) {
    var wrap = el("div");
    function view() {
      Gym.clear(wrap);
      var row = el("div", "exitem");
      row.appendChild(el("span", "nm", ex.name));
      if (ex.is_active_variation) row.appendChild(el("span", "badge ok", "Active"));
      if (ex.per_hand) row.appendChild(el("span", "tag", "per hand"));
      if (ex.archived && ex.group_name) row.appendChild(Gym.chip(ex.group_name, ex.group_color));
      row.appendChild(el("span", "wt", ex.starting_weight ? "start " + Gym.fmtKg(ex.starting_weight) + " kg" : ""));
      var edit = el("button", "btn small", "Edit");
      edit.type = "button";
      edit.onclick = function () {
        Gym.clear(wrap);
        wrap.appendChild(editForm(ex, reload, view));
      };
      row.appendChild(edit);
      wrap.appendChild(row);
    }
    view();
    return wrap;
  }

  function section(title, chip, color, items, reload, i) {
    var card = el("section", "card rise");
    card.style.setProperty("--accent", color);
    card.style.setProperty("--accent-deep", color === "var(--ink-soft)" ? "var(--ink)" : color);
    card.style.setProperty("--i", i);
    card.appendChild(el("h3", "group-title", chip ? [chip, title] : title));
    items.forEach(function (ex) { card.appendChild(item(ex, reload)); });
    return card;
  }

  function render(exercises, reload) {
    Gym.clear(root);
    root.appendChild(addForm(reload));
    var live = exercises.filter(function (e) { return !e.archived; });
    var n = 0;
    groups.forEach(function (g) {
      var items = live.filter(function (e) { return e.is_cycling && e.group_id === g.id; });
      if (items.length) root.appendChild(section(g.name, Gym.chip(g.name, g.color), g.color, items, reload, n++));
    });
    var aux = live.filter(function (e) { return !e.is_cycling; });
    if (aux.length) root.appendChild(section("Auxiliary", null, "var(--ink-soft)", aux, reload, n++));

    var archived = exercises.filter(function (e) { return e.archived; });
    if (archived.length) {
      var det = el("details", "card details-card");
      det.style.setProperty("--accent", "var(--muted)");
      det.appendChild(el("summary", null, "Archived (" + archived.length + ")"));
      archived.forEach(function (ex) { det.appendChild(item(ex, reload)); });
      root.appendChild(det);
    }
  }

  function load() {
    return Promise.all([Gym.api("groups"), Gym.api("exercises?include_archived=1")])
      .then(function (r) {
        groups = r[0].groups;
        render(r[1].exercises, load);
      })
      .catch(function (e) {
        Gym.clear(root);
        root.appendChild(el("div", "error", "Couldn't load exercises: " + e.message));
      });
  }

  Gym.ready(load);
})();
