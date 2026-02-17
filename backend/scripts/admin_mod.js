import readline from 'readline';

const API_BASE = "http://127.0.0.1:5000/api/upload";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function moderate() {
    console.log("\n-------------------------------------------");
    console.log("🚀 COLLEGE PHOTO GALLERY - MODERATION TOOL");
    console.log("-------------------------------------------\n");

    try {
        const response = await fetch(`${API_BASE}/pending`);
        if (!response.ok) throw new Error("Failed to fetch pending photos");

        const pending = await response.json();

        if (pending.length === 0) {
            console.log("✅ No pending photos to review. Good job!");
            rl.close();
            return;
        }

        console.log(`📦 Found ${pending.length} pending memories to review...\n`);

        for (let i = 0; i < pending.length; i++) {
            const photo = pending[i];
            const fullUrl = `http://127.0.0.1:5000${photo.imageUrl}`;

            console.log(`[${i + 1}/${pending.length}] 📸 ID: ${photo._id}`);
            console.log(`📝 Title: ${photo.title}`);
            console.log(`📁 Category: ${photo.folder}`);
            console.log(`🔗 Image URL: ${fullUrl}`);
            console.log(`-------------------------------------------`);

            // Try to open the image automatically on Windows
            import('child_process').then(cp => {
                cp.exec(`start ${fullUrl}`);
            }).catch(() => {
                // If opening fails, the user can still click the URL in the terminal
            });

            const action = await question("Action? (a = Approve, r = Reject, s = Skip, q = Quit): ");

            if (action.toLowerCase() === 'a') {
                const approveRes = await fetch(`${API_BASE}/approve/${photo._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (approveRes.ok) console.log("✅ Approved!");
                else {
                    const data = await approveRes.json().catch(() => ({}));
                    console.log(`❌ Failed to approve: ${approveRes.status} ${data.message || ''}`);
                }
            }
            else if (action.toLowerCase() === 'r') {
                const reason = await question("Reason for rejection? (e.g., Irrelevant, Blurry): ");
                const rejectRes = await fetch(`${API_BASE}/reject/${photo._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rejectionReason: reason })
                });
                if (rejectRes.ok) console.log(`🗑️ Rejected. Reason: ${reason}`);
                else {
                    const data = await rejectRes.json().catch(() => ({}));
                    console.log(`❌ Failed to reject: ${rejectRes.status} ${data.message || ''}`);
                }
            }
            else if (action.toLowerCase() === 'q') {
                break;
            }
            else if (action.toLowerCase() === 's') {
                console.log("⏩ Skipped.");
            }
            else {
                console.log("❓ Invalid choice, skipping.");
            }
            console.log("\n");
        }

        console.log("✨ Finalized review session.");
    } catch (err) {
        console.error("💥 Error during moderation:", err.message);
    } finally {
        rl.close();
    }
}

moderate();
