// Auto-resize any iframe.quiz-iframe based on messages from the iframe content.
// Works with multiple quiz iframes on the same page.
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "quiz-iframe-height") return;

  const height = Number(data.height);
  if (!Number.isFinite(height) || height <= 0) return;

  document.querySelectorAll("iframe.quiz-iframe").forEach((iframe) => {
    if (iframe.contentWindow === event.source) {
      iframe.style.height = `${Math.ceil(height)}px`;
    }
  });
});
