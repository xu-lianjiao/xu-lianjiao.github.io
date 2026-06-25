document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('mumble-board');
    if (!board) return;

    const size = 11;

    // Game state variables
    let bagM = 40;
    let bagU = 20;
    let scoreYou = 0;
    let scoreAi = 0;
    let currentPlayScore = 0;
    let cells = null; // initialized after grid generation
    let gameOver = false;
    let currentTurn = 'player';
    const maxRackSize = 7;

    // AI rack counts
    let aiM = 0;
    let aiU = 0;

    // Swap mode state
    let swapModeActive = false;

    // Grid coordinates
    const boardTypes = Array.from({ length: size }, () => Array(size).fill('normal'));
    const boardCells = Array.from({ length: size }, () => Array(size).fill(null));

    // DOM Elements
    const unseenMEl = document.getElementById('mumble-unseen-m');
    const unseenUEl = document.getElementById('mumble-unseen-u');
    const playBtn = document.getElementById('mumble-play-btn');
    const resetBtn = document.getElementById('mumble-reset-btn');
    const swapBtn = document.getElementById('mumble-swap-btn');
    const scoreYouEl = document.getElementById('mumble-score-you');
    const scoreAiEl = document.getElementById('mumble-score-ai');
    const playScoreEl = document.getElementById('mumble-play-points');

    const legalWords = new Set(["MM", "MU", "UM", "MMM", "MUM", "UMM", "UMU", "MUMM", "MUMU", "MUUMUU"]);

    function getUnseenCounts() {
        return {
            M: bagM + aiM,
            U: bagU + aiU
        };
    }

    function updateStatusDisplay() {
        const unseen = getUnseenCounts();
        if (unseenMEl) unseenMEl.textContent = unseen.M;
        if (unseenUEl) unseenUEl.textContent = unseen.U;
        if (scoreYouEl) scoreYouEl.textContent = scoreYou;
        if (scoreAiEl) scoreAiEl.textContent = scoreAi;

        // Update Swap button state
        if (swapBtn) {
            const hasActiveTiles = Array.from(cells || []).some(c => c.dataset.occupied === 'true' && c.dataset.active === 'true');
            const totalBag = bagM + bagU;
            if (totalBag >= 7 && !hasActiveTiles && !gameOver && currentTurn === 'player') {
                swapBtn.disabled = false;
            } else {
                swapBtn.disabled = true;
            }
        }
    }

    function createBoardStateFromDom() {
        const state = {
            board: Array.from({ length: size }, () => Array.from({ length: size }, () => ({
                occupied: false,
                active: false,
                letter: null
            }))),
            scoreYou,
            scoreAi,
            playerRack: getPlayerRackCounts(),
            aiRack: { M: aiM, U: aiU },
            bag: { M: bagM, U: bagU },
            turn: currentTurn
        };

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = boardCells[r][c];
                if (!cell) continue;
                state.board[r][c].occupied = cell.dataset.occupied === 'true';
                state.board[r][c].active = cell.dataset.active === 'true';
                if (state.board[r][c].occupied) {
                    const tile = cell.querySelector('.mmabble-tile');
                    if (tile) {
                        state.board[r][c].letter = tile.querySelector('.mmabble-tile-letter').textContent.trim();
                    }
                }
            }
        }

        return state;
    }

    function cloneState(state) {
        return {
            board: state.board.map(row => row.map(cell => ({
                occupied: cell.occupied,
                active: cell.active,
                letter: cell.letter
            }))),
            scoreYou: state.scoreYou,
            scoreAi: state.scoreAi,
            playerRack: { ...state.playerRack },
            aiRack: { ...state.aiRack },
            bag: { ...state.bag },
            turn: state.turn
        };
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
            const centerOccupied = activeCells.some(cell => cell.r === 5 && cell.c === 5);
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
            const wordStr = word.map(cell => state.board[cell.r][cell.c].letter).join('');
            if (!legalWords.has(wordStr)) {
                return { legal: false, score: 0 };
            }
        }

        let totalScore = 0;
        for (const word of formedWords) {
            let wordSum = 0;
            let wordMultiplier = 1;

            for (const cell of word) {
                const letter = state.board[cell.r][cell.c].letter;
                let baseLetterVal = (letter === 'M') ? 3 : 1;

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
        const totalBag = state.bag.M + state.bag.U;
        // The function of a legal move existence checker only kicks in once there are fewer than 7 tiles in the bag
        if (totalBag >= 7) {
            return true;
        }

        const rack = side === 'player' ? state.playerRack : state.aiRack;
        const totalRack = rack.M + rack.U;
        if (totalRack < 1) {
            return false;
        }

        // Check only 1-tile or 2-tile plays
        // 1-tile plays:
        const lettersToTry = [];
        if (rack.M >= 1) lettersToTry.push('M');
        if (rack.U >= 1) lettersToTry.push('U');

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (state.board[r][c].occupied) continue;

                for (const letter of lettersToTry) {
                    state.board[r][c].occupied = true;
                    state.board[r][c].active = true;
                    state.board[r][c].letter = letter;

                    const result = evaluateStatePlay(state);

                    state.board[r][c].occupied = false;
                    state.board[r][c].active = false;
                    state.board[r][c].letter = null;

                    if (result.legal) {
                        return true;
                    }
                }
            }
        }

        // 2-tile plays:
        if (totalRack >= 2) {
            const letterCombos = [];
            if (rack.M >= 2) letterCombos.push(['M', 'M']);
            if (rack.M >= 1 && rack.U >= 1) {
                letterCombos.push(['M', 'U']);
                letterCombos.push(['U', 'M']);
            }
            if (rack.U >= 2) letterCombos.push(['U', 'U']);

            // Generate pairs of cells
            const pairs = [];
            // Horizontal consecutive or gap of 1
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size - 1; c++) {
                    pairs.push([{ r, c }, { r, c: c + 1 }]);
                }
                for (let c = 0; c < size - 2; c++) {
                    pairs.push([{ r, c }, { r, c: c + 2 }]);
                }
            }
            // Vertical consecutive or gap of 1
            for (let c = 0; c < size; c++) {
                for (let r = 0; r < size - 1; r++) {
                    pairs.push([{ r, c }, { r: r + 1, c }]);
                }
                for (let r = 0; r < size - 2; r++) {
                    pairs.push([{ r, c }, { r: r + 2, c }]);
                }
            }

            for (const pair of pairs) {
                if (state.board[pair[0].r][pair[0].c].occupied || state.board[pair[1].r][pair[1].c].occupied) {
                    continue;
                }

                for (const combo of letterCombos) {
                    state.board[pair[0].r][pair[0].c].occupied = true;
                    state.board[pair[0].r][pair[0].c].active = true;
                    state.board[pair[0].r][pair[0].c].letter = combo[0];

                    state.board[pair[1].r][pair[1].c].occupied = true;
                    state.board[pair[1].r][pair[1].c].active = true;
                    state.board[pair[1].r][pair[1].c].letter = combo[1];

                    const result = evaluateStatePlay(state);

                    state.board[pair[0].r][pair[0].c].occupied = false;
                    state.board[pair[0].r][pair[0].c].active = false;
                    state.board[pair[0].r][pair[0].c].letter = null;

                    state.board[pair[1].r][pair[1].c].occupied = false;
                    state.board[pair[1].r][pair[1].c].active = false;
                    state.board[pair[1].r][pair[1].c].letter = null;

                    if (result.legal) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // Generate legal moves for AI using segment-based search
    function generateAgentMoves(state) {
        const rack = state.aiRack;
        const totalRack = rack.M + rack.U;
        if (totalRack < 1) {
            return [];
        }

        const moves = [];
        const seen = new Set();

        // Horizontal segments
        for (let r = 0; r < size; r++) {
            for (let cStart = 0; cStart < size; cStart++) {
                for (let cEnd = cStart + 1; cEnd < size; cEnd++) {
                    const len = cEnd - cStart + 1;
                    const cellsInSeg = [];
                    let emptyCount = 0;
                    for (let c = cStart; c <= cEnd; c++) {
                        const occupied = state.board[r][c].occupied;
                        cellsInSeg.push({ r, c, occupied, letter: state.board[r][c].letter });
                        if (!occupied) {
                            emptyCount++;
                        }
                    }

                    if (emptyCount >= 1 && emptyCount <= totalRack) {
                        const emptyIndices = [];
                        for (let i = 0; i < len; i++) {
                            if (!cellsInSeg[i].occupied) {
                                emptyIndices.push(i);
                            }
                        }

                        const numCombos = Math.pow(2, emptyCount);
                        for (let comboIdx = 0; comboIdx < numCombos; comboIdx++) {
                            let neededM = 0;
                            let neededU = 0;
                            const assignment = [];

                            for (let i = 0; i < emptyCount; i++) {
                                const bit = (comboIdx >> i) & 1;
                                const letter = bit === 0 ? 'M' : 'U';
                                assignment.push(letter);
                                if (letter === 'M') neededM++;
                                else neededU++;
                            }

                            if (rack.M >= neededM && rack.U >= neededU) {
                                const candidateSeg = cellsInSeg.map((cell, idx) => {
                                    if (cell.occupied) {
                                        return cell.letter;
                                    } else {
                                        const emptyIdx = emptyIndices.indexOf(idx);
                                        return assignment[emptyIdx];
                                    }
                                });
                                const wordStr = candidateSeg.join('');

                                if (legalWords.has(wordStr)) {
                                    const cellsToPlace = [];
                                    for (let i = 0; i < emptyCount; i++) {
                                        const idxInSeg = emptyIndices[i];
                                        cellsToPlace.push({
                                            r,
                                            c: cellsInSeg[idxInSeg].c,
                                            letter: assignment[i]
                                        });
                                    }

                                    // Apply temp state to test board connection and validity
                                    for (const cell of cellsToPlace) {
                                        state.board[cell.r][cell.c].occupied = true;
                                        state.board[cell.r][cell.c].active = true;
                                        state.board[cell.r][cell.c].letter = cell.letter;
                                    }

                                    const result = evaluateStatePlay(state);

                                    // Revert
                                    for (const cell of cellsToPlace) {
                                        state.board[cell.r][cell.c].occupied = false;
                                        state.board[cell.r][cell.c].active = false;
                                        state.board[cell.r][cell.c].letter = null;
                                    }

                                    if (result.legal) {
                                        const key = cellsToPlace.map(cell => `${cell.r},${cell.c}:${cell.letter}`).sort().join('|');
                                        if (!seen.has(key)) {
                                            seen.add(key);
                                            moves.push({
                                                cells: cellsToPlace,
                                                score: result.score
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Vertical segments
        for (let c = 0; c < size; c++) {
            for (let rStart = 0; rStart < size; rStart++) {
                for (let rEnd = rStart + 1; rEnd < size; rEnd++) {
                    const len = rEnd - rStart + 1;
                    const cellsInSeg = [];
                    let emptyCount = 0;
                    for (let r = rStart; r <= rEnd; r++) {
                        const occupied = state.board[r][c].occupied;
                        cellsInSeg.push({ r, c, occupied, letter: state.board[r][c].letter });
                        if (!occupied) {
                            emptyCount++;
                        }
                    }

                    if (emptyCount >= 1 && emptyCount <= totalRack) {
                        const emptyIndices = [];
                        for (let i = 0; i < len; i++) {
                            if (!cellsInSeg[i].occupied) {
                                emptyIndices.push(i);
                            }
                        }

                        const numCombos = Math.pow(2, emptyCount);
                        for (let comboIdx = 0; comboIdx < numCombos; comboIdx++) {
                            let neededM = 0;
                            let neededU = 0;
                            const assignment = [];

                            for (let i = 0; i < emptyCount; i++) {
                                const bit = (comboIdx >> i) & 1;
                                const letter = bit === 0 ? 'M' : 'U';
                                assignment.push(letter);
                                if (letter === 'M') neededM++;
                                else neededU++;
                            }

                            if (rack.M >= neededM && rack.U >= neededU) {
                                const candidateSeg = cellsInSeg.map((cell, idx) => {
                                    if (cell.occupied) {
                                        return cell.letter;
                                    } else {
                                        const emptyIdx = emptyIndices.indexOf(idx);
                                        return assignment[emptyIdx];
                                    }
                                });
                                const wordStr = candidateSeg.join('');

                                if (legalWords.has(wordStr)) {
                                    const cellsToPlace = [];
                                    for (let i = 0; i < emptyCount; i++) {
                                        const idxInSeg = emptyIndices[i];
                                        cellsToPlace.push({
                                            r: cellsInSeg[idxInSeg].r,
                                            c,
                                            letter: assignment[i]
                                        });
                                    }

                                    for (const cell of cellsToPlace) {
                                        state.board[cell.r][cell.c].occupied = true;
                                        state.board[cell.r][cell.c].active = true;
                                        state.board[cell.r][cell.c].letter = cell.letter;
                                    }

                                    const result = evaluateStatePlay(state);

                                    for (const cell of cellsToPlace) {
                                        state.board[cell.r][cell.c].occupied = false;
                                        state.board[cell.r][cell.c].active = false;
                                        state.board[cell.r][cell.c].letter = null;
                                    }

                                    if (result.legal) {
                                        const key = cellsToPlace.map(cell => `${cell.r},${cell.c}:${cell.letter}`).sort().join('|');
                                        if (!seen.has(key)) {
                                            seen.add(key);
                                            moves.push({
                                                cells: cellsToPlace,
                                                score: result.score
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return moves;
    }

    function updatePlayButtonState() {
        if (!playBtn) return;

        if (gameOver || currentTurn !== 'player') {
            playBtn.disabled = true;
            if (playScoreEl) playScoreEl.textContent = '-';
            return;
        }

        if (swapModeActive) {
            // Swap Mode Play button criteria
            const selectedTiles = document.querySelectorAll('#mumble-rack .mmabble-tile.selected');
            playBtn.disabled = selectedTiles.length === 0;
            if (playScoreEl) playScoreEl.textContent = 'Swap';
            return;
        }

        const result = evaluateStatePlay(createBoardStateFromDom());
        currentPlayScore = result.score;
        playBtn.disabled = !result.legal;
        if (playScoreEl) {
            playScoreEl.textContent = result.legal ? currentPlayScore : '-';
        }
    }

    function getCellType(r, c) {
        // start dw at (5,5)
        if (r === 5 && c === 5) return 'start';

        // tw at {(0,0),(10,10),(0,10),(10,0)}
        if ((r === 0 || r === 10) && (c === 0 || c === 10)) return 'tw';

        // dw at {(1,1), (2,2),(9,9),(8,8),(9,1),(8,2),(1,9),(2,8)}
        const dwCoords = [
            '1,1', '2,2', '8,8', '9,9', '9,1', '8,2', '1,9', '2,8'
        ];
        if (dwCoords.includes(`${r},${c}`)) return 'dw';

        // tl at {(0,3),(0,7),(3,0),(3,3),(3,7),(3,10),(7,0),(7,3),(7,7),(7,10),(10,3),(10,7)}
        const tlCoords = [
            '0,3', '0,7', '3,0', '3,3', '3,7', '3,10', '7,0', '7,3', '7,7', '7,10', '10,3', '10,7'
        ];
        if (tlCoords.includes(`${r},${c}`)) return 'tl';

        // dl at {(4,4),(4,6),(6,4),(6,6),(2,5),(1,4),(1,6),(5,2),(4,1),(6,1),(9,4),(9,6),(8,5),(4,9),(6,9),(5,8)}
        const dlCoords = [
            '4,4', '4,6', '6,4', '6,6', '2,5', '1,4', '1,6', '5,2', '4,1', '6,1', '9,4', '9,6', '8,5', '4,9', '6,9', '5,8'
        ];
        if (dlCoords.includes(`${r},${c}`)) return 'dl';

        return 'normal';
    }

    // Grid Generation
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

    // Rack slots & tiles setup
    const rack = document.getElementById('mumble-rack');
    const slots = rack.querySelectorAll('.mmabble-rack-slot');

    // Drag-and-drop state variables
    let draggedTile = null;
    let originalParent = null;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    function onTilePointerDown(e) {
        if (gameOver || currentTurn !== 'player' || swapModeActive) return;
        if (e.button !== 0) return;

        const tile = e.currentTarget;
        const parent = tile.parentElement;

        if (parent.classList.contains('mmabble-cell') && parent.dataset.active === 'false') {
            return;
        }

        draggedTile = tile;
        originalParent = parent;
        startX = e.clientX;
        startY = e.clientY;
        hasMoved = false;

        const rect = tile.getBoundingClientRect();
        tile.style.width = rect.width + 'px';
        tile.style.height = rect.height + 'px';
        tile.style.position = 'fixed';
        tile.style.zIndex = '9999';
        tile.style.pointerEvents = 'none';

        tile.style.setProperty('--tile-size', rect.width + 'px');

        tile.style.left = (e.clientX - rect.width / 2) + 'px';
        tile.style.top = (e.clientY - rect.height / 2) + 'px';

        document.body.style.cursor = 'grabbing';

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

        const elementBelow = document.elementFromPoint(x, y);

        let cell = elementBelow ? elementBelow.closest('.mmabble-cell') : null;
        let rackContainer = elementBelow ? elementBelow.closest('.mmabble-rack-container') : null;
        let rackTiles = elementBelow ? elementBelow.closest('.mmabble-rack-tiles') : null;
        let rackSlot = elementBelow ? elementBelow.closest('.mmabble-rack-slot') : null;

        let placed = false;
        const letter = tile.querySelector('.mmabble-tile-letter').textContent.trim();

        if (!hasMoved) {
            if (originalParent.classList.contains('mmabble-cell')) {
                const emptySlot = findTargetRackSlot(letter);
                if (emptySlot) {
                    emptySlot.appendChild(tile);
                    placed = true;
                }
            } else {
                originalParent.appendChild(tile);
                placed = true;
            }
        } else {
            if (cell) {
                // Released over Mumble board cell (inside mumble-board)
                if (cell.closest('#mumble-board') && cell.dataset.active === 'true' && cell.dataset.occupied === 'false') {
                    cell.appendChild(tile);
                    cell.dataset.occupied = 'true';
                    placed = true;
                }
            } else if (rackContainer || rackTiles || rackSlot) {
                const emptySlot = findTargetRackSlot(letter);
                if (emptySlot) {
                    emptySlot.appendChild(tile);
                    placed = true;
                }
            }
        }

        if (!placed) {
            originalParent.appendChild(tile);
            if (originalParent.classList.contains('mmabble-cell')) {
                originalParent.dataset.occupied = 'true';
            }
        }

        // Re-align rack order
        sortRackSlots();

        tile.style.position = '';
        tile.style.zIndex = '';
        tile.style.width = '';
        tile.style.height = '';
        tile.style.left = '';
        tile.style.top = '';
        tile.style.pointerEvents = '';
        tile.style.removeProperty('--tile-size');

        document.body.style.cursor = '';

        draggedTile = null;
        originalParent = null;

        updatePlayButtonState();
        updateStatusDisplay();
    }

    function getPlayerRackCounts() {
        let M = 0;
        let U = 0;
        slots.forEach(slot => {
            const tile = slot.querySelector('.mmabble-tile');
            if (tile) {
                const letter = tile.querySelector('.mmabble-tile-letter').textContent.trim();
                if (letter === 'M') M++;
                else if (letter === 'U') U++;
            }
        });
        return { M, U };
    }

    function findTargetRackSlot(letter) {
        const counts = getPlayerRackCounts();
        const numMs = counts.M;

        if (letter === 'M') {
            // Snaps to leftmost empty space
            for (let i = 0; i < maxRackSize; i++) {
                if (!slots[i].querySelector('.mmabble-tile')) {
                    return slots[i];
                }
            }
        } else {
            // Snaps to leftmost empty index that is not less than the number of Ms currently on rack
            for (let i = numMs; i < maxRackSize; i++) {
                if (!slots[i].querySelector('.mmabble-tile')) {
                    return slots[i];
                }
            }
        }
        return null;
    }

    function sortRackSlots() {
        // Collect current rack tiles
        const tiles = [];
        slots.forEach(slot => {
            const tile = slot.querySelector('.mmabble-tile');
            if (tile) {
                tiles.push(tile);
                tile.remove();
            }
        });

        // Sort them: M first, then U
        tiles.sort((a, b) => {
            const la = a.querySelector('.mmabble-tile-letter').textContent.trim();
            const lb = b.querySelector('.mmabble-tile-letter').textContent.trim();
            if (la === lb) return 0;
            return la === 'M' ? -1 : 1;
        });

        // Distribute back to slots starting from index 0
        for (let i = 0; i < tiles.length; i++) {
            slots[i].appendChild(tiles[i]);
        }
    }

    function createMumbleTile(letter, idValue) {
        const tile = document.createElement('div');
        tile.className = 'mmabble-tile';
        tile.id = idValue || `mumble-tile-${Date.now()}-${Math.random()}`;
        const val = (letter === 'M') ? 3 : 1;
        tile.innerHTML = `
            <span class="mmabble-tile-letter">${letter}</span>
            <span class="mmabble-tile-value">${val}</span>
        `;
        tile.addEventListener('pointerdown', onTilePointerDown);
        tile.addEventListener('click', (e) => {
            if (swapModeActive) {
                if (tile.parentElement.classList.contains('mmabble-rack-slot')) {
                    e.stopPropagation();
                    tile.classList.toggle('selected');
                    updatePlayButtonState();
                }
            } else {
                if (!tile.parentElement.classList.contains('mmabble-cell')) {
                    e.stopPropagation();
                }
            }
        });
        return tile;
    }

    // Draw a tile from the bag
    function drawFromBag() {
        const total = bagM + bagU;
        if (total === 0) return null;

        const rand = Math.random() * total;
        if (rand < bagM) {
            bagM--;
            return 'M';
        } else {
            bagU--;
            return 'U';
        }
    }

    function fillPlayerRackToMax() {
        const counts = getPlayerRackCounts();
        const currentTotal = counts.M + counts.U;
        const needed = maxRackSize - currentTotal;

        const drawn = [];
        for (let i = 0; i < needed; i++) {
            const letter = drawFromBag();
            if (letter) {
                drawn.push(letter);
            }
        }

        // Rebuild slots
        const currentTiles = [];
        slots.forEach(slot => {
            const tile = slot.querySelector('.mmabble-tile');
            if (tile) {
                currentTiles.push(tile);
                tile.remove();
            }
        });

        drawn.forEach(letter => {
            currentTiles.push(createMumbleTile(letter));
        });

        currentTiles.sort((a, b) => {
            const la = a.querySelector('.mmabble-tile-letter').textContent.trim();
            const lb = b.querySelector('.mmabble-tile-letter').textContent.trim();
            if (la === lb) return 0;
            return la === 'M' ? -1 : 1;
        });

        for (let i = 0; i < currentTiles.length; i++) {
            slots[i].appendChild(currentTiles[i]);
        }
    }

    function fillAiRackToMax() {
        const currentTotal = aiM + aiU;
        const needed = maxRackSize - currentTotal;
        for (let i = 0; i < needed; i++) {
            const letter = drawFromBag();
            if (letter === 'M') aiM++;
            else if (letter === 'U') aiU++;
        }
    }

    // Game initial draws
    function initialSetup() {
        bagM = 40;
        bagU = 20;
        aiM = 0;
        aiU = 0;
        scoreYou = 0;
        scoreAi = 0;
        currentPlayScore = 0;
        gameOver = false;
        currentTurn = 'player';
        swapModeActive = false;

        // Clear overlay
        const overlay = board.querySelector('.mmabble-overlay');
        if (overlay) overlay.remove();

        // Clear board cells
        cells.forEach(c => {
            c.dataset.occupied = 'false';
            c.dataset.active = 'true';
            const tile = c.querySelector('.mmabble-tile');
            if (tile) tile.remove();
        });

        // Clear rack slots
        slots.forEach(slot => {
            const tile = slot.querySelector('.mmabble-tile');
            if (tile) tile.remove();
        });

        // Draw initial tiles
        fillPlayerRackToMax();
        fillAiRackToMax();

        const noticeEl = document.getElementById('mumble-ai-score-notice');
        if (noticeEl) {
            noticeEl.style.visibility = 'hidden';
        }

        updateStatusDisplay();
        updatePlayButtonState();
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
        const playerRack = getPlayerRackCounts();
        const totalPlayerRackPoints = playerRack.M * 3 + playerRack.U * 1;
        const totalAiRackPoints = aiM * 3 + aiU * 1;

        if (reason === 'out') {
            if (sideJustMoved === 'player') {
                scoreYou += totalAiRackPoints;
                scoreAi -= totalAiRackPoints;
            } else {
                scoreAi += totalPlayerRackPoints;
                scoreYou -= totalPlayerRackPoints;
            }
            return;
        }

        scoreYou -= totalPlayerRackPoints;
        scoreAi -= totalAiRackPoints;
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
        if (gameOver) return;

        const playerRack = getPlayerRackCounts();
        const totalPlayer = playerRack.M + playerRack.U;
        const totalAi = aiM + aiU;

        const sideRackCount = sideJustMoved === 'player' ? totalPlayer : totalAi;
        if (sideRackCount === 0) {
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
        updateStatusDisplay();

        if (currentTurn === 'ai') {
            const noticeEl = document.getElementById('mumble-ai-score-notice');
            if (noticeEl) {
                noticeEl.style.visibility = 'hidden';
            }
            window.setTimeout(runAiTurn, 500);
        }
    }

    function runAiTurn() {
        if (gameOver || currentTurn !== 'ai') return;

        const state = createBoardStateFromDom();
        const searchMoves = generateAgentMoves(state);

        if (searchMoves.length > 0) {
            // Play greedy move with max points
            searchMoves.sort((a, b) => b.score - a.score);
            const bestMove = searchMoves[0];

            // Commit move
            for (const cellPos of bestMove.cells) {
                const cell = boardCells[cellPos.r][cellPos.c];
                const tile = createMumbleTile(cellPos.letter);
                cell.appendChild(tile);
                cell.dataset.occupied = 'true';
                cell.dataset.active = 'false';
                tile.style.cursor = 'default';

                if (cellPos.letter === 'M') aiM--;
                else aiU--;
            }

            scoreAi += bestMove.score;
            const noticeEl = document.getElementById('mumble-ai-score-notice');
            if (noticeEl) {
                noticeEl.textContent = `AI scored ${bestMove.score} points`;
                noticeEl.style.visibility = 'visible';
            }
            fillAiRackToMax();
            updateStatusDisplay();
            currentTurn = 'player';
            maybeAdvanceTurn('ai');
        } else {
            // No legal moves exist. Swap tiles if conditions met
            const totalBag = bagM + bagU;
            if (totalBag >= 7) {
                // Agent swaps all its tiles
                const currentAiM = aiM;
                const currentAiU = aiU;
                const totalSwapped = currentAiM + currentAiU;

                // Return to bag
                bagM += currentAiM;
                bagU += currentAiU;

                aiM = 0;
                aiU = 0;

                // Draw new tiles
                fillAiRackToMax();
                updateStatusDisplay();

                const noticeEl = document.getElementById('mumble-ai-score-notice');
                if (noticeEl) {
                    noticeEl.style.visibility = 'hidden';
                }

                // Show the overlay indicating agent exchanged tiles
                const overlay = document.createElement('div');
                overlay.className = 'mmabble-overlay';
                overlay.textContent = `Agent exchanged ${totalSwapped} tiles. Your move.`;
                board.appendChild(overlay);

                // Disable interaction during the 2000ms delay by keeping turn as 'ai'
                currentTurn = 'ai';

                window.setTimeout(() => {
                    overlay.remove();
                    currentTurn = 'player';
                    maybeAdvanceTurn('ai');
                }, 2000);
            } else {
                // Cannot play or swap -> Stalemate
                setGameOver('stalemate', 'ai');
            }
        }
    }

    function findAndRemoveTileFromRack(letter) {
        for (let i = maxRackSize - 1; i >= 0; i--) {
            const slot = slots[i];
            const tile = slot.querySelector('.mmabble-tile');
            if (tile && tile.querySelector('.mmabble-tile-letter').textContent.trim() === letter) {
                tile.remove();
                return tile;
            }
        }
        return null;
    }

    // Cell click placement interaction
    cells.forEach(cell => {
        cell.addEventListener('click', (e) => {
            if (gameOver || currentTurn !== 'player' || swapModeActive) return;
            if (cell.dataset.active !== 'true') return;

            const rackCounts = getPlayerRackCounts();

            if (cell.dataset.occupied === 'true') {
                // clicking any active tile on the grid will return it to your rack
                const existingTile = cell.querySelector('.mmabble-tile');
                if (existingTile) {
                    const letter = existingTile.querySelector('.mmabble-tile-letter').textContent.trim();
                    const emptySlot = findTargetRackSlot(letter);
                    if (emptySlot) {
                        emptySlot.appendChild(existingTile);
                    }
                    cell.dataset.occupied = 'false';
                }
            } else {
                // cell is empty
                if (e.shiftKey) {
                    // if you hold shift and click, and if you have a U on your rack, U will appear at that space
                    if (rackCounts.U > 0) {
                        const uTile = findAndRemoveTileFromRack('U');
                        if (uTile) {
                            cell.appendChild(uTile);
                            cell.dataset.occupied = 'true';
                        }
                    }
                } else {
                    // if you click an open square and have an M on your rack, M will appear at that space
                    if (rackCounts.M > 0) {
                        const mTile = findAndRemoveTileFromRack('M');
                        if (mTile) {
                            cell.appendChild(mTile);
                            cell.dataset.occupied = 'true';
                        }
                    }
                }
            }

            sortRackSlots();
            updatePlayButtonState();
            updateStatusDisplay();
        });
    });

    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            initialSetup();
        });
    }

    // Swap / Exchange button click handler
    if (swapBtn) {
        swapBtn.addEventListener('click', () => {
            if (gameOver || currentTurn !== 'player') return;

            const hasActiveTiles = Array.from(cells).some(c => c.dataset.occupied === 'true' && c.dataset.active === 'true');
            if (hasActiveTiles) return;

            if (swapModeActive) {
                // Toggle off
                exitSwapMode();
            } else {
                // Enter Swap Mode
                swapModeActive = true;
                showSwapOverlay();
                updatePlayButtonState();
            }
        });
    }

    function showSwapOverlay() {
        const existing = board.querySelector('.mmabble-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'mmabble-overlay';
        overlay.textContent = "Select the tiles from your rack to swap. Press Play to confirm.";
        board.appendChild(overlay);
    }

    function exitSwapMode() {
        swapModeActive = false;
        const overlay = board.querySelector('.mmabble-overlay');
        if (overlay) overlay.remove();

        // Deselect all selected rack tiles
        slots.forEach(slot => {
            const tile = slot.querySelector('.mmabble-tile');
            if (tile) {
                tile.classList.remove('selected');
            }
        });

        updatePlayButtonState();
    }

    // Play button click handler
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (gameOver || currentTurn !== 'player') return;

            if (swapModeActive) {
                // Execute Swap
                const selectedTiles = document.querySelectorAll('#mumble-rack .mmabble-tile.selected');
                if (selectedTiles.length === 0) return;

                selectedTiles.forEach(tile => {
                    const letter = tile.querySelector('.mmabble-tile-letter').textContent.trim();
                    if (letter === 'M') bagM++;
                    else bagU++;
                    tile.remove();
                });

                // Clear swap mode & draw fresh tiles
                exitSwapMode();
                fillPlayerRackToMax();
                updateStatusDisplay();
                maybeAdvanceTurn('player');
                return;
            }

            // Normal Play Move
            const result = evaluateStatePlay(createBoardStateFromDom());
            if (!result.legal) return;

            scoreYou += result.score;
            lockActiveCells();
            fillPlayerRackToMax();
            updateStatusDisplay();
            maybeAdvanceTurn('player');
        });
    }

    function showGameOverOverlay() {
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
            playerText = "It's a tie!";
        }

        overlay.textContent = `Game over, ${playerText}`;
        board.appendChild(overlay);
    }

    // Start game
    initialSetup();
});
