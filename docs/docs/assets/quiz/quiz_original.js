// assets/quiz/quiz.js

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

/* --------------------------
   MCQ
-------------------------- */

function initMCQ(card) {
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

  const correctSnippet = card.querySelector(".solution-correct");

  // Generic wrong feedback (no data-i)
  const wrongSnippetGeneric = card.querySelector(".solution-wrong:not([data-i])");
  // Per-choice wrong feedback: <div class="solution-wrong" data-i="2">...</div>
  const wrongSnippets = new Map();
  card.querySelectorAll(".solution-wrong[data-i]").forEach(el => {
    const k = Number(el.dataset.i);
    if (Number.isFinite(k)) wrongSnippets.set(k, el.innerHTML);
  });

  const showSnippet = card.querySelector(".solution-show");

  function clearChoiceStyles() {
    choiceBtns.forEach(b => {
      b.classList.remove("selected", "correct", "wrong");
      b.setAttribute("aria-pressed", "false");
    });
  }

  function select(i) {
    selectedIndex = i;

    // Always reflect the *current* selection visually.
    // Also clears prior correct/wrong styling so the user can try again without pressing reset.
    choiceBtns.forEach(b => {
      b.classList.remove("selected", "correct", "wrong");
      b.setAttribute("aria-pressed", "false");
    });

    const btn = choiceBtns[i];
    if (!btn) return;

    btn.classList.add("selected");
    btn.setAttribute("aria-pressed", "true");
  }

  choiceBtns.forEach(btn => {
    btn.addEventListener("click", () => select(Number(btn.dataset.i)));
  });

  checkBtn.addEventListener("click", () => {
    if (selectedIndex === null) {
      setFeedback(fbEl, "⚠️ Pick an option first.", false);
      return;
    }

    // Clear any previous correct/wrong state, then apply to the *currently selected* option only
    choiceBtns.forEach(b => b.classList.remove("correct", "wrong"));

    const selBtn = choiceBtns[selectedIndex];
    if (!selBtn) return;

    if (selectedIndex === correctIndex) {
      selBtn.classList.add("correct");
      setFeedback(fbEl, correctSnippet?.innerHTML ?? "✅ Correct.", true);
    } else {
      selBtn.classList.add("wrong");
      const perChoice = wrongSnippets.get(selectedIndex);
      setFeedback(
        fbEl,
        perChoice ?? wrongSnippetGeneric?.innerHTML ?? "❌ Not quite. Try again.",
        false
      );
    }
  });

  showBtn?.addEventListener("click", () => {
    setFeedback(fbEl, showSnippet?.innerHTML ?? "Solution not provided.", true);
  });

  resetBtn.addEventListener("click", () => {
    selectedIndex = null;
    clearChoiceStyles();
    setFeedback(fbEl, 'Pick an option, then click <strong>Check</strong>.', null);
  });

  setFeedback(fbEl, 'Pick an option, then click <strong>Check</strong>.', null);
}


/* --------------------------
   Numeric
-------------------------- */

function initNumeric(card) {
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
  // data-units="\\,\\mathrm{m/s}" -> appended in feedback math
  const decimals = Number.isFinite(Number(card.dataset.decimals)) ? Number(card.dataset.decimals) : 3;
  const unitsLatex = card.dataset.units ?? ""; // should be latex-safe string

  const correctSnippet = card.querySelector(".solution-correct");
  const wrongSnippet   = card.querySelector(".solution-wrong");
  const showSnippet    = card.querySelector(".solution-show");

  function fmt(x) {
    return Number.isFinite(x) ? x.toFixed(decimals) : String(x);
  }

  function defaultCorrectHtml() {
    // Show the numeric answer in math mode so KaTeX formats units
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
      // If they provided a custom wrong snippet, use it; otherwise show their value.
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
   Init everything on a page
-------------------------- */

function initQuizzes() {
  // Render KaTeX in prompt + options up front
  renderAllMath();

  document.querySelectorAll(".quiz-mcq").forEach(initMCQ);
  document.querySelectorAll(".quiz-num").forEach(initNumeric);
}

window.initQuizzes = initQuizzes;

document.addEventListener("DOMContentLoaded", () => {
  initQuizzes();
  initQuizIframeAutoResize();
});

/* --------------------------
   Iframe auto-resize: post our height to the parent page
-------------------------- */

function postQuizIframeHeight() {
  // Only run when embedded in an iframe
  if (window.parent === window) return;

  const h = document.documentElement.scrollHeight;
  window.parent.postMessage({ type: "quiz-iframe-height", height: h }, "*");
}

function initQuizIframeAutoResize() {
  if (window.parent === window) return; // not in iframe

  let rafId = null;
  const schedulePost = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      postQuizIframeHeight();
    });
  };

  // Post once on load
  schedulePost();

  // Post whenever the document size changes (feedback, etc.)
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(schedulePost);
    ro.observe(document.body);               // better than documentElement
  }

  // Post when the iframe viewport changes (window resize)
  window.addEventListener("resize", schedulePost);

  // Fallback: also post after clicks (option select / check / reset)
  document.addEventListener("click", () => setTimeout(schedulePost, 0));
}
