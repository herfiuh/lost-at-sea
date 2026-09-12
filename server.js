const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
  currentShift: 1,
  submissions: {
    1: { C: null, E: null, T: null, D: null },
    2: { C: null, E: null, T: null, D: null },
    3: { C: null, E: null, T: null, D: null }
  },
  shiftScores: { 1: null, 2: null, 3: null },
  finalOutcome: null // 'success', 'drifted', or 'grounded'
};

function calculateShiftScore(shift) {
  const subs = gameState.submissions[shift];
  let correctCount = 0;
  
  // Choice strings starting with "1." are the correct answers
  ['C', 'E', 'T', 'D'].forEach(team => {
    if (subs[team] && subs[team].choice.startsWith('1.')) {
      correctCount++;
    }
  });

  return correctCount; // 0 to 4
}

function checkAutoAdvance(shift) {
  if (gameState.currentShift === 'ended') return;
  const subs = gameState.submissions[shift];
  
  if (subs.C && subs.E && subs.T && subs.D) {
    const score = calculateShiftScore(shift);
    gameState.shiftScores[shift] = score;

    setTimeout(() => {
      if (gameState.currentShift === 1) {
        gameState.currentShift = 2;
      } else if (gameState.currentShift === 2) {
        gameState.currentShift = 3;
      } else if (gameState.currentShift === 3) {
        gameState.currentShift = 'ended';
        
        // Determine Final Journey Outcome
        const totalScore = gameState.shiftScores[1] + gameState.shiftScores[2] + gameState.shiftScores[3];
        if (totalScore >= 10) {
          gameState.finalOutcome = 'success'; // Safe Arrival
        } else if (gameState.submissions[3].T.choice.startsWith('1.') && gameState.submissions[3].D.choice.startsWith('1.')) {
          gameState.finalOutcome = 'drifted'; // Missed Port / Stranded near Halul Island
        } else {
          gameState.finalOutcome = 'grounded'; // Ran aground on Fasht Reefs
        }
      }
      io.emit('stateUpdate', gameState);
    }, 2000);
  }
}

io.on('connection', (socket) => {
  socket.emit('stateUpdate', gameState);

  socket.on('submitDecision', ({ shift, team, name, choice }) => {
    if (gameState.submissions[shift]) {
      gameState.submissions[shift][team] = { name, choice };
      io.emit('stateUpdate', gameState);
      checkAutoAdvance(shift);
    }
  });

  socket.on('setShift', (shiftNumber) => {
    gameState.currentShift = shiftNumber;
    if (shiftNumber === 'ended') {
      gameState.finalOutcome = gameState.finalOutcome || 'success';
    }
    io.emit('stateUpdate', gameState);
  });

  socket.on('resetGame', () => {
    gameState = {
      currentShift: 1,
      submissions: {
        1: { C: null, E: null, T: null, D: null },
        2: { C: null, E: null, T: null, D: null },
        3: { C: null, E: null, T: null, D: null }
      },
      shiftScores: { 1: null, 2: null, 3: null },
      finalOutcome: null
    };
    io.emit('stateUpdate', gameState);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));