// ================================================================
// shuffle.js — FINAL BULLETPROOF VERSION (2025)
// ---------------------------------------------------------------
//  ✓ Preserves correctIndex after shuffling
//  ✓ Handles "A. text", "A ) text", "A- text", etc.
//  ✓ Robust fallback when option text is modified by LLM
//  ✓ Protects against malformed option arrays
// ================================================================

(function(){

  // ------------------------------------------------------------
  // Utility: Remove leading "A. ", "B)", "C:", "D -", etc.
  // ------------------------------------------------------------
  function normalizeOptionText(opt) {
    if (!opt) return "";
    return opt
      .toString()
      .trim()
      .replace(/^[A-Da-d][\.\)\-:\s]+/, "") // remove A.  B)  C-  etc.
      .trim()
      .toLowerCase();
  }

  // ------------------------------------------------------------
  // Fisher–Yates Shuffle
  // ------------------------------------------------------------
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ------------------------------------------------------------
  // Main Hook Called by exam-core.js
  // ------------------------------------------------------------
  window.shuffleQuestions = function(examData) {
    if (!examData || !Array.isArray(examData.questions)) return examData;

    examData.questions = examData.questions.map(q => {
      if (!q.options || q.options.length !== 4) return q;

      // --- 1. Get correct option using letter index ---
      const oldCorrectIndex = q.correctIndex ?? q.correct_index ?? -1;
      const originalOption = q.options[oldCorrectIndex] || null;

      // Normalize original for reliable matching
      const normalizedOriginal = normalizeOptionText(originalOption);

      // --- 2. Shuffle options ---
      const shuffled = shuffleArray(q.options);

      // --- 3. Locate new correct index (smart matching) ---
      let newCorrectIndex = shuffled.findIndex(opt =>
        normalizeOptionText(opt) === normalizedOriginal
      );

      // --- Fallback: If matching fails, default to first option ---
      if (newCorrectIndex === -1) {
        console.warn("⚠️ shuffle.js: Correct option fallback triggered for Q:", q);
        newCorrectIndex = 0;
      }

      // --- 4. Return updated question object ---
      return {
        ...q,
        options: shuffled,
        correctIndex: newCorrectIndex
      };
    });

    return examData;
  };

})();
