// shuffle.js (Corrected Version — preserves correctIndex after option shuffle)

(function(){
  // Utility: Fisher–Yates shuffle
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Main hook used by exam-core.js
  window.shuffleQuestions = function(examData) {
    if (!examData || !examData.questions) return examData;

    examData.questions = examData.questions.map(q => {

      // 1️⃣ Store original correct option text BEFORE shuffle
      const originalCorrectText =
        q.options[q.correctIndex] || q.options[q.correct_index] || null;

      // 2️⃣ Shuffle the options
      const shuffled = shuffleArray(q.options);

      // 3️⃣ Find where the old correct text moved to
      const newCorrectIndex = shuffled.findIndex(opt => opt === originalCorrectText);

      return {
        ...q,
        options: shuffled,
        correctIndex: newCorrectIndex  // ⭐️ FIXED — correct answer ALWAYS tracked
      };
    });

    return examData;
  };
})();
