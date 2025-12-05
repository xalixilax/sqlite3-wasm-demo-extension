import { useState, useEffect } from "react";

interface LogEntry {
  cssClass: string;
  message: string;
}

interface LogMessage {
  type: "log";
  payload: {
    cssClass: string;
    args: string[];
  };
}

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const worker = new Worker("/worker.js?sqlite3.dir=jswasm");

    worker.onmessage = ({ data }: MessageEvent<LogMessage>) => {
      switch (data.type) {
        case "log":
          setLogs((prev) => [
            ...prev,
            {
              cssClass: data.payload.cssClass,
              message: data.payload.args.join(" "),
            },
          ]);
          break;
        default:
          setLogs((prev) => [
            ...prev,
            {
              cssClass: "error",
              message: `Unhandled message: ${data.type}`,
            },
          ]);
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        whiteSpace: "break-spaces",
      }}
    >
      <h1>Hello, sqlite3</h1>
      {logs.map((log, index) => (
        <div
          key={index}
          className={log.cssClass}
          style={{
            color:
              log.cssClass === "warning" || log.cssClass === "error"
                ? "red"
                : "inherit",
            backgroundColor: log.cssClass === "error" ? "yellow" : "inherit",
          }}
        >
          {log.message}
        </div>
      ))}
    </div>
  );
}

export default App;
