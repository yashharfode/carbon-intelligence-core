const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');
const { log } = require('../config/googleServices');

const router = express.Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-key');

// --- Strict Input Validation Schema (Zod) ---
// Preprocesses values to safely parse numbers, preventing unexpected crashes, and protects against injection.
const activitySchema = z.object({
  activityType: z.enum([
    'Driving a petrol car',
    'Taking a bus',
    'Eating a beef burger',
    'Running AC',
    'Cycling'
  ], {
    required_error: 'Activity type is required',
    invalid_type_error: 'Invalid activity type selected'
  }),
  duration: z.preprocess(
    (val) => val === undefined || val === null || val === '' ? 0 : Number(val),
    z.number().min(0, 'Duration cannot be negative').max(1440, 'Duration exceeds daily limit')
  ).default(0),
  distance: z.preprocess(
    (val) => val === undefined || val === null || val === '' ? 0 : Number(val),
    z.number().min(0, 'Distance cannot be negative').max(10000, 'Distance exceeds logical limit')
  ).default(0),
  unit: z.enum(['km', 'miles']).default('km')
});

router.post('/', async (req, res) => {
  try {
    // 1. Strict Validation
    const validatedData = activitySchema.parse(req.body);
    
    const { activityType, duration, distance, unit } = validatedData;

    // 2. Construct Safe Prompt
    const prompt = `
      Act as a Senior Environmental Scientist and calculate the carbon footprint for the following activity.
      Activity: ${activityType}
      Duration: ${duration} minutes
      Distance: ${distance} ${unit}
      
      You must return ONLY a structured JSON containing:
      {
        "raw_co2_kg": <Numerical value representing the kg of CO2 emitted>,
        "contextual_nudge": "<A relatable real-world comparison. E.g., 'This equals running an AC for X hours. Taking a bus could have saved Y% of this.'>",
        "environmental_impact_status": "<Strictly 'degrading' if the impact is high, or 'thriving' if it's low or eco-friendly>"
      }
    `;

    // 3. Gemini Processing
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON in case the model wraps it in markdown blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON format received from Gemini');
    }
    
    const jsonResponse = JSON.parse(jsonMatch[0]);

    // 4. Fully Asynchronous Cloud Logging
    // We do NOT await this promise, so it doesn't block the API response time.
    const metadata = { resource: { type: 'global' } };
    const entry = log.entry(metadata, {
      activity: activityType,
      co2: jsonResponse.raw_co2_kg,
      timestamp: new Date().toISOString()
    });
    log.write(entry).catch(err => console.error('GCP Logging Error:', err));

    return res.status(200).json(jsonResponse);

  } catch (error) {
    // Handle Zod Validation Errors strictly
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors ? error.errors.map(e => e.message).join(', ') : error.issues.map(e => e.message).join(', ');
      return res.status(400).json({ error: errorMessages });
    }

    console.error('Gemini API Error:', error);
    
    // Asynchronous Error Logging
    const metadata = { resource: { type: 'global' }, severity: 'ERROR' };
    const entry = log.entry(metadata, { error: error.message, body: req.body });
    log.write(entry).catch(err => console.error('GCP Logging Error:', err));

    // Fallback response with 206 Partial Content ensures resilience
    const fallbackResponse = {
      raw_co2_kg: 5.0, // Default generic value
      contextual_nudge: "We couldn't calculate the exact impact right now, but every small step counts. Consider greener choices like walking or public transit next time!",
      environmental_impact_status: 'degrading'
    };
    
    return res.status(206).json(fallbackResponse);
  }
});

// --- AI Carbon Coach Chat Endpoint ---
router.post('/coach', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    const systemPrompt = `
      You are the AI Carbon Coach inside the Carbon Reduction Ecosystem 2.0.
      Your objective is to analyze user habits, calculate carbon savings, suggest actionable green swaps, and motivate behavior change.
      Provide a highly encouraging, informative, and concise response (max 3 sentences).
      Use friendly markdown formatting.
    `;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(`${systemPrompt}\nUser Query: ${message}`);
    const responseText = result.response.text();

    // Async Cloud Logging
    const metadata = { resource: { type: 'global' } };
    const entry = log.entry(metadata, { action: 'chat_coach', query: message, timestamp: new Date().toISOString() });
    log.write(entry).catch(err => console.error('GCP Logging Error:', err));

    return res.status(200).json({ response: responseText.trim() });
  } catch (error) {
    console.error('Carbon Coach Error:', error);

    // Async Error Logging
    const metadata = { resource: { type: 'global' }, severity: 'ERROR' };
    const entry = log.entry(metadata, { error: error.message, action: 'chat_coach_failed' });
    log.write(entry).catch(err => console.error('GCP Logging Error:', err));

    // Resilient fallback advice
    return res.status(200).json({
      response: "That's an interesting question! Switching to green public transit, eating plant-based meals, and monitoring home energy are great ways to reduce your carbon impact. Keep stepping forward! 🌍"
    });
  }
});

module.exports = router;
