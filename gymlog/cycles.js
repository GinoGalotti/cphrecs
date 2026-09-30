/* Cycles page: one card per movement group — active variation, 8-rep max, per-session
   trend (inline SVG), stall hint, inline rotate panel, collapsible history. */
(function () {
  "use strict";

  var el = Gym.el;
  var root = document.getElementById("app");
  var SVGNS = "http://www.w3.org/2000/svg";
  var STALL_TEXT = "Stalled · no new 8-rep max in 3 sessions";

  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  // Bars = each session's best 8-rep weight; null sessions render as an empty tick.
  function trendSvg(trend, color) {
    var pts = trend.slice(-14);
    var vals = pts.map(function (t) { return t.max; }).filter(function (v) { return v != null; });
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    var STEP = 22, BAR = 14, H = 66, BASE = 62;
    var s = svg("svg", { viewBox: "0 0 " + pts.length * STEP + " " + H, width: pts.length * STEP, role: "img" });
    s.setAttribute("aria-label", "8-rep max per session: " + pts.map(function (t) { return t.max == null ? "none" : Gym.fmtKg(t.max); }).join(", "));
    pts.forEach(function (t, i) {
      var x = i * STEP + (STEP - BAR) / 2;
      var g = svg("g");
      g.appendChild(svg("title")).textContent = Gym.fmtDate(t.date) + (t.max == null ? " · no 8-rep set" : " · " + Gym.fmtKg(t.max));
      if (t.max == null) {
        g.appendChild(svg("rect", { x: x, y: BASE - 3, width: BAR, height: 3, rx: 1.5, fill: "#cdbca0" }));
      } else {
        var h = max > min ? 14 + 30 * ((t.max - min) / (max - min)) : 30;
        g.appendChild(svg("rect", {
          x: x, y: BASE - h, width: BAR, height: h, rx: 3, fill: color,
          "fill-opacity": t.max === max ? 1 : 0.5
        }));
        var label = svg("text", { x: x + BAR / 2, y: BASE - h - 4 });
        label.textContent = Gym.fmtKg(t.max);
        g.appendChild(label);
      }
      s.appendChild(g);
    });
    return s;
  }

  function historyBlock(c) {
    var d = el("details", "history");
    d.appendChild(el("summary", null, [el("span", "chev", "›"), " Cycle history (" + c.history.length + ")"]));
    if (!c.history.length) {
      d.appendChild(el("p", "hint", "No closed cycles yet."));
      return d;
    }
    var table = el("table", "hist");
    table.appendChild(el("thead", null, el("tr", null, [
      el("th", null, "Variation"), el("th", null, "Period"),
      el("th", "num", "Sessions"), el("th", "num", "8-rep max")
    ])));
    var body = el("tbody");
    c.history.forEach(function (h) {
      body.appendChild(el("tr", null, [
        el("td", null, h.exercise_name),
        el("td", null, Gym.fmtDate(h.started_on) + " – " + Gym.fmtDate(h.ended_on)),
        el("td", "num", h.sessions),
        el("td", "num", h.eight_rep_max == null ? "–" : Gym.fmtKg(h.eight_rep_max))
      ]));
    });
    table.appendChild(body);
    d.appendChild(table);
    return d;
  }

  function rotatePanel(c, done) {
    var active = c.active ? c.active.exercise_id : null;
    var options = c.variations.filter(function (v) { return !v.archived && v.id !== active; });
    var panel = el("div", "rotpanel");
    var sel = el("select", "inp");
    sel.setAttribute("aria-label", "Next variation for " + c.group.name);
    options.forEach(function (v) {
      var o = el("option", null, v.name);
      o.value = v.id;
      if (v.id === c.next_exercise_id) o.selected = true;
      sel.appendChild(o);
    });
    var err = el("div", "error");
    err.hidden = true;
    var confirm = el("button", "btn primary small", "Confirm rotate");
    confirm.type = "button";
    var cancel = el("button", "btn small", "Cancel");
    cancel.type = "button";
    panel.appendChild(el("div", "field", [el("label", null, "Rotate to"), sel]));
    panel.appendChild(err);
    panel.appendChild(el("div", "actions", [confirm, cancel]));

    cancel.onclick = function () { panel.hidden = true; };
    confirm.onclick = function () {
      confirm.disabled = true;
      err.hidden = true;
      Gym.api("cycles/rotate", {
        method: "POST",
        body: { group_id: c.group.id, exercise_id: +sel.value, date: Gym.todayLocal() }
      }).then(done).catch(function (e) {
        confirm.disabled = false;
        err.textContent = e.message;
        err.hidden = false;
      });
    };
    panel.hidden = true;
    return { node: panel, canRotate: options.length > 0 };
  }

  function card(c, i, reload) {
    var a = c.active;
    var art = el("article", "card rise");
    art.style.setProperty("--accent", c.group.color);
    art.style.setProperty("--accent-deep", c.group.color);
    art.style.setProperty("--i", i);

    var head = el("div", "card-head");
    var tw = el("div", "title-wrap");
    tw.appendChild(el("div", null, Gym.chip(c.group.name, c.group.color)));
    var h2 = el("h2", null, a ? a.exercise_name : "No active variation");
    h2.style.marginTop = "8px";
    tw.appendChild(h2);
    if (a) {
      tw.appendChild(el("div", "note",
        "Since " + Gym.fmtDate(a.started_on) + " · " + a.sessions + (a.sessions === 1 ? " session" : " sessions") +
        (a.per_hand ? " · per hand" : "")));
    }
    head.appendChild(tw);

    var rot = rotatePanel(c, reload);
    var rotBtn = el("button", "btn small", "Rotate");
    rotBtn.type = "button";
    rotBtn.disabled = !rot.canRotate;
    rotBtn.setAttribute("aria-expanded", "false");
    rotBtn.onclick = function () {
      rot.node.hidden = !rot.node.hidden;
      rotBtn.setAttribute("aria-expanded", String(!rot.node.hidden));
    };
    head.appendChild(rotBtn);
    art.appendChild(head);

    if (a) {
      art.appendChild(el("div", "basis accent", "8-rep max"));
      var row = el("div", "bignum");
      var v = el("div", "v", a.eight_rep_max == null ? "–" : Gym.fmtKg(a.eight_rep_max));
      if (a.eight_rep_max != null) v.appendChild(el("small", null, a.per_hand ? "kg/db" : "kg"));
      row.appendChild(el("div", "bigbox", [v, el("div", "l", "This cycle")]));
      var trend = el("div", "trend");
      if (a.trend.length) trend.appendChild(trendSvg(a.trend, c.group.color));
      else trend.appendChild(el("p", "hint", "No sessions in this cycle yet."));
      row.appendChild(trend);
      art.appendChild(row);
      if (a.stalled) art.appendChild(el("p", null, el("span", "badge warn", STALL_TEXT))).style.marginTop = "12px";
    }

    art.appendChild(rot.node);
    art.appendChild(historyBlock(c));
    return art;
  }

  function load() {
    return Gym.api("cycles").then(function (data) {
      Gym.clear(root);
      data.cycles.forEach(function (c, i) { root.appendChild(card(c, i, load)); });
    }).catch(function (e) {
      Gym.clear(root);
      root.appendChild(el("div", "error", "Couldn't load cycles: " + e.message));
    });
  }

  Gym.ready(load);
})();
