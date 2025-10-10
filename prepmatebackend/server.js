import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { spawn } from "child_process";
import vosk from "vosk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { text } from "stream/consumers";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Initialize Vosk model
vosk.setLogLevel(0);
const MODEL_PATH = "./SttModel/vosk-model-small-en-us-0.15"; // your Vosk model path
const sampleRate = 16000;
const model = new vosk.Model('./SttModel/vosk-model-small-en-us-0.15');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

/* -------------------- VOSK STT Endpoint -------------------- */
app.post("/api/stt", upload.single("audio"), async (req, res) => {
  try {
    const filePath = req.file.path;
   
    // Convert audio to 16kHz mono PCM using ffmpeg
    const ffmpeg = spawn("ffmpeg", [
      "-loglevel",
      "quiet",
      "-i",
      filePath,
      "-ar",
      sampleRate.toString(),
      "-ac",
      "1",
      "-f",
      "s16le",
      "pipe:1",
    ]);
console.log('jjj..')
    const rec = new vosk.Recognizer({ model: model, sampleRate });
    rec.setWords(true);

    ffmpeg.stdout.on("data", (chunk) => {
      rec.acceptWaveform(chunk);
    });

    ffmpeg.on("close", () => {
      console.log("....")
      const result = rec.finalResult();
      rec.free();
     
      fs.unlinkSync(filePath); // clean up uploaded file
      console.log(result.text);
      res.json({ text: result.text });
    });
  } catch (err) {
    console.error("❌ STT Error:", err);
    res.status(500).json({ error: "Speech recognition failed" });
  }
});

/* -------------------- Gemini AI Interview Endpoint -------------------- */
app.post("/api/interview/ask", async (req, res) => {
  try {
    const { question, answer } = req.body;

    const prompt = `
    You are an expert interview coach.
    Question: "${question}"
    Candidate's answer: "${answer}"

    Evaluate the answer on:
    - Accuracy
    - Clarity
    - Confidence
    - Structure

    Then:
    - Give a short feedback summary (2–3 lines)
    - Suggest an improved version of the answer
    - Generate the next relevant interview question

    Return the result ONLY in valid JSON:
    {
      "feedback": "...",
      "score": number,
      "improvedAnswer": "...",
      "nextQuestion": "..."
    }
    `;

    const result = await gModel.generateContent(prompt);
    const text = result.response.text();

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const cleanJson = text.slice(jsonStart, jsonEnd);
    const parsed = JSON.parse(cleanJson);

    res.json(parsed);
  } catch (error) {
    console.error("❌ AI Error:", error);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

app.get("/", (req, res) => {
  res.send("PrepMate Backend is Running ✅");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
