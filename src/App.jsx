import { useState } from "react";
import JSZip from "jszip";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const THEME_DECORATIONS = {
  christmas: {
    topLeft: "🎄",
    topRight: "🎅",
    bottomLeft: "🔔",
    bottomRight: "❄️"
  },
  movie: {
    topLeft: "🎬",
    topRight: "🍿",
    bottomLeft: "🎞️",
    bottomRight: "🎭"
  },
  sports: {
    topLeft: "⚽",
    topRight: "🏀",
    bottomLeft: "🏈",
    bottomRight: "⚾"
  },
  nature: {
    topLeft: "🌿",
    topRight: "🌸",
    bottomLeft: "🦋",
    bottomRight: "🌻"
  }
};

export default function WordSearchCreator() {
  const [activeTab, setActiveTab] = useState("tab1");
  const [files, setFiles] = useState([]);
  const [gridSize, setGridSize] = useState(15);
  const [pageFormat, setPageFormat] = useState("6x9");
  const [customTheme, setCustomTheme] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customNumber, setCustomNumber] = useState(100);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [perplexityOutput, setPerplexityOutput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [decorationsEnabled, setDecorationsEnabled] = useState(true);

  // Generate word search grid
  const generateWordSearch = (words, size = 15) => {
    const grid = Array(size).fill(null).map(() => Array(size).fill(""));
    const wordPositions = [];
    const directions = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];

    for (const word of words) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < 100) {
        const dir = directions[Math.floor(Math.random() * 8)];
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        
        let canPlace = true;
        for (let i = 0; i < word.length; i++) {
          const r = row + i * dir[0];
          const c = col + i * dir[1];
          if (r < 0 || r >= size || c < 0 || c >= size) {
            canPlace = false;
            break;
          }
          if (grid[r][c] && grid[r][c] !== word[i]) {
            canPlace = false;
            break;
          }
        }
        
        if (canPlace) {
          const positions = [];
          for (let i = 0; i < word.length; i++) {
            const r = row + i * dir[0];
            const c = col + i * dir[1];
            grid[r][c] = word[i];
            positions.push({ row: r, col: c });
          }
          wordPositions.push({ word, positions });
          placed = true;
        }
        attempts++;
      }
    }

    // Fill empty cells
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) {
          grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
    }

    return { grid, wordPositions };
  };

  // Generate prompt for Perplexity
  const generatePrompt = () => {
    const prompt = `Create ${customNumber} themed word search lists for "${customTheme}"${customDescription ? ` (${customDescription})` : ""}.

Format EXACTLY like this for EACH list:

*Theme Title 1*
word1
word2
word3
...
word30

*Theme Title 2*
word1
word2
...

REQUIREMENTS:
- Each list needs exactly 27-30 words
- ALL words must be thematically relevant to "${customTheme}"
- Minimize word repetition between lists
- Use American English
- Format: Plain text only, one word per line
- Separate each list with blank line

Generate all ${customNumber} lists now.`;
    
    setGeneratedPrompt(prompt);
    setMessage("✓ Prompt generated!");
  };

  const selectAllPrompt = (e) => {
    e.target.select();
  };

  // Parse Perplexity output and create ZIP
  const parseAndCreateZip = async () => {
    if (!perplexityOutput.trim()) {
      setMessage("❌ Please paste Perplexity output first");
      return;
    }

    setParsing(true);
    try {
      const lists = [];
      const lines = perplexityOutput.split("\n");
      let currentTitle = "";
      let currentWords = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") && trimmed.endsWith("*")) {
          if (currentTitle && currentWords.length >= 27 && currentWords.length <= 30) {
            lists.push({ title: currentTitle, words: currentWords });
          }
          currentTitle = trimmed.slice(1, -1);
          currentWords = [];
        } else if (trimmed && currentTitle) {
          currentWords.push(trimmed);
        }
      }

      if (currentTitle && currentWords.length >= 27 && currentWords.length <= 30) {
        lists.push({ title: currentTitle, words: currentWords });
      }

      if (lists.length === 0) {
        setMessage("❌ No valid lists found. Check format.");
        setParsing(false);
        return;
      }

      const zip = new JSZip();
      lists.forEach((list, idx) => {
        const content = `*${list.title}*\n${list.words.join("\n")}\n`;
        zip.file(`wordsearch_${String(idx + 1).padStart(3, "0")}.txt`, content);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${customTheme}_Wordsearches_Lists.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage(`✓ Created ZIP with ${lists.length} lists!`);
    } catch (err) {
      setMessage("❌ Error parsing output");
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  // Upload and generate PDFs/PNGs
  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    const parsedFiles = [];

    for (const file of uploadedFiles) {
      if (file.name.endsWith(".zip")) {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        for (const [name, fileObj] of Object.entries(content.files)) {
          if (!fileObj.dir && name.endsWith(".txt")) {
            const text = await fileObj.async("text");
            const lines = text.trim().split("\n");
            const title = lines[0].replace(/\*/g, "");
            const words = lines.slice(1).filter(w => w.trim());
            parsedFiles.push({ title, words });
          }
        }
      } else if (file.name.endsWith(".txt")) {
        const text = await file.text();
        const lines = text.trim().split("\n");
        const title = lines[0].replace(/\*/g, "");
        const words = lines.slice(1).filter(w => w.trim());
        parsedFiles.push({ title, words });
      }
    }

    setFiles(parsedFiles);
    setMessage(`✓ Loaded ${parsedFiles.length} puzzles!`);
  };

  const generatePuzzles = async () => {
    if (files.length === 0) {
      setMessage("❌ No files loaded");
      return;
    }

    setMessage("⏳ Generating puzzles...");
    const puzzles = [];

    for (const file of files) {
      const { grid, wordPositions } = generateWordSearch(file.words, gridSize);
      puzzles.push({
        title: file.title,
        words: file.words,
        grid,
        wordPositions
      });
    }

    setMessage(`✓ Generated ${puzzles.length} puzzles!`);
    await downloadPDFs(puzzles);
    await downloadPNGs(puzzles);
  };

  const downloadPDFs = async (puzzles) => {
    const zip = new JSZip();

    for (let idx = 0; idx < puzzles.length; idx++) {
      const puzzle = puzzles[idx];
      const doc = new jsPDF({ orientation: "portrait", unit: "in", format: pageFormat === "6x9" ? [6, 9] : pageFormat === "A4" ? [8.27, 11.69] : [8.5, 11] });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Page 1 - Puzzle
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(puzzle.title, pageWidth / 2, 0.4, { align: "center" });

      const gridWidth = 5;
      const cellSize = gridWidth / puzzle.grid.length;
      const startX = (pageWidth - gridWidth) / 2;
      const startY = 0.8;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      
      for (let r = 0; r < puzzle.grid.length; r++) {
  for (let c = 0; c < puzzle.grid[r].length; c++) {
    const x = startX + c * cellSize;
    const y = startY + r * cellSize;
    
    // Disegna sfondo bianco
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, cellSize, cellSize, "F");
    
    // Disegna bordo nero
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.01);
    doc.rect(x, y, cellSize, cellSize, "S");
    
    // Scrivi lettera
    doc.setTextColor(0, 0, 0);
    doc.text(puzzle.grid[r][c], x + cellSize / 2, y + cellSize / 2 + 0.05, { align: "center", baseline: "middle" });
  }
}

      // Word list
      const wordListY = startY + gridWidth + 0.2;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Find these words:", startX, wordListY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wordsPerCol = Math.ceil(puzzle.words.length / 3);
      const colWidth = gridWidth / 3;
      
      puzzle.words.forEach((word, widx) => {
        const col = Math.floor(widx / wordsPerCol);
        const row = widx % wordsPerCol;
        const x = startX + col * colWidth;
        const y = wordListY + 0.2 + row * 0.15;
        doc.text(`• ${word}`, x, y);
      });

      // Page 2 - Solution
      doc.addPage();
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(`${puzzle.title} - Solution`, pageWidth / 2, 0.4, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");

      for (let r = 0; r < puzzle.grid.length; r++) {
  for (let c = 0; c < puzzle.grid[r].length; c++) {
    const x = startX + c * cellSize;
    const y = startY + r * cellSize;
    
    const isFound = puzzle.wordPositions.some(wp =>
      wp.positions.some(pos => pos.row === r && pos.col === c)
    );

    // Disegna sfondo (bianco o giallo)
    if (isFound) {
      doc.setFillColor(255, 255, 0); // Giallo
    } else {
      doc.setFillColor(255, 255, 255); // Bianco
    }
    doc.rect(x, y, cellSize, cellSize, "F");
    
    // Disegna bordo nero
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.01);
    doc.rect(x, y, cellSize, cellSize, "S");
    
    // Scrivi lettera
    doc.setTextColor(0, 0, 0);
    doc.text(puzzle.grid[r][c], x + cellSize / 2, y + cellSize / 2 + 0.05, { align: "center", baseline: "middle" });
  }
}

      // Word list - no styling
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Found words:", startX, wordListY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      puzzle.words.forEach((word, widx) => {
        const col = Math.floor(widx / wordsPerCol);
        const row = widx % wordsPerCol;
        const x = startX + col * colWidth;
        const y = wordListY + 0.2 + row * 0.15;
        doc.text(`• ${word}`, x, y);
      });

      const pdfBlob = doc.output("blob");
      zip.file(`puzzle_${String(idx + 1).padStart(3, "0")}.pdf`, pdfBlob);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Wordsearches_Puzzles.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadPNGs = async (puzzles) => {
    const zip = new JSZip();

    for (let idx = 0; idx < puzzles.length; idx++) {
      const puzzle = puzzles[idx];

      // Puzzle PNG
      const puzzleHTML = document.createElement("div");
      puzzleHTML.style.cssText = "width: 600px; padding: 20px; background: white; font-family: Arial;";
      
      const title = document.createElement("h1");
      title.textContent = puzzle.title;
      title.style.cssText = "text-align: center; margin-bottom: 20px;";
      puzzleHTML.appendChild(title);

      const grid = document.createElement("div");
      grid.style.cssText = `display: grid; grid-template-columns: repeat(${puzzle.grid.length}, 1fr); gap: 1px; width: 500px; height: 500px; margin: 0 auto 20px; border: 2px solid #000;`;

      for (let r = 0; r < puzzle.grid.length; r++) {
        for (let c = 0; c < puzzle.grid[r].length; c++) {
          const cell = document.createElement("div");
          cell.textContent = puzzle.grid[r][c];
          cell.style.cssText = "display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; font-weight: bold; font-size: 14px;";
          grid.appendChild(cell);
        }
      }
      puzzleHTML.appendChild(grid);

      const wordList = document.createElement("div");
      wordList.style.cssText = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 500px; margin: 0 auto; font-size: 14px;";
      puzzle.words.forEach(word => {
        const item = document.createElement("div");
        item.textContent = `• ${word}`;
        wordList.appendChild(item);
      });
      puzzleHTML.appendChild(wordList);

      document.body.appendChild(puzzleHTML);
      const canvas = await html2canvas(puzzleHTML, { backgroundColor: "white", scale: 2 });
      document.body.removeChild(puzzleHTML);

      const pngBlob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob), "image/png"));
      zip.file(`puzzle_${String(idx + 1).padStart(3, "0")}.png`, pngBlob);

      // Solution PNG
      const solutionHTML = document.createElement("div");
      solutionHTML.style.cssText = "width: 600px; padding: 20px; background: white; font-family: Arial;";
      
      const sTitle = document.createElement("h1");
      sTitle.textContent = `${puzzle.title} - Solution`;
      sTitle.style.cssText = "text-align: center; margin-bottom: 20px;";
      solutionHTML.appendChild(sTitle);

      const sGrid = document.createElement("div");
      sGrid.style.cssText = `display: grid; grid-template-columns: repeat(${puzzle.grid.length}, 1fr); gap: 1px; width: 500px; height: 500px; margin: 0 auto 20px; border: 2px solid #000;`;

      for (let r = 0; r < puzzle.grid.length; r++) {
        for (let c = 0; c < puzzle.grid[r].length; c++) {
          const isFound = puzzle.wordPositions.some(wp =>
            wp.positions.some(pos => pos.row === r && pos.col === c)
          );

          const cell = document.createElement("div");
          cell.textContent = puzzle.grid[r][c];
          cell.style.cssText = `display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; font-weight: bold; font-size: 14px; ${isFound ? "background-color: #ffff00;" : ""}`;
          sGrid.appendChild(cell);
        }
      }
      solutionHTML.appendChild(sGrid);

      const sWordList = document.createElement("div");
      sWordList.style.cssText = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 500px; margin: 0 auto; font-size: 14px;";
      puzzle.words.forEach(word => {
        const item = document.createElement("div");
        item.textContent = `• ${word}`;
        sWordList.appendChild(item);
      });
      solutionHTML.appendChild(sWordList);

      document.body.appendChild(solutionHTML);
      const sCanvas = await html2canvas(solutionHTML, { backgroundColor: "white", scale: 2 });
      document.body.removeChild(solutionHTML);

      const sPngBlob = await new Promise(resolve => sCanvas.toBlob(blob => resolve(blob), "image/png"));
      zip.file(`solution_${String(idx + 1).padStart(3, "0")}.png`, sPngBlob);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Wordsearches_Images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a", color: "#fff", padding: "20px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", marginBottom: "30px" }}>📚 Word Search Creator PRO</h1>

        <div style={{ display: "flex", gap: "10px", marginBottom: "30px", borderBottom: "2px solid #444" }}>
          <button
            onClick={() => setActiveTab("tab1")}
            style={{
              padding: "10px 20px",
              background: activeTab === "tab1" ? "#0099ff" : "#333",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "16px",
              borderBottom: activeTab === "tab1" ? "3px solid #00dd00" : "none"
            }}
          >
            Upload & Generate
          </button>
          <button
            onClick={() => setActiveTab("tab2")}
            style={{
              padding: "10px 20px",
              background: activeTab === "tab2" ? "#0099ff" : "#333",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "16px",
              borderBottom: activeTab === "tab2" ? "3px solid #00dd00" : "none"
            }}
          >
            Generate Custom Lists
          </button>
          <button
            onClick={() => setActiveTab("tab3")}
            style={{
              padding: "10px 20px",
              background: activeTab === "tab3" ? "#0099ff" : "#333",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "16px",
              borderBottom: activeTab === "tab3" ? "3px solid #00dd00" : "none"
            }}
          >
            Quick Templates
          </button>
        </div>

        {activeTab === "tab1" && (
          <div style={{ background: "#222", padding: "30px", borderRadius: "8px" }}>
            <h2>Upload Files & Generate</h2>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>Upload TXT or ZIP files:</label>
              <input
                type="file"
                multiple
                accept=".txt,.zip"
                onChange={handleFileUpload}
                style={{ padding: "10px", width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>Grid Size:</label>
              <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} style={{ padding: "10px", width: "100%" }}>
                <option value={15}>15x15</option>
                <option value={20}>20x20</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>Page Format:</label>
              <select value={pageFormat} onChange={(e) => setPageFormat(e.target.value)} style={{ padding: "10px", width: "100%" }}>
                <option value="8.5x11">8.5x11 (US Letter)</option>
                <option value="A4">A4</option>
                <option value="6x9">6x9 (KDP)</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" checked={decorationsEnabled} onChange={(e) => setDecorationsEnabled(e.target.checked)} />
                Enable Decorations
              </label>
            </div>

            <button
              onClick={generatePuzzles}
              style={{
                width: "100%",
                padding: "15px",
                background: "#00dd00",
                color: "#000",
                border: "none",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
                borderRadius: "4px"
              }}
            >
              Generate Puzzles
            </button>

            {message && <p style={{ marginTop: "20px", padding: "10px", background: "#333", borderRadius: "4px" }}>{message}</p>}
          </div>
        )}

        {activeTab === "tab2" && (
          <div style={{ background: "#222", padding: "30px", borderRadius: "8px" }}>
            <h2>Generate Custom Lists with Perplexity</h2>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>Theme Name:</label>
              <input
                type="text"
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                placeholder="e.g., Movie Wordsearch"
                style={{ padding: "10px", width: "100%", borderRadius: "4px", border: "none" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>Description (optional):</label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="e.g., action, horror, comedy"
                style={{ padding: "10px", width: "100%", borderRadius: "4px", border: "none" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>Number of Lists:</label>
              <input
                type="number"
                value={customNumber}
                onChange={(e) => setCustomNumber(Number(e.target.value))}
                min="10"
                max="200"
                style={{ padding: "10px", width: "100%", borderRadius: "4px", border: "none" }}
              />
            </div>

            <button
              onClick={generatePrompt}
              style={{
                width: "100%",
                padding: "12px",
                background: "#0099ff",
                color: "#fff",
                border: "none",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                borderRadius: "4px",
                marginBottom: "20px"
              }}
            >
              Generate Prompt
            </button>

            {generatedPrompt && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px" }}>Generated Prompt (click to select):</label>
                <textarea
                  readOnly
                  value={generatedPrompt}
                  onClick={selectAllPrompt}
                  style={{
                    width: "100%",
                    height: "200px",
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #444",
                    background: "#333",
                    color: "#fff",
                    fontFamily: "monospace",
                    cursor: "pointer"
                  }}
                />
                <small style={{ display: "block", marginTop: "5px", color: "#888" }}>💡 Click to select all, then press CTRL+C to copy</small>
              </div>
            )}

            <a
              href="https://www.perplexity.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                width: "100%",
                padding: "12px",
                background: "#9933ff",
                color: "#fff",
                border: "none",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                borderRadius: "4px",
                marginBottom: "20px",
                textAlign: "center",
                textDecoration: "none"
              }}
            >
              Open Perplexity Pro
            </a>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>Paste Perplexity Output Here (click to select):</label>
              <textarea
                value={perplexityOutput}
                onChange={(e) => setPerplexityOutput(e.target.value)}
                onClick={selectAllPrompt}
                placeholder="Paste the generated lists from Perplexity Pro..."
                style={{
                  width: "100%",
                  height: "200px",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #444",
                  background: "#333",
                  color: "#fff",
                  fontFamily: "monospace",
                  cursor: "pointer"
                }}
              />
            </div>

            <button
              onClick={parseAndCreateZip}
              disabled={parsing}
              style={{
                width: "100%",
                padding: "15px",
                background: parsing ? "#666" : "#00dd00",
                color: "#000",
                border: "none",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: parsing ? "not-allowed" : "pointer",
                borderRadius: "4px"
              }}
            >
              {parsing ? "Parsing..." : "Parse & Create ZIP"}
            </button>

            {message && <p style={{ marginTop: "20px", padding: "10px", background: "#333", borderRadius: "4px" }}>{message}</p>}
          </div>
        )}

        {activeTab === "tab3" && (
          <div style={{ background: "#222", padding: "30px", borderRadius: "8px" }}>
            <h2>Quick Templates</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
              {[
                { name: "🎄 Christmas", value: "christmas" },
                { name: "🎬 Movie", value: "movie" },
                { name: "⚽ Sports", value: "sports" },
                { name: "🌿 Nature", value: "nature" }
              ].map((template) => (
                <button
                  key={template.value}
                  onClick={() => {
                    setCustomTheme(template.name);
                    alert(`Template "${template.name}" selected! Now use TAB 2 to generate lists.`);
                  }}
                  style={{
                    padding: "20px",
                    background: "#333",
                    border: "2px solid #0099ff",
                    color: "#fff",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    borderRadius: "4px"
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
