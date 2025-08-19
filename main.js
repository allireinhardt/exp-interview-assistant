const ELEVENLABS_API_KEY = 'sk_eeebfbcf289db0ed030011b9acb7ec5b14a91586fb92da83';
const OPENAI_API_KEY = prompt("Enter your OpenAI API key:"); // 🔐 Secure browser prompt
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const webhookUrl = "https://hooks.zapier.com/hooks/catch/9590371/u4b1wjk/";

const answers = [];
let currentQuestion = 0;

const questions = [
  "Are you eligible to work in the country where this position is located?",
  "Will you require visa sponsorship now or in the future?",
  "Are you currently employed?",
  "If so, why are you considering a new opportunity?",
  "How do you feel about working remotely?",
  "Have you seen our website or the virtual platform we use, E... X... P World?",
  "What excites you about this opportunity or about working for E... X... P?",
  "Can you briefly describe your career history at a high level?",
  "What strengths do you bring to this role?",
  "What salary range are you targeting?",
  "If we move forward, what day and time would be best for a formal interview?"
];

const intro = "Hi there! I’m Rachel with E... X... P. Thanks so much for applying. I just have a few quick questions to help us learn more about you — let’s get started!";
const outro = "Thanks so much! We’ll review your responses and follow up shortly with next steps.";

const speakText = async (text) => {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    console.error('TTS Error:', response.statusText);
    document.getElementById('status').innerText = "TTS Error: " + response.statusText;
    return;
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  return new Promise((resolve) => {
    audio.onended = resolve;
    audio.play();
  });
};

const listenForAnswer = () => {
  return new Promise((resolve, reject) => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();

    recognition.onresult = (event) => {
      const response = event.results[0][0].transcript;
      resolve(response);
    };

    recognition.onerror = (event) => {
      reject(event.error);
    };
  });
};

const summarizeWithGPT = async (answersArray) => {
  const prompt = `
You are an AI recruiting assistant. Summarize the candidate's responses from a voice screening interview.

1. Summarize each answer in 1-2 bullet points.
2. Provide a brief 2-3 sentence overall impression of the candidate.
3. Describe the candidate’s tone in 1-2 adjectives (e.g., confident, warm, hesitant).

Here are the full Q&A pairs:
${answersArray.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    })
  });

  const data = await response.json();
  const summary = data.choices[0].message.content;
  return summary;
};

const runInterview = async () => {
  document.getElementById('status').innerText = "Interview in progress...";
  document.getElementById('answers').innerHTML = "";
  const summaryBox = document.getElementById('summary');
  summaryBox.innerHTML = "";
  summaryBox.classList.remove("visible");

  await speakText(intro);
  await new Promise(resolve => setTimeout(resolve, 1000));

  for (let i = 0; i < questions.length; i++) {
    currentQuestion = i;
    const question = questions[i];

    await speakText(question);
    await new Promise(resolve => setTimeout(resolve, 1000));
    document.getElementById('status').innerText = "Listening...";

    try {
      const answer = await listenForAnswer();
      answers.push({ question, answer });

      const answerDisplay = document.createElement('div');
      answerDisplay.innerHTML = `<strong>Q:</strong> ${question}<br><strong>A:</strong> ${answer}<br><br>`;
      document.getElementById('answers').appendChild(answerDisplay);

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Speech error:", error);
      document.getElementById('status').innerText = "Speech error: " + error;
      break;
    }
  }

  await speakText(outro);
  document.getElementById('status').innerText = "Interview complete ✅";

  const summaryText = await summarizeWithGPT(answers);
  summaryBox.innerHTML = `<h3>📝 AI Summary & Tone:</h3><pre>${summaryText}</pre>`;
  summaryBox.classList.add("visible");

  const zapPayload = {
    timestamp: new Date().toISOString(),
    summary: summaryText,
    answers: answers.map((a) => ({
      question: a.question,
      answer: a.answer
    }))
  };

  fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(zapPayload)
  })
    .then(res => {
      console.log("✅ Sent to Zapier");
    })
    .catch(err => {
      console.error("❌ Failed to send to Zapier", err);
    });
};

document.getElementById('start').addEventListener('click', () => {
  runInterview();
});
