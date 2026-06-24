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

    // Scrabble Validation and Scoring Algorithm
    function evaluatePlay() {
        if (!cells) return { legal: false, score: 0 };
        
        // 1. Find all active cells on the board (tiles placed in the current turn)
        const activeCells = Array.from(cells).filter(c => c.dataset.occupied === 'true' && c.dataset.active === 'true');
        
        // 2. Find all inactive occupied cells on the board (tiles placed in previous turns)
        const inactiveCells = Array.from(cells).filter(c => c.dataset.occupied === 'true' && c.dataset.active === 'false');
        
        if (activeCells.length === 0) {
            return { legal: false, score: 0 };
        }
        
        // 3. First move must cover the center cell (4, 4)
        const isFirstMove = (inactiveCells.length === 0);
        if (isFirstMove) {
            const centerOccupied = activeCells.some(c => c.dataset.row === '4' && c.dataset.col === '4');
            if (!centerOccupied) {
                return { legal: false, score: 0 };
            }
        }
        
        // 4. Verify all active tiles are in a single row or single column
        const rows = activeCells.map(c => parseInt(c.dataset.row));
        const cols = activeCells.map(c => parseInt(c.dataset.col));
        const uniqueRows = [...new Set(rows)];
        const uniqueCols = [...new Set(cols)];
        
        if (uniqueRows.length > 1 && uniqueCols.length > 1) {
            return { legal: false, score: 0 };
        }
        
        // 5. Check contiguous connection of active cells (no empty spaces between them)
        // If they are row-aligned (same row)
        if (uniqueRows.length === 1) {
            const r = uniqueRows[0];
            const minC = Math.min(...cols);
            const maxC = Math.max(...cols);
            for (let c = minC; c <= maxC; c++) {
                const cell = Array.from(cells).find(item => parseInt(item.dataset.row) === r && parseInt(item.dataset.col) === c);
                if (!cell || cell.dataset.occupied !== 'true') {
                    return { legal: false, score: 0 };
                }
            }
        }
        // If they are col-aligned (same col)
        else if (uniqueCols.length === 1) {
            const c = uniqueCols[0];
            const minR = Math.min(...rows);
            const maxR = Math.max(...rows);
            for (let r = minR; r <= maxR; r++) {
                const cell = Array.from(cells).find(item => parseInt(item.dataset.row) === r && parseInt(item.dataset.col) === c);
                if (!cell || cell.dataset.occupied !== 'true') {
                    return { legal: false, score: 0 };
                }
            }
        }
        
        // 6. Check connection to existing tiles (if not the first move)
        if (!isFirstMove) {
            let hasAdjacentConnection = false;
            for (const activeCell of activeCells) {
                const r = parseInt(activeCell.dataset.row);
                const c = parseInt(activeCell.dataset.col);
                const neighbors = [
                    { r: r + 1, c: c },
                    { r: r - 1, c: c },
                    { r: r, c: c + 1 },
                    { r: r, c: c - 1 }
                ];
                for (const n of neighbors) {
                    if (n.r >= 0 && n.r < 9 && n.c >= 0 && n.c < 9) {
                        const neighborCell = Array.from(cells).find(item => parseInt(item.dataset.row) === n.r && parseInt(item.dataset.col) === n.c);
                        if (neighborCell && neighborCell.dataset.occupied === 'true' && neighborCell.dataset.active === 'false') {
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
        
        // 7. Find all formed words (sequences containing at least one active tile)
        const formedWords = [];
        
        // Horizontal scan
        for (let r = 0; r < 9; r++) {
            let startCol = null;
            for (let c = 0; c <= 9; c++) {
                const cell = (c < 9) ? Array.from(cells).find(item => parseInt(item.dataset.row) === r && parseInt(item.dataset.col) === c) : null;
                if (cell && cell.dataset.occupied === 'true') {
                    if (startCol === null) {
                        startCol = c;
                    }
                } else {
                    if (startCol !== null) {
                        const length = c - startCol;
                        if (length >= 2) {
                            const segmentCells = [];
                            for (let col = startCol; col < c; col++) {
                                const sc = Array.from(cells).find(item => parseInt(item.dataset.row) === r && parseInt(item.dataset.col) === col);
                                segmentCells.push(sc);
                            }
                            const hasActive = segmentCells.some(sc => sc.dataset.active === 'true');
                            if (hasActive) {
                                formedWords.push(segmentCells);
                            }
                        }
                        startCol = null;
                    }
                }
            }
        }
        
        // Vertical scan
        for (let col = 0; col < 9; col++) {
            let startRow = null;
            for (let r = 0; r <= 9; r++) {
                const cell = (r < 9) ? Array.from(cells).find(item => parseInt(item.dataset.row) === r && parseInt(item.dataset.col) === col) : null;
                if (cell && cell.dataset.occupied === 'true') {
                    if (startRow === null) {
                        startRow = r;
                    }
                } else {
                    if (startRow !== null) {
                        const length = r - startRow;
                        if (length >= 2) {
                            const segmentCells = [];
                            for (let row = startRow; row < r; row++) {
                                const sc = Array.from(cells).find(item => parseInt(item.dataset.row) === row && parseInt(item.dataset.col) === col);
                                segmentCells.push(sc);
                            }
                            const hasActive = segmentCells.some(sc => sc.dataset.active === 'true');
                            if (hasActive) {
                                formedWords.push(segmentCells);
                            }
                        }
                        startRow = null;
                    }
                }
            }
        }
        
        // If no word of length >= 2 is formed containing new tiles, then the play is invalid
        if (formedWords.length === 0) {
            return { legal: false, score: 0 };
        }
        
        // 8. Validate that all formed words have length 2 or 3 (words MM or MMM only)
        for (const word of formedWords) {
            if (word.length < 2 || word.length > 3) {
                return { legal: false, score: 0 };
            }
        }
        
        // 9. Score calculation taking into account DL, TL, DW, TW, and center DW starting square
        let totalScore = 0;
        for (const word of formedWords) {
            let wordSum = 0;
            let wordMultiplier = 1;
            
            for (const cell of word) {
                let baseLetterVal = 3; // "M" is always worth 3 points
                
                // Bonuses are only applied if the cell was placed in the current turn (active)
                if (cell.dataset.active === 'true') {
                    const type = cell.dataset.type;
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

    function updatePlayButtonState() {
        if (!playBtn) return;
        
        if (gameOver) {
            playBtn.disabled = true;
            if (playScoreEl) {
                playScoreEl.textContent = '-';
            }
            return;
        }
        
        const result = evaluatePlay();
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
        // Double Letter (DL) - Light Blue
        if ((r === 3 || r === 5) && (c === 3 || c === 5)) {
            return 'dl';
        }
        if ((r === 0 || r === 8) && c === 4) {
            return 'dl';
        }
        if ((c === 0 || c === 8) && r === 4) {
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
        if (gameOver) return;
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
        const tile = document.createElement('div');
        tile.className = 'mmabble-tile';
        tile.id = `mmabble-tile-${i}`;
        tile.innerHTML = `
            <span class="mmabble-tile-letter">M</span>
            <span class="mmabble-tile-value">3</span>
        `;
        
        // Add drag and drop listeners
        tile.addEventListener('pointerdown', onTilePointerDown);
        tile.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents click event from bubbling up to the cells
        });
        
        slots[i].appendChild(tile);
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

    // Add Click Handlers for Interactive Cell-based Tile Placement
    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            if (gameOver) return;
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
                const tile = document.createElement('div');
                tile.className = 'mmabble-tile';
                tile.id = `mmabble-tile-${i}`;
                tile.innerHTML = `
                    <span class="mmabble-tile-letter">M</span>
                    <span class="mmabble-tile-value">3</span>
                `;
                tile.addEventListener('pointerdown', onTilePointerDown);
                tile.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                slots[i].appendChild(tile);
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
            
            // Remove game over overlay if exists
            const overlay = board.querySelector('.mmabble-overlay');
            if (overlay) {
                overlay.remove();
            }
            
            updateStatusDisplay();
            updatePlayButtonState();
        });
    }

    // Set up Play Button Interaction
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (gameOver) return;
            
            const result = evaluatePlay();
            if (!result.legal) return;
            
            // Add play score to player's total score
            scoreYou += result.score;
            
            // Lock all currently placed active tiles by setting active to 'false'
            const activeCells = Array.from(cells).filter(c => c.dataset.occupied === 'true' && c.dataset.active === 'true');
            const tilesPlayedCount = activeCells.length;
            
            activeCells.forEach(cell => {
                cell.dataset.active = 'false';
                // Remove visual grab cursor from locked tiles
                const tile = cell.querySelector('.mmabble-tile');
                if (tile) {
                    tile.style.cursor = 'default';
                }
            });
            
            // Replenish the player's rack from the bag
            const emptySlots = Array.from(slots).filter(slot => !slot.querySelector('.mmabble-tile'));
            const slotsToReplenish = Math.min(emptySlots.length, tilesInBag);
            
            for (let i = 0; i < slotsToReplenish; i++) {
                const slot = emptySlots[i];
                const tile = document.createElement('div');
                tile.className = 'mmabble-tile';
                tile.id = `mmabble-tile-${Date.now()}-${Math.random()}`; // unique ID
                tile.innerHTML = `
                    <span class="mmabble-tile-letter">M</span>
                    <span class="mmabble-tile-value">3</span>
                `;
                
                // Add drag and drop listeners
                tile.addEventListener('pointerdown', onTilePointerDown);
                tile.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                slot.appendChild(tile);
            }
            
            // Decrement state variables
            tilesInBag -= slotsToReplenish;
            tilesRemaining -= tilesPlayedCount;
            
            // Reset current play score to 0
            currentPlayScore = 0;
            
            // Check game over conditions
            const playerRackTiles = Array.from(slots).filter(slot => slot.querySelector('.mmabble-tile')).length;
            
            let isGameOver = false;
            let gameOverReason = ""; // "out" or "stalemate"
            
            if (playerRackTiles === 0) {
                isGameOver = true;
                gameOverReason = "out";
            } else if (!checkLegalMovesExist()) {
                isGameOver = true;
                gameOverReason = "stalemate";
            }
            
            if (isGameOver) {
                gameOver = true;
                
                // Adjust scores according to international tournament rules
                if (gameOverReason === "out") {
                    // One side playing out
                    scoreYou += 3 * aiTilesCount;
                    scoreAi -= 3 * aiTilesCount;
                } else {
                    // Stalemate
                    scoreYou -= 3 * playerRackTiles;
                    scoreAi -= 3 * aiTilesCount;
                }
                
                updateStatusDisplay();
                updatePlayButtonState();
                showGameOverOverlay();
            } else {
                // Update displays normal flow
                updateStatusDisplay();
                updatePlayButtonState();
            }
        });
    }

    function checkLegalMovesExist() {
        if (!cells) return false;
        
        // Count tiles on the player's rack
        const playerRackTiles = Array.from(slots).filter(slot => slot.querySelector('.mmabble-tile')).length;
        
        // Count inactive cells on the board (locked tiles)
        const inactiveCellsCount = Array.from(cells).filter(c => c.dataset.occupied === 'true' && c.dataset.active === 'false').length;
        
        // If empty board (first move), we need at least 2 tiles on the rack to make a legal move
        if (inactiveCellsCount === 0) {
            return playerRackTiles >= 2;
        }
        
        // If not empty board, we need at least 1 tile on the rack to make any move
        if (playerRackTiles < 1) {
            return false;
        }
        
        // Check all unoccupied squares: if placing a single tile there is legal
        for (const cell of cells) {
            if (cell.dataset.occupied === 'false') {
                const originalOccupied = cell.dataset.occupied;
                const originalActive = cell.dataset.active;
                
                // Temporarily place tile
                cell.dataset.occupied = 'true';
                cell.dataset.active = 'true';
                
                const result = evaluatePlay();
                
                // Restore
                cell.dataset.occupied = originalOccupied;
                cell.dataset.active = originalActive;
                
                if (result.legal) {
                    return true;
                }
            }
        }
        
        return false;
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
