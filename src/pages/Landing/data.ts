// Static content for the landing page.

export type DemoTab = "steps" | "practice";

export const PERCENT_STEPS: { step: string; tip: string }[] = [
  {
    step: 'The equation is in the form $ax^2 + bx + c = 0$, so we can factor.$$2x^2 - 5x - 3 = 0$$Here $a = 2$, $b = -5$, $c = -3$.',
    tip: "Spotting a, b, and c first means you'll never lose track of which number goes where in the next steps.",
  },
  {
    step: 'Multiply $a \\times c = 2 \\times (-3) = -6$.\nFind two numbers that **multiply to −6** and **add to −5**.\nThose numbers are $-6$ and $+1$. ✓',
    tip: "Looking for a pair that multiplies to a×c and adds to b is the whole trick behind splitting the middle term.",
  },
  {
    step: 'Split the middle term using $-6x + x$:$$2x^2 - 6x + x - 3 = 0$$',
    tip: "Splitting −5x into −6x + x doesn't change the equation — it just sets things up so we can group in pairs.",
  },
  {
    step: 'Group and factor each pair:$$2x(x-3) + 1(x-3) = 0$$$$(2x+1)(x-3) = 0$$',
    tip: "Notice both groups share the factor (x − 3) — that's what lets you pull it out and combine everything into one product.",
  },
  {
    step: 'Set each factor to zero and solve:$$2x + 1 = 0 \\implies x = -\\tfrac{1}{2}$$$$x - 3 = 0 \\implies x = 3$$',
    tip: "Each bracket can equal zero on its own — solve them separately and you'll land on both roots.",
  },
];

export const PERCENT_PRACTICE: { q: string; options: string[]; correct: number; explanation: string }[] = [
  {
    q: "Solve x² − x − 6 = 0",
    options: ["x = 2 or −3", "x = −2 or 3", "x = 1 or −6", "x = 3 or 6"],
    correct: 1,
    explanation: "Factor as (x − 3)(x + 2) = 0, giving x = 3 or x = −2.",
  },
  {
    q: "Solve 3x² + 5x − 2 = 0",
    options: ["x = 1/3 or −2", "x = −1/3 or 2", "x = 2 or −3", "x = 1 or −2"],
    correct: 0,
    explanation: "Factor as (3x − 1)(x + 2) = 0, giving x = 1/3 or x = −2.",
  },
  {
    q: "Solve x² − 9 = 0",
    options: ["x = 3", "x = ±9", "x = ±3", "x = 9 or 0"],
    correct: 2,
    explanation: "Difference of squares: (x − 3)(x + 3) = 0, so x = ±3.",
  },
];

export const LOADING_MSGS = [
  "Reading the question…",
  "Identifying the concept…",
  "Detailing the steps…",
];

export const FAQ_ITEMS = [
  {
    q: "What is Gogodeep?",
    a: "Gogodeep is a free AI tool that breaks down any difficult question, step by step. Upload a screenshot of a hard problem and get a full explanation, the underlying concept, and practice questions to make it stick. For STEM topics, Gogodeep also pairs your question with an interactive model you can play with to build real intuition.",
  },
  {
    q: "Which exams and subjects does it support?",
    a: "Gogodeep mainly supports STEM subjects across IB (SL & HL), AP, SAT, and A-Level, including Maths, Physics, Chemistry, Biology, and Earth & Space Science. It works for other subjects too.",
  },
  {
    q: "Is it really free?",
    a: "Yes, Gogodeep is free to use. There is also a paid Deep plan that unlocks unlimited scans, unlimited Blue use, and unlimited practice questions.",
  },
  {
    q: "Will it just give me the answer?",
    a: "No. Gogodeep is built to make you understand, not just copy. It breaks down the exact concept you missed, explains the reasoning step by step, and generates targeted practice so the knowledge actually sticks. You walk away knowing how to solve the next one, not just this one.",
  },
  {
    q: "Can I upload handwritten working?",
    a: "Yes. Take a photo of handwritten notes, a worksheet, or a past paper question and Gogodeep will read and break it down.",
  },
  {
    q: "How is this different from asking ChatGPT?",
    a: "Gogodeep is built specifically for exam-style questions, presented in an easily digestible way so anyone can follow along. It doesn't just give you an answer. It identifies the exact concept you're missing, explains it clearly, and generates targeted practice so the understanding actually sticks.",
  },
];

export const QUOTES = [
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "The only real mistake is the one from which we learn nothing.", author: "Henry Ford" },
  { text: "We do not learn from experience. We learn from reflecting on experience.", author: "John Dewey" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Mistakes are the portals of discovery.", author: "James Joyce" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Genius is 1% inspiration and 99% perspiration.", author: "Thomas Edison" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Education is not the learning of facts, but the training of the mind to think.", author: "Albert Einstein" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Nothing in the world can take the place of persistence.", author: "Calvin Coolidge" },
  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { text: "You don't lose marks for not knowing. You lose them for not finding out.", author: "Anonymous" },
  { text: "The student who reviews their mistakes outperforms the one who only studies new material.", author: "Anonymous" },
  { text: "The top students are not always the smartest. They just catch their errors faster.", author: "Anonymous" },
  { text: "One hour of deliberate review beats five hours of passive re-reading.", author: "Anonymous" },
  { text: "Every concept you master today is one less thing that can surprise you on exam day.", author: "Anonymous" },
  { text: "Comfort and high grades do not live at the same address.", author: "Anonymous" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "An unexamined answer is not worth submitting.", author: "Anonymous" },
  { text: "Frustration is just excitement without direction.", author: "Anonymous" },
  { text: "Repetition is the mother of skill.", author: "Tony Robbins" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "What we learn with pleasure, we never forget.", author: "Alfred Mercier" },
  { text: "A mistake is evidence that someone tried.", author: "Anonymous" },
];
