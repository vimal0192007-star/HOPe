const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env file automatically
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

// Node API server runs strictly on port 5000 (Python CARE backend runs on port 8000)
const PORT = process.env.NODE_PORT || 5000;
const HOST = '0.0.0.0';

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'backend.log');

function log(msg, level = 'INFO') {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const line = `[${timestamp}] [${level}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(`[HOPe Backend] ${msg}`);
}

// CARE AI System Role Prompt
const CARE_SYSTEM_PROMPT = `You are CARE, the intelligent assistant integrated into HOPe.

You assist authorized users with hospital workflows, software navigation, information retrieval and natural conversation.

You are not a doctor and must not independently diagnose, prescribe, or make clinical decisions.

When the user asks for a HOPe operation, identify the appropriate predefined intent.

Never generate arbitrary operating-system commands.
Never execute shell commands.
Never execute PowerShell.
Never modify files directly.
Never access unrelated computer resources.

Only use approved HOPe tools supplied by the application.

For simple commands, respond briefly.
For complex questions, provide a clear structured answer.

If you don't know something, say so.
Do not invent patient information, hospital information, test results, appointments or system states.`;

// In-Memory Database Models
const database = {
  patients: [
    { id: 'pat-101', mrn: 'MRN-2026-8812', name: 'Robert Vance', age: 58, gender: 'Male', bloodGroup: 'A+', roomNumber: 'Bed ICU-02', ward: 'ICU', status: 'Inpatient', primaryDoctor: 'Dr. Sarah Smith', admissionDate: '2026-08-28', allergies: ['Penicillin'], diagnosis: 'Acute Coronary Syndrome', vitalSigns: { heartRate: 84, bp: '135/88', spo2: 97, temp: 37.1 } },
    { id: 'pat-102', mrn: 'MRN-2026-9043', name: 'Emily Watson', age: 34, gender: 'Female', bloodGroup: 'O-', roomNumber: 'Ward 3B - Bed 12', ward: 'Maternity', status: 'Inpatient', primaryDoctor: 'Dr. Sarah Smith', admissionDate: '2026-08-30', allergies: ['Latex', 'Sulfa'], diagnosis: 'Post-operative Recovery', vitalSigns: { heartRate: 72, bp: '118/76', spo2: 99, temp: 36.8 } }
  ],
  emergencyCases: [
    { id: 'er-01', caseCode: 'ER-911-01', patientName: 'James Rodriguez', age: 45, triagePriority: 'P1 - Critical', location: 'ER Trauma Bay 1', assignedDoctor: 'Dr. Sarah Smith', assignedNurse: 'Nurse Joy Nurse', chiefComplaint: 'Acute Chest Pain & Severe Dyspnea', arrivalTime: '18:15', status: 'Under Treatment' },
    { id: 'er-02', caseCode: 'ER-911-02', patientName: 'Michael Chang', age: 62, triagePriority: 'P2 - Urgent', location: 'ER Bay 3', assignedDoctor: 'Dr. Arthur Chen', assignedNurse: 'Nurse Joy Nurse', chiefComplaint: 'Laceration to Right Forearm', arrivalTime: '18:40', status: 'In Triage' }
  ],
  pharmacyItems: [
    { id: 'ph-1', code: 'DRUG-001', name: 'Atorvastatin 20mg', category: 'Cardiovascular', stockQuantity: 450, minStockLevel: 100, unit: 'Tablets', expiryDate: '2027-06-15', price: 1.50, location: 'Shelf A-12' },
    { id: 'ph-2', code: 'DRUG-002', name: 'Amoxicillin 500mg', category: 'Antibiotic', stockQuantity: 85, minStockLevel: 100, unit: 'Capsules', expiryDate: '2026-11-20', price: 2.10, location: 'Shelf B-04' }
  ],
  labTests: [
    { id: 'lab-101', testCode: 'LAB-2026-11', patientId: 'pat-101', patientName: 'Robert Vance', testName: 'Troponin I & Lipid Panel', category: 'Biochemistry', requestedBy: 'Dr. Sarah Smith', requestedDate: '2026-09-01 14:00', status: 'Completed', result: 'Troponin I: 4.8 ng/mL (Elevated)', unit: 'ng/mL', referenceRange: '0.0 - 0.04', technician: 'Tech David Miller' }
  ]
};

// Full Intent System Map
function parseCommandIntent(message) {
  const msg = (message || '').toLowerCase().trim();
  
  if (msg.includes('emergency') || msg.includes('er') || msg.includes('triage') || msg.includes('bed')) {
    return { intent: 'OPEN_EMERGENCY', action: 'emergency', title: 'Emergency Center' };
  }
  if (msg.includes('patient') || msg.includes('record')) {
    return { intent: 'OPEN_PATIENT_RECORDS', action: 'patients', title: 'Patient Records' };
  }
  if (msg.includes('pharmacy') || msg.includes('drug') || msg.includes('medicine')) {
    return { intent: 'OPEN_PHARMACY', action: 'pharmacy', title: 'Central Pharmacy' };
  }
  if (msg.includes('lab') || msg.includes('laboratory') || msg.includes('pathology') || msg.includes('test')) {
    return { intent: 'OPEN_LAB', action: 'laboratory', title: 'Pathology Lab' };
  }
  if (msg.includes('appointment') || msg.includes('schedule')) {
    return { intent: 'OPEN_APPOINTMENTS', action: 'appointments', title: 'Appointments' };
  }
  if (msg.includes('surgery') || msg.includes('operation') || msg.includes('theatre') || msg.includes('ot')) {
    return { intent: 'OPEN_SURGERY', action: 'surgery', title: 'Operation Theatre' };
  }
  if (msg.includes('blood')) {
    return { intent: 'OPEN_BLOOD_BANK', action: 'bloodbank', title: 'Blood Bank Vault' };
  }
  if (msg.includes('ambulance') || msg.includes('dispatch')) {
    return { intent: 'OPEN_AMBULANCE', action: 'ambulance', title: 'Ambulance Fleet' };
  }
  if (msg.includes('radiology') || msg.includes('xray') || msg.includes('imaging') || msg.includes('ct') || msg.includes('mri')) {
    return { intent: 'OPEN_RADIOLOGY', action: 'radiology', title: 'Radiology Imaging' };
  }
  if (msg.includes('staff') || msg.includes('doctor') || msg.includes('nurse') || msg.includes('roster')) {
    return { intent: 'OPEN_DOCTOR', action: 'staff', title: 'Hospital Staff Roster' };
  }
  if (msg.includes('inventory') || msg.includes('supplies') || msg.includes('stock')) {
    return { intent: 'OPEN_INVENTORY', action: 'inventory', title: 'Medical Supplies' };
  }
  if (msg.includes('report') || msg.includes('analytics')) {
    return { intent: 'OPEN_REPORTS', action: 'reports', title: 'Analytics & Reports' };
  }
  if (msg.includes('file') || msg.includes('vfs')) {
    return { intent: 'OPEN_FILES', action: 'files', title: 'File Manager' };
  }
  if (msg.includes('setting') || msg.includes('config')) {
    return { intent: 'OPEN_SETTINGS', action: 'settings', title: 'System Settings' };
  }
  if (msg.includes('terminal') || msg.includes('cli') || msg.includes('shell')) {
    return { intent: 'OPEN_TERMINAL', action: 'terminal', title: 'Terminal Shell' };
  }
  if (msg.includes('dashboard') || msg.includes('home') || msg.includes('desktop') || msg.includes('return')) {
    return { intent: 'NAVIGATE_HOME', action: 'dashboard', title: 'Hospital Dashboard' };
  }
  
  return { intent: 'GENERAL_CONVERSATION', action: null, title: 'General Query' };
}

function sendJSON(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(body));
}

// Google AI Gemini API Integration with System Prompt
function callGoogleAI(apiKey, userMessage, context, callback) {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${CARE_SYSTEM_PROMPT}\n\nCurrent App Context: ${context ? JSON.stringify(context) : 'Hospital Desktop'}\nClinician Query: "${userMessage}".`
          }
        ]
      }
    ]
  });

  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.candidates && json.candidates[0] && json.candidates[0].content) {
          const text = json.candidates[0].content.parts[0].text;
          callback(null, text);
        } else if (json.error) {
          callback(new Error(json.error.message || 'Google AI error'));
        } else {
          callback(null, 'CARE processed your request.');
        }
      } catch (err) {
        callback(err);
      }
    });
  });

  req.on('error', (err) => {
    callback(err);
  });

  req.write(payload);
  req.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJSON(res, 204, {});
    return;
  }

  const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = parsedUrl.pathname;

  log(`${req.method} ${pathname}`);

  // GET /health & GET /api/care/health
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health' || pathname === '/api/care/health')) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const isConfigured = !!apiKey && apiKey !== 'YOUR_KEY_HERE';
    sendJSON(res, 200, {
      status: 'ok',
      service: 'HOPe Backend',
      ai: isConfigured ? 'connected' : 'not_configured',
      configured: isConfigured,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // GET /api/care/status
  if (req.method === 'GET' && pathname === '/api/care/status') {
    const apiKey = process.env.GOOGLE_API_KEY;
    const isConfigured = !!apiKey && apiKey !== 'YOUR_KEY_HERE';
    sendJSON(res, 200, {
      success: true,
      service: 'HOPe CARE AI Engine',
      googleAiConnected: isConfigured,
      apiKeyConfigured: isConfigured
    });
    return;
  }

  // POST /api/care/chat
  if (req.method === 'POST' && pathname === '/api/care/chat') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyData || '{}');
        const userMessage = body.message || '';
        const context = body.context || {};
        const parsed = parseCommandIntent(userMessage);

        const apiKey = process.env.GOOGLE_API_KEY;
        const isConfigured = !!apiKey && apiKey !== 'YOUR_KEY_HERE';

        if (isConfigured) {
          callGoogleAI(apiKey, userMessage, context, (err, aiResponseText) => {
            if (err) {
              log(`Google AI error: ${err.message}`, 'WARN');
              const fallbackMsg = parsed.action ? `Opening ${parsed.title}.` : `CARE processed your request.`;
              sendJSON(res, 200, {
                message: fallbackMsg,
                response: fallbackMsg,
                intent: parsed.intent,
                action: parsed.action,
                aiConnected: false,
                error: err.message
              });
            } else {
              sendJSON(res, 200, {
                message: aiResponseText,
                response: aiResponseText,
                intent: parsed.intent,
                action: parsed.action,
                aiConnected: true
              });
            }
          });
        } else {
          const defaultMsg = parsed.action 
            ? `Opening ${parsed.title}.` 
            : `Google AI is not configured. Add GOOGLE_API_KEY to the server environment.`;
          sendJSON(res, 200, {
            message: defaultMsg,
            response: defaultMsg,
            intent: parsed.intent,
            action: parsed.action,
            aiConnected: false
          });
        }
      } catch (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid JSON payload' });
      }
    });
    return;
  }

  // GET /api/patients
  if (req.method === 'GET' && pathname === '/api/patients') {
    sendJSON(res, 200, { success: true, data: database.patients });
    return;
  }

  // GET /api/emergency
  if (req.method === 'GET' && pathname === '/api/emergency') {
    sendJSON(res, 200, { success: true, data: database.emergencyCases });
    return;
  }

  // 404 Fallback
  sendJSON(res, 404, { success: false, error: `Endpoint ${pathname} not found` });
});

server.listen(PORT, HOST, () => {
  const keyStatus = (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'YOUR_KEY_HERE') ? 'Configured' : 'Missing/Default';
  log(`HOPe Backend API running at http://${HOST}:${PORT} (Google AI Status: ${keyStatus})`);
});
