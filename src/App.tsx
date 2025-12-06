import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import {
	useAddUser,
	useDeleteUser,
	useUpdateUser,
	useUsers,
} from "./lib/workerClient";

// Create a query client
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 5000,
		},
	},
});

function UserManager() {
	const [newName, setNewName] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [newAge, setNewAge] = useState("");
	const [validationError, setValidationError] = useState("");

	const { data: users = [], isLoading, error, refetch } = useUsers();
	const addUserMutation = useAddUser({
		onError: (err) => setValidationError(err.message),
	});
	const updateUserMutation = useUpdateUser();
	const deleteUserMutation = useDeleteUser();
    
	const handleAddUser = async () => {
		setValidationError("");

		if (!newName || !newEmail || !newAge) {
			setValidationError("Please fill in all fields");
			return;
		}

		await addUserMutation.mutateAsync({
			name: newName,
			email: newEmail,
			age: parseInt(newAge, 10),
		});

		setNewName("");
		setNewEmail("");
		setNewAge("");
	};

	const handleDeleteUser = (id: number) => {
		deleteUserMutation.mutate({ id });
	};

	const handleUpdateUser = (id: number) => {
		const name = prompt("Enter new name (leave empty to skip):");
		const email = prompt("Enter new email (leave empty to skip):");
		const ageStr = prompt("Enter new age (leave empty to skip):");

		const updateData: {
			id: number;
			name?: string;
			email?: string;
			age?: number;
		} = { id };
		if (name) updateData.name = name;
		if (email) updateData.email = email;
		if (ageStr) updateData.age = parseInt(ageStr, 10);

		updateUserMutation.mutate(updateData);
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
			<h1>SQLite3 WASM Demo - Type-Safe Edition</h1>

			{isLoading && (
				<div style={{ padding: "10px", backgroundColor: "#e3f2fd" }}>
					Loading users...
				</div>
			)}
			{error && (
				<div
					style={{ padding: "10px", backgroundColor: "#ffebee", color: "red" }}
				>
					Error: {error.message}
				</div>
			)}
			{validationError && (
				<div
					style={{
						padding: "10px",
						backgroundColor: "#fff3cd",
						color: "#856404",
						border: "1px solid #ffc107",
						borderRadius: "4px",
					}}
				>
					⚠️ {validationError}
				</div>
			)}

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
						type="button"
						onClick={handleAddUser}
						disabled={addUserMutation.isPending}
						style={{
							padding: "10px",
							backgroundColor: addUserMutation.isPending ? "#ccc" : "#4CAF50",
							color: "white",
							border: "none",
							cursor: addUserMutation.isPending ? "not-allowed" : "pointer",
							fontSize: "14px",
						}}
					>
						{addUserMutation.isPending ? "Adding..." : "Add User"}
					</button>
				</div>
			</div>

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
						type="button"
						onClick={() => refetch()}
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
								<th style={{ padding: "8px", border: "1px solid #ddd" }}>
									Age
								</th>
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
											type="button"
											onClick={() => handleUpdateUser(user.id)}
											disabled={updateUserMutation.isPending}
											style={{
												padding: "5px 10px",
												backgroundColor: updateUserMutation.isPending
													? "#ccc"
													: "#2196F3",
												color: "white",
												border: "none",
												cursor: updateUserMutation.isPending
													? "not-allowed"
													: "pointer",
											}}
										>
											Edit
										</button>
										<button
											type="button"
											onClick={() => handleDeleteUser(user.id)}
											disabled={deleteUserMutation.isPending}
											style={{
												padding: "5px 10px",
												backgroundColor: deleteUserMutation.isPending
													? "#ccc"
													: "#f44336",
												color: "white",
												border: "none",
												cursor: deleteUserMutation.isPending
													? "not-allowed"
													: "pointer",
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
		</div>
	);
}

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<UserManager />
		</QueryClientProvider>
	);
}

export default App;
