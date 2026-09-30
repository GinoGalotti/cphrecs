/* ====================================================================
   Gym log — shared helpers (window.Gym): fetch wrapper, DOM helper,
   formatting, weight parsing, local "today", group chips, tab bar.
   Text is always inserted via textContent (exercise names are user data).
   ==================================================================== */
(function () {
  "use strict";

  var G = (window.Gym = {});

  /* ---------- DOM ---------- */
  // el("div", "cls", "text" | node | [nodes/strings])
  G.add = function (node, content) {
    if (content == null || content === false) return node;
    if (Array.isArray(content)) {
      content.forEach(function (c) { G.add(node, c); });
    } else if (content.nodeType) {
      node.appendChild(content);
    } else {
      node.appendChild(document.createTextNode(String(content)));
    }
    return node;
  };

  G.el = function (tag, cls, content) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return G.add(n, content);
  };

  G.clear = function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  /* ---------- API ---------- */
  // Resolves with the parsed JSON body; rejects with Error(message = server `error`), .status set.
  G.api = function (path, opts) {
    opts = opts || {};
    var init = { method: opts.method || "GET", headers: {} };
    if (opts.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    return fetch("/gymlog/api/" + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var e = new Error(data.error || "Request failed (" + r.status + ")");
          e.status = r.status;
          throw e;
        }
        return data;
      });
    });
  };

  /* ---------- numbers + dates ---------- */
  // 80 -> "80", 82.5 -> "82.5" (no trailing zeros)
  G.fmtKg = function (n) {
    if (n == null || isNaN(n)) return "–";
    return String(+Number(n).toFixed(2));
  };

  // "82,5" / "82.5" -> 82.5 ; invalid or negative -> null
  G.parseWeight = function (v) {
    var s = String(v == null ? "" : v).trim().replace(",", ".");
    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
    var n = Number(s);
    return isFinite(n) && n >= 0 ? n : null;
  };

  // Local (browser) calendar date as YYYY-MM-DD — never the server's UTC date.
  G.todayLocal = function () {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // "2026-09-12" -> "12 Sep" ; with weekday -> "Sat 12 Sep"
  G.fmtDate = function (iso, weekday) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return iso || "";
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return (weekday ? DAYS[d.getDay()] + " " : "") + d.getDate() + " " + MONTHS[d.getMonth()];
  };

  // [{reps, weight}] -> "80×8, 85×8"
  G.fmtSets = function (sets) {
    return sets.map(function (s) { return G.fmtKg(s.weight) + "×" + s.reps; }).join(", ");
  };

  /* ---------- group chips ---------- */
  var CHIP_LABELS = {
    "Horizontal Press": "H-Press",
    "Horizontal Pull": "H-Pull",
    "Vertical Press": "V-Press",
    "Vertical Pull": "V-Pull",
    "Squat": "Squat",
    "Hinge": "Hinge"
  };

  G.chip = function (groupName, color) {
    var label = CHIP_LABELS[groupName] || String(groupName || "").slice(0, 8);
    var c = G.el("span", "chip", label);
    if (color) c.style.setProperty("--chip", color);
    c.title = groupName || "";
    return c;
  };

  /* ---------- tab bar ---------- */
  var TABS = [
    { id: "log", label: "Log", href: "/gymlog/", icon: "M4 6h16M4 12h16M4 18h10" },
    { id: "new", label: "New", href: "/gymlog/new/", icon: "M12 5v14M5 12h14" },
    { id: "cycles", label: "Cycles", href: "/gymlog/cycles/", icon: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" },
    { id: "exercises", label: "Exercises", href: "/gymlog/exercises/", icon: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" }
  ];

  function tabBar() {
    var current = document.body.getAttribute("data-tab");
    var nav = G.el("nav", "tabbar");
    nav.setAttribute("aria-label", "Gym log");
    TABS.forEach(function (t) {
      var a = G.el("a");
      a.href = t.href;
      if (t.id === current) a.setAttribute("aria-current", "page");
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", t.icon);
      svg.appendChild(path);
      a.appendChild(svg);
      a.appendChild(G.el("span", null, t.label));
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  G.ready = function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  G.ready(tabBar);
})();
