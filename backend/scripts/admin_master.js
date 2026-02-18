import readline from 'readline';

// Config
const API_BASE = "http://127.0.0.1:5000/api";
const UPLOAD_BASE = "http://127.0.0.1:5000";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    while (true) {
        console.log("\n===========================================");
        console.log("💎 COLLEGE PHOTO GALLERY - MASTER ADMIN");
        console.log("===========================================");
        console.log("1. Moderate Pending Photos (Review uploads)");
        console.log("2. Manage User Requests (Chat & Deletions)");
        console.log("q. Exit");
        console.log("-------------------------------------------");

        const choice = await question("Select an option: ");

        if (choice === '1') {
            await moderatePhotos();
        } else if (choice === '2') {
            await manageRequests();
        } else if (choice.toLowerCase() === 'q') {
            console.log("Goodbye! 👋");
            rl.close();
            process.exit();
        } else {
            console.log("❌ Invalid option. Try again.");
        }
    }
}

async function moderatePhotos() {
    console.log("\n--- 📸 MODERATING PENDING PHOTOS ---");
    try {
        const response = await fetch(`${API_BASE}/upload/pending`);
        if (!response.ok) throw new Error("Failed to fetch pending photos");
        const pending = await response.json();

        if (pending.length === 0) {
            console.log("✅ No pending photos to review.");
            return;
        }

        console.log(`📦 Found ${pending.length} memories to review...\n`);

        for (const photo of pending) {
            const fullUrl = `${UPLOAD_BASE}${photo.imageUrl}`;
            console.log(`📸 ID: ${photo._id} | 📝 Title: ${photo.title}`);
            console.log(`📁 Category: ${photo.folder}`);
            console.log(`🔗 Image URL: ${fullUrl}`);

            // Auto-open
            import('child_process').then(cp => cp.exec(`start ${fullUrl}`)).catch(() => { });

            const action = await question("Action? (a = Approve, r = Reject, s = Skip, q = Back to Menu): ");

            if (action.toLowerCase() === 'a') {
                const res = await fetch(`${API_BASE}/upload/approve/${photo._id}`, { method: 'PATCH' });
                if (res.ok) console.log("✅ Approved!");
            } else if (action.toLowerCase() === 'r') {
                const reason = await question("Reason for rejection?: ");
                const res = await fetch(`${API_BASE}/upload/reject/${photo._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rejectionReason: reason })
                });
                if (res.ok) console.log(`🗑️ Rejected. Reason: ${reason}`);
            } else if (action.toLowerCase() === 'q') {
                break;
            }
            console.log("");
        }
    } catch (err) {
        console.error("💥 Error:", err.message);
    }
}

async function manageRequests() {
    console.log("\n--- 💬 MANAGING USER REQUESTS ---");
    try {
        const response = await fetch(`${API_BASE}/requests/`);
        if (!response.ok) throw new Error("Failed to fetch requests");
        const requests = await response.json();
        const pending = requests.filter(r => r.status === 'pending');

        if (pending.length === 0) {
            console.log("✅ No pending requests.");
            return;
        }

        console.log(`💬 Found ${pending.length} pending requests...\n`);

        for (const req of pending) {
            console.log(`👤 From: ${req.user?.name || 'Unknown'}`);
            console.log(`🏷️ Type: ${req.type.toUpperCase()} | 💬 Message: ${req.message}`);

            if (req.photo) {
                const fullUrl = `${UPLOAD_BASE}${req.photo.imageUrl}`;
                console.log(`📸 Photo: ${req.photo.title} | 🔗 ${fullUrl}`);
                import('child_process').then(cp => cp.exec(`start ${fullUrl}`)).catch(() => { });
            }

            const action = await question("Action? (y = Respond/Resolve, d = Delete Photo, r = Rename Photo, s = Skip, q = Back to Menu): ");

            if (action.toLowerCase() === 'y') {
                const responseText = await question("Your response: ");
                const status = (await question("Resolve? (y/n): ")).toLowerCase() === 'y' ? 'resolved' : 'pending';
                await fetch(`${API_BASE}/requests/${req._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminResponse: responseText, status })
                });
                console.log("✅ Response sent!");
            } else if (action.toLowerCase() === 'd' && req.photo) {
                const confirm = await question("Permanently delete? (y/n): ");
                if (confirm.toLowerCase() === 'y') {
                    const delRes = await fetch(`${API_BASE}/upload/${req.photo._id}`, { method: 'DELETE' });
                    if (delRes.ok) {
                        await fetch(`${API_BASE}/requests/${req._id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ adminResponse: "Photo deleted.", status: 'resolved' })
                        });
                        console.log("🗑️ Photo deleted and request resolved!");
                    } else {
                        console.log("❌ Failed to delete photo.");
                    }
                }
            } else if (action.toLowerCase() === 'r' && req.photo) {
                const newTitle = await question(`Enter new title for "${req.photo.title}": `);
                if (newTitle.trim()) {
                    const renRes = await fetch(`${API_BASE}/upload/${req.photo._id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: newTitle.trim() })
                    });
                    if (renRes.ok) {
                        await fetch(`${API_BASE}/requests/${req._id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ adminResponse: `Photo renamed to "${newTitle.trim()}".`, status: 'resolved' })
                        });
                        console.log("✅ Photo renamed and request resolved!");
                    } else {
                        console.log("❌ Failed to rename photo.");
                    }
                }
            } else if (action.toLowerCase() === 'q') {
                break;
            }
            console.log("");
        }
    } catch (err) {
        console.error("💥 Error:", err.message);
    }
}

main();
