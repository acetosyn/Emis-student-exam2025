// shuffle.js (Extension for exam-core)

(function(){
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  window.shuffleQuestions = function(examData) {
    if (!examData || !examData.questions) return examData;

    examData.questions = examData.questions.map(q => {
      const shuffled = shuffleArray(q.options);
      return {
        ...q,
        options: shuffled,
        // keep answer as text, correctness resolved by exam-core.js -> getCorrectIndex()
        answer: q.answer
      };
    });

    return examData;
  };
})();
// End of shuffle.js