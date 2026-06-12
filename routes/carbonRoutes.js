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
    'Cycling',
    'Walking',
    'Home Energy',
    'Water Usage'
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

// --- Scientific Local Manual Calculator Helper ---
// Provides resilient, immediate calculations for local runs and API fallbacks.
function calculateLocalCarbon(activityType, duration, distance, unit) {
  const distanceKm = unit === 'miles' ? distance * 1.60934 : distance;
  let raw_co2_kg = 0;
  let environmental_impact_status = 'thriving';
  let nudge = '';

  switch (activityType) {
  case 'Driving a petrol car':
    raw_co2_kg = parseFloat((distanceKm * 0.18).toFixed(2));
    environmental_impact_status = raw_co2_kg > 2.5 ? 'degrading' : 'thriving';
    nudge = `Driving this distance emitted approximately ${raw_co2_kg} kg of CO2. Swapping this trip with public transit could save up to 80% of these emissions!`;
    break;

  case 'Taking a bus':
    raw_co2_kg = parseFloat((distanceKm * 0.04).toFixed(2));
    environmental_impact_status = 'thriving';
    nudge = `Taking the bus emitted only ${raw_co2_kg} kg of CO2, which is significantly lower than driving a private vehicle. Great choice!`;
    break;

  case 'Eating a beef burger':
    const qty = distance > 0 ? distance : 1;
    raw_co2_kg = parseFloat((qty * 3.0).toFixed(2));
    environmental_impact_status = 'degrading';
    nudge = `Eating this meal is estimated to have a carbon cost of ${raw_co2_kg} kg CO2. Swapping beef for plant-based alternatives reduces food footprints by over 80%!`;
    break;

  case 'Running AC':
    const acHours = duration / 60;
    raw_co2_kg = parseFloat((acHours * 0.8).toFixed(2));
    environmental_impact_status = raw_co2_kg > 1.0 ? 'degrading' : 'thriving';
    nudge = `Using your AC for this duration has emitted around ${raw_co2_kg} kg of CO2. Consider raising the thermostat to 24°C or using eco-mode to save power.`;
    break;

  case 'Cycling':
  case 'Walking':
    raw_co2_kg = 0.0;
    environmental_impact_status = 'thriving';
    nudge = 'Wonderful! Active transit is completely carbon-free. You saved 100% of transport emissions for this journey!';
    break;

  case 'Home Energy':
    const energyUnits = distance > 0 ? distance : 5;
    raw_co2_kg = parseFloat((energyUnits * 0.2).toFixed(2));
    environmental_impact_status = raw_co2_kg > 2.0 ? 'degrading' : 'thriving';
    nudge = `Your home heating/cooking energy emitted ${raw_co2_kg} kg of CO2. Switching to energy-efficient appliances makes a measurable difference.`;
    break;

  case 'Water Usage':
    const liters = distance > 0 ? distance : 100;
    raw_co2_kg = parseFloat((liters * 0.0003).toFixed(3));
    environmental_impact_status = 'thriving';
    nudge = `Processing and heating this volume of water emitted ${raw_co2_kg} kg of CO2. Shorter showers directly reduce water heating energy!`;
    break;

  default:
    raw_co2_kg = 1.2;
    environmental_impact_status = 'thriving';
    nudge = 'Every conscious environmental action contributes to our global carbon balance. Keep tracking your impact!';
  }

  return {
    raw_co2_kg,
    contextual_nudge: nudge,
    environmental_impact_status
  };
}

router.post('/', async (req, res) => {
  let validatedData;
  try {
    if (req.body && req.body.FAIL_BEFORE_VALIDATION) {
      throw new Error('Simulated pre-validation failure');
    }
    // 1. Strict Validation
    validatedData = activitySchema.parse(req.body);
    const { activityType, duration, distance, unit } = validatedData;

    // 2. Direct Bypass to Local Calculator if API Key is mock or unset
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key') {
      const localResponse = calculateLocalCarbon(activityType, duration, distance, unit);
      
      // Asynchronous Cloud Logging
      const metadata = { resource: { type: 'global' } };
      const entry = log.entry(metadata, {
        activity: activityType,
        co2: localResponse.raw_co2_kg,
        mode: 'local_calculator',
        timestamp: new Date().toISOString()
      });
      log.write(entry).catch(err => console.error('GCP Logging Error:', err));

      return res.status(200).json(localResponse);
    }

    // 3. Construct Safe Prompt
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

    // 4. Gemini Processing
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON in case the model wraps it in markdown blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON format received from Gemini');
    }
    
    const jsonResponse = JSON.parse(jsonMatch[0]);

    // 5. Fully Asynchronous Cloud Logging
    const metadata = { resource: { type: 'global' } };
    const entry = log.entry(metadata, {
      activity: activityType,
      co2: jsonResponse.raw_co2_kg,
      mode: 'gemini_api',
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

    console.error('Gemini API Error (falling back to local calculations):', error);
    
    // Asynchronous Error Logging
    const metadata = { resource: { type: 'global' }, severity: 'ERROR' };
    const entry = log.entry(metadata, { error: error.message, body: req.body });
    log.write(entry).catch(err => console.error('GCP Logging Error:', err));

    // Fallback response using our local manual calculator
    if (validatedData) {
      const { activityType, duration, distance, unit } = validatedData;
      const fallbackResponse = calculateLocalCarbon(activityType, duration, distance, unit);
      return res.status(206).json(fallbackResponse);
    }
    
    return res.status(206).json({
      raw_co2_kg: 2.0,
      contextual_nudge: 'We calculated a fallback estimation. Try swapping private trips with transit to save carbon!',
      environmental_impact_status: 'thriving'
    });
  }
});

// --- AI Carbon Coach Chat Endpoint ---
router.post('/coach', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }
    if (message.length > 500) {
      return res.status(400).json({ error: 'Message length exceeds the maximum limit of 500 characters' });
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
