const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-in-production';
const CHALLENGES_FILE = path.join(__dirname, 'challenges.json');

// Mock user storage (em produção usar BD)
const users = new Map();

function readChallenges(){
  return JSON.parse(fs.readFileSync(CHALLENGES_FILE, 'utf8'));
}

function writeChallenges(data){
  fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(data, null, 2));
}

// Middleware JWT
function verifyToken(req, res, next){
  const token = req.headers.authorization?.split(' ')[1];
  if(!token) return res.status(401).json({ error: 'Token required' });
  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  }catch(err){
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Auth endpoints
app.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  if(!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  const userId = uuidv4();
  const user = { id: userId, email, role };
  users.set(userId, user);
  
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
  res.json({ access_token: token, user });
});

app.post('/register', (req, res) => {
  const { email, password, role } = req.body;
  if(!email || !password || !role) return res.status(400).json({ error: 'Email, password, and role required' });
  
  const userId = uuidv4();
  const user = { id: userId, email, role };
  users.set(userId, user);
  
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
  res.json({ access_token: token, user });
});

// Challenge endpoints
app.get('/challenges', verifyToken, (req, res) => {
  res.json(readChallenges());
});

app.put('/challenges/:id', verifyToken, (req, res) => {
  if(req.user.role !== 'interviewer') return res.status(403).json({ error: 'Only interviewers can edit' });
  
  const id = Number(req.params.id);
  const challenges = readChallenges();
  const idx = challenges.findIndex(c => c.id === id);
  if(idx === -1) return res.status(404).json({ error: 'Not found' });
  challenges[idx] = { ...challenges[idx], ...req.body };
  writeChallenges(challenges);
  res.json(challenges[idx]);
});

app.post('/challenges', verifyToken, (req, res) => {
  if(req.user.role !== 'interviewer') return res.status(403).json({ error: 'Only interviewers can create' });
  
  const challenges = readChallenges();
  const newId = Math.max(...challenges.map(c => c.id), 0) + 1;
  const newChallenge = { id: newId, ...req.body };
  challenges.push(newChallenge);
  writeChallenges(challenges);
  res.json(newChallenge);
});

// Start a run by emitting to connected runner(s)
app.post('/run', verifyToken, (req, res) => {
  const { language, code, sessionId } = req.body;
  const sid = sessionId || uuidv4();
  // broadcast to runners
  io.to('runners').emit('run', { sessionId: sid, language, code });
  res.json({ sessionId: sid });
});

// Socket.io connections
io.on('connection', (socket) => {
  const { role } = socket.handshake.query || {};
  if(role === 'runner'){
    socket.join('runners');
    console.log('Runner connected:', socket.id);
  }

  // forward runner logs to clients
  socket.on('runner-log', (payload) => {
    const { sessionId, data } = payload;
    io.to(sessionId).emit('log', { sessionId, data });
  });

  // client joins a session to receive logs
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
  });

  // WebRTC / signaling events - forwarded to peers
  socket.on('webrtc-offer', (payload) => {
    io.to(payload.target).emit('webrtc-offer', { from: socket.id, sdp: payload.sdp });
  });
  socket.on('webrtc-answer', (payload) => {
    io.to(payload.target).emit('webrtc-answer', { from: socket.id, sdp: payload.sdp });
  });
  socket.on('webrtc-candidate', (payload) => {
    io.to(payload.target).emit('webrtc-candidate', { from: socket.id, candidate: payload.candidate });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log('API listening on', PORT));
