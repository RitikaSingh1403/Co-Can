import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import Editor from '@monaco-editor/react';

const App = () => {
  const [code, setCode] = useState('// Write your code here\nfunction hello() {\n  console.log("Hello, world!");\n}');
  const [panelSizes, setPanelSizes] = useState([50, 50]);
  const [isResizing, setIsResizing] = useState(false);
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('// Output will appear here\n');
  const [isRunning, setIsRunning] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  
  const containerRef = useRef(null);
  const excalidrawRef = useRef(null);
  const editorRef = useRef(null);

  // Check backend health on component mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        const data = await response.json();
        setBackendStatus('connected');
        setOutput('Lets run your code buddy ! \n');
      } else {
        setBackendStatus('error');
        setOutput('// Error: Backend server not responding properly\n');
      }
    } catch (error) {
      setBackendStatus('error');
      setOutput('// Error: Cannot connect to backend server. Make sure it\'s running on port 3001.\n');
    }
  };

  const handleEditorChange = (value) => {
    setCode(value);
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const totalWidth = containerRect.width;
      const newLeftPanelWidth = ((e.clientX - containerRect.left) / totalWidth) * 100;
      const newRightPanelWidth = 100 - newLeftPanelWidth;
      
      setPanelSizes([newLeftPanelWidth, newRightPanelWidth]);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Set default code based on language
  useEffect(() => {
    if (language === 'python') {
      setCode('# Write your Python code here\ndef hello():\n    print("Hello, world!")\n\nhello()');
    } else if (language === 'java') {
      setCode('// Write your Java code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}');
    } else if (language === 'cpp') {
      setCode('// Write your C++ code here\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}');
    } else if (language === 'javascript') {
      setCode('// Write your JavaScript code here\nfunction hello() {\n    console.log("Hello, world!");\n}\n\nhello();');
    }
  }, [language]);

  const runCode = async () => {
    if (backendStatus !== 'connected') {
      setOutput('// Error: Backend not connected. Please check if backend server is running.\n');
      return;
    }

    setIsRunning(true);
    setOutput('');
    
    try {
      let endpoint = language;
      
      const response = await fetch(`http://localhost:3001/execute/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        setOutput(prev => prev + `\nError:\n${result.error}\n\nExecution failed.`);
      } else {
        setOutput(prev => prev + `\n${result.output}\n\nExecution completed successfully.`);
      }
    } catch (error) {
      setOutput(prev => prev + `\nError:\n${error.message}\n\nMake sure the backend server is running on port 3001.`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearOutput = () => {
    setOutput('// Output cleared\n');
  };

  const exportData = async () => {
    try {
      // Get elements from Excalidraw
      const elements = excalidrawRef.current?.getSceneElements();
      
      const data = {
        excalidraw: elements || [],
        code: code,
        language: language,
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      setOutput(prev => prev + `\nExport Error: ${error.message}`);
    }
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.code) {
          setCode(data.code);
        }
        if (data.language) {
          setLanguage(data.language);
        }
        if (data.excalidraw && excalidrawRef.current) {
          excalidrawRef.current.updateScene({
            elements: data.excalidraw.elements || data.excalidraw,
          });
        }
        setOutput('// Project imported successfully\n');
      } catch (error) {
        console.error('Import error:', error);
        setOutput(prev => prev + `\nImport Error: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  const triggerImport = () => {
    document.getElementById('import-file').click();
  };

  const retryBackendConnection = () => {
    setBackendStatus('checking');
    checkBackendHealth();
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">Sketch & Code</div>
        <div className="controls">
          <div className="backend-status">
            <div className={`status-dot ${backendStatus}`} title={
              backendStatus === 'connected' ? 'Backend Connected' : 
              backendStatus === 'error' ? 'Backend Offline' : 
              backendStatus === 'checking' ? 'Checking Backend...' :
              'Backend Status Unknown'
            }></div>
            {backendStatus === 'error' && (
              <button onClick={retryBackendConnection} className="retry-button">
                Retry
              </button>
            )}
          </div>
          <input
            type="file"
            id="import-file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={importData}
          />
          <button onClick={triggerImport}>Import Project</button>
          <button onClick={exportData}>Export Project</button>
        </div>
      </header>
      
      <div className="split-container" ref={containerRef}>
        <div 
          className="panel" 
          style={{ width: `${panelSizes[0]}%` }}
        >
          <div className="excalidraw-container">
            <Excalidraw ref={excalidrawRef} />
          </div>
        </div>
        
        <div 
          className="resizer" 
          onMouseDown={startResizing}
        />
        
        <div 
          className="panel" 
          style={{ width: `${panelSizes[1]}%` }}
        >
          <div className="editor-container">
            <div className="editor-toolbar">
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                className="language-select"
                disabled={isRunning}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
              <button 
                onClick={runCode} 
                disabled={isRunning || backendStatus !== 'connected'}
                className="run-button"
                title={backendStatus !== 'connected' ? 'Backend not connected' : 'Run code'}
              >
                {isRunning ? 'Running...' : 'Run Code'}
              </button>
              <button onClick={clearOutput} className="clear-button">
                Clear Output
              </button>
            </div>
            
            <div className="monaco-container">
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  lineNumbers: 'on',
                  glyphMargin: false,
                  folding: true,
                  lineDecorationsWidth: 10,
                  lineNumbersMinChars: 3,
                  scrollbar: {
                    useShadows: false,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                  readOnly: isRunning,
                }}
              />
            </div>
            
            <div className="output-container">
              <div className="output-header">
                <span>Output</span>
                {backendStatus !== 'connected' && (
                  <span className="backend-warning">
                    Backend connection required for code execution
                  </span>
                )}
              </div>
              <div className="output-content">
                <pre>{output}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;