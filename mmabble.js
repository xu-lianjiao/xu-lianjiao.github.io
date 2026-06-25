document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('mmabble-board');
    if (!board) return;

    const size = 9;

    // Game state variables as requested
    let tilesRemaining = 40;
    let tilesInBag = 26;
    let scoreYou = 0;
    let scoreAi = 0;
    let currentPlayScore = 0;
    let cells = null; // initialized after grid generation
    let gameOver = false;
    let aiTilesCount = 7;
    let currentTurn = 'player';
    const maxRackSize = 7;
    const boardTypes = Array.from({ length: size }, () => Array(size).fill('normal'));
    const boardCells = Array.from({ length: size }, () => Array(size).fill(null));

    const remainingEl = document.getElementById('mmabble-remaining');
    const bagEl = document.getElementById('mmabble-bag');
    const playBtn = document.getElementById('mmabble-play-btn');

    // Scoreboard DOM Elements
    const scoreYouEl = document.getElementById('mmabble-score-you');
    const scoreAiEl = document.getElementById('mmabble-score-ai');
    const playScoreEl = document.getElementById('mmabble-play-points');

    function updateStatusDisplay() {
        if (remainingEl) remainingEl.textContent = tilesRemaining;
        if (bagEl) bagEl.textContent = tilesInBag;
        if (scoreYouEl) scoreYouEl.textContent = scoreYou;
        if (scoreAiEl) scoreAiEl.textContent = scoreAi;
    }

    function createBoardStateFromDom() {
        const state = {
            board: Array.from({ length: size }, () => Array.from({ length: size }, () => ({
                occupied: false,
                active: false
            }))),
            scoreYou,
            scoreAi,
            playerRack: Array.from(slots || []).filter(slot => slot.querySelector('.mmabble-tile')).length,
            aiRack: aiTilesCount,
            bag: tilesInBag,
            turn: currentTurn
        };

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = boardCells[r][c];
                if (!cell) continue;
                state.board[r][c].occupied = cell.dataset.occupied === 'true';
                state.board[r][c].active = cell.dataset.active === 'true';
            }
        }

        return state;
    }

    function cloneState(state) {
        return {
            board: state.board.map(row => row.map(cell => ({
                occupied: cell.occupied,
                active: cell.active
            }))),
            scoreYou: state.scoreYou,
            scoreAi: state.scoreAi,
            playerRack: state.playerRack,
            aiRack: state.aiRack,
            bag: state.bag,
            turn: state.turn
        };
    }

    function countOccupiedTiles(state) {
        let count = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (state.board[r][c].occupied) {
                    count++;
                }
            }
        }
        return count;
    }

    function getInactiveOccupiedCount(state) {
        let count = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = state.board[r][c];
                if (cell.occupied && !cell.active) {
                    count++;
                }
            }
        }
        return count;
    }

    function evaluateStatePlay(state) {
        const activeCells = [];
        const inactiveOccupied = getInactiveOccupiedCount(state);

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (state.board[r][c].occupied && state.board[r][c].active) {
                    activeCells.push({ r, c });
                }
            }
        }

        if (activeCells.length === 0) {
            return { legal: false, score: 0 };
        }

        const isFirstMove = inactiveOccupied === 0;
        if (isFirstMove) {
            const centerOccupied = activeCells.some(cell => cell.r === 4 && cell.c === 4);
            if (!centerOccupied) {
                return { legal: false, score: 0 };
            }
        }

        const rows = activeCells.map(cell => cell.r);
        const cols = activeCells.map(cell => cell.c);
        const uniqueRows = [...new Set(rows)];
        const uniqueCols = [...new Set(cols)];

        if (uniqueRows.length > 1 && uniqueCols.length > 1) {
            return { legal: false, score: 0 };
        }

        if (uniqueRows.length === 1) {
            const r = uniqueRows[0];
            const minC = Math.min(...cols);
            const maxC = Math.max(...cols);
            for (let c = minC; c <= maxC; c++) {
                if (!state.board[r][c].occupied) {
                    return { legal: false, score: 0 };
                }
            }
        } else if (uniqueCols.length === 1) {
            const c = uniqueCols[0];
            const minR = Math.min(...rows);
            const maxR = Math.max(...rows);
            for (let r = minR; r <= maxR; r++) {
                if (!state.board[r][c].occupied) {
                    return { legal: false, score: 0 };
                }
            }
        }

        if (!isFirstMove) {
            let hasAdjacentConnection = false;
            for (const activeCell of activeCells) {
                const neighbors = [
                    { r: activeCell.r + 1, c: activeCell.c },
                    { r: activeCell.r - 1, c: activeCell.c },
                    { r: activeCell.r, c: activeCell.c + 1 },
                    { r: activeCell.r, c: activeCell.c - 1 }
                ];
                for (const n of neighbors) {
                    if (n.r >= 0 && n.r < size && n.c >= 0 && n.c < size) {
                        const neighborCell = state.board[n.r][n.c];
                        if (neighborCell.occupied && !neighborCell.active) {
                            hasAdjacentConnection = true;
                            break;
                        }
                    }
                }
                if (hasAdjacentConnection) break;
            }

            if (!hasAdjacentConnection) {
                return { legal: false, score: 0 };
            }
        }

        const formedWords = [];

        for (let r = 0; r < size; r++) {
            let startCol = null;
            for (let c = 0; c <= size; c++) {
                const occupied = c < size ? state.board[r][c].occupied : false;
                if (occupied) {
                    if (startCol === null) {
                        startCol = c;
                    }
                } else if (startCol !== null) {
                    const length = c - startCol;
                    if (length >= 2) {
                        const segment = [];
                        for (let col = startCol; col < c; col++) {
                            segment.push({ r, c: col });
                        }
                        if (segment.some(cell => state.board[cell.r][cell.c].active)) {
                            formedWords.push(segment);
                        }
                    }
                    startCol = null;
                }
            }
        }

        for (let c = 0; c < size; c++) {
            let startRow = null;
            for (let r = 0; r <= size; r++) {
                const occupied = r < size ? state.board[r][c].occupied : false;
                if (occupied) {
                    if (startRow === null) {
                        startRow = r;
                    }
                } else if (startRow !== null) {
                    const length = r - startRow;
                    if (length >= 2) {
                        const segment = [];
                        for (let row = startRow; row < r; row++) {
                            segment.push({ r: row, c });
                        }
                        if (segment.some(cell => state.board[cell.r][cell.c].active)) {
                            formedWords.push(segment);
                        }
                    }
                    startRow = null;
                }
            }
        }

        if (formedWords.length === 0) {
            return { legal: false, score: 0 };
        }

        for (const word of formedWords) {
            if (word.length < 2 || word.length > 3) {
                return { legal: false, score: 0 };
            }
        }

        let totalScore = 0;
        for (const word of formedWords) {
            let wordSum = 0;
            let wordMultiplier = 1;

            for (const cell of word) {
                let baseLetterVal = 3;
                if (state.board[cell.r][cell.c].active) {
                    const type = boardTypes[cell.r][cell.c];
                    if (type === 'dl') {
                        baseLetterVal *= 2;
                    } else if (type === 'tl') {
                        baseLetterVal *= 3;
                    } else if (type === 'dw' || type === 'start') {
                        wordMultiplier *= 2;
                    } else if (type === 'tw') {
                        wordMultiplier *= 3;
                    }
                }
                wordSum += baseLetterVal;
            }

            totalScore += wordSum * wordMultiplier;
        }

        return { legal: true, score: totalScore };
    }

    function hasLegalMoves(state, side) {
        const rackCount = side === 'player' ? state.playerRack : state.aiRack;
        if (rackCount < 1) {
            return false;
        }

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (state.board[r][c].occupied) {
                    continue;
                }

                state.board[r][c].occupied = true;
                state.board[r][c].active = true;
                const result = evaluateStatePlay(state);
                state.board[r][c].occupied = false;
                state.board[r][c].active = false;

                if (result.legal) {
                    return true;
                }
            }
        }

        return false;
    }

    function generateSearchMoves(state, side) {
        const rackCount = side === 'player' ? state.playerRack : state.aiRack;
        if (rackCount < 1) {
            return [];
        }

        const seen = new Set();
        const moves = [];
        function recordCandidate(cellsToPlace) {
            if (cellsToPlace.length > rackCount) {
                return;
            }

            for (const cell of cellsToPlace) {
                if (state.board[cell.r][cell.c].occupied) {
                    return;
                }
            }

            const previous = [];
            for (const cell of cellsToPlace) {
                const boardCell = state.board[cell.r][cell.c];
                previous.push({
                    r: cell.r,
                    c: cell.c,
                    occupied: boardCell.occupied,
                    active: boardCell.active
                });
                boardCell.occupied = true;
                boardCell.active = true;
            }

            const result = evaluateStatePlay(state);

            for (const cell of previous) {
                state.board[cell.r][cell.c].occupied = cell.occupied;
                state.board[cell.r][cell.c].active = cell.active;
            }

            if (!result.legal) {
                return;
            }

            const key = cellsToPlace
                .map(cell => `${cell.r},${cell.c}`)
                .sort()
                .join('|');
            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            moves.push({
                cells: cellsToPlace.map(cell => ({ r: cell.r, c: cell.c })),
                score: result.score
            });
        }

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (!state.board[r][c].occupied) {
                    recordCandidate([{ r, c }]);
                }
            }
        }

        if (rackCount >= 2) {
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size - 1; c++) {
                    recordCandidate([{ r, c }, { r, c: c + 1 }]);
                }
                for (let c = 0; c < size - 2; c++) {
                    recordCandidate([{ r, c }, { r, c: c + 2 }]);
                }
            }

            for (let c = 0; c < size; c++) {
                for (let r = 0; r < size - 1; r++) {
                    recordCandidate([{ r, c }, { r: r + 1, c }]);
                }
                for (let r = 0; r < size - 2; r++) {
                    recordCandidate([{ r, c }, { r: r + 2, c }]);
                }
            }
        }

        if (rackCount >= 3) {
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size - 2; c++) {
                    recordCandidate([
                        { r, c },
                        { r, c: c + 1 },
                        { r, c: c + 2 }
                    ]);
                }
            }

            for (let c = 0; c < size; c++) {
                for (let r = 0; r < size - 2; r++) {
                    recordCandidate([
                        { r, c },
                        { r: r + 1, c },
                        { r: r + 2, c }
                    ]);
                }
            }
        }

        return moves;
    }

    function applyMoveToState(state, side, move) {
        const next = cloneState(state);
        const rackKey = side === 'player' ? 'playerRack' : 'aiRack';
        const scoreKey = side === 'player' ? 'scoreYou' : 'scoreAi';

        for (const cell of move.cells) {
            next.board[cell.r][cell.c].occupied = true;
            next.board[cell.r][cell.c].active = true;
        }

        const moveResult = evaluateStatePlay(next);
        if (!moveResult.legal) {
            return null;
        }

        next[scoreKey] += moveResult.score;

        for (const cell of move.cells) {
            next.board[cell.r][cell.c].active = false;
        }

        next[rackKey] -= move.cells.length;
        const drawCount = Math.min(maxRackSize - next[rackKey], next.bag);
        next[rackKey] += drawCount;
        next.bag -= drawCount;

        const opponent = side === 'player' ? 'ai' : 'player';
        if (next[rackKey] === 0) {
            if (side === 'player') {
                next.scoreYou += 3 * next.aiRack;
                next.scoreAi -= 3 * next.aiRack;
            } else {
                next.scoreAi += 3 * next.playerRack;
                next.scoreYou -= 3 * next.playerRack;
            }
            next.turn = opponent;
            next.terminal = true;
            next.terminalReason = 'out';
            return next;
        }

        next.turn = opponent;
        if (!hasLegalMoves(next, opponent)) {
            next.scoreYou -= 3 * next.playerRack;
            next.scoreAi -= 3 * next.aiRack;
            next.terminal = true;
            next.terminalReason = 'stalemate';
            return next;
        }

        next.terminal = false;
        next.terminalReason = null;
        return next;
    }

    function evaluateTerminalUtility(state) {
        const spread = state.scoreAi - state.scoreYou;
        if (state.scoreAi > state.scoreYou) {
            return 1000 + spread;
        }
        if (state.scoreYou > state.scoreAi) {
            return -1000 + spread;
        }
        return spread;
    }

    function minimax(state, depth, alpha, beta) {
        const legalMoves = generateSearchMoves(state, state.turn);

        if (legalMoves.length === 0) {
            const terminalState = cloneState(state);
            terminalState.scoreYou -= 3 * terminalState.playerRack;
            terminalState.scoreAi -= 3 * terminalState.aiRack;
            return {
                value: evaluateTerminalUtility(terminalState),
                move: null
            };
        }

        if (depth === 0) {
            return {
                value: state.scoreAi - state.scoreYou,
                move: null
            };
        }

        const maximizing = state.turn === 'ai';
        const orderedMoves = legalMoves.slice().sort((a, b) => {
            return maximizing ? b.score - a.score : a.score - b.score;
        });

        let bestMove = null;

        if (maximizing) {
            let bestValue = -Infinity;
            for (const move of orderedMoves) {
                const nextState = applyMoveToState(state, 'ai', move);
                if (!nextState) continue;

                const value = nextState.terminal
                    ? evaluateTerminalUtility(nextState)
                    : minimax(nextState, depth - 1, alpha, beta).value;

                if (value > bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
                alpha = Math.max(alpha, bestValue);
                if (beta <= alpha) {
                    break;
                }
            }
            return { value: bestValue, move: bestMove };
        }

        let bestValue = Infinity;
        for (const move of orderedMoves) {
            const nextState = applyMoveToState(state, 'player', move);
            if (!nextState) continue;

            const value = nextState.terminal
                ? evaluateTerminalUtility(nextState)
                : minimax(nextState, depth - 1, alpha, beta).value;

            if (value < bestValue) {
                bestValue = value;
                bestMove = move;
            }
            beta = Math.min(beta, bestValue);
            if (beta <= alpha) {
                break;
            }
        }
        return { value: bestValue, move: bestMove };
    }

    function updatePlayButtonState() {
        if (!playBtn) return;

        if (gameOver || currentTurn !== 'player') {
            playBtn.disabled = true;
            if (playScoreEl) {
                playScoreEl.textContent = '-';
            }
            return;
        }

        const result = evaluateStatePlay(createBoardStateFromDom());
        currentPlayScore = result.score;
        playBtn.disabled = !result.legal;
        if (playScoreEl) {
            playScoreEl.textContent = result.legal ? currentPlayScore : '-';
        }
    }

    // Helper to get cell type
    function getCellType(r, c) {
        // Triple Word (TW) - Saturated Red
        if ((r === 0 || r === 8) && (c === 0 || c === 8)) {
            return 'tw';
        }
        // Double Word (DW) - Pink
        if ((r === 1 || r === 7) && (c === 1 || c === 7)) {
            return 'dw';
        }
        if (r === 4 && c === 4) {
            return 'start'; // Center cell
        }
        // Triple Letter (TL) - Saturated Blue
        if ((r === 2 || r === 6) && (c === 2 || c === 6)) {
            return 'tl';
        }
        if ((r === 0 || r === 8) && c === 4) {
            return 'tl';
        }
        if ((c === 0 || c === 8) && r === 4) {
            return 'tl';
        }
        // Double Letter (DL) - Light Blue
        if ((r === 3 || r === 5) && (c === 3 || c === 5)) {
            return 'dl';
        }
        return 'normal';
    }

    // Create board cells
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            const type = getCellType(r, c);

            cell.className = 'mmabble-cell';
            if (type !== 'normal') {
                cell.classList.add(type);
            }

            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.dataset.type = type;
            cell.dataset.active = 'true';
            cell.dataset.occupied = 'false';
            boardTypes[r][c] = type;
            boardCells[r][c] = cell;

            // If center starting square, add star SVG. Otherwise, add multiplier labels for bonus cells.
            if (type === 'start') {
                cell.innerHTML = `
                    <svg class="start-star" viewBox="0 0 24 24" fill="none" stroke="#1d2d44" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                `;
            } else if (type !== 'normal') {
                let labelText = '';
                if (type === 'tw') labelText = '3W';
                else if (type === 'dw') labelText = '2W';
                else if (type === 'tl') labelText = '3L';
                else if (type === 'dl') labelText = '2L';

                cell.innerHTML = `<span class="mmabble-cell-label">${labelText}</span>`;
            }

            board.appendChild(cell);
        }
    }

    cells = board.querySelectorAll('.mmabble-cell');

    // Set up Player Rack Slots and Tiles
    const rack = document.getElementById('mmabble-rack');
    const slots = rack.querySelectorAll('.mmabble-rack-slot');

    // Drag-and-drop state variables
    let draggedTile = null;
    let originalParent = null;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    // Define drag and drop event handlers
    function onTilePointerDown(e) {
        if (gameOver || currentTurn !== 'player') return;
        if (e.button !== 0) return; // Only allow left-clicks/standard presses

        const tile = e.currentTarget;
        const parent = tile.parentElement;

        // Only allow dragging if parent is NOT an inactive board cell
        if (parent.classList.contains('mmabble-cell') && parent.dataset.active === 'false') {
            return;
        }

        draggedTile = tile;
        originalParent = parent;
        startX = e.clientX;
        startY = e.clientY;
        hasMoved = false;

        // Get precise dimensions of the tile before detaching it
        const rect = tile.getBoundingClientRect();
        tile.style.width = rect.width + 'px';
        tile.style.height = rect.height + 'px';
        tile.style.position = 'fixed';
        tile.style.zIndex = '9999';
        tile.style.pointerEvents = 'none';

        // Set inline --tile-size custom property to preserve font rendering of M and 3
        tile.style.setProperty('--tile-size', rect.width + 'px');

        // Snap center of the tile directly to cursor position
        tile.style.left = (e.clientX - rect.width / 2) + 'px';
        tile.style.top = (e.clientY - rect.height / 2) + 'px';

        // Set the global cursor to grabbing hand
        document.body.style.cursor = 'grabbing';

        // Mark cell as unoccupied immediately when tile is lifted
        if (originalParent.classList.contains('mmabble-cell')) {
            originalParent.dataset.occupied = 'false';
        }

        document.body.appendChild(tile);

        window.addEventListener('pointermove', onTilePointerMove);
        window.addEventListener('pointerup', onTilePointerUp);
    }

    function onTilePointerMove(e) {
        if (!draggedTile) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
        }

        const width = parseFloat(draggedTile.style.width);
        const height = parseFloat(draggedTile.style.height);

        // Keep the tile centered under the cursor
        draggedTile.style.left = (e.clientX - width / 2) + 'px';
        draggedTile.style.top = (e.clientY - height / 2) + 'px';
    }

    function onTilePointerUp(e) {
        if (!draggedTile) return;

        window.removeEventListener('pointermove', onTilePointerMove);
        window.removeEventListener('pointerup', onTilePointerUp);

        const tile = draggedTile;
        const x = e.clientX;
        const y = e.clientY;

        // Find element below cursor (with pointer-events none, it goes straight to board/rack)
        const elementBelow = document.elementFromPoint(x, y);

        let cell = elementBelow ? elementBelow.closest('.mmabble-cell') : null;
        let rackContainer = elementBelow ? elementBelow.closest('.mmabble-rack-container') : null;
        let rackTiles = elementBelow ? elementBelow.closest('.mmabble-rack-tiles') : null;
        let rackSlot = elementBelow ? elementBelow.closest('.mmabble-rack-slot') : null;

        let placed = false;

        // If it was a simple click without significant movement
        if (!hasMoved) {
            if (originalParent.classList.contains('mmabble-cell')) {
                // Clicked tile on cell: return to leftmost empty rack slot (if active)
                const emptySlot = findLeftmostEmptySlot();
                if (emptySlot) {
                    emptySlot.appendChild(tile);
                    placed = true;
                }
            } else {
                // Clicked tile on rack: keep it there
                originalParent.appendChild(tile);
                placed = true;
            }
        } else {
            // Dragged action:
            // 1. Released over a board cell
            if (cell) {
                if (cell.dataset.active === 'true' && cell.dataset.occupied === 'false') {
                    cell.appendChild(tile);
                    cell.dataset.occupied = 'true';
                    placed = true;
                }
            }
            // 2. Released over player rack
            else if (rackContainer || rackTiles || rackSlot) {
                const emptySlot = findLeftmostEmptySlot();
                if (emptySlot) {
                    emptySlot.appendChild(tile);
                    placed = true;
                }
            }
        }

        // 3. Fallback: return to original parent if not successfully placed
        if (!placed) {
            originalParent.appendChild(tile);
            if (originalParent.classList.contains('mmabble-cell')) {
                originalParent.dataset.occupied = 'true';
            }
        }

        // Reset all inline style rules to revert to stylesheet constraints
        tile.style.position = '';
        tile.style.zIndex = '';
        tile.style.width = '';
        tile.style.height = '';
        tile.style.left = '';
        tile.style.top = '';
        tile.style.pointerEvents = '';
        tile.style.removeProperty('--tile-size');

        // Reset global body cursor
        document.body.style.cursor = '';

        draggedTile = null;
        originalParent = null;

        updatePlayButtonState();
    }

    // Create 7 tiles with letter 'M' and value '3' on the rack slots
    for (let i = 0; i < 7; i++) {
        slots[i].appendChild(createMmabbleTile(`mmabble-tile-${i}`));
    }

    // Find rightmost tile currently on the rack
    function findRightmostTileOnRack() {
        for (let i = 6; i >= 0; i--) {
            const slot = slots[i];
            const tile = slot.querySelector('.mmabble-tile');
            if (tile) {
                return tile;
            }
        }
        return null;
    }

    // Find leftmost empty slot on the rack
    function findLeftmostEmptySlot() {
        for (let i = 0; i < 7; i++) {
            const slot = slots[i];
            const tile = slot.querySelector('.mmabble-tile');
            if (!tile) {
                return slot;
            }
        }
        return null;
    }

    function countPlayerRackTiles() {
        return Array.from(slots).filter(slot => slot.querySelector('.mmabble-tile')).length;
    }

    function createMmabbleTile(idValue) {
        const tile = document.createElement('div');
        tile.className = 'mmabble-tile';
        tile.id = idValue || `mmabble-tile-${Date.now()}-${Math.random()}`;
        tile.innerHTML = `
            <span class="mmabble-tile-letter">M</span>
            <span class="mmabble-tile-value">3</span>
        `;
        tile.addEventListener('pointerdown', onTilePointerDown);
        tile.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        return tile;
    }

    function fillPlayerRackToMax() {
        const emptySlots = Array.from(slots).filter(slot => !slot.querySelector('.mmabble-tile'));
        const slotsToReplenish = Math.min(emptySlots.length, tilesInBag);

        for (let i = 0; i < slotsToReplenish; i++) {
            emptySlots[i].appendChild(createMmabbleTile());
        }

        tilesInBag -= slotsToReplenish;
    }

    function lockActiveCells() {
        const activeCells = Array.from(cells).filter(c => c.dataset.occupied === 'true' && c.dataset.active === 'true');
        activeCells.forEach(cell => {
            cell.dataset.active = 'false';
            const tile = cell.querySelector('.mmabble-tile');
            if (tile) {
                tile.style.cursor = 'default';
            }
        });
        return activeCells.length;
    }

    function applyGameOverScoring(reason, sideJustMoved) {
        const playerRackTiles = countPlayerRackTiles();
        if (reason === 'out') {
            if (sideJustMoved === 'player') {
                scoreYou += 3 * aiTilesCount;
                scoreAi -= 3 * aiTilesCount;
            } else {
                scoreAi += 3 * playerRackTiles;
                scoreYou -= 3 * playerRackTiles;
            }
            return;
        }

        scoreYou -= 3 * playerRackTiles;
        scoreAi -= 3 * aiTilesCount;
    }

    function setGameOver(reason, sideJustMoved) {
        gameOver = true;
        currentTurn = 'player';
        applyGameOverScoring(reason, sideJustMoved);
        updateStatusDisplay();
        updatePlayButtonState();
        showGameOverOverlay();
    }

    function maybeAdvanceTurn(sideJustMoved) {
        if (gameOver) {
            return;
        }

        const sideRackTiles = sideJustMoved === 'player' ? countPlayerRackTiles() : aiTilesCount;
        if (sideRackTiles === 0) {
            setGameOver('out', sideJustMoved);
            return;
        }

        const nextTurn = sideJustMoved === 'player' ? 'ai' : 'player';
        const state = createBoardStateFromDom();
        state.turn = nextTurn;

        if (!hasLegalMoves(state, nextTurn)) {
            setGameOver('stalemate', sideJustMoved);
            return;
        }

        currentTurn = nextTurn;
        updatePlayButtonState();

        if (currentTurn === 'ai') {
            const noticeEl = document.getElementById('mmabble-ai-score-notice');
            if (noticeEl) {
                noticeEl.style.visibility = 'hidden';
            }
            window.setTimeout(runAiTurn, 100);
        }
    }

    function commitAiMove(move) {
        for (const cellPos of move.cells) {
            const cell = boardCells[cellPos.r][cellPos.c];
            const tile = createMmabbleTile();
            cell.appendChild(tile);
            cell.dataset.occupied = 'true';
            cell.dataset.active = 'false';
            tile.style.cursor = 'default';
        }

        scoreAi += move.score;
        aiTilesCount -= move.cells.length;
        const aiSlotsNeeded = Math.min(maxRackSize - aiTilesCount, tilesInBag);
        aiTilesCount += aiSlotsNeeded;
        tilesInBag -= aiSlotsNeeded;
        tilesRemaining -= move.cells.length;
    }

    function runAiTurn() {
        if (gameOver || currentTurn !== 'ai') {
            return;
        }

        const state = createBoardStateFromDom();
        state.turn = 'ai';
        const search = minimax(state, 2, -Infinity, Infinity);
        if (!search.move) {
            setGameOver('stalemate', 'ai');
            return;
        }

        commitAiMove(search.move);
        const noticeEl = document.getElementById('mmabble-ai-score-notice');
        if (noticeEl) {
            noticeEl.textContent = `AI scored ${search.move.score} points`;
            noticeEl.style.visibility = 'visible';
        }
        updateStatusDisplay();
        currentTurn = 'player';
        maybeAdvanceTurn('ai');
    }

    // Add Click Handlers for Interactive Cell-based Tile Placement
    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            if (gameOver || currentTurn !== 'player') return;
            // Only interact if cell is active
            if (cell.dataset.active !== 'true') return;

            if (cell.dataset.occupied === 'true') {
                // Clicked occupied cell: return its tile to leftmost empty slot on the rack
                const existingTile = cell.querySelector('.mmabble-tile');
                if (existingTile) {
                    const emptySlot = findLeftmostEmptySlot();
                    if (emptySlot) {
                        emptySlot.appendChild(existingTile);
                        cell.dataset.occupied = 'false';
                        updatePlayButtonState();
                    }
                }
            } else {
                // Clicked empty cell: move the rightmost tile from the rack to this cell
                const tileToMove = findRightmostTileOnRack();
                if (tileToMove) {
                    cell.appendChild(tileToMove);
                    cell.dataset.occupied = 'true';
                    updatePlayButtonState();
                }
            }
        });
    });

    // Set up Reset Button Interaction
    const resetBtn = document.getElementById('mmabble-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Delete all tiles currently on the page
            const allTiles = document.querySelectorAll('.mmabble-tile');
            allTiles.forEach(tile => tile.remove());

            // Re-create the 7 initial tiles on the rack slots
            for (let i = 0; i < 7; i++) {
                slots[i].appendChild(createMmabbleTile(`mmabble-tile-${i}`));
            }

            // Reset all cells to unoccupied and active
            cells.forEach(c => {
                c.dataset.occupied = 'false';
                c.dataset.active = 'true';
            });

            // Reset state variables to default values
            tilesRemaining = 40;
            tilesInBag = 26;
            scoreYou = 0;
            scoreAi = 0;
            currentPlayScore = 0;
            gameOver = false;
            aiTilesCount = 7;
            currentTurn = 'player';

            // Remove game over overlay if exists
            const overlay = board.querySelector('.mmabble-overlay');
            if (overlay) {
                overlay.remove();
            }

            const noticeEl = document.getElementById('mmabble-ai-score-notice');
            if (noticeEl) {
                noticeEl.style.visibility = 'hidden';
            }

            updateStatusDisplay();
            updatePlayButtonState();
        });
    }

    // Set up Play Button Interaction
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (gameOver || currentTurn !== 'player') return;

            const result = evaluateStatePlay(createBoardStateFromDom());
            if (!result.legal) return;

            // Add play score to player's total score
            scoreYou += result.score;

            // Lock all currently placed active tiles by setting active to 'false'
            const tilesPlayedCount = lockActiveCells();
            fillPlayerRackToMax();
            tilesRemaining -= tilesPlayedCount;

            // Reset current play score to 0
            currentPlayScore = 0;
            updateStatusDisplay();
            maybeAdvanceTurn('player');
        });
    }

    function showGameOverOverlay() {
        // Remove existing overlay if any
        const existing = board.querySelector('.mmabble-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'mmabble-overlay';

        let playerText = "";
        if (scoreYou > scoreAi) {
            playerText = "You win!";
        } else if (scoreAi > scoreYou) {
            playerText = "AI wins!";
        } else {
            playerText = "it's a tie!";
        }

        overlay.textContent = `Game over, ${playerText}`;
        board.appendChild(overlay);
    }

    // Initialize status text display and play button state
    updateStatusDisplay();
    updatePlayButtonState();
});
