const request = require('supertest');
const app = require('../server');

// Mock Gemini
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify({
                raw_co2_kg: 2.5,
                contextual_nudge: "This is a mock nudge.",
                environmental_impact_status: "degrading"
              })
            }
          })
        })
      };
    })
  };
});

// Mock GCP Logging to prevent real API calls during tests
jest.mock('@google-cloud/logging', () => {
  return {
    Logging: jest.fn().mockImplementation(() => {
      return {
        log: jest.fn().mockReturnValue({
          entry: jest.fn().mockReturnValue({}),
          write: jest.fn().mockResolvedValue(true)
        })
      };
    })
  };
});

describe('POST /api/carbon', () => {
  it('should return a 400 error if activityType is missing', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .send({ duration: 30, distance: 10, unit: 'km' });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return the correct payload on successful Gemini calculation', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .send({ activityType: 'Driving a petrol car', duration: 30, distance: 10, unit: 'km' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('raw_co2_kg', 2.5);
    expect(res.body).toHaveProperty('contextual_nudge', 'This is a mock nudge.');
    expect(res.body).toHaveProperty('environmental_impact_status', 'degrading');
  });
});
