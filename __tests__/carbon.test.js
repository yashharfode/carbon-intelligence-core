const request = require('supertest');
const app = require('../server');

// Mock Google Generative AI with conditional failure injection
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockImplementation((prompt) => {
            if (prompt.includes('999 minutes') || prompt.includes('simulated coach failure')) {
              throw new Error('Gemini API simulated failure');
            }
            if (prompt.includes('888 minutes')) {
              return Promise.resolve({
                response: {
                  text: () => 'This response is completely raw text and does not contain any JSON objects.'
                }
              });
            }
            return Promise.resolve({
              response: {
                text: () => JSON.stringify({
                  raw_co2_kg: 2.5,
                  contextual_nudge: 'This is a mock nudge.',
                  environmental_impact_status: 'degrading'
                })
              }
            });
          })
        })
      };
    })
  };
});

// Mock config/googleServices directly to avoid GCP warnings during unit tests
jest.mock('../config/googleServices', () => {
  return {
    log: {
      entry: jest.fn().mockReturnValue({}),
      write: jest.fn().mockResolvedValue(true)
    },
    logging: {},
    bigquery: {},
    storage: {},
    admin: {},
    firebaseApp: {}
  };
});

describe('POST /api/carbon', () => {
  let originalEnvKey;

  beforeAll(() => {
    originalEnvKey = process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalEnvKey;
  });

  it('should return a 400 error if activityType is missing', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .send({ duration: 30, distance: 10, unit: 'km' });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return a 400 error if activityType is invalid', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .send({ activityType: 'Flying a plane', duration: 30, distance: 10, unit: 'km' });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return the correct payload on successful Gemini calculation', async () => {
    process.env.GEMINI_API_KEY = 'real-api-key';
    const res = await request(app)
      .post('/api/carbon')
      .send({ activityType: 'Driving a petrol car', duration: 30, distance: 10, unit: 'km' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('raw_co2_kg', 2.5);
    expect(res.body).toHaveProperty('contextual_nudge', 'This is a mock nudge.');
    expect(res.body).toHaveProperty('environmental_impact_status', 'degrading');
  });

  it('should use default values for duration and distance if they are missing', async () => {
    process.env.GEMINI_API_KEY = 'real-api-key';
    const res = await request(app)
      .post('/api/carbon')
      .send({ activityType: 'Cycling' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('raw_co2_kg');
  });

  // Test local calculation fallbacks when GEMINI_API_KEY is unset or mock-key
  describe('Local Manual Calculator Fallback', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'mock-key';
    });

    const activities = [
      { activityType: 'Driving a petrol car', duration: 60, distance: 20, unit: 'km', expectedCo2: 3.6 },
      { activityType: 'Driving a petrol car', duration: 60, distance: 20, unit: 'miles', expectedCo2: 5.79 },
      { activityType: 'Taking a bus', duration: 30, distance: 15, unit: 'km', expectedCo2: 0.6 },
      { activityType: 'Eating a beef burger', duration: 15, distance: 2, unit: 'km', expectedCo2: 6.0 }, // qty is parsed from distance
      { activityType: 'Running AC', duration: 120, distance: 0, unit: 'km', expectedCo2: 1.6 }, // 2 hours * 0.8
      { activityType: 'Cycling', duration: 45, distance: 10, unit: 'km', expectedCo2: 0 },
      { activityType: 'Walking', duration: 30, distance: 2, unit: 'km', expectedCo2: 0 },
      { activityType: 'Home Energy', duration: 0, distance: 10, unit: 'km', expectedCo2: 2.0 },
      { activityType: 'Water Usage', duration: 10, distance: 150, unit: 'km', expectedCo2: 0.045 }
    ];

    activities.forEach(({ activityType, duration, distance, unit, expectedCo2 }) => {
      it(`should return correct local calculation for activity: ${activityType} (${unit})`, async () => {
        const res = await request(app)
          .post('/api/carbon')
          .send({ activityType, duration, distance, unit });

        expect(res.statusCode).toEqual(200);
        expect(res.body.raw_co2_kg).toEqual(expectedCo2);
        expect(res.body).toHaveProperty('contextual_nudge');
        expect(res.body).toHaveProperty('environmental_impact_status');
      });
    });
  });

  // Test the fallback mechanism when Gemini errors out (Returns status 206)
  it('should fallback to local calculator and return 206 if Gemini API fails', async () => {
    process.env.GEMINI_API_KEY = 'real-api-key';
    const res = await request(app)
      .post('/api/carbon')
      .send({ activityType: 'Running AC', duration: 999, distance: 0 }); // triggers simulate fail

    expect(res.statusCode).toEqual(206);
    expect(res.body).toHaveProperty('raw_co2_kg');
    expect(res.body.raw_co2_kg).toBe(13.32); // 999/60 * 0.8 = 13.32
    expect(res.body.environmental_impact_status).toBe('degrading');
  });

  // Test fallback when Gemini returns invalid JSON formatted string
  it('should fallback to local calculator and return 206 if Gemini returns invalid JSON formatting', async () => {
    process.env.GEMINI_API_KEY = 'real-api-key';
    const res = await request(app)
      .post('/api/carbon')
      .send({ activityType: 'Running AC', duration: 888, distance: 0 }); // triggers invalid JSON fail

    expect(res.statusCode).toEqual(206);
    expect(res.body).toHaveProperty('raw_co2_kg');
    expect(res.body.raw_co2_kg).toBe(11.84); // 888/60 * 0.8 = 11.84
    expect(res.body.environmental_impact_status).toBe('degrading');
  });

  // Test fallback when request throws error before Zod validation completes
  it('should return a 206 error with global hardcoded fallback if API fails pre-validation', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .send({ FAIL_BEFORE_VALIDATION: true });

    expect(res.statusCode).toEqual(206);
    expect(res.body).toHaveProperty('raw_co2_kg', 2.0);
    expect(res.body.environmental_impact_status).toBe('thriving');
  });

  // Test express body parser error mapping
  it('should return a 400 error if request payload has malformed JSON structure', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .set('Content-Type', 'application/json')
      .send('{"activityType":'); // Malformed JSON triggers body parser error

    expect(res.statusCode).toEqual(400); // Express body parser error code preserved
  });
});

describe('POST /api/carbon/coach', () => {
  it('should return a 400 error if message is missing or invalid', async () => {
    const res = await request(app)
      .post('/api/carbon/coach')
      .send({});
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return a 400 error if message is longer than 500 characters', async () => {
    const longMessage = 'a'.repeat(501);
    const res = await request(app)
      .post('/api/carbon/coach')
      .send({ message: longMessage });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Message length exceeds the maximum limit of 500 characters');
  });

  it('should return a 200 response with coaching advice when valid message is sent', async () => {
    const res = await request(app)
      .post('/api/carbon/coach')
      .send({ message: 'I travel 10km daily by bike' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('response');
    expect(typeof res.body.response).toBe('string');
  });

  it('should return a resilient 200 response with fallback advice if Gemini API fails', async () => {
    const res = await request(app)
      .post('/api/carbon/coach')
      .send({ message: 'simulated coach failure' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('response');
    expect(res.body.response).toContain("That's an interesting question!");
    expect(res.body.response).toContain('Switching to green public transit');
  });
});
