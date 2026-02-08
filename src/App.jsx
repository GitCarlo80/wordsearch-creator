import React, { useState } from 'react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const WordSearchCreator = () => {
  const [words, setWords] = useState([]);
  const [gridSize, setGridSize] = useState(20);
  const [pageFormat, setPageFormat] = useState('6x9');
  const [puzzlesPerPage, setPuzzlesPerPage] = useState(1);
  const [enableDecorations, setEnableDecorations] = useState(true);
  const [generatedPuzzles, setGeneratedPuzzles] = useState([]);
  const [currentTab, setCurrentTab] = useState('upload');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let uploadedWords = [];
    if (file.name.endsWith('.txt')) {
      const text = await file.text();
      uploadedWords = parseWordLists(text);
    } else if (file.name.endsWith('.zip')) {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);
      for (const filename in unzipped.files) {
        if (filename.endsWith('.txt')) {
          const text = await unzipped.files[filename].async('text');
          const lists = parseWordLists(text);
          uploadedWords = uploadedWords.concat(lists);
        }
      }
    }
    if (uploadedWords.length > 0) {
      setWords(uploadedWords);
      generatePuzzles(uploadedWords);
    }
  };

  const parseWordLists = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const lists = [];
    let currentList = null;
    for (const line of lines) {
      if (line.includes('(') && line.includes(')')) {
        if (currentList && currentList.words.length > 0) {
          lists.push(currentList);
        }
        const themeMatch = line.match(/\((.*?)\)/);
        const theme = themeMatch ? themeMatch[1] : line;
        currentList = { theme, words: [] };
      } else if (currentList && line.length > 0) {
        currentList.words.push(line);
      }
    }
    if (currentList && currentList.words.length > 0) {
      lists.push(currentList);
    }
    return lists;
  };

  const generatePuzzles = (wordLists) => {
    const puzzles = [];
    for (const list of wordLists) {
      const grid = createGrid(list.words, gridSize);
      puzzles.push({
        theme: list.theme,
        words: list.words,
        grid: grid.grid,
        wordPositions: grid.wordPositions
      });
    }
    setGeneratedPuzzles(puzzles);
  };

  const createGrid = (wordList, size) => {
    const grid = Array(size).fill(null).map(() => Array(size).fill(''));
    const wordPositions = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    wordList.forEach(word => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        if (canPlace(grid, word, row, col, dir[0], dir[1], size)) {
          const positions = [];
          for (let i = 0; i < word.length; i++) {
            const r = row + i * dir[0];
            const c = col + i * dir[1];
            grid[r][c] = word[i].toUpperCase();
            positions.push({ row: r, col: c });
          }
          wordPositions.push({ word, positions });
          placed = true;
        }
        attempts++;
      }
    });
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (grid[i][j] === '') {
          grid[i][j] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
    }
    return { grid, wordPositions };
  };

  const canPlace = (grid, word, row, col, rowDir, colDir, size) => {
    if (row + (word.length - 1) * rowDir < 0 || row + (word.length - 1) * rowDir >= size) return false;
    if (col + (word.length - 1) * colDir < 0 || col + (word.length - 1) * colDir >= size) return false;
    for (let i = 0; i < word.length; i++) {
      const r = row + i * rowDir;
      const c = col + i * colDir;
      if (grid[r][c] !== '' && grid[r][c] !== word[i].toUpperCase()) return false;
    }
    return true;
  };

  const downloadPDFs = async () => {
  if (generatedPuzzles.length === 0) {
    alert('Nessun puzzle generato! Carica prima un file.');
    return;
  }

  // Crea un unico ZIP con due cartelle
  const allFilesZip = new JSZip();
  const puzzlesFolder = allFilesZip.folder('puzzles');
  const solutionsFolder = allFilesZip.folder('solutions');

  // Itera su tutti i puzzle generati
  for (let puzzleIdx = 0; puzzleIdx < generatedPuzzles.length; puzzleIdx++) {
    const puzzle = generatedPuzzles[puzzleIdx];

    // Determina dimensioni pagina
    let pageWidth, pageHeight;
    if (pageFormat === '6x9') {
      pageWidth = 152.4;
      pageHeight = 228.6;
    } else if (pageFormat === 'A4') {
      pageWidth = 210;
      pageHeight = 297;
    } else if (pageFormat === 'US Letter') {
      pageWidth = 215.9;
      pageHeight = 279.4;
    }

    // === CREA PDF PUZZLE ===
    const puzzleDoc = new jsPDF({
      orientation: pageWidth > pageHeight ? 'l' : 'p',
      unit: 'mm',
      format: [pageWidth, pageHeight]
    });

    const margin = 8;
    const puzzleGridSize = puzzle.grid.length;
    const availableWidth = pageWidth - 2 * margin;
    const gridWidth = availableWidth * 0.55;
    const wordsWidth = availableWidth * 0.40;
    const titleHeight = 12;
    const availableHeight = pageHeight - 2 * margin - titleHeight;
    const cellSize = Math.min(gridWidth / puzzleGridSize, availableHeight / puzzleGridSize);

    // Titolo
    puzzleDoc.setFontSize(14);
    puzzleDoc.setFont(undefined, 'bold');
    puzzleDoc.text(puzzle.theme || 'Word Search', pageWidth / 2, margin + 6, { align: 'center' });

    // Disegna griglia puzzle
    const gridStartX = margin + wordsWidth + 5;
    const gridStartY = margin + titleHeight;

    puzzleDoc.setFontSize(8);
    for (let r = 0; r < puzzle.grid.length; r++) {
      for (let c = 0; c < puzzle.grid[r].length; c++) {
        const x = gridStartX + c * cellSize;
        const y = gridStartY + r * cellSize;

        puzzleDoc.setFillColor(255, 255, 255);
        puzzleDoc.rect(x, y, cellSize, cellSize, "F");
        puzzleDoc.setDrawColor(0, 0, 0);
        puzzleDoc.setLineWidth(0.1);
        puzzleDoc.rect(x, y, cellSize, cellSize, "S");

        const fontSize = Math.max(5, Math.min(8, cellSize * 0.5));
        puzzleDoc.setFontSize(fontSize);
        puzzleDoc.setTextColor(0, 0, 0);
        puzzleDoc.text(puzzle.grid[r][c], x + cellSize / 2, y + cellSize / 2 + fontSize * 0.1, {
          align: "center",
          baseline: "middle"
        });
      }
    }

    // Lista parole
    const wordsStartX = margin;
    const wordsStartY = gridStartY + 5;
    puzzleDoc.setFontSize(9);
    puzzleDoc.setFont(undefined, 'bold');
    puzzleDoc.text('Find these words:', wordsStartX, wordsStartY - 2);
    puzzleDoc.setFont(undefined, 'normal');
    puzzleDoc.setFontSize(7);

    const numColumns = 2;
    const colWidth = wordsWidth / numColumns;
    const lineHeight = 4;
    const wordsPerColumn = Math.ceil(puzzle.words.length / numColumns);
    let wordIdx = 0;

    for (let col = 0; col < numColumns; col++) {
      for (let row = 0; row < wordsPerColumn; row++) {
        if (wordIdx < puzzle.words.length) {
          const x = wordsStartX + col * colWidth;
          const y = wordsStartY + row * lineHeight;
          puzzleDoc.text(`• ${puzzle.words[wordIdx]}`, x, y);
          wordIdx++;
        }
      }
    }

    // === CREA PDF SOLUZIONE ===
    const solutionDoc = new jsPDF({
      orientation: pageWidth > pageHeight ? 'l' : 'p',
      unit: 'mm',
      format: [pageWidth, pageHeight]
    });

    // Titolo soluzione
    solutionDoc.setFontSize(14);
    solutionDoc.setFont(undefined, 'bold');
    solutionDoc.text(`${puzzle.theme || 'Word Search'} - Solution`, pageWidth / 2, margin + 6, { align: 'center' });

    // Disegna griglia soluzione
    for (let r = 0; r < puzzle.grid.length; r++) {
      for (let c = 0; c < puzzle.grid[r].length; c++) {
        const x = gridStartX + c * cellSize;
        const y = gridStartY + r * cellSize;

        const isFound = puzzle.wordPositions.some(wp =>
          wp.positions.some(pos => pos.row === r && pos.col === c)
        );

        if (isFound) {
          solutionDoc.setFillColor(255, 255, 100);
        } else {
          solutionDoc.setFillColor(255, 255, 255);
        }
        solutionDoc.rect(x, y, cellSize, cellSize, "F");
        solutionDoc.setDrawColor(0, 0, 0);
        solutionDoc.setLineWidth(0.1);
        solutionDoc.rect(x, y, cellSize, cellSize, "S");

        const fontSize = Math.max(5, Math.min(8, cellSize * 0.5));
        solutionDoc.setFontSize(fontSize);
        solutionDoc.setTextColor(0, 0, 0);
        solutionDoc.text(puzzle.grid[r][c], x + cellSize / 2, y + cellSize / 2 + fontSize * 0.1, {
          align: "center",
          baseline: "middle"
        });
      }
    }

    // Converti in blob e aggiungi agli ZIP
    const puzzleBlob = puzzleDoc.output('blob');
    const solutionBlob = solutionDoc.output('blob');

    puzzlesFolder.file(`puzzle-${puzzleIdx + 1}-${puzzle.theme || 'wordsearch'}.pdf`, puzzleBlob);
    solutionsFolder.file(`solution-${puzzleIdx + 1}-${puzzle.theme || 'wordsearch'}.pdf`, solutionBlob);
  }

  // Genera e scarica il file ZIP finale
  const finalZipBlob = await allFilesZip.generateAsync({ type: 'blob' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(finalZipBlob);
  link.download = `word-search-complete-${Date.now()}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
};
      const wordsStartX = margin;
      const wordsStartY = gridStartY + 5;
      puzzleDoc.setFontSize(9);
      puzzleDoc.setFont(undefined, 'bold');
      puzzleDoc.text('Find these words:', wordsStartX, wordsStartY - 2);
      puzzleDoc.setFont(undefined, 'normal');
      puzzleDoc.setFontSize(7);
      const numColumns = 2;
      const colWidth = wordsWidth / numColumns;
      const lineHeight = 4;
      const wordsPerColumn = Math.ceil(puzzle.words.length / numColumns);
      let wordIdx = 0;
      for (let col = 0; col < numColumns; col++) {
        for (let row = 0; row < wordsPerColumn; row++) {
          if (wordIdx < puzzle.words.length) {
            const x = wordsStartX + col * colWidth;
            const y = wordsStartY + row * lineHeight;
            puzzleDoc.text(`• ${puzzle.words[wordIdx]}`, x, y);
            wordIdx++;
          }
        }
      }
      const solutionDoc = new jsPDF({ orientation: pageWidth > pageHeight ? 'l' : 'p', unit: 'mm', format: [pageWidth, pageHeight] });
      solutionDoc.setFontSize(14);
      solutionDoc.setFont(undefined, 'bold');
      solutionDoc.text(`${puzzle.theme || 'Word Search'} - Solution`, pageWidth / 2, margin + 6, { align: 'center' });
      for (let r = 0; r < puzzle.grid.length; r++) {
        for (let c = 0; c < puzzle.grid[r].length; c++) {
          const x = gridStartX + c * cellSize;
          const y = gridStartY + r * cellSize;
          const isFound = puzzle.wordPositions.some(wp => wp.positions.some(pos => pos.row === r && pos.col === c));
          if (isFound) { solutionDoc.setFillColor(255, 255, 100); }
          else { solutionDoc.setFillColor(255, 255, 255); }
          solutionDoc.rect(x, y, cellSize, cellSize, "F");
          solutionDoc.setDrawColor(0, 0, 0);
          solutionDoc.setLineWidth(0.1);
          solutionDoc.rect(x, y, cellSize, cellSize, "S");
          const fontSize = Math.max(5, Math.min(8, cellSize * 0.5));
          solutionDoc.setFontSize(fontSize);
          solutionDoc.setTextColor(0, 0, 0);
          solutionDoc.text(puzzle.grid[r][c], x + cellSize / 2, y + cellSize / 2 + fontSize * 0.1, { align: "center", baseline: "middle" });
        }
      }
  const downloadPNGs = async () => {
    for (let puzzleIdx = 0; puzzleIdx < generatedPuzzles.length; puzzleIdx++) {
      const puzzle = generatedPuzzles[puzzleIdx];
      const puzzleDiv = document.createElement('div');
      puzzleDiv.style.cssText = 'background: white; padding: 20px; width: 800px;';
      const titleP = document.createElement('h2');
      titleP.textContent = puzzle.theme || 'Word Search Puzzle';
      titleP.style.textAlign = 'center';
      puzzleDiv.appendChild(titleP);
      const gridDiv = createGridDiv(puzzle.grid, null);
      puzzleDiv.appendChild(gridDiv);
      const wordListDiv = document.createElement('div');
      wordListDiv.style.cssText = 'margin-top: 20px; columns: 3;';
      puzzle.words.forEach(word => {
        const p = document.createElement('p');
        p.textContent = word;
        p.style.margin = '5px 0';
        wordListDiv.appendChild(p);
      });
      puzzleDiv.appendChild(wordListDiv);
      document.body.appendChild(puzzleDiv);
      const canvas = await html2canvas(puzzleDiv);
      const link = document.createElement('a');
      link.href = canvas.toDataURL();
      link.download = `word-search-puzzle-${puzzleIdx + 1}.png`;
      link.click();
      document.body.removeChild(puzzleDiv);
      const solutionDiv = document.createElement('div');
      solutionDiv.style.cssText = 'background: white; padding: 20px; width: 800px;';
      const titleS = document.createElement('h2');
      titleS.textContent = `${puzzle.theme || 'Word Search'} - Solution`;
      titleS.style.textAlign = 'center';
      solutionDiv.appendChild(titleS);
    const gridDivSol = createGridDiv(puzzle.grid, puzzle.wordPositions);
      solutionDiv.appendChild(gridDivSol);
      document.body.appendChild(solutionDiv);
      const canvasSol = await html2canvas(solutionDiv);
      const linkSol = document.createElement('a');
      linkSol.href = canvasSol.toDataURL();
      linkSol.download = `word-search-solution-${puzzleIdx + 1}.png`;
      linkSol.click();
      document.body.removeChild(solutionDiv);
    }
  };

  const createGridDiv = (grid, wordPositions) => {
    const gridDiv = document.createElement('div');
    gridDiv.style.cssText = 'display: inline-block; border: 2px solid black;';
    const cellSize = 30;
    const highlightedCells = new Set();
    if (wordPositions) {
      wordPositions.forEach(wp => {
        wp.positions.forEach(pos => {
          highlightedCells.add(`${pos.row},${pos.col}`);
        });
      });
    }
    for (let r = 0; r < grid.length; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.style.cssText = 'display: flex;';
      for (let c = 0; c < grid[r].length; c++) {
        const cellDiv = document.createElement('div');
        const isHighlighted = highlightedCells.has(`${r},${c}`);
        cellDiv.style.cssText = `width: ${cellSize}px; height: ${cellSize}px; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-weight: bold; background-color: ${isHighlighted ? 'yellow' : 'white'};`;
        cellDiv.textContent = grid[r][c];
        rowDiv.appendChild(cellDiv);
      }
      gridDiv.appendChild(rowDiv);
    }
    return gridDiv;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>📄 Word Search Creator PRO</h1>
      </header>
      <div style={styles.tabBar}>
        <button style={{...styles.tabButton, backgroundColor: currentTab === 'upload' ? '#00bcd4' : '#555'}} onClick={() => setCurrentTab('upload')}>
          Upload & Generate
        </button>
        <button style={{...styles.tabButton, backgroundColor: currentTab === 'custom' ? '#00bcd4' : '#555'}} onClick={() => setCurrentTab('custom')}>
          Generate Custom Lists
        </button>
        <button style={{...styles.tabButton, backgroundColor: currentTab === 'templates' ? '#00bcd4' : '#555'}} onClick={() => setCurrentTab('templates')}>
          Quick Templates
        </button>
      </div>
      <div style={styles.content}>
        {currentTab === 'upload' && (
          <div>
            <h2>Upload Files & Generate</h2>
            <p>Upload TXT or ZIP files:</p>
            <input type="file" accept=".txt,.zip" onChange={handleFileUpload} />
            <br />
            <div style={styles.formGroup}>
              <label>Grid Size:</label>
              <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))}>
                <option value={15}>15x15</option>
                <option value={20}>20x20</option>
                <option value={25}>25x25</option>
              </select>
            </div>
            <br />
            <div style={styles.formGroup}>
              <label>Page Format:</label>
              <select value={pageFormat} onChange={(e) => setPageFormat(e.target.value)}>
                <option value="6x9">6x9 (KDP)</option>
                <option value="A4">A4</option>
                <option value="US Letter">US Letter</option>
              </select>
            </div>
            <br />
            <div style={styles.formGroup}>
              <label>Puzzles per page:</label>
              <select value={puzzlesPerPage} onChange={(e) => setPuzzlesPerPage(Number(e.target.value))}>
                <option value={1}>1 per page</option>
                <option value={2}>2 per page</option>
              </select>
            </div>
            <br />
            <div style={styles.formGroup}>
              <label>
                <input type="checkbox" checked={enableDecorations} onChange={(e) => setEnableDecorations(e.target.checked)} />
                Enable Decorations
              </label>
            </div>
            <br />
            <button style={styles.generateButton} onClick={() => downloadPDFs()}>
              Download PDFs
            </button>
            <button style={{...styles.generateButton, marginLeft: '10px'}} onClick={() => downloadPNGs()}>
              Download PNGs
            </button>
          </div>
        )}
        {currentTab === 'custom' && (
          <div>
            <h2>Generate Custom Lists</h2>
            <p>Feature coming soon! Create custom word lists for your puzzles.</p>
          </div>
        )}
        {currentTab === 'templates' && (
          <div>
            <h2>Quick Templates</h2>
            <p>Feature coming soon! Use pre-made templates for common themes.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#222',
    color: '#fff',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
    borderBottom: '2px solid #00bcd4',
    paddingBottom: '10px',
  },
  title: {
    fontSize: '32px',
    margin: '0',
    color: '#00bcd4',
  },
  tabBar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid #444',
  },
  tabButton: {
    padding: '10px 20px',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#333',
    padding: '20px',
    borderRadius: '8px',
  },
  formGroup: {
    marginBottom: '15px',
  },
  generateButton: {
    backgroundColor: '#00ff00',
    color: '#000',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    borderRadius: '4px',
    marginTop: '15px',
  },
};

export default WordSearchCreator;
