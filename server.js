require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;

// Middleware - FIX CORS FOR SAME PORT
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());

console.log('Starting server with configuration:');
console.log('Port:', port);

// Judge0 configuration
const JUDGE0_CONFIG = {
  baseURL: process.env.JUDGE0_BASE_URL || 'https://judge0-ce.p.rapidapi.com',
  apiKey: process.env.JUDGE0_API_KEY || '',
  languageIds: {
    javascript: 63,
    python: 71,
    java: 62,
    cpp: 54
  }
};

console.log('Judge0 Base URL:', JUDGE0_CONFIG.baseURL);
console.log('Judge0 API Key:', JUDGE0_CONFIG.apiKey ? 'Provided' : 'Not provided');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    port: port,
    judge0Configured: !!JUDGE0_CONFIG.apiKey
  });
});

// Judge0 execution endpoint
app.post('/execute/:language', async (req, res) => {
  try {
    const { code } = req.body;
    const { language } = req.params;
    
    const languageId = JUDGE0_CONFIG.languageIds[language];
    if (!languageId) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    if (!JUDGE0_CONFIG.apiKey) {
      return res.status(500).json({ 
        error: 'Judge0 API key not configured',
        message: 'Please set up JUDGE0_API_KEY in environment variables'
      });
    }

    // Judge0 API call
    const options = {
      method: 'POST',
      url: `${JUDGE0_CONFIG.baseURL}/submissions`,
      params: {
        base64_encoded: 'false',
        fields: '*',
        wait: 'true'
      },
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': JUDGE0_CONFIG.apiKey,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
      },
      data: {
        source_code: code,
        language_id: languageId,
        stdin: '',
        cpu_time_limit: 5,
        memory_limit: 128000
      }
    };

    // DEBUG: Log request details
    console.log('=== DEBUG: Judge0 Request ===');
    console.log('Language:', language);
    console.log('Language ID:', languageId);
    console.log('Code sample:', code.substring(0, 100) + '...');
    console.log('=======================');

    const response = await axios.request(options);
    const result = response.data;

    // Process the result
    if (result.status.id === 3) {
      res.json({ 
        output: result.stdout || '', 
        error: result.stderr || null 
      });
    } else if (result.status.id === 6) {
      res.json({ 
        output: '', 
        error: result.compile_output || 'Compilation error' 
      });
    } else if (result.status.id === 5) {
      res.json({ 
        output: '', 
        error: 'Time limit exceeded' 
      });
    } else {
      res.json({ 
        output: '', 
        error: result.message || `Execution failed: ${result.status.description}` 
      });
    }

  } catch (error) {
    console.error('Judge0 API error:', error.message);
    res.status(500).json({ 
      error: `Failed to execute code: ${error.message}`,
      details: 'Check Judge0 API configuration'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`✅ Health endpoint: http://localhost:${port}/health`);
  console.log(`✅ Judge0 endpoints: POST http://localhost:${port}/execute/{language}`);
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

