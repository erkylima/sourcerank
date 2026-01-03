const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const API_URL = process.env.API_URL || 'http://localhost:4000';
const socket = io(API_URL, { query: { role: 'runner' } });

function emitLog(sessionId, line){
  socket.emit('runner-log', { sessionId, data: line });
}

socket.on('connect', () => {
  console.log('Connected to API as runner', socket.id);
});

socket.on('run', async (payload) => {
  const { sessionId, language, code } = payload;
  const id = sessionId || uuidv4();
  emitLog(id, `Starting run for language=${language}\n`);
  try{
    await runCode(id, language, code);
    emitLog(id, `Execution finished\n`);
  }catch(err){
    emitLog(id, `Error: ${String(err)}\n`);
  }
});

async function runCode(sessionId, language, code){
  const tmpDir = path.join('/tmp', `sr_${sessionId}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  if(language === 'python'){
    const file = path.join(tmpDir, 'main.py');
    fs.writeFileSync(file, code);
    return spawnAndStream('python3', [file], sessionId);
  }
  if(language === 'node'){
    const file = path.join(tmpDir, 'main.js');
    fs.writeFileSync(file, code);
    return spawnAndStream('node', [file], sessionId);
  }
  if(language === 'ts'){
    const file = path.join(tmpDir, 'main.ts');
    fs.writeFileSync(file, code);
    return spawnAndStream('npx', ['ts-node', file], sessionId);
  }
  if(language === 'go'){
    const file = path.join(tmpDir, 'main.go');
    fs.writeFileSync(file, code);
    return spawnAndStream('go', ['run', file], sessionId);
  }
  if(language === 'java'){
    const file = path.join(tmpDir, 'Main.java');
    fs.writeFileSync(file, code);
    return spawnAndStream('sh', ['-c', `javac ${file} && java -cp ${tmpDir} Main`], sessionId);
  }
  if(language === 'csharp'){
    const file = path.join(tmpDir, 'Program.cs');
    fs.writeFileSync(file, code);
    return spawnAndStream('sh', ['-c', `mcs ${file} -out:${tmpDir}/Program.exe && mono ${tmpDir}/Program.exe`], sessionId);
  }
  throw new Error('Unsupported language: ' + language);
}

function spawnAndStream(cmd, args, sessionId){
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: process.env });
    p.stdout.on('data', (chunk) => emitLog(sessionId, chunk.toString()));
    p.stderr.on('data', (chunk) => emitLog(sessionId, chunk.toString()));
    p.on('close', (code) => {
      emitLog(sessionId, `Process exited with code ${code}\n`);
      resolve();
    });
    p.on('error', (err) => {
      emitLog(sessionId, `Spawn error: ${err.message}\n`);
      reject(err);
    });
  });
}
