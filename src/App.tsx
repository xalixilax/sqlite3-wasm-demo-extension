import { useState, useEffect, useRef } from "react";

interface LogEntry {
  cssClass: string;
  message: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

interface LogMessage {
  type: "log";
  payload: {
    cssClass: string;
    args: string[];
  };
}

interface QueryResultMessage {
  type: "queryResult";
  payload: {
    users: User[];
  };
}

type WorkerResponse = LogMessage | QueryResultMessage;

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAge, setNewAge] = useState("");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker("/worker.js?sqlite3.dir=jswasm");
    workerRef.current = worker;

    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
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
        case "queryResult":
          setUsers(data.payload.users);
          break;
        default:
          setLogs((prev) => [
            ...prev,
            {
              cssClass: "error",
              message: `Unhandled message: ${(data as { type: string }).type}`,
            },
          ]);
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  const handleAddUser = () => {
    if (!newName || !newEmail || !newAge) {
      alert("Please fill in all fields");
      return;
    }

    workerRef.current?.postMessage({
      type: "addUser",
      payload: {
        name: newName,
        email: newEmail,
        age: parseInt(newAge, 10),
      },
    });

    // Clear form
    setNewName("");
    setNewEmail("");
    setNewAge("");
  };

  const handleDeleteUser = (id: number) => {
    workerRef.current?.postMessage({
      type: "deleteUser",
      payload: { id },
    });
  };

  const handleUpdateUser = (id: number) => {
    const name = prompt("Enter new name (leave empty to skip):");
    const email = prompt("Enter new email (leave empty to skip):");
    const ageStr = prompt("Enter new age (leave empty to skip):");

    workerRef.current?.postMessage({
      type: "updateUser",
      payload: {
        id,
        ...(name && { name }),
        ...(email && { email }),
        ...(ageStr && { age: parseInt(ageStr, 10) }),
      },
    });
  };

  const handleRefresh = () => {
    workerRef.current?.postMessage({
      type: "getUsers",
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        padding: "20px",
        gap: "20px",
      }}
    >
      <h1>SQLite3 WASM Demo</h1>

      {/* Add User Form */}
      <div
        style={{
          border: "2px solid #333",
          padding: "15px",
          borderRadius: "5px",
        }}
      >
        <h2>Add New User</h2>
        <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: "5px", fontSize: "14px" }}
          />
          <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ padding: "5px", fontSize: "14px" }}
          />
          <input
            type="number"
            placeholder="Age"
            value={newAge}
            onChange={(e) => setNewAge(e.target.value)}
            style={{ padding: "5px", fontSize: "14px" }}
          />
          <button
            onClick={handleAddUser}
            style={{
              padding: "10px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Add User
          </button>
        </div>
      </div>

      {/* Users List */}
      <div
        style={{
          border: "2px solid #333",
          padding: "15px",
          borderRadius: "5px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2>Users ({users.length})</h2>
          <button
            onClick={handleRefresh}
            style={{
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
        {users.length === 0 ? (
          <p>No users found. Click refresh or add a new user.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "10px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ padding: "8px", border: "1px solid #ddd" }}>ID</th>
                <th style={{ padding: "8px", border: "1px solid #ddd" }}>
                  Name
                </th>
                <th style={{ padding: "8px", border: "1px solid #ddd" }}>
                  Email
                </th>
                <th style={{ padding: "8px", border: "1px solid #ddd" }}>Age</th>
                <th style={{ padding: "8px", border: "1px solid #ddd" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                    {user.id}
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                    {user.name}
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                    {user.email}
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                    {user.age}
                  </td>
                  <td
                    style={{
                      padding: "8px",
                      border: "1px solid #ddd",
                      display: "flex",
                      gap: "5px",
                    }}
                  >
                    <button
                      onClick={() => handleUpdateUser(user.id)}
                      style={{
                        padding: "5px 10px",
                        backgroundColor: "#2196F3",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      style={{
                        padding: "5px 10px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Logs */}
      <div
        style={{
          border: "2px solid #333",
          padding: "15px",
          borderRadius: "5px",
        }}
      >
        <h2>Console Logs</h2>
        <div
          style={{
            maxHeight: "300px",
            overflow: "auto",
            backgroundColor: "#f5f5f5",
            padding: "10px",
          }}
        >
          {logs.map((log, index) => (
            <div
              key={index}
              className={log.cssClass}
              style={{
                color:
                  log.cssClass === "warning" || log.cssClass === "error"
                    ? "red"
                    : "inherit",
                backgroundColor:
                  log.cssClass === "error" ? "yellow" : "inherit",
                marginBottom: "5px",
              }}
            >
              {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
