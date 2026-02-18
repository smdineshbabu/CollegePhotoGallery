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
    PieChart as PieChartIcon,
    TrendingUp
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

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
    const [analytics, setAnalytics] = useState(null);

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
        }

        // Fetch Analytics independently
        try {
            const analyticsRes = await axios.get(`${API_BASE}/analytics`);
            setAnalytics(analyticsRes.data);
        } catch (err) {
            console.error('Analytics fetch error:', err);
            setAnalytics('error'); // Marker for error state
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
                    <div
                        className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart2 size={20} color="white" /> Analytics
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

                                <div className="stats-grid" style={{ marginTop: '2.5rem' }}>
                                    <div className="stat-card">
                                        <p className="muted">Pending Photos</p>
                                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>{pendingPhotos.length}</div>
                                    </div>
                                    <div className="stat-card">
                                        <p className="muted">Total Photos</p>
                                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>{photos.length}</div>
                                    </div>
                                    <div className="stat-card">
                                        <p className="muted">User Requests</p>
                                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>{filteredRequests.length}</div>
                                    </div>
                                </div>
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
                                            <div className="photo-actions">
                                                <button className="btn btn-primary" onClick={() => handleResolveRequest(req._id)}>
                                                    Reply & Resolve
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

                        {activeTab === 'analytics' && (
                            <div className="analytics-view">
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <h1>Gallery Analytics</h1>
                                    <p className="muted">Detailed insights into your college memories.</p>
                                </div>

                                {analytics === 'error' ? (
                                    <div className="stat-card" style={{ textAlign: 'center', padding: '3rem' }}>
                                        <XCircle size={48} color="#FF4D4D" style={{ marginBottom: '1rem' }} />
                                        <h3>Unable to load Analytics</h3>
                                        <p className="muted">Make sure the backend server is updated and running.</p>
                                        <button className="btn btn-primary" onClick={fetchData} style={{ marginTop: '1.5rem' }}>
                                            Try Again
                                        </button>
                                    </div>
                                ) : !analytics ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                                        <Loader2 className="animate-spin" size={32} color="#007AFF" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="stats-grid">
                                            <div className="stat-card">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                    <TrendingUp size={20} color="#007AFF" />
                                                    <p className="muted">Total Engagement</p>
                                                </div>
                                                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{analytics.summary.totalViews}</div>
                                                <p style={{ fontSize: '0.85rem', color: '#00D094', fontWeight: 600 }}>Total Views Across Gallery</p>
                                            </div>
                                            <div className="stat-card">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                    <ImageIcon size={20} color="#00D094" />
                                                    <p className="muted">Library Size</p>
                                                </div>
                                                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{analytics.summary.totalPhotos}</div>
                                                <p style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Total Photos Uploaded</p>
                                            </div>
                                        </div>

                                        <div className="charts-grid">
                                            <div className="chart-card">
                                                <h3>Views by Folder</h3>
                                                <div style={{ width: '100%', height: 300 }}>
                                                    <ResponsiveContainer>
                                                        <BarChart data={analytics.viewsByFolder}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                                            <Tooltip
                                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: 'white' }}
                                                            />
                                                            <Bar dataKey="views" fill="#007AFF" radius={[4, 4, 0, 0]} barSize={40} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            <div className="chart-card">
                                                <h3>Content Status</h3>
                                                <div style={{ width: '100%', height: 300 }}>
                                                    <ResponsiveContainer>
                                                        <PieChart>
                                                            <Pie
                                                                data={analytics.statusDistribution}
                                                                innerRadius={60}
                                                                outerRadius={100}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                            >
                                                                {analytics.statusDistribution.map((entry, index) => (
                                                                    <Cell
                                                                        key={`cell-${index}`}
                                                                        fill={
                                                                            entry.name === 'approved' ? '#00D094' :
                                                                                entry.name === 'pending' ? '#FF9F1C' : '#FF4D4D'
                                                                        }
                                                                    />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip />
                                                            <Legend verticalAlign="bottom" height={36} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="top-photos-section" style={{ marginTop: '3rem' }}>
                                            <h3>Top 5 Most Viewed Photos</h3>
                                            <div className="top-photos-list">
                                                {analytics.topPhotos.map((photo, index) => (
                                                    <div key={photo._id} className="top-photo-item">
                                                        <span className="rank-number">#{index + 1}</span>
                                                        <img src={getImgUrl(photo.imageUrl)} alt="" className="top-photo-thumb" />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700 }}>{photo.title}</div>
                                                            <div className="muted" style={{ fontSize: '0.85rem' }}>{photo.folder}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 800, color: '#007AFF' }}>{photo.views}</div>
                                                            <div className="muted" style={{ fontSize: '0.75rem' }}>Views</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
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
