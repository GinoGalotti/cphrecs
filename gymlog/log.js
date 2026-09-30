/* Log page: reverse-chronological sessions, ★ on new cycle maxes, "Load older" paging. */
(function () {
  "use strict";

  var el = Gym.el;
  var root = document.getElementById("app");
  var list, moreWrap, cursor = null, shown = 0;

  function exerciseLine(ex) {
    var row = el("div", "ex");
    var name = el("span", "nm");
    if (ex.is_cycling && ex.group_name) name.appendChild(Gym.chip(ex.group_name, ex.color));
    name.appendChild(document.createTextNode(ex.name + (ex.per_hand ? " (per hand)" : "")));
    row.appendChild(name);

    var sets = el("span", "st", "— ");
    ex.sets.forEach(function (s, i) {
      if (i) sets.appendChild(document.createTextNode(", "));
      var txt = Gym.fmtKg(s.weight) + "×" + s.reps;
      if (s.is_cycle_pr) sets.appendChild(el("b", "pr", "★ " + txt));
      else sets.appendChild(document.createTextNode(txt));
    });
    row.appendChild(sets);
    return row;
  }

  function sessionCard(s, i) {
    var first = s.exercises.filter(function (e) { return e.is_cycling && e.color; })[0];
    var a = el("a", "card session rise");
    a.href = "/gymlog/new/?id=" + s.id;
    a.style.setProperty("--accent", first ? first.color : "var(--ink-soft)");
    a.style.setProperty("--i", Math.min(i, 8));

    var head = el("div", "card-head");
    head.appendChild(el("div", "title-wrap", el("div", "date", Gym.fmtDate(s.date, true))));
    if (s.template_name) head.appendChild(el("div", "tmpl", s.template_name));
    a.appendChild(head);

    s.exercises.forEach(function (ex) { a.appendChild(exerciseLine(ex)); });
    if (s.notes) a.appendChild(el("p", "snotes", s.notes));
    return a;
  }

  function load() {
    var qs = "sessions?limit=30";
    if (cursor) qs += "&before=" + encodeURIComponent(cursor.date) + "&before_id=" + cursor.id;
    return Gym.api(qs).then(function (data) {
      data.sessions.forEach(function (s) { list.appendChild(sessionCard(s, shown++)); });
      cursor = data.has_more ? { date: data.next_before, id: data.next_before_id } : null;
      Gym.clear(moreWrap);
      if (cursor) {
        var btn = el("button", "btn", "Load older");
        btn.type = "button";
        btn.onclick = function () {
          btn.disabled = true;
          load().catch(function (e) { btn.disabled = false; showError(e); });
        };
        moreWrap.appendChild(btn);
      }
      if (!shown) {
        list.appendChild(el("div", "state empty", "No sessions yet. Log your first one."));
      }
    });
  }

  function showError(e) {
    root.appendChild(el("div", "error", "Couldn't load the log: " + e.message));
  }

  function start() {
    var top = el("div", "topbar");
    var cta = el("a", "btn primary", "Log session →");
    cta.href = "/gymlog/new/";
    top.appendChild(cta);
    list = el("div", "sessions");
    moreWrap = el("div", "more");
    Gym.clear(root);
    root.appendChild(top);
    root.appendChild(list);
    root.appendChild(moreWrap);
    load().catch(showError);
  }

  Gym.ready(start);
})();
