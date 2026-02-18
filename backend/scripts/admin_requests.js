import readline from 'readline';

const API_BASE = "http://127.0.0.1:5000/api/requests";
const UPLOAD_BASE = "http://127.0.0.1:5000";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function manageRequests() {
    console.log("\n-------------------------------------------");
    console.log("🚀 COLLEGE PHOTO GALLERY - REQUESTS MANAGER");
    console.log("-------------------------------------------\n");

    try {
        const response = await fetch(`${API_BASE}/`);
        if (!response.ok) throw new Error("Failed to fetch requests");

        const requests = await response.json();

        if (requests.length === 0) {
            console.log("✅ No requests found.");
            rl.close();
            return;
        }

        const pending = requests.filter(r => r.status === 'pending');
        console.log(`📦 Found ${requests.length} total, ${pending.length} pending requests...\n`);

        for (const req of pending) {
            console.log(`[REQUEST] ID: ${req._id}`);
            console.log(`👤 From: ${req.user?.name || 'Unknown'} (${req.user?.email || 'N/A'})`);
            console.log(`🏷️ Type: ${req.type.toUpperCase()}`);
            console.log(`💬 Message: ${req.message}`);

            if (req.photo) {
                const fullUrl = `${UPLOAD_BASE}${req.photo.imageUrl}`;
                console.log(`📸 Related Photo: ${req.photo.title}`);
                console.log(`🔗 Image URL: ${fullUrl}`);

                // Open image automatically
                import('child_process').then(cp => {
                    cp.exec(`start ${fullUrl}`);
                }).catch(() => { });
            }

            console.log(`-------------------------------------------`);
            const action = await question("Respond? (y = Yes, d = Delete Photo, s = Skip, q = Quit): ");

            if (action.toLowerCase() === 'y') {
                const responseText = await question("Your response: ");
                const statusConfirm = await question("Mark as resolved? (y = Yes, n = Leave Pending): ");

                const patchRes = await fetch(`${API_BASE}/${req._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        adminResponse: responseText,
                        status: statusConfirm.toLowerCase() === 'y' ? 'resolved' : 'pending'
                    })
                });

                if (patchRes.ok) console.log("✅ Response sent and status updated!");
                else console.log("❌ Failed to update request.");
            } else if (action.toLowerCase() === 'd' && req.photo) {
                const confirm = await question(`Are you sure you want to PERMANENTLY DELETE photo "${req.photo.title}"? (y/n): `);
                if (confirm.toLowerCase() === 'y') {
                    // Call the delete API
                    const delRes = await fetch(`${UPLOAD_BASE}/api/upload/${req.photo._id}`, {
                        method: 'DELETE'
                    });

                    if (delRes.ok) {
                        console.log("🗑️ Photo deleted successfully.");
                        // Mark request as resolved
                        await fetch(`${API_BASE}/${req._id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                adminResponse: "Photo deleted as requested.",
                                status: 'resolved'
                            })
                        });
                        console.log("✅ Request marked as resolved.");
                    } else {
                        console.log(`❌ Failed to delete photo. Status: ${delRes.status}`);
                    }
                }
            } else if (action.toLowerCase() === 'q') {
                break;
            } else if (action.toLowerCase() === 's') {
                const ignore = await question("Mark as ignored? (y/n): ");
                if (ignore.toLowerCase() === 'y') {
                    await fetch(`${API_BASE}/${req._id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'ignored' })
                    });
                    console.log("⏩ Ignored.");
                } else {
                    console.log("⏩ Skipped.");
                }
            }
            console.log("\n");
        }
        console.log("✨ Finalized request management session.");
    } catch (err) {
        console.error("💥 Error managing requests:", err.message);
    } finally {
        rl.close();
    }
}

manageRequests();
