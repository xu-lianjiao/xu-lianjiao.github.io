document.addEventListener('DOMContentLoaded', () => {
    const ROWS = 6;
    const COLS = 7;

    let board = [];
    let currentPlayer = 1; // 1 for Player 1 (Red), 2 for Player 2 (Yellow)
    let isThinking = false; // Prevents clicks during AI thinking time
    let gameOver = false;
    let startTime = 0;

    const tokensContainer = document.getElementById('tokens-container');
    const boardFrame = document.getElementById('board-frame');
    const columnsContainer = document.getElementById('columns-container');
    const statusIndicator = document.getElementById('status-indicator') || document.createElement('div');
    const statusText = document.getElementById('status-text') || document.createElement('div');
    const resetBtn = document.getElementById('reset-btn');

    // Initialize the game
    function initGame() {
        board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        currentPlayer = 1;
        isThinking = false;
        gameOver = false;

        // Clear draw styling
        const container = document.querySelector('.connect4-container');
        if (container) {
            container.classList.remove('draw');
        }

        // Clear confetti
        const confettiContainer = document.getElementById('confetti-container');
        if (confettiContainer) {
            confettiContainer.innerHTML = '';
        }

        // Clear dynamic elements
        tokensContainer.innerHTML = '';
        boardFrame.innerHTML = '';
        columnsContainer.innerHTML = '';

        // Generate 42 circular cutout board cells
        for (let i = 0; i < ROWS * COLS; i++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            boardFrame.appendChild(cell);
        }

        // Generate 7 interactive columns
        for (let col = 0; col < COLS; col++) {
            const colOverlay = document.createElement('div');
            colOverlay.className = 'column-overlay';
            colOverlay.dataset.col = col;

            // Handle column hovering
            colOverlay.addEventListener('mouseenter', () => {
                if (gameOver || isThinking) return;
                colOverlay.classList.add(currentPlayer === 1 ? 'hover-red' : 'hover-yellow');
            });

            colOverlay.addEventListener('mouseleave', () => {
                colOverlay.classList.remove('hover-red', 'hover-yellow');
            });

            // Handle column clicks
            colOverlay.addEventListener('click', () => {
                if (gameOver || isThinking || currentPlayer !== 1) return;

                // Remove hover visual immediately on click
                colOverlay.classList.remove('hover-red', 'hover-yellow');

                makeMove(col);
            });

            columnsContainer.appendChild(colOverlay);
        }

        updateStatus();
    }

    // Attempt to make a move in a column
    function makeMove(col) {
        // Find the lowest available row in the selected column
        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][col] === 0) {
                targetRow = r;
                break;
            }
        }

        // Column is full, click ignored
        if (targetRow === -1) return;

        // Update board state
        board[targetRow][col] = currentPlayer;

        // Create and animate token
        const token = document.createElement('div');
        token.className = `token ${currentPlayer === 1 ? 'red' : 'yellow'} drop-animation`;
        token.style.setProperty('--col', col);
        token.style.setProperty('--row', targetRow);
        tokensContainer.appendChild(token);

        // Check if currentPlayer won
        if (checkWin(board, currentPlayer)) {
            gameOver = true;
            isThinking = false;

            // Highlight the winning 4-in-a-row after the drop animation completes (500ms delay)
            const winCoords = getWinningCoords(board, currentPlayer);
            if (winCoords) {
                setTimeout(() => {
                    winCoords.forEach(([r, c]) => {
                        const cellIdx = r * COLS + c;
                        const cell = boardFrame.children[cellIdx];
                        if (cell) {
                            cell.classList.add('winning');
                        }
                    });
                }, 500);
            }

            // Celebration confetti if the player wins (currentPlayer === 1)
            if (currentPlayer === 1) {
                setTimeout(playConfetti, 500);
            }

            setTimeout(() => {
                statusIndicator.className = 'status-indicator';
                if (currentPlayer === 1) {
                    statusIndicator.classList.add('red');
                    statusText.textContent = "You win!";
                } else {
                    statusIndicator.classList.add('yellow');
                    statusText.textContent = "AI wins!";
                }
            }, 350); // Slight delay for the drop animation to finish
            return;
        }

        // Check if board is full (draw)
        if (!hasAvailableMoves()) {
            gameOver = true;
            isThinking = false;
            const container = document.querySelector('.connect4-container');
            if (container) {
                container.classList.add('draw');
            }
            setTimeout(() => {
                statusIndicator.className = 'status-indicator';
                statusText.textContent = "It's a draw!";
            }, 350);
            return;
        }

        // Turn management
        if (currentPlayer === 1) {
            currentPlayer = 2;
            isThinking = true;
            updateStatus();

            // Check if there are any valid moves left before scheduling AI
            if (hasAvailableMoves()) {
                setTimeout(aiMove, 600); // 600ms delay for visual/thinking naturalness
            } else {
                handleBoardFull();
            }
        } else {
            currentPlayer = 1;
            // Cooldown after AI makes the move to let the drop animation complete
            setTimeout(() => {
                isThinking = false;
                updateStatus();

                if (!hasAvailableMoves()) {
                    handleBoardFull();
                }
            }, 500);
        }
    }

    // Helper to check if a player has 4-in-a-row on the board
    function checkWin(grid, player) {
        // Horizontal check
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 3; c++) {
                if (grid[r][c] === player &&
                    grid[r][c + 1] === player &&
                    grid[r][c + 2] === player &&
                    grid[r][c + 3] === player) {
                    return true;
                }
            }
        }

        // Vertical check
        for (let r = 0; r < ROWS - 3; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === player &&
                    grid[r + 1][c] === player &&
                    grid[r + 2][c] === player &&
                    grid[r + 3][c] === player) {
                    return true;
                }
            }
        }

        // Diagonal up check (bottom-left to top-right)
        for (let r = 3; r < ROWS; r++) {
            for (let c = 0; c < COLS - 3; c++) {
                if (grid[r][c] === player &&
                    grid[r - 1][c + 1] === player &&
                    grid[r - 2][c + 2] === player &&
                    grid[r - 3][c + 3] === player) {
                    return true;
                }
            }
        }

        // Diagonal down check (top-left to bottom-right)
        for (let r = 0; r < ROWS - 3; r++) {
            for (let c = 0; c < COLS - 3; c++) {
                if (grid[r][c] === player &&
                    grid[r + 1][c + 1] === player &&
                    grid[r + 2][c + 2] === player &&
                    grid[r + 3][c + 3] === player) {
                    return true;
                }
            }
        }

        return false;
    }

    // Helper to get winning coordinates
    function getWinningCoords(grid, player) {
        // Horizontal check
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 3; c++) {
                if (grid[r][c] === player &&
                    grid[r][c + 1] === player &&
                    grid[r][c + 2] === player &&
                    grid[r][c + 3] === player) {
                    return [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]];
                }
            }
        }

        // Vertical check
        for (let r = 0; r < ROWS - 3; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === player &&
                    grid[r + 1][c] === player &&
                    grid[r + 2][c] === player &&
                    grid[r + 3][c] === player) {
                    return [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]];
                }
            }
        }

        // Diagonal up check (bottom-left to top-right)
        for (let r = 3; r < ROWS; r++) {
            for (let c = 0; c < COLS - 3; c++) {
                if (grid[r][c] === player &&
                    grid[r - 1][c + 1] === player &&
                    grid[r - 2][c + 2] === player &&
                    grid[r - 3][c + 3] === player) {
                    return [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]];
                }
            }
        }

        // Diagonal down check (top-left to bottom-right)
        for (let r = 0; r < ROWS - 3; r++) {
            for (let c = 0; c < COLS - 3; c++) {
                if (grid[r][c] === player &&
                    grid[r + 1][c + 1] === player &&
                    grid[r + 2][c + 2] === player &&
                    grid[r + 3][c + 3] === player) {
                    return [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]];
                }
            }
        }

        return null;
    }

    // Custom utility evaluation function:
    // yellow won is 1000, red won is -1000.
    // Otherwise: winConditions - lossConditions.
    function evaluateBoard(grid) {
        if (checkWin(grid, 2)) return 1000;
        if (checkWin(grid, 1)) return -1000;

        let winConditions = 0;
        let lossConditions = 0;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === 0) {
                    // Check if occupied by agent results in agent win
                    grid[r][c] = 2;
                    if (checkWin(grid, 2)) {
                        winConditions++;
                    }
                    grid[r][c] = 0;

                    // Check if occupied by player results in player win
                    grid[r][c] = 1;
                    if (checkWin(grid, 1)) {
                        lossConditions++;
                    }
                    grid[r][c] = 0;
                }
            }
        }

        return winConditions - lossConditions;
    }

    // Minimax search algorithm with alpha-beta pruning
    function minimax(grid, depth, alpha, beta, isMaximizing) {
        if (Date.now() - startTime >= 5000) {
            return evaluateBoard(grid);
        }
        if (checkWin(grid, 2)) return 1000 - depth;
        if (checkWin(grid, 1)) return -1000 - depth;

        let isFull = true;
        for (let c = 0; c < COLS; c++) {
            if (grid[0][c] === 0) {
                isFull = false;
                break;
            }
        }

        if (depth === 0 || isFull) {
            return evaluateBoard(grid);
        }

        const colOrder = [3, 2, 4, 1, 5, 0, 6];

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let c of colOrder) {
                let row = -1;
                for (let r = ROWS - 1; r >= 0; r--) {
                    if (grid[r][c] === 0) {
                        row = r;
                        break;
                    }
                }

                if (row !== -1) {
                    grid[row][c] = 2;
                    const evaluation = minimax(grid, depth - 1, alpha, beta, false);
                    grid[row][c] = 0;

                    maxEval = Math.max(maxEval, evaluation);
                    alpha = Math.max(alpha, evaluation);
                    if (beta <= alpha) {
                        break;
                    }
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let c of colOrder) {
                let row = -1;
                for (let r = ROWS - 1; r >= 0; r--) {
                    if (grid[r][c] === 0) {
                        row = r;
                        break;
                    }
                }

                if (row !== -1) {
                    grid[row][c] = 1;
                    const evaluation = minimax(grid, depth - 1, alpha, beta, true);
                    grid[row][c] = 0;

                    minEval = Math.min(minEval, evaluation);
                    beta = Math.min(beta, evaluation);
                    if (beta <= alpha) {
                        break;
                    }
                }
            }
            return minEval;
        }
    }

    // Minimax AI with Alpha-Beta pruning (searches to depth of 7 plies)
    function aiMove() {
        startTime = Date.now();
        let bestCols = [];
        let bestEval = -Infinity;
        const colOrder = [3, 2, 4, 1, 5, 0, 6];

        for (let c of colOrder) {
            let r = -1;
            for (let row = ROWS - 1; row >= 0; row--) {
                if (board[row][c] === 0) {
                    r = row;
                    break;
                }
            }

            if (r !== -1) {
                board[r][c] = 2; // Simulate AI move
                // Depth = 6 here, combined with the simulated AI root move = 7 moves total
                const evaluation = minimax(board, 6, -Infinity, Infinity, false);
                board[r][c] = 0; // Undo AI move

                if (evaluation > bestEval) {
                    bestEval = evaluation;
                    bestCols = [c];
                } else if (evaluation === bestEval) {
                    bestCols.push(c);
                }
            }
        }

        if (bestCols.length > 0) {
            const chosenCol = bestCols[Math.floor(Math.random() * bestCols.length)];
            makeMove(chosenCol);
        } else {
            handleBoardFull();
        }
    }

    // Helper to check if any columns have free spaces
    function hasAvailableMoves() {
        for (let c = 0; c < COLS; c++) {
            if (board[0][c] === 0) return true;
        }
        return false;
    }

    // Handle board full state
    function handleBoardFull() {
        isThinking = false;
        const container = document.querySelector('.connect4-container');
        if (container) {
            container.classList.add('draw');
        }
        statusIndicator.className = 'status-indicator';
        statusText.textContent = "Board is full!";
    }

    // Update status bar UI
    function updateStatus() {
        statusIndicator.className = 'status-indicator';
        if (isThinking) {
            statusIndicator.classList.add('thinking');
            statusText.textContent = "AI is thinking...";
        } else {
            if (currentPlayer === 1) {
                statusIndicator.classList.add('red');
                statusText.textContent = "Your turn";
            } else {
                statusIndicator.classList.add('yellow');
                statusText.textContent = "AI's turn";
            }
        }
    }

    // Play confetti celebration animation
    function playConfetti() {
        const container = document.getElementById('confetti-container');
        if (!container) return;

        const colors = ['#f54242', '#f5a442', '#f5eb42', '#42f554', '#42e6f5', '#a442f5', '#f542b9'];
        const confettiCount = 130; // Increased count for a bigger explosion

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';

            // Random size between 6px and 12px
            const size = Math.random() * 6 + 6;
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

            // Shoot out from just above the board in the center (relative to enlarged container offset by 150px)
            const startX = 310 + (Math.random() * 60 - 30);
            const startY = 140 + (Math.random() * 30 - 15);

            // Angle: shoot upwards (-30 deg to 210 deg)
            const angle = Math.random() * Math.PI * 1.2 + Math.PI * 1.9;
            const velocity = Math.random() * 150 + 100; // Increased velocity for a wider blast

            const midX = startX + Math.cos(angle) * velocity;
            const midY = startY + Math.sin(angle) * velocity;

            // Fall down below the board
            const endX = midX + (Math.random() * 60 - 30);
            const endY = midY + Math.random() * 150 + 120; // Increased falling distance

            confetti.style.setProperty('--start-x', `${startX}px`);
            confetti.style.setProperty('--start-y', `${startY}px`);
            confetti.style.setProperty('--mid-x', `${midX}px`);
            confetti.style.setProperty('--mid-y', `${midY}px`);
            confetti.style.setProperty('--end-x', `${endX}px`);
            confetti.style.setProperty('--end-y', `${endY}px`);

            // Random delay and duration (speed halved: duration is doubled)
            confetti.style.animationDelay = `${Math.random() * 0.25}s`;
            confetti.style.animationDuration = `${Math.random() * 3.0 + 2.5}s`;

            container.appendChild(confetti);

            // Cleanup after animation completes
            setTimeout(() => {
                confetti.remove();
            }, 6000);
        }
    }

    // Reset button event listener
    resetBtn.addEventListener('click', initGame);

    // Start the game
    initGame();
});
