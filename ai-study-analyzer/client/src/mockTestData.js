// Mock Test Data for Testing the Test Interface
// This file contains sample test data for multiple subjects and topics

export const mockTests = {
  'test-001': {
    id: 'test-001',
    title: 'Biology: Cell Structure and Function',
    subject: 'Biology',
    topic: 'Cell Structure and Function',
    difficulty: 'medium',
    duration: 30, // in minutes
    totalMarks: 40,
    createdAt: new Date().toISOString(),
    questions: [
      // MCQ Questions
      {
        id: 'q1',
        type: 'mcq',
        marks: 1,
        question: 'Which organelle is responsible for producing energy in the cell?',
        options: [
          'A. Nucleus',
          'B. Mitochondria',
          'C. Ribosome',
          'D. Golgi Apparatus'
        ],
        correctAnswer: 'B',
        explanation: 'Mitochondria is the powerhouse of the cell as it produces ATP (energy) through cellular respiration.'
      },
      {
        id: 'q2',
        type: 'mcq',
        marks: 1,
        question: 'What is the primary function of the cell membrane?',
        options: [
          'A. Protein synthesis',
          'B. Control of substances entering and leaving the cell',
          'C. Storage of genetic information',
          'D. Production of ATP'
        ],
        correctAnswer: 'B',
        explanation: 'The cell membrane (plasma membrane) acts as a selectively permeable barrier that controls the movement of substances between the cell and its environment.'
      },
      {
        id: 'q3',
        type: 'mcq',
        marks: 1,
        question: 'Which of the following is found only in plant cells?',
        options: [
          'A. Chloroplast',
          'B. Centriole',
          'C. Mitochondria',
          'D. Ribosome'
        ],
        correctAnswer: 'A',
        explanation: 'Chloroplasts are found only in plant cells and are responsible for photosynthesis.'
      },
      {
        id: 'q4',
        type: 'mcq',
        marks: 1,
        question: 'What does the nucleus contain?',
        options: [
          'A. Ribosomes and enzymes',
          'B. Genetic material (DNA)',
          'C. Proteins and lipids',
          'D. ATP molecules'
        ],
        correctAnswer: 'B',
        explanation: 'The nucleus contains the cell\'s genetic material (DNA) enclosed within a nuclear membrane.'
      },
      {
        id: 'q5',
        type: 'mcq',
        marks: 1,
        question: 'Which organelle is responsible for sorting and packaging proteins?',
        options: [
          'A. Endoplasmic Reticulum',
          'B. Mitochondria',
          'C. Golgi Apparatus',
          'D. Ribosome'
        ],
        correctAnswer: 'C',
        explanation: 'The Golgi Apparatus modifies, packages, and sorts proteins received from the ER before transport to their final destinations.'
      },

      // Short Answer Questions
      {
        id: 'q6',
        type: 'shortAnswer',
        marks: 3,
        question: 'Explain the difference between prokaryotic and eukaryotic cells.',
        correctAnswer: 'Prokaryotic cells lack a membrane-bound nucleus and organelles, found in bacteria and archaea. Eukaryotic cells have a true nucleus and membrane-bound organelles, found in animals, plants, and fungi.',
        explanation: 'This is a fundamental classification of cells. Key differences include nucleus presence, organelle presence, size, and complexity of internal organization.'
      },
      {
        id: 'q7',
        type: 'shortAnswer',
        marks: 3,
        question: 'What is the role of ribosomes in protein synthesis?',
        correctAnswer: 'Ribosomes read mRNA sequences and translate them into amino acid chains, synthesizing proteins according to genetic instructions.',
        explanation: 'Ribosomes are the site of protein synthesis, where mRNA is read and translated into polypeptide chains.'
      },
      {
        id: 'q8',
        type: 'shortAnswer',
        marks: 3,
        question: 'How does the endoplasmic reticulum function in the cell?',
        correctAnswer: 'Rough ER synthesizes proteins with ribosomes, while smooth ER synthesizes lipids and stores calcium. Both transport materials throughout the cell.',
        explanation: 'The ER is crucial for synthesis and transport of cellular materials, with rough and smooth ER serving different functions.'
      },

      // Long Answer Questions
      {
        id: 'q9',
        type: 'longAnswer',
        marks: 5,
        question: 'Describe the structure and function of mitochondria, and explain why it is crucial for cellular metabolism.',
        correctAnswer: 'Mitochondria has a double membrane structure with an outer membrane, inner membrane, cristae, and matrix. It contains enzymes for the citric acid cycle and electron transport chain. It produces ATP through aerobic respiration. The large surface area from cristae increases ATP production efficiency. It is crucial because it provides energy (ATP) needed for all cellular processes including muscle contraction, ion pumping, biosynthesis, and transport.',
        explanation: 'A comprehensive answer should include structural features, metabolic processes (aerobic respiration), ATP production mechanism, and the importance of ATP for cell survival and function.'
      },
      {
        id: 'q10',
        type: 'longAnswer',
        marks: 5,
        question: 'Explain how different organelles work together to synthesize and export a protein from a eukaryotic cell.',
        correctAnswer: 'Protein synthesis begins at ribosomes on rough ER membrane. The protein is synthesized with a signal sequence directing it into the ER lumen. The ER transports the protein in vesicles to the Golgi Apparatus. The Golgi modifies, folds, and packages the protein. Transport vesicles carry the processed protein to the cell membrane. Vesicles fuse with the plasma membrane, releasing the protein outside the cell through exocytosis. This process involves coordination between nucleus (DNA), ribosomes, ER, Golgi, and vesicular transport.',
        explanation: 'This describes the secretory pathway, one of the most important processes in eukaryotic cells, involving multiple organelles working in sequence.'
      }
    ]
  },

  'test-002': {
    id: 'test-002',
    title: 'Mathematics: Algebra Fundamentals',
    subject: 'Mathematics',
    topic: 'Algebra Fundamentals',
    difficulty: 'easy',
    duration: 20,
    totalMarks: 30,
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        marks: 1,
        question: 'Solve: 2x + 5 = 13',
        options: [
          'A. x = 2',
          'B. x = 4',
          'C. x = 6',
          'D. x = 8'
        ],
        correctAnswer: 'B',
        explanation: '2x + 5 = 13 → 2x = 8 → x = 4'
      },
      {
        id: 'q2',
        type: 'mcq',
        marks: 1,
        question: 'What is the coefficient of x in the expression 3x² + 5x - 2?',
        options: [
          'A. 3',
          'B. 5',
          'C. -2',
          'D. 2'
        ],
        correctAnswer: 'B',
        explanation: 'The coefficient of x is the number that multiplies x, which is 5.'
      },
      {
        id: 'q3',
        type: 'shortAnswer',
        marks: 3,
        question: 'Expand: (x + 3)(x - 2)',
        correctAnswer: 'x² + x - 6',
        explanation: '(x + 3)(x - 2) = x² - 2x + 3x - 6 = x² + x - 6'
      }
    ]
  },

  'test-003': {
    id: 'test-003',
    title: 'History: World War II',
    subject: 'History',
    topic: 'World War II',
    difficulty: 'hard',
    duration: 40,
    totalMarks: 50,
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        marks: 2,
        question: 'In which year did World War II begin?',
        options: [
          'A. 1937',
          'B. 1939',
          'C. 1941',
          'D. 1945'
        ],
        correctAnswer: 'B',
        explanation: 'World War II began on September 1, 1939, when Germany invaded Poland.'
      },
      {
        id: 'q2',
        type: 'mcq',
        marks: 2,
        question: 'Who was the Prime Minister of Britain during most of World War II?',
        options: [
          'A. Neville Chamberlain',
          'B. Winston Churchill',
          'C. Clement Attlee',
          'D. Stanley Baldwin'
        ],
        correctAnswer: 'B',
        explanation: 'Winston Churchill served as Prime Minister of Britain from 1940 to 1945, leading the country through most of WWII.'
      },
      {
        id: 'q3',
        type: 'longAnswer',
        marks: 10,
        question: 'Analyze the major causes of World War II and how they related to the outcome of World War I.',
        correctAnswer: 'WWII causes stemmed from WWI consequences: 1) Treaty of Versailles imposed harsh reparations on Germany, creating economic hardship and resentment. 2) Territorial changes created nationalist tensions. 3) Rise of fascism in Italy and Germany as response to economic depression. 4) Failure of League of Nations to prevent aggression. 5) Appeasement policies failed to stop expansion. 6) Arms race among nations. The harsh peace terms from WWI directly motivated WWII, showing how punitive post-war settlements can lead to future conflicts.',
        explanation: 'A strong answer should connect WWII causes to WWI consequences, discuss economic and political factors, and show understanding of how historical events are interconnected.'
      }
    ]
  }
};

// Function to get a mock test by ID
export const getMockTest = (testId) => {
  return mockTests[testId] || null;
};

// Function to get all mock test summaries
export const getMockTestSummaries = () => {
  return Object.values(mockTests).map(test => ({
    id: test.id,
    title: test.title,
    subject: test.subject,
    topic: test.topic,
    difficulty: test.difficulty,
    duration: test.duration,
    totalMarks: test.totalMarks,
    questionCount: test.questions.length
  }));
};

// Mock evaluation results for testing
export const mockEvaluationResult = {
  testId: 'test-001',
  studentId: 'student-001',
  timeTaken: 28,
  submittedAt: new Date().toISOString(),
  evaluations: [
    {
      questionIndex: 0,
      score: 1,
      isCorrect: true,
      feedback: 'Correct! You identified mitochondria as the powerhouse of the cell.',
      suggestions: 'Great understanding of cell organelles.'
    },
    {
      questionIndex: 1,
      score: 1,
      isCorrect: true,
      feedback: 'Correct! The cell membrane controls substance transport.',
      suggestions: 'Continue to focus on membrane function.'
    },
    {
      questionIndex: 2,
      score: 0,
      isCorrect: false,
      feedback: 'Incorrect. Centrioles are found only in animal cells, not plant cells. Chloroplasts are unique to plant cells.',
      suggestions: 'Review the differences between plant and animal cells.'
    },
    {
      questionIndex: 3,
      score: 1,
      isCorrect: true,
      feedback: 'Correct! The nucleus contains genetic material.',
      suggestions: 'Excellent understanding of nuclear function.'
    },
    {
      questionIndex: 4,
      score: 1,
      isCorrect: true,
      feedback: 'Correct! The Golgi Apparatus packages and sorts proteins.',
      suggestions: 'Strong grasp of the secretory pathway.'
    }
  ],
  overallFeedback: 'Good performance overall. You have a solid understanding of cell structure and organelle functions.',
  weakAreas: ['Plant vs Animal Cell Differences'],
  recommendations: [
    'Review the unique features of plant cells (chloroplasts, cell wall)',
    'Study organelle locations in different cell types',
    'Continue practicing with short and long answer questions'
  ],
  performanceMetrics: {
    totalScore: 4,
    maxScore: 5,
    percentage: 80,
    performanceLevel: 'strong',
    correctAnswers: 4,
    totalQuestions: 5
  }
};
