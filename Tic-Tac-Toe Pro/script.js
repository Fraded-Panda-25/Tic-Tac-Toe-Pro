        /**
         * TIC-TAC-TOE WEB APP ENGINE
         * Senior Architecture Implementation Document
         */

        // =========================================================================
        // 1. STORAGE SYSTEM MANAGER
        // =========================================================================
        const StorageManager = {
            PREFIX: 'ttt_pro_',
            defaults: {
                mode: 'pve',
                difficulty: 'impossible',
                size: '3',
                symbol: 'X',
                colorX: '#ef4444',
                colorO: '#3b82f6',
                theme: 'system',
                wallpaper: '',
                volume: 0.5,
                muted: false,
                stats: { played: 0, wins: 0, losses: 0, draws: 0, currentStreak: 0, bestStreak: 0 }
            },
            get(key) {
                try {
                    const data = localStorage.getItem(this.PREFIX + key);
                    return data ? JSON.parse(data) : this.defaults[key];
                } catch {
                    return this.defaults[key];
                }
            },
            set(key, val) {
                try { localStorage.setItem(this.PREFIX + key, JSON.stringify(val)); } catch (e) { console.error(e); }
            }
        };

        // =========================================================================
        // 2. SYNTHESIZED AUDIO ARCHITECTURE
        // =========================================================================
        const AudioManager = {
            ctx: null,
            init() {
                if (this.ctx) return;
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            },
            play(type) {
                if (StorageManager.get('muted')) return;
                this.init();
                if (!this.ctx) return;

                const vol = StorageManager.get('volume');
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(vol * 0.15, this.ctx.currentTime);
                gain.connect(this.ctx.destination);

                const osc = this.ctx.createOscillator();
                osc.connect(gain);

                const now = this.ctx.currentTime;

                switch (type) {
                    case 'click':
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(400, now);
                        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
                        osc.start(now);
                        osc.stop(now + 0.05);
                        break;
                    case 'toss':
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(200, now);
                        osc.frequency.linearRampToValueAtTime(600, now + 0.3);
                        osc.start(now);
                        osc.stop(now + 0.3);
                        break;
                    case 'win':
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(523.25, now); // C5
                        osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
                        osc.frequency.setValueAtTime(783.99, now + 0.3); // G5
                        osc.start(now);
                        osc.stop(now + 0.6);
                        break;
                    case 'draw':
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(293.66, now); // D4
                        osc.frequency.linearRampToValueAtTime(146.83, now + 0.4); // D3
                        osc.start(now);
                        osc.stop(now + 0.4);
                        break;
                }
            }
        };

        // =========================================================================
        // 3. ZERO-DEPENDENCY PARTICLE / CONFETTI ENGINE
        // =========================================================================
        const AnimationEngine = {
            canvas: document.getElementById('particles-canvas'),
            ctx: null,
            particles: [],
            active: false,
            init() {
                this.ctx = this.canvas.getContext('2d');
                window.addEventListener('resize', () => this.resize());
                this.resize();
            },
            resize() {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            },
            triggerVictoryConfetti() {
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                this.init();
                this.particles = [];
                this.active = true;
                const colors = [StorageManager.get('colorX'), StorageManager.get('colorO'), '#f59e0b', '#10b981', '#3b82f6'];
                
                for (let i = 0; i < 150; i++) {
                    this.particles.push({
                        x: Math.random() * this.canvas.width,
                        y: Math.random() * this.canvas.height - this.canvas.height,
                        r: Math.random() * 6 + 4,
                        d: Math.random() * this.canvas.height,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        tilt: Math.random() * 10 - 5,
                        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                        tiltAngle: 0
                    });
                }
                this.loop();
            },
            loop() {
                if (!this.active) return;
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                let remaining = false;

                for (let p of this.particles) {
                    p.tiltAngle += p.tiltAngleIncremental;
                    p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
                    p.x += Math.sin(p.tiltAngle);
                    p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 5;

                    if (p.y < this.canvas.height) remaining = true;

                    this.ctx.beginPath();
                    this.ctx.lineWidth = p.r;
                    this.ctx.strokeStyle = p.color;
                    this.ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                    this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
                    this.ctx.stroke();
                }

                if (remaining) {
                    requestAnimationFrame(() => this.loop());
                } else {
                    this.active = false;
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                }
            }
        };

        // =========================================================================
        // 4. CORE ENGINE & MATRICES SYSTEM
        // =========================================================================
        const GameEngine = {
            size: 3,
            winCondition: 3,
            board: [],
            turn: 'X',
            mode: 'pve',
            difficulty: 'impossible',
            humanSymbol: 'X',
            aiSymbol: 'O',
            history: [],
            historyIndex: -1,
            winningCombos: [],
            isThinking: false,

            initialize(size, mode, difficulty, humanSymbol) {
                this.size = parseInt(size);
                this.winCondition = this.size === 3 ? 3 : (this.size === 4 ? 4 : 5);
                this.mode = mode;
                this.difficulty = difficulty;
                this.humanSymbol = humanSymbol;
                this.aiSymbol = humanSymbol === 'X' ? 'O' : 'X';
                this.board = Array(this.size * this.size).fill(null);
                this.history = [ [...this.board] ];
                this.historyIndex = 0;
                this.isThinking = false;
                this.generateWinningCombinations();
            },

            generateWinningCombinations() {
                const N = this.size;
                const W = this.winCondition;
                this.winningCombos = [];

                // Horizontal vector verification
                for (let r = 0; r < N; r++) {
                    for (let c = 0; c <= N - W; c++) {
                        let combo = [];
                        for (let k = 0; k < W; k++) combo.push(r * N + (c + k));
                        this.winningCombos.push(combo);
                    }
                }
                // Vertical vector verification
                for (let c = 0; c < N; c++) {
                    for (let r = 0; r <= N - W; r++) {
                        let combo = [];
                        for (let k = 0; k < W; k++) combo.push((r + k) * N + c);
                        this.winningCombos.push(combo);
                    }
                }
                // Diagonal calculations (Top-Left down to Bottom-Right)
                for (let r = 0; r <= N - W; r++) {
                    for (let c = 0; c <= N - W; c++) {
                        let combo = [];
                        for (let k = 0; k < W; k++) combo.push((r + k) * N + (c + k));
                        this.winningCombos.push(combo);
                    }
                }
                // Anti-diagonal calculations (Top-Right down to Bottom-Left)
                for (let r = 0; r <= N - W; r++) {
                    for (let c = W - 1; c < N; c++) {
                        let combo = [];
                        for (let k = 0; k < W; k++) combo.push((r + k) * N + (c - k));
                        this.winningCombos.push(combo);
                    }
                }
            },

            checkWinState(boardState) {
                for (let combo of this.winningCombos) {
                    const first = boardState[combo[0]];
                    if (first && combo.every(idx => boardState[idx] === first)) {
                        return { winner: first, combination: combo };
                    }
                }
                if (boardState.every(cell => cell !== null)) return { winner: 'draw', combination: [] };
                return null;
            },

            commitMove(index, symbol) {
                if (this.board[index] || this.isThinking) return false;
                
                // Truncate forward history if tracking from an undone position
                if (this.historyIndex < this.history.length - 1) {
                    this.history = this.history.slice(0, this.historyIndex + 1);
                }

                this.board[index] = symbol;
                this.history.push([...this.board]);
                this.historyIndex++;
                return true;
            }
        };

        // =========================================================================
        // 5. HEURISTIC AI EXPERT SYSTEM
        // =========================================================================
        const AIEngine = {
            computeMove() {
                const size = GameEngine.size;
                const board = [...GameEngine.board];
                
                // Casual intelligence filter
                if (GameEngine.difficulty === 'casual' && Math.random() < 0.35) {
                    return this.getRandomMove(board);
                }

                // Optimal calculation routing
                if (size === 3) {
                    return this.getMinimaxMove(board);
                } else {
                    return this.getAlphaBetaHeuristicMove(board);
                }
            },

            getRandomMove(board) {
                const empties = board.map((c, i) => c === null ? i : null).filter(v => v !== null);
                return empties[Math.floor(Math.random() * empties.length)];
            },

            getMinimaxMove(board) {
                let optimalScore = -Infinity;
                let choice = -1;

                for (let i = 0; i < board.length; i++) {
                    if (board[i] === null) {
                        board[i] = GameEngine.aiSymbol;
                        let score = this.minimax(board, 0, false);
                        board[i] = null;
                        if (score > optimalScore) {
                            optimalScore = score;
                            choice = i;
                        }
                    }
                }
                return choice;
            },

            minimax(board, depth, isMaximizing) {
                const res = GameEngine.checkWinState(board);
                if (res) {
                    if (res.winner === GameEngine.aiSymbol) return 10 - depth;
                    if (res.winner === GameEngine.humanSymbol) return depth - 10;
                    return 0;
                }

                if (isMaximizing) {
                    let optimal = -Infinity;
                    for (let i = 0; i < board.length; i++) {
                        if (board[i] === null) {
                            board[i] = GameEngine.aiSymbol;
                            optimal = Math.max(optimal, this.minimax(board, depth + 1, false));
                            board[i] = null;
                        }
                    }
                    return optimal;
                } else {
                    let optimal = Infinity;
                    for (let i = 0; i < board.length; i++) {
                        if (board[i] === null) {
                            board[i] = GameEngine.humanSymbol;
                            optimal = Math.min(optimal, this.minimax(board, depth + 1, true));
                            board[i] = null;
                        }
                    }
                    return optimal;
                }
            },

            getAlphaBetaHeuristicMove(board) {
                let optimalScore = -Infinity;
                let choice = -1;
                // Max depth constrained dynamically by processing grid size complexity
                const configuredMaxDepth = GameEngine.size === 4 ? 4 : 3;

                for (let i = 0; i < board.length; i++) {
                    if (board[i] === null) {
                        board[i] = GameEngine.aiSymbol;
                        let score = this.alphaBeta(board, 0, -Infinity, Infinity, false, configuredMaxDepth);
                        board[i] = null;
                        if (score > optimalScore) {
                            optimalScore = score;
                            choice = i;
                        }
                    }
                }
                return choice === -1 ? this.getRandomMove(board) : choice;
            },

            alphaBeta(board, depth, alpha, beta, isMaximizing, maxDepth) {
                const res = GameEngine.checkWinState(board);
                if (res) {
                    if (res.winner === GameEngine.aiSymbol) return 1000 - depth;
                    if (res.winner === GameEngine.humanSymbol) return depth - 1000;
                    return 0;
                }

                if (depth >= maxDepth) {
                    return this.evaluateHeuristicMatrix(board);
                }

                if (isMaximizing) {
                    let maxEval = -Infinity;
                    for (let i = 0; i < board.length; i++) {
                        if (board[i] === null) {
                            board[i] = GameEngine.aiSymbol;
                            let evaluation = this.alphaBeta(board, depth + 1, alpha, beta, false, maxDepth);
                            board[i] = null;
                            maxEval = Math.max(maxEval, evaluation);
                            alpha = Math.max(alpha, evaluation);
                            if (beta <= alpha) break;
                        }
                    }
                    return maxEval;
                } else {
                    let minEval = Infinity;
                    for (let i = 0; i < board.length; i++) {
                        if (board[i] === null) {
                            board[i] = GameEngine.humanSymbol;
                            let evaluation = this.alphaBeta(board, depth + 1, alpha, beta, true, maxDepth);
                            board[i] = null;
                            minEval = Math.min(minEval, evaluation);
                            beta = Math.min(beta, evaluation);
                            if (beta <= alpha) break;
                        }
                    }
                    return minEval;
                }
            },

            evaluateHeuristicMatrix(board) {
                let totalScore = 0;
                for (let combo of GameEngine.winningCombos) {
                    let aiCount = 0;
                    let humanCount = 0;
                    for (let idx of combo) {
                        if (board[idx] === GameEngine.aiSymbol) aiCount++;
                        else if (board[idx] === GameEngine.humanSymbol) humanCount++;
                    }
                    if (aiCount > 0 && humanCount === 0) {
                        totalScore += Math.pow(10, aiCount);
                    } else if (humanCount > 0 && aiCount === 0) {
                        totalScore -= Math.pow(10, humanCount);
                    }
                }
                return totalScore;
            }
        };

        // =========================================================================
        // 6. UI RENDERER & RUNTIME ENVIRONMENT INTERACTION
        // =========================================================================
        const UIRenderer = {
            activeLastMoveIndex: -1,
            
            announce(message) {
                const element = document.getElementById('aria-announcer');
                element.textContent = '';
                setTimeout(() => element.textContent = message, 50);
            },

            switchScreen(screenId) {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById(screenId).classList.add('active');
                this.announce(`Switched interface panel to ${screenId.replace('screen-', '')}`);
            },

            applyGlobalThemeStyles() {
                const themeSetting = StorageManager.get('theme');
                if (themeSetting === 'system') {
                    const matchesDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.setAttribute('data-theme', matchesDark ? 'dark' : 'light');
                } else {
                    document.documentElement.setAttribute('data-theme', themeSetting);
                }

                const url = StorageManager.get('wallpaper');
                if (url) {
                    document.body.style.backgroundImage = `url('${url}')`;
                    document.body.classList.add('has-wallpaper');
                } else {
                    document.body.style.backgroundImage = '';
                    document.body.classList.remove('has-wallpaper');
                }

                document.documentElement.style.setProperty('--color-x', StorageManager.get('colorX'));
                document.documentElement.style.setProperty('--color-o', StorageManager.get('colorO'));
            },

            syncFormSettings() {
                document.getElementById('select-mode').value = StorageManager.get('mode');
                document.getElementById('select-difficulty').value = StorageManager.get('difficulty');
                document.getElementById('select-size').value = StorageManager.get('size');
                document.getElementById('select-symbol').value = StorageManager.get('symbol');
                document.getElementById('color-x').value = StorageManager.get('colorX');
                document.getElementById('color-o').value = StorageManager.get('colorO');
                document.getElementById('select-theme').value = StorageManager.get('theme');
                document.getElementById('input-wallpaper').value = StorageManager.get('wallpaper');
                document.getElementById('range-volume').value = StorageManager.get('volume');
                document.getElementById('btn-toggle-mute').textContent = StorageManager.get('muted') ? "Unmute" : "Mute";
                this.toggleAIDifficultyVisibility();
            },

            toggleAIDifficultyVisibility() {
                const mode = document.getElementById('select-mode').value;
                document.getElementById('ai-difficulty-group').style.display = (mode === 'pve') ? 'flex' : 'none';
            },

            renderNewBoard() {
                const boardContainer = document.getElementById('board');
                boardContainer.innerHTML = '';
                const N = GameEngine.size;
                boardContainer.style.gridTemplateColumns = `repeat(${N}, 1fr)`;

                for (let i = 0; i < N * N; i++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    cell.setAttribute('role', 'gridcell');
                    cell.setAttribute('tabindex', '0');
                    cell.setAttribute('data-index', i);
                    
                    const row = Math.floor(i / N) + 1;
                    const col = (i % N) + 1;
                    cell.setAttribute('aria-label', `Row ${row} Column ${col}, Empty`);

                    this.bindCellInputEvents(cell, i, row, col);
                    boardContainer.appendChild(cell);
                }
                this.activeLastMoveIndex = -1;
            },

            bindCellInputEvents(cell, idx, row, col) {
                const triggerAction = () => {
                    if (GameEngine.board[idx] || GameEngine.isThinking) return;
                    this.executeTurnCycle(idx);
                };

                cell.addEventListener('click', () => { triggerAction(); });
                cell.addEventListener('keydown', (e) => {
                    const N = GameEngine.size;
                    let destinationIndex = null;

                    switch (e.key) {
                        case ' ':
case 'Enter':
                            e.preventDefault();
                            triggerAction();
                            return;
                        case 'ArrowRight':
                            destinationIndex = (idx % N === N - 1) ? idx - (N - 1) : idx + 1;
                            break;
                        case 'ArrowLeft':
                            destinationIndex = (idx % N === 0) ? idx + (N - 1) : idx - 1;
                            break;
                        case 'ArrowDown':
                            destinationIndex = (idx >= N * (N - 1)) ? idx - N * (N - 1) : idx + N;
                            break;
                        case 'ArrowUp':
                            destinationIndex = (idx < N) ? idx + N * (N - 1) : idx - N;
                            break;
                        default: return;
                    }

                    if (destinationIndex !== null) {
                        e.preventDefault();
                        document.querySelector(`[data-index="${destinationIndex}"]`).focus();
                    }
                });
            },

            executeTurnCycle(index) {
                AudioManager.play('click');
                const actingSymbol = GameEngine.turn;
                
                if (!GameEngine.commitMove(index, actingSymbol)) return;
                this.activeLastMoveIndex = index;
                this.syncBoardToState();

                const outcome = GameEngine.checkWinState(GameEngine.board);
                if (outcome) {
                    this.handleMatchTermination(outcome);
                    return;
                }

                // Invert active turn sequence
                GameEngine.turn = GameEngine.turn === 'X' ? 'O' : 'X';
                
                if (GameEngine.mode === 'pve' && GameEngine.turn === GameEngine.aiSymbol) {
                    this.triggerAIProcessingThread();
                } else {
                    this.updateStatusBanner();
                }
            },

            triggerAIProcessingThread() {
                GameEngine.isThinking = true;
                this.updateStatusBanner();
                // Random variation added to create realistic delay cycles
                const processDelay = Math.floor(Math.random() * 200) + 400;

                setTimeout(() => {
                    const aiMove = AIEngine.computeMove();
                    GameEngine.isThinking = false;
                    
                    if (aiMove !== undefined && aiMove !== -1) {
                        AudioManager.play('click');
                        GameEngine.commitMove(aiMove, GameEngine.aiSymbol);
                        this.activeLastMoveIndex = aiMove;
                        this.syncBoardToState();

                        const outcome = GameEngine.checkWinState(GameEngine.board);
                        if (outcome) {
                            this.handleMatchTermination(outcome);
                            return;
                        }
                        GameEngine.turn = GameEngine.humanSymbol;
                    }
                    this.updateStatusBanner();
                }, processDelay);
            },

            syncBoardToState() {
                const cells = document.querySelectorAll('.cell');
                const N = GameEngine.size;

                cells.forEach((cell, idx) => {
                    const stateToken = GameEngine.board[idx];
                    cell.innerHTML = '';
                    cell.classList.remove('last-move');

                    const row = Math.floor(idx / N) + 1;
                    const col = (idx % N) + 1;

                    if (stateToken) {
                        cell.classList.add('occupied');
                        cell.setAttribute('aria-label', `Row ${row} Column ${col}, Filled ${stateToken}`);
                        
                        const visualNode = document.createElement('span');
                        visualNode.classList.add('piece');
                        visualNode.style.color = stateToken === 'X' ? StorageManager.get('colorX') : StorageManager.get('colorO');
                        visualNode.textContent = stateToken;
                        cell.appendChild(visualNode);
                    } else {
                        cell.classList.remove('occupied');
                        cell.setAttribute('aria-label', `Row ${row} Column ${col}, Empty`);
                    }

                    if (idx === this.activeLastMoveIndex) {
                        cell.classList.add('last-move');
                    }
                });
            },

            updateStatusBanner() {
                const banner = document.getElementById('game-status');
                if (GameEngine.isThinking) {
                    banner.textContent = "AI Engine calculating matrix branches...";
                    this.announce("AI is calculating options");
                } else {
                    banner.textContent = `Active Operation Turn: Player [${GameEngine.turn}]`;
                    this.announce(`Turn updated to player ${GameEngine.turn}`);
                }
            },

            handleMatchTermination(outcome) {
                const banner = document.getElementById('game-status');
                const stats = StorageManager.get('stats');
                stats.played++;

                if (outcome.winner === 'draw') {
                    banner.textContent = "Draw Confirmed. Equilibrium Achieved.";
                    AudioManager.play('draw');
                    this.announce("Game ended in a draw");
                    stats.draws++;
                    stats.currentStreak = 0;
                } else {
                    banner.textContent = `Match Concluded. Victor: [${outcome.winner}]`;
                    this.announce(`Player ${outcome.winner} won the match`);
                    
                    outcome.combination.forEach(idx => {
                        document.querySelector(`[data-index="${idx}"]`).classList.add('winning-cell');
                    });

                    // Parse profile metrics configurations
                    if (GameEngine.mode === 'pve') {
                        if (outcome.winner === GameEngine.humanSymbol) {
                            AudioManager.play('win');
                            AnimationEngine.triggerVictoryConfetti();
                            stats.wins++;
                            stats.currentStreak++;
                            if (stats.currentStreak > stats.bestStreak) stats.bestStreak = stats.currentStreak;
                        } else {
                            AudioManager.play('draw'); // Loss audio feedback path
                            stats.losses++;
                            stats.currentStreak = 0;
                        }
                    } else {
                        AudioManager.play('win');
                        AnimationEngine.triggerVictoryConfetti();
                    }
                }

                StorageManager.set('stats', stats);
                GameEngine.isThinking = false; 
                // Freeze board structure interactability post termination
                GameEngine.isThinking = true; 
            },

            renderHistoryTimelineState() {
                GameEngine.board = [...GameEngine.history[GameEngine.historyIndex]];
                this.syncBoardToState();
                const banner = document.getElementById('game-status');
                banner.textContent = `Viewing Move Step Node: [${GameEngine.historyIndex} / ${GameEngine.history.length - 1}]`;
            },

            populatePerformanceModal() {
                const stats = StorageManager.get('stats');
                document.getElementById('stat-played').textContent = stats.played;
                document.getElementById('stat-wins').textContent = stats.wins;
                document.getElementById('stat-losses').textContent = stats.losses;
                document.getElementById('stat-draws').textContent = stats.draws;
                
                const ratio = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
                document.getElementById('stat-pct').textContent = `${ratio}%`;
                document.getElementById('stat-streak').textContent = stats.currentStreak;
            }
        };

        // =========================================================================
        // 7. COIN TOSS LOGIC SYSTEM
        // =========================================================================
        const TossSystem = {
            resultWinner: null,
            isProcessing: false,
            
            executeTossSequence() {
                if (this.isProcessing) return;
                this.isProcessing = true;
                AudioManager.play('toss');

                const coin = document.getElementById('toss-coin');
                const status = document.getElementById('toss-status');
                const confirmBtn = document.getElementById('btn-confirm-toss');

                status.textContent = "Randomizing variance vectors...";
                UIRenderer.announce("Flipping coin...");

                const sides = ['X', 'O'];
                this.resultWinner = sides[Math.floor(Math.random() * sides.length)];

                // Rotate multiple times for visual effect
                const targetRotations = this.resultWinner === 'X' ? 1440 : 1620; 
                
                if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    coin.style.transform = `rotateY(${targetRotations}deg)`;
                } else {
                    coin.style.transform = this.resultWinner === 'X' ? 'rotateY(0deg)' : 'rotateY(180deg)';
                }

                setTimeout(() => {
                    this.isProcessing = false;
                    const humanChoice = StorageManager.get('symbol');
                    
                    if (GameEngine.mode === 'pvp') {
                        status.textContent = `Toss Won by Symbol: [${this.resultWinner}]. They open turn allocation.`;
                    } else {
                        if (this.resultWinner === humanChoice) {
                            status.textContent = `You won the toss. Symbol [${this.resultWinner}] takes execution phase 1.`;
                        } else {
                            status.textContent = `AI won the toss. Symbol [${this.resultWinner}] commands priority.`;
                        }
                    }
                    UIRenderer.announce(status.textContent);
                    confirmBtn.disabled = false;
                }, 2000);
            }
        };

        // =========================================================================
        // 8. BINDING HANDLERS & REGISTRATION INTERFACES
        // =========================================================================
        document.addEventListener('DOMContentLoaded', () => {
            UIRenderer.syncFormSettings();
            UIRenderer.applyGlobalThemeStyles();

            // Screen Setup UI Actions
            document.getElementById('select-mode').addEventListener('change', () => {
                UIRenderer.toggleAIDifficultyVisibility();
            });

            document.getElementById('btn-goto-toss').addEventListener('click', () => {
                // Read from view into persistence layer
                StorageManager.set('mode', document.getElementById('select-mode').value);
                StorageManager.set('difficulty', document.getElementById('select-difficulty').value);
                StorageManager.set('size', document.getElementById('select-size').value);
                StorageManager.set('symbol', document.getElementById('select-symbol').value);
                StorageManager.set('colorX', document.getElementById('color-x').value);
                StorageManager.set('colorO', document.getElementById('color-o').value);
                StorageManager.set('theme', document.getElementById('select-theme').value);
                StorageManager.set('wallpaper', document.getElementById('input-wallpaper').value);

                UIRenderer.applyGlobalThemeStyles();
                
                // Reset coin transform positions
                document.getElementById('toss-coin').style.transform = 'rotateY(0deg)';
                document.getElementById('btn-confirm-toss').disabled = true;
                document.getElementById('toss-status').textContent = "Awaiting rotation confirmation trigger.";

                UIRenderer.switchScreen('screen-toss');
            });

            document.getElementById('btn-clear-wallpaper').addEventListener('click', () => {
                document.getElementById('input-wallpaper').value = '';
                StorageManager.set('wallpaper', '');
                UIRenderer.applyGlobalThemeStyles();
            });

            // Metrics Panels Input Elements
            document.getElementById('btn-open-stats').addEventListener('click', () => {
                UIRenderer.populatePerformanceModal();
                document.getElementById('modal-stats-overlay').style.display = 'flex';
                document.getElementById('btn-close-stats').focus();
            });

            document.getElementById('btn-close-stats').addEventListener('click', () => {
                document.getElementById('modal-stats-overlay').style.display = 'none';
            });

            document.getElementById('btn-reset-stats').addEventListener('click', () => {
                if (confirm("Confirm deep purge of all system matrix records?")) {
                    StorageManager.set('stats', StorageManager.defaults.stats);
                    UIRenderer.populatePerformanceModal();
                }
            });

            // Toss Control Implementations
            document.getElementById('btn-execute-toss').addEventListener('click', () => {
                TossSystem.executeTossSequence();
            });

            document.getElementById('btn-confirm-toss').addEventListener('click', () => {
                GameEngine.initialize(
                    StorageManager.get('size'),
                    StorageManager.get('mode'),
                    StorageManager.get('difficulty'),
                    StorageManager.get('symbol')
                );

                GameEngine.turn = TossSystem.resultWinner;
                UIRenderer.renderNewBoard();
                UIRenderer.switchScreen('screen-game');
                UIRenderer.updateStatusBanner();

                if (GameEngine.mode === 'pve' && GameEngine.turn === GameEngine.aiSymbol) {
                    UIRenderer.triggerAIProcessingThread();
                }
            });

            // Runtime Match Panel Options
            document.getElementById('btn-abort-game').addEventListener('click', () => {
                if (confirm("Terminate ongoing computation? Progress matrix data will be dropped.")) {
                    UIRenderer.switchScreen('screen-setup');
                }
            });

            // History Explorer Functionality
            document.getElementById('btn-history-prev').addEventListener('click', () => {
                if (GameEngine.historyIndex > 0) {
                    GameEngine.historyIndex--;
                    UIRenderer.renderHistoryTimelineState();
                }
            });

            document.getElementById('btn-history-next').addEventListener('click', () => {
                if (GameEngine.historyIndex < GameEngine.history.length - 1) {
                    GameEngine.historyIndex++;
                    UIRenderer.renderHistoryTimelineState();
                }
            });

            // Volume Control Configuration Elements
            document.getElementById('range-volume').addEventListener('input', (e) => {
                StorageManager.set('volume', parseFloat(e.target.value));
            });

            document.getElementById('btn-toggle-mute').addEventListener('click', () => {
                const current = StorageManager.get('muted');
                StorageManager.set('muted', !current);
                document.getElementById('btn-toggle-mute').textContent = !current ? "Unmute" : "Mute";
            });

            // Watcher configuration mapping for changes in environment settings
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (StorageManager.get('theme') === 'system') UIRenderer.applyGlobalThemeStyles();
            });
        });
