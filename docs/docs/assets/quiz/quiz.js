// assets/quiz/quiz.js
//
// Features:
// - MCQ: per-choice wrong feedback via <div class="solution-wrong" data-i="...">...</div>
// - MCQ: does NOT auto-highlight the correct choice when the user is wrong
// - MCQ: can try multiple answers without pressing Reset (select -> check -> select -> check ...)
// - Quiz decks: multiple questions in one iframe with Previous/Next + "Question X of N"
// - Iframe auto-resize helper: posts height to parent and responds to parent height requests
//
// Authoring a deck (recommended):
// <div class="quiz-deck" data-src="q1.html,q2.html,q3.html"></div>
// Each q*.html can remain a full standalone HTML file; this script will fetch it and extract the first .quiz-mcq or .quiz-num card.

function renderAllMath(root = document.body) {
  if (!window.renderMathInElement) return;
  renderMathInElement(root, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$",  right: "$",  display: false },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false
  });
}

/* --------------------------
   Helpers
-------------------------- */

function setFeedback(fbEl, html, okState) {
  fbEl.classList.remove("ok", "bad");
  if (okState === true) fbEl.classList.add("ok");
  if (okState === false) fbEl.classList.add("bad");

  fbEl.innerHTML = html;
  renderAllMath(fbEl);
  postQuizIframeHeightSoon();
}

// Parse the first numeric token from a string.
// Accepts things like: "17.3", "17.3 m/s", "1.2e-3", "-.5"
function parseNumberLoose(s) {
  const str = (s ?? "").trim();
  const m = str.match(/[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?/);
  if (!m) return { ok: false, msg: "Enter a numeric value." };
  const x = Number(m[0]);
  if (!Number.isFinite(x)) return { ok: false, msg: "Enter a numeric value." };
  return { ok: true, x };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/* --------------------------
   MCQ
-------------------------- */

function initMCQ(card) {
  if (card.dataset.initialized === "1") return;
  card.dataset.initialized = "1";

  const choicesBox = card.querySelector(".choices");
  const choiceBtns = Array.from(card.querySelectorAll(".choice"));
  const fbEl = card.querySelector(".feedback");

  const checkBtn = card.querySelector('[data-action="check"]');
  const showBtn  = card.querySelector('[data-action="show"]');
  const resetBtn = card.querySelector('[data-action="reset"]');

  if (!choicesBox || !choiceBtns.length || !fbEl || !checkBtn || !resetBtn) {
    console.warn("MCQ quiz missing required elements:", card);
    return;
  }

  const correctIndex = Number(choicesBox.dataset.correct);
  let selectedIndex = null;
  let hasChecked = false;

  // Solution snippets
  const correctSnippet = card.querySelector(".solution-correct");
  const showSnippet    = card.querySelector(".solution-show");

  // Per-choice wrong snippets:
  //   <div class="solution-wrong" data-i="0">...</div>
  // plus optional generic fallback:
  //   <div class="solution-wrong">...</div>
  const wrongByIndex = new Map();
  let wrongFallback = null;

  card.querySelectorAll(".solution-wrong").forEach(el => {
    const di = el.getAttribute("data-i");
    if (di != null && di !== "") {
      const idx = Number(di);
      if (Number.isFinite(idx)) wrongByIndex.set(idx, el.innerHTML);
    } else {
      // first fallback wins
      if (wrongFallback == null) wrongFallback = el.innerHTML;
    }
  });

  function clearChoiceStyles() {
    choiceBtns.forEach(b => {
      b.classList.remove("selected", "correct", "wrong");
      b.setAttribute("aria-pressed", "false");
    });
  }

  function setDefaultPrompt() {
    setFeedback(fbEl, 'Pick an option, then click <strong>Check</strong>.', null);
  }

  function select(i) {
    selectedIndex = i;

    // When changing selection after a check, clear the old evaluation styling
    if (hasChecked) {
      choiceBtns.forEach(b => b.classList.remove("correct", "wrong"));
      setDefaultPrompt();
      hasChecked = false;
    }

    choiceBtns.forEach(b => b.classList.remove("selected"));
    const btn = choiceBtns[i];
    if (!btn) return;

    btn.classList.add("selected");
    choiceBtns.forEach(b => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    postQuizIframeHeightSoon();
  }

  choiceBtns.forEach(btn => {
    btn.addEventListener("click", () => select(Number(btn.dataset.i)));
  });

  checkBtn.addEventListener("click", () => {
    if (selectedIndex === null) {
      setFeedback(fbEl, "⚠️ Pick an option first.", false);
      return;
    }

    hasChecked = true;

    // Style only the selected choice (do NOT auto-highlight the correct choice)
    choiceBtns.forEach(b => b.classList.remove("correct", "wrong"));
    const selBtn = choiceBtns[selectedIndex];
    if (selBtn) {
      selBtn.classList.add(selectedIndex === correctIndex ? "correct" : "wrong");
    }

    if (selectedIndex === correctIndex) {
      setFeedback(fbEl, correctSnippet?.innerHTML ?? "✅ Correct.", true);
    } else {
      const specific = wrongByIndex.get(selectedIndex);
      setFeedback(
        fbEl,
        specific ?? wrongFallback ?? "❌ Not quite. Try another option.",
        false
      );
    }
  });

  // showBtn?.addEventListener("click", () => {
  //   setFeedback(fbEl, showSnippet?.innerHTML ?? "Solution not provided.", true);
  // });
  
  showBtn?.addEventListener("click", () => {
  // If your MCQ uses "locked", unlock so the user can keep interacting
  locked = false;
  selectedIndex = null;

  // Remove any previous selection / wrong / correct styling
  clearChoiceStyles();

  // Highlight ONLY the correct option in green
  if (choiceBtns[correctIndex]) {
    choiceBtns[correctIndex].classList.add("correct");
  }

  // Show solution text
  setFeedback(fbEl, showSnippet?.innerHTML ?? "Solution not provided.", true);

  // Optional: if you have a post-height function for the iframe, call it here
  // postQuizIframeHeight?.();
});


  resetBtn.addEventListener("click", () => {
    selectedIndex = null;
    hasChecked = false;
    clearChoiceStyles();
    setDefaultPrompt();
  });

  setDefaultPrompt();
}

/* --------------------------
   Numeric
-------------------------- */

function initNumeric(card) {
  if (card.dataset.initialized === "1") return;
  card.dataset.initialized = "1";

  const fbEl = card.querySelector(".feedback");
  const input = card.querySelector('input[type="text"], input[type="number"]');

  const checkBtn = card.querySelector('[data-action="check"]');
  const showBtn  = card.querySelector('[data-action="show"]');
  const resetBtn = card.querySelector('[data-action="reset"]');

  if (!fbEl || !input || !checkBtn || !resetBtn) {
    console.warn("Numeric quiz missing required elements:", card);
    return;
  }

  // Required on the card:
  // data-answer="17.3205" data-tol="0.15"
  const answer = Number(card.dataset.answer);
  const tol = Number(card.dataset.tol);

  // Optional:
  // data-decimals="3"  -> how many decimals to show in feedback
  // data-units="\,\mathrm{m/s}" -> appended in feedback math
  const decimals = Number.isFinite(Number(card.dataset.decimals)) ? Number(card.dataset.decimals) : 3;
  const unitsLatex = card.dataset.units ?? "";

  const correctSnippet = card.querySelector(".solution-correct");
  const wrongSnippet   = card.querySelector(".solution-wrong");
  const showSnippet    = card.querySelector(".solution-show");

  function fmt(x) {
    return Number.isFinite(x) ? x.toFixed(decimals) : String(x);
  }

  function defaultCorrectHtml() {
    const units = unitsLatex ? unitsLatex : "";
    return String.raw`✅ Correct. Your answer $${fmt(answer)}${units}$$ is within tolerance.`;
  }

  function defaultWrongHtml(x) {
    const units = unitsLatex ? unitsLatex : "";
    return String.raw`❌ Not quite. You entered $${fmt(x)}${units}$$. Try again.`;
  }

  checkBtn.addEventListener("click", () => {
    const parsed = parseNumberLoose(input.value);
    if (!parsed.ok) {
      setFeedback(fbEl, `⚠️ ${parsed.msg}`, false);
      return;
    }

    const x = parsed.x;
    const ok = Math.abs(x - answer) <= tol;

    if (ok) {
      setFeedback(fbEl, correctSnippet?.innerHTML ?? defaultCorrectHtml(), true);
    } else {
      setFeedback(fbEl, wrongSnippet?.innerHTML ?? defaultWrongHtml(x), false);
    }
  });

  showBtn?.addEventListener("click", () => {
    setFeedback(fbEl, showSnippet?.innerHTML ?? String.raw`Answer: $${fmt(answer)}${unitsLatex}$$.`, true);
  });

  resetBtn.addEventListener("click", () => {
    input.value = "";
    setFeedback(fbEl, 'Enter your answer, then click <strong>Check</strong>.', null);
    input.focus();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkBtn.click();
  });

  setFeedback(fbEl, 'Enter your answer, then click <strong>Check</strong>.', null);
}

/* --------------------------
   Quiz Decks (Prev/Next + progress)
-------------------------- */

async function loadCardFromHtml(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Prefer these:
  const card = doc.querySelector(".card.quiz-mcq, .card.quiz-num") ||
               doc.querySelector(".quiz-mcq, .quiz-num") ||
               doc.querySelector(".card");

  if (!card) throw new Error(`No .quiz-mcq/.quiz-num/.card found in ${url}`);
  const imported = document.importNode(card, true);

  // Make sure it has .card so it uses existing styles
  if (!imported.classList.contains("card")) imported.classList.add("card");
  return imported;
}

function buildDeckNav(total) {
  const nav = document.createElement("div");
  nav.className = "quiz-deck-nav";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "quiz-deck-prev";
  prev.textContent = "Previous";

  const prog = document.createElement("div");
  prog.className = "quiz-deck-progress";
  prog.textContent = `Question 1 of ${total}`;

  const next = document.createElement("button");
  next.type = "button";
  next.className = "quiz-deck-next";
  next.textContent = "Next";

  nav.appendChild(prev);
  nav.appendChild(prog);
  nav.appendChild(next);

  return { nav, prev, next, prog };
}

function showOnly(cards, idx) {
  cards.forEach((c, i) => {
    const on = i === idx;
    c.hidden = !on;
    c.style.display = on ? "" : "none";
  });
}

function updateNavState(prev, next, prog, idx, total) {
  prev.disabled = idx <= 0;
  next.disabled = idx >= total - 1;
  prog.textContent = `Question ${idx + 1} of ${total}`;
}

async function initQuizDeck(deck) {
  if (deck.dataset.initialized === "1") return;
  deck.dataset.initialized = "1";

  // Ensure deck layout doesn't fight .card max-width
  deck.classList.add("quiz-deck");

  // Stage: where cards live
  const stage = document.createElement("div");
  stage.className = "quiz-deck-stage";
  deck.appendChild(stage);

  // Collect cards
  let cards = [];

  const srcAttr = (deck.dataset.src ?? "").trim();
  if (srcAttr) {
    // Show a lightweight loading indicator
    const loading = document.createElement("div");
    loading.className = "muted";
    loading.textContent = "Loading questions…";
    stage.appendChild(loading);

    const urls = srcAttr.split(",").map(s => s.trim()).filter(Boolean);
    const loaded = [];
    for (const url of urls) {
      try {
        const card = await loadCardFromHtml(url);
        loaded.push(card);
      } catch (e) {
        console.warn(e);
      }
    }

    stage.innerHTML = "";
    loaded.forEach(c => stage.appendChild(c));
    cards = loaded;
  } else {
    // Inline mode: user placed cards directly inside deck
    cards = Array.from(deck.querySelectorAll(".card.quiz-mcq, .card.quiz-num, .quiz-mcq, .quiz-num, .card"));
    cards.forEach(c => stage.appendChild(c));
  }

  // Filter to cards that look like quizzes (MCQ/Numeric)
  cards = cards.filter(c => c.classList.contains("quiz-mcq") || c.classList.contains("quiz-num"));
  if (!cards.length) {
    stage.innerHTML = '<div class="muted">No quiz questions found in this deck.</div>';
    postQuizIframeHeightSoon();
    return;
  }

  // Insert nav above stage
  const { nav, prev, next, prog } = buildDeckNav(cards.length);
  deck.insertBefore(nav, stage);

  // Init quizzes in this deck (idempotent)
  renderAllMath(deck);
  cards.forEach(card => {
    if (card.classList.contains("quiz-mcq")) initMCQ(card);
    if (card.classList.contains("quiz-num")) initNumeric(card);
  });

  // Show the first question
  let idx = clamp(Number(deck.dataset.start ?? 1) - 1, 0, cards.length - 1);
  showOnly(cards, idx);
  updateNavState(prev, next, prog, idx, cards.length);
  postQuizIframeHeightSoon();

  function go(newIdx) {
    idx = clamp(newIdx, 0, cards.length - 1);
    showOnly(cards, idx);
    updateNavState(prev, next, prog, idx, cards.length);
    // Re-render math in case the question uses KaTeX and was injected
    renderAllMath(cards[idx]);
    postQuizIframeHeightSoon();
  }

  prev.addEventListener("click", () => go(idx - 1));
  next.addEventListener("click", () => go(idx + 1));

  // Optional keyboard support when focused inside the deck:
  deck.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(idx - 1);
    if (e.key === "ArrowRight") go(idx + 1);
  });
}

function initQuizDecks() {
  document.querySelectorAll(".quiz-deck").forEach(initQuizDeck);
}

/* --------------------------
   Iframe auto-resize (iframe -> parent)
-------------------------- */

let __quizHeightRAF = null;

function postQuizIframeHeightSoon() {
  if (window.parent === window) return; // not in an iframe
  if (__quizHeightRAF) return;

  __quizHeightRAF = requestAnimationFrame(() => {
    __quizHeightRAF = null;
    const h = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: "quiz-iframe-height", height: h }, "*");
  });
}

function initQuizIframeAutoResize() {
  if (window.parent === window) return;

  // Parent can request height (e.g., on window resize)
  window.addEventListener("message", (event) => {
    if (event.data?.type === "quiz-iframe-request-height") {
      postQuizIframeHeightSoon();
    }
  });

  // Content changes
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => postQuizIframeHeightSoon());
    ro.observe(document.body);
  }

  // Viewport changes within iframe
  window.addEventListener("resize", () => postQuizIframeHeightSoon());

  // Initial
  postQuizIframeHeightSoon();
  setTimeout(postQuizIframeHeightSoon, 0);
  setTimeout(postQuizIframeHeightSoon, 50);
}

/* --------------------------
   Init everything on a page
-------------------------- */

function initQuizzes(root = document) {
  renderAllMath(root);
  root.querySelectorAll(".quiz-mcq").forEach(initMCQ);
  root.querySelectorAll(".quiz-num").forEach(initNumeric);
}

window.initQuizzes = initQuizzes;

document.addEventListener("DOMContentLoaded", () => {
  initQuizIframeAutoResize();
  initQuizDecks();
  initQuizzes(document);
  postQuizIframeHeightSoon();
});
