import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Image as ImageIcon,
    MessageSquare,
    CheckCircle,
    XCircle,
    Download,
    LayoutDashboard,
    ShieldAlert,
    Search,
    Filter,
    LogOut,
    ChevronRight,
    Loader2,
    X,
    BarChart2,
    Eye,
    Heart,
} from 'lucide-react';

const API_BASE = '/api';

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Relative paths like /uploads/... will be handled by Vite proxy
    return url;
};

function App() {
    const [activeTab, setActiveTab] = useState('moderation');
    const [photos, setPhotos] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [modalInput, setModalInput] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // Fetch core data (Photos & Requests)
        try {
            const [photosRes, requestsRes] = await Promise.all([
                axios.get(`${API_BASE}/upload`),
                axios.get(`${API_BASE}/requests/`)
            ]);
            setPhotos(photosRes.data);
            setRequests(requestsRes.data);
        } catch (err) {
            console.error('Core fetch error:', err);
        } finally {
            setLoading(false);
        }

    };

    const handleApprove = async (id) => {
        try {
            await axios.patch(`${API_BASE}/upload/approve/${id}`);
            setPhotos(prev => prev.map(p => p._id === id ? { ...p, status: 'approved' } : p));
        } catch (err) {
            alert('Failed to approve');
        }
    };

    const handleReject = (id) => {
        setModalInput('');
        setModalConfig({
            title: 'Reject Photo',
            message: 'Please provide a reason for rejecting this memory.',
            type: 'prompt',
            onConfirm: async (reason) => {
                try {
                    await axios.patch(`${API_BASE}/upload/reject/${id}`, { rejectionReason: reason });
                    setPhotos(prev => prev.map(p => p._id === id ? { ...p, status: 'rejected', rejectionReason: reason } : p));
                    setModalConfig(null);
                } catch (err) {
                    alert('Failed to reject');
                }
            }
        });
    };

    const handleResolveRequest = (id) => {
        setModalInput('');
        setModalConfig({
            title: 'Reply to User',
            message: 'Type your response to the user below. This will resolve the request.',
            type: 'prompt',
            onConfirm: async (response) => {
                try {
                    await axios.patch(`${API_BASE}/requests/${id}`, {
                        adminResponse: response,
                        status: 'resolved'
                    });
                    setRequests(prev => prev.map(r => r._id === id ? { ...r, status: 'resolved', adminResponse: response } : r));
                    setModalConfig(null);
                } catch (err) {
                    alert('Failed to resolve request');
                }
            }
        });
    };

    const handleAdminDeletePhoto = (photoId, requestId) => {
        setModalConfig({
            title: 'Fulfill Deletion Request?',
            message: 'Are you sure you want to delete this photo and resolve the user request? This is permanent.',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    // 1. Delete the photo
                    await axios.delete(`${API_BASE}/upload/${photoId}`);
                    
                    // 2. Resolve the request
                    await axios.patch(`${API_BASE}/requests/${requestId}`, {
                        adminResponse: "Photo has been deleted as requested.",
                        status: 'resolved'
                    });

                    // 3. Update local state
                    setPhotos(prev => prev.filter(p => p._id !== photoId));
                    setRequests(prev => prev.map(r => r._id === requestId ? { ...r, status: 'resolved', adminResponse: "Resolved" } : r));
                    
                    setModalConfig(null);
                    setTimeout(() => alert('Photo deleted and request resolved!'), 300);
                } catch (err) {
                    console.error('Delete fulfillment error:', err);
                    alert('Failed to fulfill deletion request');
                }
            }
        });
    };

    const handleAiScan = () => {
        setModalConfig({
            title: 'AI Auto-Moderation',
            message: 'Are you sure you want to run the AI scan? It will automatically reject low-quality photos.',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    const res = await axios.post(`${API_BASE}/upload/ai-scan`);
                    setModalConfig(null);
                    // Wait a bit for the animation to finish
                    setTimeout(() => alert(res.data.message), 300);
                    fetchData();
                } catch (err) {
                    alert('AI Scan failed');
                }
            }
        });
    };

    const pendingPhotos = photos.filter(p => p.status === 'pending');
    const approvedPhotos = photos.filter(p => p.status === 'approved');
    const filteredRequests = requests.filter(r => r.status === 'pending');

    const handleBatchDownload = () => {
        window.open(`${API_BASE}/upload/batch-download`, '_blank');
    };

    return (
        <div className="dashboard-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="logo-container">
                    <div className="logo-icon">
                        <ImageIcon size={24} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Gallery Admin</h2>
                </div>

                <nav>
                    <div
                        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <LayoutDashboard size={20} color="white" /> Dashboard
                    </div>
                    <div
                        className={`nav-item ${activeTab === 'moderation' ? 'active' : ''}`}
                        onClick={() => setActiveTab('moderation')}
                    >
                        <ShieldAlert size={20} color="white" /> Moderation
                        {pendingPhotos.length > 0 && <span className="photo-badge badge-pending" style={{ position: 'static', marginLeft: 'auto', background: 'white', color: '#FF9F1C' }}>{pendingPhotos.length}</span>}
                    </div>
                    <div
                        className={`nav-item ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        <MessageSquare size={20} color="white" /> Requests
                        {filteredRequests.length > 0 && <span className="photo-badge badge-pending" style={{ position: 'static', marginLeft: 'auto', background: 'white', color: '#FF9F1C' }}>{filteredRequests.length}</span>}
                    </div>
                    <div
                        className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`}
                        onClick={() => setActiveTab('gallery')}
                    >
                        <CheckCircle size={20} color="white" /> Approved
                    </div>
                </nav>

                <div style={{ marginTop: 'auto' }}>
                    <div className="nav-item">
                        <LogOut size={20} color="white" /> Logout
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Loader2 className="animate-spin" size={48} color="#007AFF" />
                    </div>
                ) : (
                    <div className="animate-fade">
                        {activeTab === 'dashboard' && (
                            <>
                                <h1>Welcome Back, Admin</h1>
                                <p className="muted">Here's what's happening in the gallery today.</p>

                            </>
                        )}

                        {activeTab === 'moderation' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h1>Moderation Queue</h1>
                                        <p className="muted">Review and approve memories before they go live.</p>
                                    </div>
                                    <button className="btn btn-danger" onClick={handleAiScan} style={{ flex: 'none', padding: '0.75rem 1.5rem', background: 'rgba(255, 159, 28, 0.1)', color: '#FF9F1C', borderColor: 'rgba(255, 159, 28, 0.2)' }}>
                                        <Search size={20} /> AI Auto-Scan
                                    </button>
                                </div>

                                <div className="photo-grid" style={{ marginTop: '2rem' }}>
                                    {pendingPhotos.map(photo => (
                                        <div key={photo._id} className="photo-card">
                                            <img
                                                src={getImgUrl(photo.imageUrl)}
                                                alt={photo.title}
                                                className="photo-preview"
                                                onClick={() => setSelectedPhoto(photo)}
                                                style={{ cursor: 'zoom-in' }}
                                            />
                                            <div className="photo-badge badge-pending">Pending</div>
                                            <div className="photo-content">
                                                <h3>{photo.title}</h3>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <p className="muted" style={{ fontSize: '0.85rem' }}>Folder: {photo.folder}</p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#64748B' }}>
                                                            <Heart size={14} fill={photo.likes?.length > 0 ? "#FF4D4D" : "none"} color={photo.likes?.length > 0 ? "#FF4D4D" : "#64748B"} />
                                                            {photo.likes?.length || 0}
                                                        </span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#64748B' }}>
                                                            <Eye size={14} />
                                                            {photo.views || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="photo-actions">
                                                    <button className="btn btn-primary" onClick={() => handleApprove(photo._id)}>
                                                        <CheckCircle size={18} /> Approve
                                                    </button>
                                                    <button className="btn btn-danger" onClick={() => handleReject(photo._id)}>
                                                        <XCircle size={18} /> Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {pendingPhotos.length === 0 && <p className="muted">Great job! No pending photos.</p>}
                                </div>
                            </>
                        )}

                        {activeTab === 'requests' && (
                            <>
                                <h1>User Requests</h1>
                                <p className="muted">Manage chat messages and photo edits.</p>

                                <div style={{ marginTop: '2rem' }}>
                                    {filteredRequests.map(req => (
                                        <div key={req._id} className="request-card">
                                            {req.photo ? (
                                                <img
                                                    src={getImgUrl(req.photo.imageUrl)}
                                                    alt="Request"
                                                    className="request-photo-mini"
                                                    onClick={() => setSelectedPhoto(req.photo)}
                                                    style={{ cursor: 'zoom-in' }}
                                                />
                                            ) : (
                                                <div className="request-photo-mini" style={{ background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <MessageSquare size={24} color="#555" />
                                                </div>
                                            )}
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: '#007AFF', fontWeight: 'bold', marginBottom: '4px' }}>{req.type.toUpperCase()}</div>
                                                <p style={{ fontWeight: 600, marginBottom: '4px' }}>{req.message}</p>
                                                <p className="muted" style={{ fontSize: '0.85rem' }}>From: {req.user?.name || 'Guest User'}</p>
                                            </div>
                                            <div className="photo-actions" style={{ flexDirection: 'column' }}>
                                                {req.type === 'deletion' && req.photo && (
                                                    <button 
                                                        className="btn btn-danger" 
                                                        onClick={() => handleAdminDeletePhoto(req.photo._id, req._id)}
                                                        style={{ marginBottom: '8px', background: 'rgba(255, 77, 77, 0.2)', border: '1px solid rgba(255, 77, 77, 0.4)' }}
                                                    >
                                                        <XCircle size={18} /> Delete Photo & Resolve
                                                    </button>
                                                )}
                                                <button className="btn btn-primary" onClick={() => handleResolveRequest(req._id)}>
                                                    <ChevronRight size={18} /> Reply & Resolve
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredRequests.length === 0 && <p className="muted">No pending requests.</p>}
                                </div>
                            </>
                        )}

                        {activeTab === 'gallery' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h1>Approved Memories</h1>
                                        <p className="muted">All photos currently live in the gallery.</p>
                                    </div>
                                    <button className="btn btn-primary" onClick={handleBatchDownload} style={{ flex: 'none', padding: '0.75rem 1.5rem' }}>
                                        <Download size={20} /> Batch Download All
                                    </button>
                                </div>

                                <div className="photo-grid" style={{ marginTop: '2rem' }}>
                                    {approvedPhotos.map(photo => (
                                        <div key={photo._id} className="photo-card">
                                            <img
                                                src={getImgUrl(photo.imageUrl)}
                                                alt={photo.title}
                                                className="photo-preview"
                                                onClick={() => setSelectedPhoto(photo)}
                                                style={{ cursor: 'zoom-in' }}
                                            />
                                            <div className="photo-content">
                                                <h3>{photo.title}</h3>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <p className="muted" style={{ fontSize: '0.85rem' }}>Folder: {photo.folder}</p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#64748B' }}>
                                                            <Heart size={14} fill={photo.likes?.length > 0 ? "#FF4D4D" : "none"} color={photo.likes?.length > 0 ? "#FF4D4D" : "#64748B"} />
                                                            {photo.likes?.length || 0}
                                                        </span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#64748B' }}>
                                                            <Eye size={14} />
                                                            {photo.views || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                    </div>
                )}
            </main>

            {/* Fullscreen Viewer */}
            {selectedPhoto && (
                <div
                    className="modal-overlay"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button
                        style={{ position: 'absolute', top: 30, right: 30, background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 10 }}
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X size={40} />
                    </button>
                    <img
                        src={getImgUrl(selectedPhoto.imageUrl)}
                        alt={selectedPhoto.title}
                        style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{selectedPhoto.title}</h2>
                        <p className="muted">Folder: {selectedPhoto.folder}</p>
                    </div>
                </div>
            )}

            {/* Premium Action Modal */}
            {modalConfig && (
                <div className="modal-overlay" onClick={() => setModalConfig(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">{modalConfig.title}</h2>
                        <p className="modal-message">{modalConfig.message}</p>

                        {modalConfig.type === 'prompt' && (
                            <input
                                autoFocus
                                className="modal-input"
                                placeholder="Type here..."
                                value={modalInput}
                                onChange={(e) => setModalInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') modalConfig.onConfirm(modalInput);
                                }}
                            />
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalConfig(null)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => modalConfig.onConfirm(modalConfig.type === 'prompt' ? modalInput : true)}
                            >
                                {modalConfig.type === 'prompt' ? 'Submit' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
