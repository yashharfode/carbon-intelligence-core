const request = require('supertest');
const app = require('../server');

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify({
                raw_co2_kg: 2.5,
                contextual_nudge: 'This is a mock nudge.',
                environmental_impact_status: 'degrading'
              })
            }
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
  it('should return a 400 error if activityType is missing', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .send({ duration: 30, distance: 10, unit: 'km' });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBeDefined();
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

  it('should use default values for duration and distance if they are missing', async () => {
    const res = await request(app)
      .post('/api/carbon')
      .send({ activityType: 'Cycling' }); // duration/distance not provided

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('raw_co2_kg');
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

  it('should return a 200 response with coaching advice when valid message is sent', async () => {
    const res = await request(app)
      .post('/api/carbon/coach')
      .send({ message: 'I travel 10km daily by bike' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('response');
    expect(typeof res.body.response).toBe('string');
  });
});
