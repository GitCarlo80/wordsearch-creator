import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const WordSearchCreator = () => {
  const [words, setWords] = useState([]);
  const [gridSize, setGridSize] = useState(15);
  const [pageFormat, setPageFormat] = useState('6x9');
  const [puzzlesPerPage, setPuzzlesPerPage] = useState(1);
  const [enableDecorations, setEnableDecorations] = useState(true);
  const [generatedPuzzles, setGeneratedPuzzles] = useState([]);
  const [currentTab, setCurrentTab] = useState('upload');
  
  // Stati per generatore custom
  const [customPrompt, setCustomPrompt] = useState('');
  const [customListCount, setCustomListCount] = useState(50);
  const [wordsPerList, setWordsPerList] = useState(40);
  const [customGeneratedLists, setCustomGeneratedLists] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dictionary, setDictionary] = useState([]);
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);

  // Carica dizionario all'avvio
  useEffect(() => {
    loadDictionary();
  }, []);

  const loadDictionary = async () => {
    try {
      const response = await fetch('/dictionary.txt');
      const text = await response.text();
      const words = text.split('\n')
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length >= 4 && w.length <= 10)
        .filter(w => /^[A-Z]+$/.test(w));
      
      setDictionary(words);
      setDictionaryLoaded(true);
      console.log(`Dizionario caricato: ${words.length} parole`);
    } catch (error) {
      console.warn('Dizionario non trovato, verranno usate parole casuali');
      setDictionaryLoaded(false);
    }
  };
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      let puzzlesList = [];

      if (file.name.endsWith('.txt')) {
        const text = await file.text();
        const lines = text.split('\n').map(w => w.trim()).filter(w => w.length > 0);
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('Word Search')) {
            let theme = lines[i];
            
            if (theme.includes('—')) {
              theme = theme.split('—')[0].trim();
            } else if (theme.includes('-')) {
              theme = theme.split('-')[0].trim();
            } else {
              theme = theme.replace(/\(.*?\)/g, '').replace(/Word Search/gi, '').trim();
            }
            
            const words = [];
            let j = i + 1;
            while (j < lines.length && !lines[j].includes('Word Search') && words.length < 40) {
              if (lines[j].length > 0) {
                words.push(lines[j]);
              }
              j++;
            }
            
            if (words.length > 0) {
              puzzlesList.push({ theme: theme, words: words });
            }
            
            i = j - 1;
          }
        }
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n');
        
        lines.forEach((line) => {
          if (line.trim()) {
            const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''));
            
            if (columns.length > 1) {
              let theme = columns[0];
              
              if (theme.includes('—')) {
                theme = theme.split('—')[0].trim();
              } else if (theme.includes('-')) {
                theme = theme.split('-')[0].trim();
              } else {
                theme = theme.replace(/\(.*?\)/g, '').replace(/Word Search/gi, '').trim();
              }
              
              const words = columns.slice(1).filter(word => word.length > 0);
              
              if (words.length > 0) {
                puzzlesList.push({ theme: theme, words: words });
              }
            }
          }
        });
      } else if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const txtFiles = Object.keys(zip.files).filter(name => 
          name.endsWith('.txt') && !name.startsWith('__MACOSX')
        );
        
        for (const fileName of txtFiles) {
          const content = await zip.files[fileName].async('text');
          const lines = content.split('\n').map(w => w.trim()).filter(w => w.length > 0);
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Word Search')) {
              let theme = lines[i];
              
              if (theme.includes('—')) {
                theme = theme.split('—')[0].trim();
              } else if (theme.includes('-')) {
                theme = theme.split('-')[0].trim();
              } else {
                theme = theme.replace(/\(.*?\)/g, '').replace(/Word Search/gi, '').trim();
              }
              
              const words = [];
              let j = i + 1;
              while (j < lines.length && !lines[j].includes('Word Search') && words.length < 40) {
                if (lines[j].length > 0) {
                  words.push(lines[j]);
                }
                j++;
              }
              
              if (words.length > 0) {
                puzzlesList.push({ theme: theme, words: words });
              }
              
              i = j - 1;
            }
          }
        }
      }

      if (puzzlesList.length > 0) {
        const puzzles = [];
        
        for (const puzzleData of puzzlesList) {
          const grid = createGrid(puzzleData.words, gridSize);
          puzzles.push({
            theme: puzzleData.theme,
            words: puzzleData.words,
            grid: grid.grid,
            wordPositions: grid.wordPositions
          });
        }
        
        setWords(puzzlesList.flatMap(p => p.words));
        setGeneratedPuzzles(puzzles);
      } else {
        alert('No words found in the file!');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please check the format.');
    }
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

    const allFilesZip = new JSZip();
    const puzzlesFolder = allFilesZip.folder('puzzles');
    const solutionsFolder = allFilesZip.folder('solutions');

    let pageWidth, pageHeight;
    if (pageFormat === '6x9') {
      pageWidth = 152.4;
      pageHeight = 228.6;
    } else if (pageFormat === '4.41x6.85') {
      pageWidth = 112;
      pageHeight = 174;
    } else if (pageFormat === 'A4') {
      pageWidth = 210;
      pageHeight = 297;
    } else if (pageFormat === 'US Letter') {
      pageWidth = 215.9;
      pageHeight = 279.4;
    }

    const puzzleDoc = new jsPDF({
      orientation: pageWidth > pageHeight ? 'l' : 'p',
      unit: 'mm',
      format: [pageWidth, pageHeight]
    });

    const solutionDoc = new jsPDF({
      orientation: pageWidth > pageHeight ? 'l' : 'p',
      unit: 'mm',
      format: [pageWidth, pageHeight]
    });

    let puzzlePageStarted = false;
    let solutionPageStarted = false;

    for (let puzzleIdx = 0; puzzleIdx < generatedPuzzles.length; puzzleIdx++) {
      const puzzle = generatedPuzzles[puzzleIdx];
      const positionInPage = puzzleIdx % puzzlesPerPage;
      
      if (positionInPage === 0 && puzzlePageStarted) {
        puzzleDoc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'l' : 'p');
        solutionDoc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'l' : 'p');
      }
      puzzlePageStarted = true;
      solutionPageStarted = true;

      const margin = 8;
      let availableHeight = pageHeight - 2 * margin;
      let startY = margin;

      if (puzzlesPerPage === 2) {
        availableHeight = (pageHeight - 3 * margin) / 2;
        startY = positionInPage === 0 ? margin : (pageHeight / 2 + margin / 2);
      }

      const titleHeight = 10;
      const puzzleGridSize = puzzle.grid.length;
      const availableWidth = pageWidth - 2 * margin;
      const gridWidth = availableWidth * 0.55;
      const wordsWidth = availableWidth * 0.40;
      const cellSize = Math.min(gridWidth / puzzleGridSize, (availableHeight - titleHeight) / puzzleGridSize);

      puzzleDoc.setFontSize(12);
      puzzleDoc.setFont(undefined, 'bold');
      puzzleDoc.text(puzzle.theme || 'Word Search', pageWidth / 2, startY + 6, { align: 'center' });

      const gridStartX = margin + wordsWidth + 5;
      const gridStartY = startY + titleHeight;

      for (let r = 0; r < puzzle.grid.length; r++) {
        for (let c = 0; c < puzzle.grid[r].length; c++) {
          const x = gridStartX + c * cellSize;
          const y = gridStartY + r * cellSize;

          puzzleDoc.setFillColor(255, 255, 255);
          puzzleDoc.rect(x, y, cellSize, cellSize, "F");
          puzzleDoc.setDrawColor(0, 0, 0);
          puzzleDoc.setLineWidth(0.1);
          puzzleDoc.rect(x, y, cellSize, cellSize, "S");

          const fontSize = Math.max(6, Math.min(9, cellSize * 0.6));
          puzzleDoc.setFontSize(fontSize);
          puzzleDoc.setTextColor(0, 0, 0);
          puzzleDoc.text(puzzle.grid[r][c], x + cellSize / 2, y + cellSize / 2 + fontSize / 4, {
            align: "center"
          });
        }
      }
      const wordsStartX = margin;
      const wordsStartY = gridStartY + 3;
      puzzleDoc.setFontSize(8);
      puzzleDoc.setFont(undefined, 'bold');
      puzzleDoc.text('Find these words:', wordsStartX, wordsStartY);
      puzzleDoc.setFont(undefined, 'normal');
      puzzleDoc.setFontSize(6);

      const numColumns = 2;
      const colWidth = wordsWidth / numColumns;
      const lineHeight = 3;
      const wordsPerColumn = Math.ceil(puzzle.words.length / numColumns);

      let wordIdx = 0;
      for (let col = 0; col < numColumns; col++) {
        for (let row = 0; row < wordsPerColumn; row++) {
          if (wordIdx < puzzle.words.length) {
            const x = wordsStartX + col * colWidth;
            const y = wordsStartY + 2 + row * lineHeight;
            puzzleDoc.text(`• ${puzzle.words[wordIdx]}`, x, y);
            wordIdx++;
          }
        }
      }

            solutionDoc.setFontSize(12);
      solutionDoc.setFont(undefined, 'bold');
      solutionDoc.text(`${puzzle.theme || 'Word Search'} - Solution`, pageWidth / 2, startY + 6, { align: 'center' });

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

          const fontSize = Math.max(4, Math.min(7, cellSize * 0.5));
          solutionDoc.setFontSize(fontSize);
          solutionDoc.setTextColor(0, 0, 0);
          solutionDoc.text(puzzle.grid[r][c], x + cellSize / 2, y + cellSize / 2 + fontSize / 4, {
            align: "center"
          });
        }
      }
    }

    const puzzleBlob = puzzleDoc.output('blob');
    const solutionBlob = solutionDoc.output('blob');

    puzzlesFolder.file(`all-puzzles.pdf`, puzzleBlob);
    solutionsFolder.file(`all-solutions.pdf`, solutionBlob);

    const finalZipBlob = await allFilesZip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(finalZipBlob);
    link.download = `word-search-complete-${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
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
  const getRandomTheme = () => {
    const themes = [
      'Animals', 'Sports', 'Countries', 'Foods', 'Colors', 'Professions',
      'Nature', 'Weather', 'Vehicles', 'Music', 'Art', 'Science',
      'Space', 'Ocean', 'Mountains', 'Cities', 'Technology', 'History',
      'Geography', 'Literature', 'Movies', 'TV Shows', 'Games', 'Hobbies',
      'Tools', 'Furniture', 'Clothing', 'Jewelry', 'Flowers', 'Trees',
      'Birds', 'Insects', 'Fish', 'Mammals', 'Reptiles', 'Emotions',
      'Fruits', 'Vegetables', 'Desserts', 'Beverages', 'Holidays', 'Seasons'
    ];
    
    return themes[Math.floor(Math.random() * themes.length)];
  };

  const generateRandomWord = (minLength = 4, maxLength = 10, usedWords = new Set()) => {
    const consonants = 'BCDFGHJKLMNPQRSTVWXZ';
    const vowels = 'AEIOU';
    let attempts = 0;
    let word = '';
    
    while (attempts < 100) {
      const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
      word = '';
      
      for (let i = 0; i < length; i++) {
        if (i % 2 === 0 || Math.random() > 0.7) {
          word += consonants[Math.floor(Math.random() * consonants.length)];
        } else {
          word += vowels[Math.floor(Math.random() * vowels.length)];
        }
      }
      
      if (!usedWords.has(word) && word.length <= maxLength) {
        usedWords.add(word);
        return word;
      }
      attempts++;
    }
    
    return word + Math.floor(Math.random() * 99);
  };

  const getRandomWordFromDictionary = (usedWords = new Set(), maxLength = 10) => {
    if (dictionary.length === 0) {
      return generateRandomWord(4, maxLength, usedWords);
    }
    
    const availableWords = dictionary.filter(w => 
      w.length <= maxLength && !usedWords.has(w)
    );
    
    if (availableWords.length === 0) {
      return generateRandomWord(4, maxLength, usedWords);
    }
    
    const word = availableWords[Math.floor(Math.random() * availableWords.length)];
    usedWords.add(word);
    return word;
  };

  const generateCustomLists = async () => {
    if (customListCount < 1 || wordsPerList < 10) {
      alert('Inserisci valori validi!');
      return;
    }

    setIsGenerating(true);
    const lists = [];
    const allUsedWords = new Set();
    const categories = ['Basics', 'Modern', 'Classic', 'Trends', 'Advanced', 'Icons', 'History', 'Terms', 'Elements', 'Concepts'];
    
    try {
      const isGenericRequest = !customPrompt || 
                              /^\d+\s*(liste?|lists?)?$/i.test(customPrompt) ||
                              /dammi.*liste?/i.test(customPrompt);
      
      for (let i = 0; i < customListCount; i++) {
        let themeName;
        
        if (isGenericRequest) {
          themeName = getRandomTheme();
        } else {
          themeName = customPrompt;
        }
        
        const category = categories[i % categories.length];
        const listName = `${themeName} ${category}`;
        const words = [];
        const listUsedWords = new Set();
        
        for (let j = 0; j < wordsPerList; j++) {
          const word = getRandomWordFromDictionary(new Set([...allUsedWords, ...listUsedWords]), 10);
          words.push(word);
          listUsedWords.add(word);
          allUsedWords.add(word);
        }
        
        lists.push({
          name: listName,
          words: words
        });
      }
      
      setCustomGeneratedLists(lists);
      alert(`✓ Generate ${lists.length} liste con ${lists.reduce((sum, list) => sum + list.words.length, 0)} parole uniche!`);
    } catch (error) {
      console.error('Error generating lists:', error);
      alert('Errore nella generazione delle liste');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCustomLists = () => {
    if (customGeneratedLists.length === 0) {
      alert('Genera prima le liste!');
      return;
    }

    let txtContent = '';
    
    customGeneratedLists.forEach((list, index) => {
      txtContent += `${list.name} Word Search\n`;
      list.words.forEach(word => {
        txtContent += `${word}\n`;
      });
      if (index < customGeneratedLists.length - 1) {
        txtContent += '\n';
      }
    });

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = customPrompt && customPrompt.trim() 
      ? `${customPrompt.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_lists_${Date.now()}.txt`
      : `random_wordsearch_lists_${Date.now()}.txt`;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📄 Word Search Creator PRO</h1>
      </div>

      <div style={styles.tabBar}>
        <button
          style={{
            ...styles.tabButton,
            backgroundColor: currentTab === 'upload' ? '#00bcd4' : '#444',
          }}
          onClick={() => setCurrentTab('upload')}
        >
          Upload & Generate
        </button>
        <button
          style={{
            ...styles.tabButton,
            backgroundColor: currentTab === 'custom' ? '#00bcd4' : '#444',
          }}
          onClick={() => setCurrentTab('custom')}
        >
          Generate Custom Lists
        </button>
        <button
          style={{
            ...styles.tabButton,
            backgroundColor: currentTab === 'templates' ? '#00bcd4' : '#444',
          }}
          onClick={() => setCurrentTab('templates')}
        >
          Quick Templates
        </button>
      </div>

      <div style={styles.content}>
        {currentTab === 'upload' && (
          <div>
            <h2>Upload Files & Generate</h2>
            <div style={styles.formGroup}>
              <label>Upload TXT, CSV or ZIP files:</label>
              <input type="file" accept=".txt,.zip,.csv" onChange={handleFileUpload} />
            </div>

            <div style={styles.formGroup}>
              <label>Grid Size:</label>
              <select value={gridSize} onChange={(e) => {
                const newSize = Number(e.target.value);
                setGridSize(newSize);
                if (generatedPuzzles.length > 0) {
                  const wordLists = generatedPuzzles.map(p => ({
                    theme: p.theme,
                    words: p.words
                  }));
                  const newPuzzles = [];
                  for (const list of wordLists) {
                    const grid = createGrid(list.words, newSize);
                    newPuzzles.push({
                      theme: list.theme,
                      words: list.words,
                      grid: grid.grid,
                      wordPositions: grid.wordPositions
                    });
                  }
                  setGeneratedPuzzles(newPuzzles);
                }
              }}>
                <option value={15}>15x15</option>
                <option value={20}>20x20</option>
                <option value={25}>25x25</option>
              </select>
            </div>
                        <div style={styles.formGroup}>
              <label>Page Format:</label>
              <select value={pageFormat} onChange={(e) => setPageFormat(e.target.value)}>
                <option value="6x9">6x9 (KDP)</option>
                <option value="4.41x6.85">4.41x6.85 (Puzzle Book)</option>
                <option value="A4">A4</option>
                <option value="US Letter">US Letter</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label>Puzzles per page:</label>
              <select value={puzzlesPerPage} onChange={(e) => setPuzzlesPerPage(Number(e.target.value))}>
                <option value={1}>1 per page</option>
                <option value={2}>2 per page</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <input
                type="checkbox"
                checked={enableDecorations}
                onChange={(e) => setEnableDecorations(e.target.checked)}
              />
              <label>Enable Decorations</label>
            </div>

            <button style={styles.generateButton} onClick={downloadPDFs}>
              Download PDFs
            </button>
            <button style={styles.generateButton} onClick={downloadPNGs}>
              Download PNGs
            </button>
          </div>
        )}
        {currentTab === 'custom' && (
          <div>
            <h2>Generate Custom Lists</h2>
            <p style={{ marginBottom: '20px', color: '#aaa' }}>
              Genera liste di parole per word search. Specifica un tema o lascia vuoto per temi casuali.
              {dictionaryLoaded && <span style={{ color: '#0f0', marginLeft: '10px' }}>✓ Dizionario caricato ({dictionary.length} parole)</span>}
              {!dictionaryLoaded && <span style={{ color: '#f90', marginLeft: '10px' }}>⚠ Dizionario non disponibile</span>}
            </p>
            
            <div style={styles.formGroup}>
              <label>Prompt o Tema (lascia vuoto per temi casuali):</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Es: 'per bambini da 7-12 anni' o '50 liste' per temi casuali"
                rows="3"
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '5px',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  backgroundColor: '#444',
                  color: '#fff',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Numero di liste:</label>
              <input
                type="number"
                value={customListCount}
                onChange={(e) => setCustomListCount(Number(e.target.value))}
                min="1"
                max="500"
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '5px',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  backgroundColor: '#444',
                  color: '#fff'
                }}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Parole per lista:</label>
              <input
                type="number"
                value={wordsPerList}
                onChange={(e) => setWordsPerList(Number(e.target.value))}
                min="10"
                max="50"
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '5px',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  backgroundColor: '#444',
                  color: '#fff'
                }}
              />
            </div>

            <button
              style={{
                ...styles.generateButton,
                opacity: isGenerating ? 0.6 : 1,
                cursor: isGenerating ? 'not-allowed' : 'pointer'
              }}
              onClick={generateCustomLists}
              disabled={isGenerating || customListCount < 1}
            >
              {isGenerating ? 'Generazione in corso...' : 'Generate Lists'}
            </button>

            {customGeneratedLists.length > 0 && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#444', borderRadius: '4px' }}>
                <h3 style={{ marginTop: 0 }}>✓ Generate {customGeneratedLists.length} liste</h3>
                <p style={{ color: '#aaa', fontSize: '14px' }}>
                  Totale parole: {customGeneratedLists.reduce((sum, list) => sum + list.words.length, 0)}
                </p>
                <button style={styles.generateButton} onClick={downloadCustomLists}>
                  Download TXT File
                </button>
              </div>
            )}
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
    marginRight: '10px',
  },
};

export default WordSearchCreator;

