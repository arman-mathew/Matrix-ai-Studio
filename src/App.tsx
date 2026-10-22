import React, { useState, useEffect, useRef } from "react";

interface CellPosition {
  r: number;
  c: number;
}

interface SelectionRange {
  startR: number;
  startC: number;
  endR: number;
  endC: number;
}

export function App() {
  // ==================== 1. ADMIN AUTHENTICATION STATE ====================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("excel_auth_token") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPassword = import.meta.env.VITE_APP_PASSWORD || "1234";

    if (passwordInput === adminPassword) {
      sessionStorage.setItem("excel_auth_token", "true");
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  // ==================== 2. SPREADSHEET STATE ====================
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sheets, setSheets] = useState<Record<string, Record<string, string>>>({
    "Sheet1": {
      "0-0": "ID", "0-1": "Product Name", "0-2": "Category", "0-3": "Price (₹)", "0-4": "Stock",
      "1-0": "101", "1-1": "Smart Wi-Fi Meter", "1-2": "Hardware", "1-3": "2499.00", "1-4": "1200",
      "2-0": "102", "2-1": "Zigbee Gateway", "2-2": "IoT Hub", "2-3": "4500.00", "2-4": "450",
      "3-0": "103", "3-1": "Voltage Sensor", "3-2": "Hardware", "3-3": "850.00", "3-4": "3000"
    },
    "Sheet2": {
      "0-0": "Month", "0-1": "Sales (₹)",
      "1-0": "January", "1-1": "450000",
      "2-0": "February", "2-1": "520000"
    }
  });

  const [activeSheet, setActiveSheet] = useState<string>("Sheet1");
  const cellData = sheets[activeSheet] || {};

  const [activeCell, setActiveCell] = useState<CellPosition>({ r: 1, c: 0 });
  const [selection, setSelection] = useState<SelectionRange>({ startR: 1, startC: 0, endR: 1, endC: 0 });
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const ROW_COUNT = 10000000; // 1 Crore rows
  const COL_COUNT = 50;
  const ROW_HEIGHT = 26;
  const COL_WIDTH = 110;
  const HEADER_HEIGHT = 26;
  const HEADER_WIDTH = 60;

  // Convert column index to Excel letter (0 -> A, 26 -> AA)
  const getColumnName = (colIndex: number) => {
    let temp, letter = '';
    colIndex++;
    while (colIndex > 0) {
      temp = (colIndex - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
  };

  const activeKey = `${activeCell.r}-${activeCell.c}`;
  const cellDisplayValue = cellData[activeKey] || "";

  useEffect(() => {
    setEditValue(cellDisplayValue);
  }, [activeCell, cellData]);

  // Viewport Auto-Scroll: ensures activeCell is always visible on screen
  const ensureCellVisible = (r: number, c: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const visibleWidth = canvas.width - HEADER_WIDTH;
    const visibleHeight = canvas.height - HEADER_HEIGHT;

    const cellX = c * COL_WIDTH;
    const cellY = r * ROW_HEIGHT;

    setScrollOffset(prev => {
      let newX = prev.x;
      let newY = prev.y;

      if (cellX < prev.x) {
        newX = cellX;
      } else if (cellX + COL_WIDTH > prev.x + visibleWidth) {
        newX = cellX + COL_WIDTH - visibleWidth;
      }

      if (cellY < prev.y) {
        newY = cellY;
      } else if (cellY + ROW_HEIGHT > prev.y + visibleHeight) {
        newY = cellY + ROW_HEIGHT - visibleHeight;
      }

      return { x: Math.max(0, newX), y: Math.max(0, newY) };
    });
  };

  // Canvas Drawing Engine
  useEffect(() => {
    if (!isAuthenticated) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 170;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const startCol = Math.floor(scrollOffset.x / COL_WIDTH);
    const endCol = Math.min(COL_COUNT, startCol + Math.ceil(canvas.width / COL_WIDTH) + 1);
    const startRow = Math.floor(scrollOffset.y / ROW_HEIGHT);
    const endRow = Math.min(ROW_COUNT, startRow + Math.ceil(canvas.height / ROW_HEIGHT) + 1);

    ctx.font = "12px Segoe UI, Calibri, sans-serif";

    const minR = Math.min(selection.startR, selection.endR);
    const maxR = Math.max(selection.startR, selection.endR);
    const minC = Math.min(selection.startC, selection.endC);
    const maxC = Math.max(selection.startC, selection.endC);

    // 1. Draw Cells
    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const x = HEADER_WIDTH + (c - startCol) * COL_WIDTH - (scrollOffset.x % COL_WIDTH);
        const y = HEADER_HEIGHT + (r - startRow) * ROW_HEIGHT - (scrollOffset.y % ROW_HEIGHT);

        const isInSelection = r >= minR && r <= maxR && c >= minC && c <= maxC;
        const isActive = activeCell.r === r && activeCell.c === c;

        if (isActive) {
          ctx.fillStyle = "#ffffff";
        } else if (isInSelection) {
          ctx.fillStyle = "#e2efda";
        } else {
          ctx.fillStyle = r === 0 ? "#f8f9fa" : "#ffffff";
        }
        ctx.fillRect(x, y, COL_WIDTH, ROW_HEIGHT);

        ctx.strokeStyle = "#d9d9d9";
        ctx.strokeRect(x, y, COL_WIDTH, ROW_HEIGHT);

        ctx.fillStyle = r === 0 ? "#000000" : "#212121";
        if (r === 0) ctx.font = "bold 12px Segoe UI";
        const val = cellData[`${r}-${c}`] || "";
        ctx.fillText(val, x + 6, y + 17);
        if (r === 0) ctx.font = "12px Segoe UI";
      }
    }

    // 2. Draw Selection Border & Fill Handle
    if (minR >= startRow && minR <= endRow && minC >= startCol && minC <= endCol) {
      const selX = HEADER_WIDTH + (minC - startCol) * COL_WIDTH - (scrollOffset.x % COL_WIDTH);
      const selY = HEADER_HEIGHT + (minR - startRow) * ROW_HEIGHT - (scrollOffset.y % ROW_HEIGHT);
      const selW = (maxC - minC + 1) * COL_WIDTH;
      const selH = (maxR - minR + 1) * ROW_HEIGHT;

      ctx.strokeStyle = "#107c41";
      ctx.lineWidth = 2;
      ctx.strokeRect(selX, selY, selW, selH);
      ctx.lineWidth = 1;

      const handleX = selX + selW - 4;
      const handleY = selY + selH - 4;
      ctx.fillStyle = "#107c41";
      ctx.fillRect(handleX, handleY, 8, 8);
    }

    // 3. Draw Row Headers
    for (let r = startRow; r < endRow; r++) {
      const y = HEADER_HEIGHT + (r - startRow) * ROW_HEIGHT - (scrollOffset.y % ROW_HEIGHT);
      const isHeaderSelected = r >= minR && r <= maxR;
      ctx.fillStyle = isHeaderSelected ? "#d0e4cc" : "#f3f3f3";
      ctx.fillRect(0, y, HEADER_WIDTH, ROW_HEIGHT);
      ctx.strokeStyle = "#d9d9d9";
      ctx.strokeRect(0, y, HEADER_WIDTH, ROW_HEIGHT);
      ctx.fillStyle = isHeaderSelected ? "#107c41" : "#666666";
      ctx.fillText((r + 1).toString(), 12, y + 17);
    }

    // 4. Draw Column Headers
    for (let c = startCol; c < endCol; c++) {
      const x = HEADER_WIDTH + (c - startCol) * COL_WIDTH - (scrollOffset.x % COL_WIDTH);
      const isHeaderSelected = c >= minC && c <= maxC;
      ctx.fillStyle = isHeaderSelected ? "#d0e4cc" : "#f3f3f3";
      ctx.fillRect(x, 0, COL_WIDTH, HEADER_HEIGHT);
      ctx.strokeStyle = "#d9d9d9";
      ctx.strokeRect(x, 0, COL_WIDTH, HEADER_HEIGHT);
      ctx.fillStyle = isHeaderSelected ? "#107c41" : "#333333";
      ctx.fillText(getColumnName(c), x + 35, 17);
    }
  }, [scrollOffset, activeCell, selection, cellData, isAuthenticated]);

  // Jump Logic for Ctrl + Arrows
  const getJumpTarget = (r: number, c: number, dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    const hasValue = (row: number, col: number) => !!cellData[`${row}-${col}`];
    
    if (dir === 'DOWN') {
      let curr = hasValue(r, c);
      if (!curr) {
        for (let i = r + 1; i < ROW_COUNT; i++) {
          if (hasValue(i, c)) return { r: i, c };
        }
        return { r: ROW_COUNT - 1, c };
      } else {
        let lastFilled = r;
        for (let i = r + 1; i < ROW_COUNT; i++) {
          if (hasValue(i, c)) lastFilled = i;
          else break;
        }
        if (lastFilled === r) {
          let foundEmpty = false;
          for (let i = r + 1; i < ROW_COUNT; i++) {
            if (!foundEmpty && !hasValue(i, c)) foundEmpty = true;
            if (foundEmpty && hasValue(i, c)) return { r: i, c };
          }
          return { r: ROW_COUNT - 1, c };
        }
        return { r: lastFilled, c };
      }
    }
    if (dir === 'UP') {
      let curr = hasValue(r, c);
      if (!curr) {
        for (let i = r - 1; i >= 0; i--) {
          if (hasValue(i, c)) return { r: i, c };
        }
        return { r: 0, c };
      } else {
        let firstFilled = r;
        for (let i = r - 1; i >= 0; i--) {
          if (hasValue(i, c)) firstFilled = i;
          else break;
        }
        if (firstFilled === r) {
          let foundEmpty = false;
          for (let i = r - 1; i >= 0; i--) {
            if (!foundEmpty && !hasValue(i, c)) foundEmpty = true;
            if (foundEmpty && hasValue(i, c)) return { r: i, c };
          }
          return { r: 0, c };
        }
        return { r: firstFilled, c };
      }
    }
    if (dir === 'RIGHT') {
      let curr = hasValue(r, c);
      if (!curr) {
        for (let j = c + 1; j < COL_COUNT; j++) {
          if (hasValue(r, j)) return { r, c: j };
        }
        return { r, c: COL_COUNT - 1 };
      } else {
        let lastFilled = c;
        for (let j = c + 1; j < COL_COUNT; j++) {
          if (hasValue(r, j)) lastFilled = j;
          else break;
        }
        if (lastFilled === c) {
          let foundEmpty = false;
          for (let j = c + 1; j < COL_COUNT; j++) {
            if (!foundEmpty && !hasValue(r, j)) foundEmpty = true;
            if (foundEmpty && hasValue(r, j)) return { r, c: j };
          }
          return { r, c: COL_COUNT - 1 };
        }
        return { r, c: lastFilled };
      }
    }
    if (dir === 'LEFT') {
      let curr = hasValue(r, c);
      if (!curr) {
        for (let j = c - 1; j >= 0; j--) {
          if (hasValue(r, j)) return { r, c: j };
        }
        return { r, c: 0 };
      } else {
        let firstFilled = c;
        for (let j = c - 1; j >= 0; j--) {
          if (hasValue(r, j)) firstFilled = j;
          else break;
        }
        if (firstFilled === c) {
          let foundEmpty = false;
          for (let j = c - 1; j >= 0; j--) {
            if (!foundEmpty && !hasValue(r, j)) foundEmpty = true;
            if (foundEmpty && hasValue(r, j)) return { r, c: j };
          }
          return { r, c: 0 };
        }
        return { r, c: firstFilled };
      }
    }
    return { r, c };
  };

  const updateActiveCellAndScroll = (r: number, c: number, isShift: boolean) => {
    setActiveCell({ r, c });
    ensureCellVisible(r, c);
    if (isShift) {
      setSelection(prev => ({ ...prev, endR: r, endC: c }));
    } else {
      setSelection({ startR: r, startC: c, endR: r, endC: c });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === "Enter") {
        setSheets(prev => ({
          ...prev,
          [activeSheet]: { ...prev[activeSheet], [activeKey]: editValue }
        }));
        setIsEditing(false);
        updateActiveCellAndScroll(Math.min(ROW_COUNT - 1, activeCell.r + 1), activeCell.c, false);
      }
      return;
    }

    let { r, c } = activeCell;
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (e.key === "ArrowDown") {
      if (isCtrl) {
        const t = getJumpTarget(r, c, 'DOWN');
        r = t.r;
      } else {
        r = Math.min(ROW_COUNT - 1, r + 1);
      }
      updateActiveCellAndScroll(r, c, isShift);
    } else if (e.key === "ArrowUp") {
      if (isCtrl) {
        const t = getJumpTarget(r, c, 'UP');
        r = t.r;
      } else {
        r = Math.max(0, r - 1);
      }
      updateActiveCellAndScroll(r, c, isShift);
    } else if (e.key === "ArrowRight") {
      if (isCtrl) {
        const t = getJumpTarget(r, c, 'RIGHT');
        c = t.c;
      } else {
        c = Math.min(COL_COUNT - 1, c + 1);
      }
      updateActiveCellAndScroll(r, c, isShift);
    } else if (e.key === "ArrowLeft") {
      if (isCtrl) {
        const t = getJumpTarget(r, c, 'LEFT');
        c = t.c;
      } else {
        c = Math.max(0, c - 1);
      }
      updateActiveCellAndScroll(r, c, isShift);
    } else if (e.key === "Enter") {
      r = Math.min(ROW_COUNT - 1, r + 1);
      updateActiveCellAndScroll(r, c, false);
    } else if (e.key === "Tab") {
      e.preventDefault();
      c = Math.min(COL_COUNT - 1, c + 1);
      updateActiveCellAndScroll(r, c, false);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      const minR = Math.min(selection.startR, selection.endR);
      const maxR = Math.max(selection.startR, selection.endR);
      const minC = Math.min(selection.startC, selection.endC);
      const maxC = Math.max(selection.startC, selection.endC);
      
      setSheets(prev => {
        const sheetCopy = { ...prev[activeSheet] };
        for (let row = minR; row <= maxR; row++) {
          for (let col = minC; col <= maxC; col++) {
            delete sheetCopy[`${row}-${col}`];
          }
        }
        return { ...prev, [activeSheet]: sheetCopy };
      });
    } else if (e.key.length === 1 && !isCtrl) {
      setIsEditing(true);
      setEditValue(e.key);
    }
  };

  // Mouse Selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < HEADER_WIDTH || y < HEADER_HEIGHT) return;

    const c = Math.floor((x - HEADER_WIDTH + (scrollOffset.x % COL_WIDTH)) / COL_WIDTH) + Math.floor(scrollOffset.x / COL_WIDTH);
    const r = Math.floor((y - HEADER_HEIGHT + (scrollOffset.y % ROW_HEIGHT)) / ROW_HEIGHT) + Math.floor(scrollOffset.y / ROW_HEIGHT);

    setActiveCell({ r, c });
    setSelection({ startR: r, startC: c, endR: r, endC: c });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < HEADER_WIDTH || y < HEADER_HEIGHT) return;

    const c = Math.floor((x - HEADER_WIDTH + (scrollOffset.x % COL_WIDTH)) / COL_WIDTH) + Math.floor(scrollOffset.x / COL_WIDTH);
    const r = Math.floor((y - HEADER_HEIGHT + (scrollOffset.y % ROW_HEIGHT)) / ROW_HEIGHT) + Math.floor(scrollOffset.y / ROW_HEIGHT);

    setSelection(prev => ({ ...prev, endR: Math.max(0, r), endC: Math.max(0, c) }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleScroll = (e: React.WheelEvent) => {
    setScrollOffset(prev => ({
      x: Math.max(0, prev.x + e.deltaX),
      y: Math.max(0, prev.y + e.deltaY)
    }));
  };

  // File Operations: Export to CSV
  const exportToCSV = () => {
    let maxR = 0, maxC = 0;
    Object.keys(cellData).forEach(key => {
      const [r, c] = key.split("-").map(Number);
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    });

    let csvContent = "";
    for (let r = 0; r <= maxR; r++) {
      let rowVals = [];
      for (let c = 0; c <= maxC; c++) {
        let val = cellData[`${r}-${c}`] || "";
        if (val.includes(",")) val = `"${val}"`;
        rowVals.push(val);
      }
      csvContent += rowVals.join(",") + "\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeSheet}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // File Operations: Import CSV
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split("\n");
      const newSheetData: Record<string, string> = {};

      lines.forEach((line, r) => {
        const cols = line.split(",");
        cols.forEach((val, c) => {
          let cleanVal = val.trim();
          if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
            cleanVal = cleanVal.slice(1, -1);
          }
          if (cleanVal) {
            newSheetData[`${r}-${c}`] = cleanVal;
          }
        });
      });

      setSheets(prev => ({ ...prev, [activeSheet]: newSheetData }));
    };
    reader.readAsText(file);
  };

  // Create New Sheet
  const addNewSheet = () => {
    const sheetName = `Sheet${Object.keys(sheets).length + 1}`;
    setSheets(prev => ({ ...prev, [sheetName]: { "0-0": "ID", "0-1": "Data" } }));
    setActiveSheet(sheetName);
  };

  // Gemini AI Handler
  const handleRunAI = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Provide ONLY a valid Excel formula or answer for this request: ${aiPrompt}` }] }]
        })
      });

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```excel|```/g, "").trim() || "";

      setSheets(prev => ({
        ...prev,
        [activeSheet]: { ...prev[activeSheet], [activeKey]: result }
      }));
      setAiPrompt("");
    } catch (err) {
      console.error("AI Error:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // ==================== 3. RENDER LOGIN SCREEN IF NOT AUTHENTICATED ====================
  if (!isAuthenticated) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#f3f3f3", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "Segoe UI, sans-serif" }}>
        <div style={{ background: "#ffffff", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", width: "380px", textAlign: "center", borderTop: "5px solid #107c41" }}>
          <div style={{ fontSize: "32px", fontWeight: "bold", color: "#107c41", marginBottom: "10px" }}>XLSX</div>
          <h2 style={{ margin: "0 0 8px 0", color: "#333", fontSize: "20px" }}>Excel AI Studio</h2>
          <p style={{ color: "#666", fontSize: "13px", marginBottom: "24px" }}>Enter admin password to access tool.</p>
          
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input 
              type="password"
              placeholder="Enter Admin Password (1234)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ padding: "10px 14px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", outline: "none" }}
              autoFocus
            />
            {loginError && <span style={{ color: "#d9534f", fontSize: "12px", textAlign: "left" }}>Incorrect password. Access denied.</span>}
            
            <button 
              type="submit"
              style={{ background: "#107c41", color: "#fff", border: "none", padding: "10px", borderRadius: "4px", fontSize: "14px", fontWeight: 600, cursor: "pointer", marginTop: "8px" }}
            >
              Unlock Tool
            </button>
          </form>
          <div style={{ marginTop: "20px", fontSize: "11px", color: "#888" }}>Restricted Access • Managed by Admin 🔒</div>
        </div>
      </div>
    );
  }

  // ==================== 4. MAIN SPREADSHEET INTERFACE ====================
  return (
    <div 
      tabIndex={0} 
      onKeyDown={handleKeyDown}
      style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#f3f3f3", outline: "none", fontFamily: "Segoe UI, sans-serif" }}
    >
      <input type="file" ref={fileInputRef} onChange={handleCSVUpload} accept=".csv" style={{ display: "none" }} />

      {/* 1. Title Bar */}
      <div style={{ background: "#107c41", color: "#ffffff", padding: "6px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", fontWeight: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ background: "#ffffff", color: "#107c41", padding: "2px 8px", fontWeight: "bold", borderRadius: "2px" }}>X</span>
          <span>Book1 - Excel AI Studio (1 Crore Rows Engine)</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "3px 8px", borderRadius: "2px", cursor: "pointer", fontSize: "11px" }}>📂 Open CSV</button>
          <button onClick={exportToCSV} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "3px 8px", borderRadius: "2px", cursor: "pointer", fontSize: "11px" }}>💾 Save as CSV</button>
        </div>
      </div>

      {/* 2. Ribbon Tabs */}
      <div style={{ background: "#f8f9fa", borderBottom: "1px solid #d1d1d1", display: "flex", padding: "0 10px", fontSize: "12px" }}>
        {["File", "Home", "Insert", "Formulas", "Data", "AI Copilot ✨"].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              padding: "8px 16px", 
              background: activeTab === tab ? "#ffffff" : "transparent", 
              border: "none", 
              borderBottom: activeTab === tab ? "2px solid #107c41" : "none",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "#107c41" : "#333"
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. Ribbon Toolbar */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #d1d1d1", padding: "8px 16px", display: "flex", gap: "20px", alignItems: "center", fontSize: "12px", height: "45px" }}>
        <div style={{ display: "flex", gap: "5px" }}>
          <button style={{ padding: "4px 10px", border: "1px solid #ccc", background: "#f9f9f9", cursor: "pointer", borderRadius: "2px" }}>📋 Copy</button>
          <button style={{ padding: "4px 10px", border: "1px solid #ccc", background: "#f9f9f9", cursor: "pointer", borderRadius: "2px" }}>✂️ Cut</button>
          <button style={{ padding: "4px 8px", border: "1px solid #ccc", background: "#f9f9f9", cursor: "pointer", borderRadius: "2px" }}><b>B</b></button>
          <button style={{ padding: "4px 8px", border: "1px solid #ccc", background: "#f9f9f9", cursor: "pointer", borderRadius: "2px" }}><i>I</i></button>
        </div>
        <div style={{ height: "20px", width: "1px", background: "#ddd" }} />
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ color: "#666" }}>AI Copilot:</span>
          <input 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ask AI to write formulas or query data..." 
            style={{ width: "280px", padding: "4px 8px", border: "1px solid #ccc", borderRadius: "2px", fontSize: "12px" }}
          />
          <button 
            onClick={handleRunAI}
            style={{ background: "#107c41", color: "#fff", border: "none", padding: "5px 12px", borderRadius: "2px", cursor: "pointer", fontWeight: 600 }}
          >
            {isAiLoading ? "Thinking..." : "Run AI"}
          </button>
        </div>
      </div>

      {/* 4. Formula Bar (`fx`) */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #d1d1d1", padding: "4px 10px", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "65px", textAlign: "center", fontWeight: "bold", color: "#555", borderRight: "1px solid #ddd", fontSize: "12px" }}>
          {getColumnName(activeCell.c)}{activeCell.r + 1}
        </div>
        <div style={{ fontStyle: "italic", fontWeight: "bold", color: "#107c41", fontSize: "13px" }}>fx</div>
        <input 
          ref={inputRef}
          value={isEditing ? editValue : cellDisplayValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            if (!isEditing) setIsEditing(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSheets(prev => ({
                ...prev,
                [activeSheet]: { ...prev[activeSheet], [activeKey]: editValue }
              }));
              setIsEditing(false);
              updateActiveCellAndScroll(Math.min(ROW_COUNT - 1, activeCell.r + 1), activeCell.c, false);
            }
          }}
          style={{ flex: 1, border: "none", outline: "none", fontSize: "13px", fontFamily: "Segoe UI" }}
          placeholder="Enter value or formula"
        />
      </div>

      {/* 5. Canvas Grid Viewport */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onWheel={handleScroll}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={() => setIsEditing(true)}
          style={{ display: "block", cursor: "cell" }}
        />
      </div>

      {/* 6. Sheet Tabs Navigation Bar */}
      <div style={{ background: "#f8f9fa", borderTop: "1px solid #d1d1d1", display: "flex", alignItems: "center", padding: "0 10px", height: "32px", gap: "4px" }}>
        <button 
          onClick={addNewSheet}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#107c41", padding: "0 8px" }}
          title="Add New Sheet"
        >
          +
        </button>
        <div style={{ height: "18px", width: "1px", background: "#ddd", margin: "0 4px" }} />
        {Object.keys(sheets).map(sheetName => (
          <button
            key={sheetName}
            onClick={() => setActiveSheet(sheetName)}
            style={{
              padding: "4px 16px",
              background: activeSheet === sheetName ? "#ffffff" : "#f1f1f1",
              border: "1px solid #d1d1d1",
              borderBottom: activeSheet === sheetName ? "2px solid #107c41" : "1px solid #d1d1d1",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: activeSheet === sheetName ? 600 : 400,
              color: activeSheet === sheetName ? "#107c41" : "#333",
              borderTopLeftRadius: "3px",
              borderTopRightRadius: "3px"
            }}
          >
            {sheetName}
          </button>
        ))}
      </div>

      {/* 7. Bottom Status Bar */}
      <div style={{ background: "#f3f3f3", borderTop: "1px solid #d1d1d1", padding: "4px 16px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#555" }}>
        <div style={{ display: "flex", gap: "15px" }}>
          <span style={{ color: "#107c41", fontWeight: "bold" }}>● Ready (Admin Protected 🔒)</span>
          <span>10,000,000 Rows Virtualized</span>
        </div>
        <div>
          <span>Active Cell: {getColumnName(activeCell.c)}{activeCell.r + 1} ({activeSheet})</span>
        </div>
      </div>
    </div>
  );
}

export default App;