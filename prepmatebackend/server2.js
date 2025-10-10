import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

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

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const cleanJson = text.slice(jsonStart, jsonEnd);
    const parsed = JSON.parse(cleanJson);
    
    res.json(parsed);
  } catch (error) {
    console.error("❌ Error:", error);
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
