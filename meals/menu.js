/* ====================================================================
   Meal-prep weekly menu — renderer
   Reads numbers FROM recipes.json (never hardcoded). One shared script
   serves every week: the week number is derived from the URL path
   (/meals/w25/ -> 25) and the data is fetched relative to the page, so
   adding a week is just a new folder + its own recipes.json.
   ==================================================================== */
(function () {
  "use strict";

  /* per-recipe accent identity, cycled by index so the page never
     assumes a fixed recipe count. First three match the one-pager:
     tomato / cocoa / olive. */
  var ACCENTS = [
    { accent: "#c0392b", deep: "#8e2820" }, // tomato
    { accent: "#5a3b2e", deep: "#43291f" }, // cocoa
    { accent: "#6b7335", deep: "#4f5826" }, // olive
    { accent: "#5b8aa6", deep: "#3f6177" }, // sky (extra weeks)
    { accent: "#c98a2b", deep: "#9a6a1f" }  // amber (extra weeks)
  ];

  var MACROS = [
    { key: "kcal", label: "kcal", unit: "", decimals: 0 },
    { key: "protein_g", label: "Protein", unit: "g", decimals: 1 },
    { key: "fat_g", label: "Fat", unit: "g", decimals: 1 },
    { key: "carbs_g", label: "Carbs", unit: "g", decimals: 1 },
    { key: "fiber_g", label: "Fiber", unit: "g", decimals: 1 }
  ];

  /* cartoon seagull — recipe 1 only. Lifted verbatim from the one-pager.
     Bob animation is disabled under prefers-reduced-motion (see CSS). */
  var GULL_SVG =
    '<svg class="gull" viewBox="0 0 120 90" aria-hidden="true">' +
      '<g class="body">' +
        '<path d="M60 44 C40 26 22 24 8 32 C26 34 38 42 52 50 Z" fill="#fdfdfd" stroke="#2b2622" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<path d="M60 44 C80 26 98 24 112 32 C94 34 82 42 68 50 Z" fill="#fdfdfd" stroke="#2b2622" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<ellipse cx="60" cy="52" rx="16" ry="13" fill="#fdfdfd" stroke="#2b2622" stroke-width="2.4"/>' +
        '<circle cx="60" cy="34" r="10" fill="#fdfdfd" stroke="#2b2622" stroke-width="2.4"/>' +
        '<path d="M60 33 L74 36 L60 41 Z" fill="#e8a33d" stroke="#2b2622" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M68 37.5 L74 36 L69 39 Z" fill="#c0392b"/>' +
        '<circle cx="58" cy="31" r="2.1" fill="#2b2622"/>' +
        '<path d="M56 64 L55 72 M64 64 L65 72" stroke="#e8a33d" stroke-width="2.2" stroke-linecap="round"/>' +
      '</g>' +
    '</svg>';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function fmt(value, decimals) {
    if (typeof value !== "number" || isNaN(value)) return "–";
    return decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);
  }

  // "portion" -> "per portion", "half" -> "per half", "pancake" -> "per pancake"
  function basisLabel(unit) {
    return "per " + (unit || "portion");
  }

  function weekFromPath() {
    var m = location.pathname.match(/\/w(\d+)\b/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function macroRow(source, extraClass) {
    var row = el("div", "macros" + (extraClass ? " " + extraClass : ""));
    MACROS.forEach(function (m) {
      var cell = el("div", "macro" + (m.key === "kcal" ? " kcal" : ""));
      var v = source ? source[m.key] : undefined;
      cell.appendChild(
        el("div", "v", fmt(v, m.decimals) + (m.unit ? '<small>' + m.unit + "</small>" : ""))
      );
      cell.appendChild(el("div", "l", m.label));
      row.appendChild(cell);
    });
    return row;
  }

  function ingredientBlock(recipe, library) {
    if (!recipe.ingredients || !recipe.ingredients.length) return null;
    var details = el("details", "ingredients");
    var summary = el(
      "summary",
      null,
      '<span class="chev">›</span> ' + recipe.ingredients.length + " ingredients"
    );
    details.appendChild(summary);
    var list = el("ul", "ing-list");
    recipe.ingredients.forEach(function (ing) {
      var ref = library[ing.id];
      var name = ref ? ref.name : ing.id; // graceful fallback to the id
      list.appendChild(el("li", "ing-name", name));
      list.appendChild(el("li", "ing-g", (ing.grams != null ? ing.grams + " g" : "")));
    });
    details.appendChild(list);
    return details;
  }

  function recipeCard(recipe, index, library) {
    var palette = ACCENTS[index % ACCENTS.length];
    var card = el("article", "card");
    card.style.setProperty("--accent", palette.accent);
    card.style.setProperty("--accent-deep", palette.deep);

    if (index === 0) card.insertAdjacentHTML("afterbegin", GULL_SVG);

    var head = el("div", "card-head");
    head.appendChild(el("div", "num", String(index + 1)));
    var titleWrap = el("div", "title-wrap");
    var h2 = el("h2");
    h2.textContent = recipe.name;
    titleWrap.appendChild(h2);
    if (recipe.note) {
      var note = el("div", "note");
      note.textContent = recipe.note;
      titleWrap.appendChild(note);
    }
    head.appendChild(titleWrap);
    if (recipe.portions != null) {
      head.appendChild(el("div", "yield", "Makes " + recipe.portions));
    }
    card.appendChild(head);

    // hero: per portion (label respects portion_unit)
    card.appendChild(el("div", "basis portion", basisLabel(recipe.portion_unit)));
    card.appendChild(macroRow(recipe.per_portion));

    // secondary: per 100 g (raw basis)
    card.appendChild(el("div", "basis", "per 100 g"));
    card.appendChild(macroRow(recipe.per_100g_raw, "per100"));

    var ing = ingredientBlock(recipe, library);
    if (ing) card.appendChild(ing);

    return card;
  }

  function showState(root, html) {
    root.innerHTML = "";
    root.appendChild(el("div", "state", html));
  }

  function render(root, recipes, library) {
    root.innerHTML = "";
    recipes.forEach(function (recipe, i) {
      root.appendChild(recipeCard(recipe, i, library));
    });
  }

  function start() {
    var root = document.getElementById("recipes");
    if (!root) return;

    // week pill + document title from the route
    var week = weekFromPath();
    if (week != null) {
      var pill = document.getElementById("weekPill");
      if (pill) pill.textContent = "Week " + week;
      document.title = "Week " + week + " — The Prep Sheet";
    }

    // ingredients.json is shared across weeks (one folder up); recipes.json
    // is colocated with the page. Ingredients are best-effort — the cards
    // render fine without them.
    var recipesP = fetch("./recipes.json").then(function (r) {
      if (!r.ok) throw new Error("recipes " + r.status);
      return r.json();
    });
    var libP = fetch("../ingredients.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });

    Promise.all([recipesP, libP])
      .then(function (out) {
        var data = out[0];
        var recipes = (data && data.recipes) || [];
        var library = {};
        if (out[1] && out[1].ingredients) {
          out[1].ingredients.forEach(function (i) { library[i.id] = i; });
        }
        if (!recipes.length) {
          showState(root, "No recipes for this week yet.");
          return;
        }
        render(root, recipes, library);
      })
      .catch(function () {
        showState(
          root,
          "Couldn't load this week's menu. Expected a <code>recipes.json</code> next to this page."
        );
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
