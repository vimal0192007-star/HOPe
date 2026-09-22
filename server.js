const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const HOST = '127.0.0.1';

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

// In-Memory Data Models
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
  ],
  auditLogs: [
    { id: 'log-1', timestamp: '2026-09-01 18:00:00', userId: 'usr-3', userName: 'Admin Marcus Vance', userRole: 'Administrator', action: 'BACKEND_INITIALIZATION', resource: 'HOPe Core API', status: 'SUCCESS', details: 'Backend HTTP API server started.' }
  ]
};

function sendJSON(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJSON(res, 204, {});
    return;
  }

  const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = parsedUrl.pathname;

  log(`${req.method} ${pathname}`);

  // HEALTH CHECK ENDPOINT (GET /health)
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    sendJSON(res, 200, {
      status: 'ok',
      service: 'HOPe Backend',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
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

  // GET /api/pharmacy
  if (req.method === 'GET' && pathname === '/api/pharmacy') {
    sendJSON(res, 200, { success: true, data: database.pharmacyItems });
    return;
  }

  // GET /api/lab
  if (req.method === 'GET' && pathname === '/api/lab') {
    sendJSON(res, 200, { success: true, data: database.labTests });
    return;
  }

  // GET /api/system-status
  if (req.method === 'GET' && pathname === '/api/system-status') {
    sendJSON(res, 200, {
      success: true,
      status: 'OPERATIONAL',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeServices: ['AuthService', 'AudioService', 'CareAI', 'VFSKernel', 'EmergencyTriage']
    });
    return;
  }

  // 404 Fallback
  sendJSON(res, 404, { success: false, error: `Endpoint ${pathname} not found` });
});

server.listen(PORT, HOST, () => {
  log(`HOPe Backend API running at http://${HOST}:${PORT}`);
});

process.on('uncaughtException', (err) => {
  log(`Uncaught Exception: ${err.message}`, 'ERROR');
});
