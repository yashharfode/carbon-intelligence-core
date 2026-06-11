const { Logging } = require('@google-cloud/logging');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

// 1. Initialize Google Cloud Logging
let logging;
let log;
try {
  logging = new Logging();
  log = logging.log('carbon-transactions');
  console.log('Google Cloud Logging client initialized.');
} catch (error) {
  console.warn('GCP Logging failed to initialize, using mock logger:', error.message);
  log = {
    entry: (metadata, data) => ({ metadata, data }),
    write: async (entry) => {
      console.log('[MOCK LOG]:', JSON.stringify(entry));
      return true;
    }
  };
}

// 2. Initialize BigQuery
let bigquery;
try {
  bigquery = new BigQuery();
  console.log('Google Cloud BigQuery client initialized.');
} catch (error) {
  console.warn('GCP BigQuery failed to initialize, using mock client:', error.message);
  bigquery = {
    query: async (queryStr) => {
      console.log('[MOCK BIGQUERY QUERY]:', queryStr);
      return [[]]; // Return empty result set
    }
  };
}

// 3. Initialize Cloud Storage
let storage;
try {
  storage = new Storage();
  console.log('Google Cloud Storage client initialized.');
} catch (error) {
  console.warn('GCP Storage failed to initialize, using mock client:', error.message);
  storage = {
    bucket: (name) => ({
      exists: async () => [false],
      file: (path) => ({
        exists: async () => [false],
        save: async (_data) => console.log(`[MOCK STORAGE SAVE] to ${name}/${path}`)
      })
    })
  };
}

// 4. Initialize Firebase Admin SDK
let firebaseApp = null;
try {
  // Check if credentials are set, otherwise use application default credentials (ADC)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    firebaseApp = admin.initializeApp();
    console.log('Firebase Admin initialized with config.');
  } else {
    // Try to initialize using applicationDefault, checking if credential object is defined
    if (admin && admin.credential && typeof admin.credential.applicationDefault === 'function') {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      console.log('Firebase Admin initialized with applicationDefault.');
    } else {
      throw new Error('admin.credential is unavailable in this module version.');
    }
  }
} catch (error) {
  console.warn('Firebase Admin failed to initialize (continuing without authentication services):', error.message);
  firebaseApp = {
    auth: () => ({
      verifyIdToken: async () => {
        throw new Error('Firebase Auth unavailable - mock environment active');
      }
    })
  };
}

module.exports = {
  logging,
  log,
  bigquery,
  storage,
  admin,
  firebaseApp
};
