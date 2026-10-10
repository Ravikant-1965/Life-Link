// DashboardPage.jsx — GPT-Style Patient Workspace with Chat, News & Health Data
// ==============================================================================
// 1) Chat Section: GPT UI with expandable/minimizable sidebar, chat sessions, prompt input
// 2) News Section: Health advisories, medical research, and news with AI discussion
// 3) Profile & Health Data: Accessible from bottom of sidebar AND top right of chat section
// ==============================================================================

import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../../api';
import { saveEmergencyCardOffline, getEmergencyCardOffline } from '../../utils/offlineStorage';
import { HealthDataModal } from './HealthDataModal';
import { SettingsModal } from './SettingsModal';
import './DashboardPage.css';

export function DashboardPage({ user, token, logout }) {
    // Navigation / auth check
    const navigate = useNavigate();
    if (!user || !token) {
        return <Navigate to="/login" replace />;
    }

    // Active View Mode: 'chat' | 'news'
    const [activeSection, setActiveSection] = useState('chat');

    // Sidebar state (extendable & minimizable)
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('lifelink_sidebar_open');
        return saved !== null ? saved === 'true' : true;
    });

    // Profile & Medical Records state
    const [profile, setProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isOfflineCard, setIsOfflineCard] = useState(false);

    // Modals state (accessible from bottom sidebar and top right)
    const [isHealthDataOpen, setIsHealthDataOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [isSidebarProfileMenuOpen, setIsSidebarProfileMenuOpen] = useState(false);

    // News Feed state
    const [newsArticles, setNewsArticles] = useState([]);
    const [loadingNews, setLoadingNews] = useState(false);
    const [newsFilter, setNewsFilter] = useState('All');
    const [newsSearch, setNewsSearch] = useState('');

    // Chat Sessions & Messages state
    const storageKeyChats = `lifelink_chats_${user?.id || 'anon'}`;
    const [chats, setChats] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKeyChats);
            if (saved) return JSON.parse(saved);
        } catch (_e) {}
        return [
            {
                id: 'chat-initial',
                title: 'Medical Profile Analysis',
                createdAt: new Date().toISOString(),
                messages: [
                    {
                        role: 'assistant',
                        content: `Hello **${user.name}**! I am your LifeLink AI Health Assistant.\n\nI am connected to your encrypted Health ID (**${user.healthId}**). I can answer questions about your recorded allergies, active medications, blood group, or explain newly uploaded reports and medical news. How can I assist you today?`,
                        referencedRecords: ['Connected to Health ID: ' + user.healthId],
                        timestamp: new Date().toISOString()
                    }
                ]
            }
        ];
    });

    const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id || 'chat-initial');
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);

    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Toggle and save sidebar preference
    const toggleSidebar = () => {
        setIsSidebarOpen((prev) => {
            const next = !prev;
            localStorage.setItem('lifelink_sidebar_open', String(next));
            return next;
        });
    };

    // Save chats to localStorage whenever updated
    useEffect(() => {
        try {
            localStorage.setItem(storageKeyChats, JSON.stringify(chats));
        } catch (_e) {}
    }, [chats, storageKeyChats]);

    // Fetch user health profile
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/api/profile', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const serverProfile = response.data.profile;
                setProfile(serverProfile);
                saveEmergencyCardOffline(serverProfile, user);
                setIsOfflineCard(false);
            } catch (error) {
                console.warn('Network issue fetching live profile, checking offline storage:', error);
                if (error.response?.status === 401) {
                    logout();
                    navigate('/login');
                    return;
                }
                const cached = getEmergencyCardOffline();
                if (cached && cached.profile) {
                    setProfile(cached.profile);
                    setIsOfflineCard(true);
                }
            } finally {
                setLoadingProfile(false);
            }
        };

        fetchProfile();
    }, [logout, navigate, token, user]);

    // Fetch news articles when entering news section
    useEffect(() => {
        if (activeSection === 'news' && newsArticles.length === 0) {
            setLoadingNews(true);
            api.get('/api/news')
                .then((res) => {
                    if (res.data?.articles) {
                        setNewsArticles(res.data.articles);
                    }
                })
                .catch(() => {
                    // Fallback curated news if network fails
                    setNewsArticles([
                        {
                            id: 'fb-1',
                            title: 'WHO Emergency Protocols: Rapid Allergy and Blood Verification',
                            category: 'Emergency Medicine',
                            tag: 'Critical Care',
                            date: 'October 2026',
                            readTime: '3 min read',
                            source: 'World Health Organization',
                            summary: 'Trauma protocols emphasize instantaneous allergy verification to avoid anaphylaxis and adverse antibiotic interactions in acute care.',
                            impact: 'Critical for patients with drug allergies.'
                        },
                        {
                            id: 'fb-2',
                            title: 'Digital Health IDs Accelerate Hospital Crossmatching Protocols',
                            category: 'Health Tech',
                            tag: 'Triage Innovation',
                            date: 'October 2026',
                            readTime: '4 min read',
                            source: 'Clinical Emergency Review',
                            summary: 'Secure QR access enables verified hospital teams to identify patients with zero internet connection.',
                            impact: 'Directly powers your LifeLink emergency ID.'
                        }
                    ]);
                })
                .finally(() => setLoadingNews(false));
        }
    }, [activeSection, newsArticles.length]);

    // Auto-scroll chat to bottom
    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (activeSection === 'chat') {
            scrollToBottom();
        }
    }, [chats, activeChatId, activeSection]);

    // Auto-resize textarea as user types
    const handleTextareaChange = (e) => {
        setInputText(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
        }
    };

    // Active Chat Object
    const currentChat = chats.find((c) => c.id === activeChatId) || chats[0];

    // Create New Chat
    const handleCreateNewChat = () => {
        const newChatId = `chat-${Date.now()}`;
        const newChat = {
            id: newChatId,
            title: 'New Health Inquiry',
            createdAt: new Date().toISOString(),
            messages: []
        };
        setChats([newChat, ...chats]);
        setActiveChatId(newChatId);
        setActiveSection('chat');
        setInputText('');
    };

    // Delete Chat
    const handleDeleteChat = (chatId, e) => {
        e.stopPropagation();
        const updated = chats.filter((c) => c.id !== chatId);
        if (updated.length === 0) {
            handleCreateNewChat();
        } else {
            setChats(updated);
            if (activeChatId === chatId) {
                setActiveChatId(updated[0].id);
            }
        }
    };

    // Send Message
    const handleSendMessage = async (textToSend = inputText) => {
        const query = (textToSend || '').trim();
        if (!query || isSending) return;

        setInputText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        const userMessage = {
            role: 'user',
            content: query,
            timestamp: new Date().toISOString()
        };

        // Update title if it's the first message
        let updatedTitle = currentChat.title;
        if (currentChat.messages.length === 0 || currentChat.title === 'New Health Inquiry') {
            updatedTitle = query.slice(0, 32) + (query.length > 32 ? '...' : '');
        }

        const updatedMessagesWithUser = [...currentChat.messages, userMessage];

        setChats((prevChats) =>
            prevChats.map((c) =>
                c.id === currentChat.id
                    ? { ...c, title: updatedTitle, messages: updatedMessagesWithUser }
                    : c
            )
        );

        setIsSending(true);

        try {
            const res = await api.post(
                '/api/chat',
                { message: query },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const botMessage = {
                role: 'assistant',
                content: res.data.reply,
                referencedRecords: res.data.referencedRecords || [],
                timestamp: res.data.timestamp || new Date().toISOString()
            };

            setChats((prevChats) =>
                prevChats.map((c) =>
                    c.id === currentChat.id
                        ? { ...c, messages: [...updatedMessagesWithUser, botMessage] }
                        : c
                )
            );
        } catch (err) {
            // Offline or fallback response
            let fallbackContent = `I have cross-referenced your offline health card:\n\n` +
                `• **Blood Group**: ${profile?.blood_group || 'Not recorded'}\n` +
                `• **Documented Allergies**: ${profile?.allergies || 'None documented'}\n` +
                `• **Active Medications**: ${profile?.current_medications || 'None recorded'}\n\n` +
                `Your encrypted Health ID is **${user?.healthId}**. For acute emergencies, call local emergency services immediately.`;

            const fallbackBotMessage = {
                role: 'assistant',
                content: fallbackContent,
                referencedRecords: ['Offline Cached Medical Profile'],
                timestamp: new Date().toISOString()
            };

            setChats((prevChats) =>
                prevChats.map((c) =>
                    c.id === currentChat.id
                        ? { ...c, messages: [...updatedMessagesWithUser, fallbackBotMessage] }
                        : c
                )
            );
        } finally {
            setIsSending(false);
        }
    };

    // Enter key sends, Shift+Enter makes newline
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Starter Prompt clicked
    const handlePromptSuggestionClick = (prompt) => {
        handleSendMessage(prompt);
    };

    // Discuss article in Chat
    const handleDiscussArticleInChat = (article) => {
        const prompt = `Can you explain the news article "${article.title}" and how it applies to my health profile and medical history?`;
        setActiveSection('chat');
        handleSendMessage(prompt);
    };

    const qrCodeValue = `${window.location.origin}/doctor/portal?healthId=${user.healthId}`;
    const totalFilesCount = (Array.isArray(profile?.document_images) ? profile.document_images.length : 0) +
        (Array.isArray(profile?.medication_images) ? profile.medication_images.length : 0) +
        (Array.isArray(profile?.medical_file_links) ? profile.medical_file_links.length : 0);

    // Filtered News
    const filteredArticles = newsArticles.filter((art) => {
        const matchesCategory = newsFilter === 'All' || art.category === newsFilter || art.tag === newsFilter;
        const matchesSearch = !newsSearch || art.title.toLowerCase().includes(newsSearch.toLowerCase()) || art.summary.toLowerCase().includes(newsSearch.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const categoriesList = ['All', 'Emergency Medicine', 'Health Tech', 'Cardiology', 'Pharmacology', 'Transplantology'];

    return (
        <div className={`gpt-workspace ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
            {/* =========================================================================
                1) EXTENDABLE & MINIMIZABLE GPT-STYLE SIDEBAR
            ========================================================================= */}
            <aside className="gpt-sidebar">
                {/* SIDEBAR HEADER */}
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <img src="/logo_cross.png" alt="LifeLink" className="sidebar-logo-img" />
                        <span className="sidebar-brand-name">LifeLink AI</span>
                    </div>
                    <button
                        className="sidebar-collapse-toggle-btn"
                        onClick={toggleSidebar}
                        title="Close sidebar (⌘+S)"
                        aria-label="Toggle sidebar"
                    >
                        ◀
                    </button>
                </div>

                {/* NEW CHAT BUTTON */}
                <div className="sidebar-action-wrap">
                    <button className="new-chat-btn" onClick={handleCreateNewChat}>
                        <span className="plus-icon">+</span>
                        <span className="new-chat-text">New chat</span>
                    </button>
                </div>

                {/* NAVIGATION TABS IN SIDEBAR */}
                <div className="sidebar-nav-tabs">
                    <button
                        className={`sidebar-nav-tab ${activeSection === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveSection('chat')}
                    >
                        💬 Medical Chat
                    </button>
                    <button
                        className={`sidebar-nav-tab ${activeSection === 'news' ? 'active' : ''}`}
                        onClick={() => setActiveSection('news')}
                    >
                        📰 Health News
                    </button>
                </div>

                {/* CHAT SESSIONS HISTORY */}
                <div className="sidebar-history-section">
                    <div className="sidebar-history-label">Recent Chats</div>
                    <div className="sidebar-chat-list">
                        {chats.map((chat) => (
                            <div
                                key={chat.id}
                                className={`sidebar-chat-item ${chat.id === activeChatId && activeSection === 'chat' ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveChatId(chat.id);
                                    setActiveSection('chat');
                                }}
                            >
                                <span className="chat-item-icon">💬</span>
                                <span className="chat-item-title" title={chat.title}>
                                    {chat.title}
                                </span>
                                <button
                                    className="chat-item-del-btn"
                                    onClick={(e) => handleDeleteChat(chat.id, e)}
                                    title="Delete chat"
                                >
                                    🗑
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* =========================================================================
                    REQUIREMENT 2 (Part A): PROFILE SECTION AT BOTTOM OF SIDEBAR
                    Contains all required settings and separate 'Health Data' section
                ========================================================================= */}
                <div className="sidebar-footer-profile">
                    {/* Quick Access Badges */}
                    <div className="sidebar-quick-health-row">
                        <button
                            className="sidebar-health-data-pill-btn"
                            onClick={() => setIsHealthDataOpen(true)}
                            title="Open personal Health Data (PDFs, images, records)"
                        >
                            <span>📁 Health Data</span>
                            <span className="health-badge-count">{totalFilesCount}</span>
                        </button>
                    </div>

                    {/* User Profile Card */}
                    <div
                        className="sidebar-user-card"
                        onClick={() => setIsSidebarProfileMenuOpen(!isSidebarProfileMenuOpen)}
                    >
                        <div className="sidebar-user-avatar">
                            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="sidebar-user-details">
                            <span className="sidebar-user-name">{user?.name}</span>
                            <span className="sidebar-user-id">{user?.healthId}</span>
                        </div>
                        <span className="sidebar-menu-dots">⋮</span>
                    </div>

                    {/* Popover Menu from Sidebar Profile Card */}
                    {isSidebarProfileMenuOpen && (
                        <div className="sidebar-profile-popover">
                            <button
                                className="popover-item"
                                onClick={() => {
                                    setIsSidebarProfileMenuOpen(false);
                                    setIsHealthDataOpen(true);
                                }}
                            >
                                📁 <span>Health Data & Records</span>
                            </button>
                            <button
                                className="popover-item"
                                onClick={() => {
                                    setIsSidebarProfileMenuOpen(false);
                                    setIsSettingsOpen(true);
                                }}
                            >
                                ⚙️ <span>Account Settings</span>
                            </button>
                            <Link
                                to="/access-log"
                                className="popover-item"
                                onClick={() => setIsSidebarProfileMenuOpen(false)}
                            >
                                📋 <span>Doctor Access Log</span>
                            </Link>
                            <div className="popover-divider" />
                            <button
                                className="popover-item logout-item"
                                onClick={() => {
                                    setIsSidebarProfileMenuOpen(false);
                                    logout();
                                }}
                            >
                                🚪 <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* =========================================================================
                MAIN VIEW (Chat Area OR News Area)
            ========================================================================= */}
            <main className="gpt-main-content">
                {/* TOP HEADER OF CHAT SECTION */}
                <header className="gpt-top-header">
                    <div className="top-header-left">
                        {/* Sidebar expand button when sidebar is collapsed */}
                        {!isSidebarOpen && (
                            <button
                                className="sidebar-expand-toggle-btn"
                                onClick={toggleSidebar}
                                title="Expand sidebar"
                                aria-label="Expand sidebar"
                            >
                                ▶
                            </button>
                        )}
                        <div className="header-status-pill">
                            <span className="status-indicator-dot" />
                            <span className="header-model-name">LifeLink AI · RAG Vector Assistant</span>
                            <span className="header-patient-id-tag">{user?.healthId}</span>
                        </div>
                    </div>

                    {/* CENTER MODE SWITCHER: CHAT VS NEWS */}
                    <div className="top-header-center">
                        <div className="section-pill-toggle">
                            <button
                                className={`pill-toggle-btn ${activeSection === 'chat' ? 'active' : ''}`}
                                onClick={() => setActiveSection('chat')}
                            >
                                💬 Chat
                            </button>
                            <button
                                className={`pill-toggle-btn ${activeSection === 'news' ? 'active' : ''}`}
                                onClick={() => setActiveSection('news')}
                            >
                                📰 News
                            </button>
                        </div>
                    </div>

                    {/* =========================================================================
                        REQUIREMENT 2 (Part B): TOP RIGHT OF CHAT SECTION
                        Profile section with required settings and separate 'Health Data' section
                    ========================================================================= */}
                    <div className="top-header-right">
                        {/* Dedicated Health Data Button */}
                        <button
                            className="top-health-data-btn"
                            onClick={() => setIsHealthDataOpen(true)}
                            title="Open personal Health Data (PDFs, prescription photos, scans)"
                        >
                            <span className="top-btn-icon">📁</span>
                            <span className="top-btn-text">Health Data</span>
                            <span className="top-health-count">{totalFilesCount}</span>
                        </button>

                        {/* Top-Right Profile Section & Settings */}
                        <div className="top-profile-menu-wrap">
                            <button
                                className="top-profile-trigger"
                                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                title="Profile & Settings"
                            >
                                <div className="top-avatar">
                                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <span className="top-user-name">{user?.name}</span>
                                <span className="top-chevron">▾</span>
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileDropdownOpen && (
                                <div className="top-profile-dropdown" onClick={() => setIsProfileDropdownOpen(false)}>
                                    <div className="dropdown-user-header">
                                        <strong>{user?.name}</strong>
                                        <div className="dropdown-email">{user?.email}</div>
                                        <div className="dropdown-health-id">{user?.healthId}</div>
                                    </div>
                                    <div className="dropdown-divider" />
                                    <button
                                        className="dropdown-link-btn"
                                        onClick={() => setIsHealthDataOpen(true)}
                                    >
                                        📁 Health Data (PDFs & Photos)
                                    </button>
                                    <button
                                        className="dropdown-link-btn"
                                        onClick={() => setIsSettingsOpen(true)}
                                    >
                                        ⚙️ Account & Security Settings
                                    </button>
                                    <Link to="/edit-profile" className="dropdown-link-btn">
                                        ✏️ Edit Health Profile
                                    </Link>
                                    <Link to="/access-log" className="dropdown-link-btn">
                                        📋 Doctor Access Log
                                    </Link>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-link-btn dropdown-logout-btn" onClick={logout}>
                                        🚪 Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* =========================================================================
                    SECTION 1: GPT CHAT SECTION
                ========================================================================= */}
                {activeSection === 'chat' && (
                    <div className="chat-section-container">
                        {/* CHAT MESSAGES STREAM */}
                        <div className="chat-messages-scroll-area">
                            {currentChat.messages.length === 0 ? (
                                <div className="chat-empty-hero">
                                    <div className="empty-hero-icon-wrap">
                                        <img src="/logo_cross.png" alt="LifeLink AI" className="hero-logo-img" />
                                    </div>
                                    <h1 className="empty-hero-title">How can LifeLink AI assist with your health?</h1>
                                    <p className="empty-hero-subtitle">
                                        Grounded in your personal encrypted health profile, medications, and clinical records.
                                    </p>

                                    {/* 4 GPT-Style Quick Prompt Cards */}
                                    <div className="prompt-cards-grid">
                                        <div
                                            className="prompt-card"
                                            onClick={() => handlePromptSuggestionClick('Review my current medications and list potential interactions or side effects.')}
                                        >
                                            <div className="prompt-card-icon">💊</div>
                                            <div className="prompt-card-title">Medication Review</div>
                                            <div className="prompt-card-desc">Check active prescriptions and dosages on file.</div>
                                        </div>

                                        <div
                                            className="prompt-card"
                                            onClick={() => handlePromptSuggestionClick('What are my documented allergies and recorded blood group in my emergency profile?')}
                                        >
                                            <div className="prompt-card-icon">🩸</div>
                                            <div className="prompt-card-title">Allergies & Blood Type</div>
                                            <div className="prompt-card-desc">Verify emergency alerts for hospital triage.</div>
                                        </div>

                                        <div
                                            className="prompt-card"
                                            onClick={() => handlePromptSuggestionClick('Summarize my complete emergency medical profile for first responders.')}
                                        >
                                            <div className="prompt-card-icon">📋</div>
                                            <div className="prompt-card-title">Emergency Summary</div>
                                            <div className="prompt-card-desc">Generate an instant doctor-ready brief.</div>
                                        </div>

                                        <div
                                            className="prompt-card"
                                            onClick={() => handlePromptSuggestionClick('Explain my uploaded medical files and document photos in plain language.')}
                                        >
                                            <div className="prompt-card-icon">📑</div>
                                            <div className="prompt-card-title">Uploaded Scans & PDFs</div>
                                            <div className="prompt-card-desc">Query document scans and lab links.</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="chat-messages-list">
                                    {currentChat.messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`chat-message-row ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}
                                        >
                                            <div className="message-avatar">
                                                {msg.role === 'user' ? (
                                                    <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                                                ) : (
                                                    <img src="/logo_cross.png" alt="AI" className="message-ai-avatar-img" />
                                                )}
                                            </div>

                                            <div className="message-content-wrapper">
                                                <div className="message-header-meta">
                                                    <span className="message-author-name">
                                                        {msg.role === 'user' ? user.name : 'LifeLink AI'}
                                                    </span>
                                                    {msg.referencedRecords && msg.referencedRecords.length > 0 && (
                                                        <span className="rag-grounded-pill">
                                                            📌 RAG Vector Context ({msg.referencedRecords.length})
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="message-text">
                                                    {msg.content.split('\n\n').map((para, pIdx) => (
                                                        <p key={pIdx}>
                                                            {para.split('\n').map((line, lIdx) => (
                                                                <span key={lIdx}>
                                                                    {line}
                                                                    {lIdx < para.split('\n').length - 1 && <br />}
                                                                </span>
                                                            ))}
                                                        </p>
                                                    ))}
                                                </div>

                                                {/* Referenced records chips */}
                                                {msg.referencedRecords && msg.referencedRecords.length > 0 && (
                                                    <div className="message-sources-box">
                                                        <span className="sources-label">Referenced from your Health Data:</span>
                                                        <div className="sources-tags">
                                                            {msg.referencedRecords.map((ref, rIdx) => (
                                                                <span key={rIdx} className="source-tag">{ref}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isSending && (
                                        <div className="chat-message-row message-assistant">
                                            <div className="message-avatar">
                                                <img src="/logo_cross.png" alt="AI" className="message-ai-avatar-img" />
                                            </div>
                                            <div className="message-content-wrapper">
                                                <div className="typing-indicator">
                                                    <span className="dot" />
                                                    <span className="dot" />
                                                    <span className="dot" />
                                                    <span className="typing-text">Cross-referencing medical profile vectors...</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={chatEndRef} />
                                </div>
                            )}
                        </div>

                        {/* GPT FLOATING CHAT INPUT CAPSULE */}
                        <div className="chat-input-bottom-container">
                            <div className="chat-input-capsule">
                                <button
                                    className="capsule-attach-btn"
                                    onClick={() => setIsHealthDataOpen(true)}
                                    title="Reference / view Health Data (PDFs, photos)"
                                >
                                    📎
                                </button>

                                <textarea
                                    ref={textareaRef}
                                    className="capsule-textarea"
                                    placeholder="Ask LifeLink AI about your health, medications, allergies, or documents..."
                                    value={inputText}
                                    onChange={handleTextareaChange}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    disabled={isSending}
                                />

                                <button
                                    className={`capsule-send-btn ${inputText.trim() ? 'active' : ''}`}
                                    onClick={() => handleSendMessage()}
                                    disabled={!inputText.trim() || isSending}
                                    aria-label="Send prompt"
                                >
                                    ↑
                                </button>
                            </div>

                            <div className="chat-disclaimer-text">
                                LifeLink Medical AI references your personal encrypted health records. Not a substitute for clinical emergency care.
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    SECTION 2: HEALTH NEWS & ADVISORIES SECTION
                ========================================================================= */}
                {activeSection === 'news' && (
                    <div className="news-section-container">
                        <div className="news-feed-header">
                            <div>
                                <span className="news-kicker">Verified Clinical Updates</span>
                                <h1 className="news-feed-title">Health News & Medical Advisories</h1>
                                <p className="news-feed-desc">
                                    Curated emergency guidance, health research, and clinical breakthroughs that you can discuss directly with your LifeLink AI.
                                </p>
                            </div>

                            {/* Search */}
                            <div className="news-search-box">
                                <input
                                    type="text"
                                    className="news-search-input"
                                    placeholder="Search medical news..."
                                    value={newsSearch}
                                    onChange={(e) => setNewsSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Category filter pills */}
                        <div className="news-filter-pills">
                            {categoriesList.map((cat) => (
                                <button
                                    key={cat}
                                    className={`news-filter-btn ${newsFilter === cat ? 'active' : ''}`}
                                    onClick={() => setNewsFilter(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* News cards list */}
                        {loadingNews ? (
                            <div className="news-loading-text">Loading verified health news...</div>
                        ) : filteredArticles.length > 0 ? (
                            <div className="news-articles-grid">
                                {filteredArticles.map((art) => (
                                    <article key={art.id} className="news-card">
                                        <div className="news-card-top">
                                            <span className="news-category-badge">{art.category}</span>
                                            <span className="news-date-text">{art.date} · {art.readTime}</span>
                                        </div>

                                        <h2 className="news-article-title">{art.title}</h2>
                                        <div className="news-source-tag">Source: <strong>{art.source}</strong></div>
                                        <p className="news-article-summary">{art.summary}</p>

                                        {art.impact && (
                                            <div className="news-impact-box">
                                                <strong>Personal Health Relevance:</strong> {art.impact}
                                            </div>
                                        )}

                                        <div className="news-card-actions">
                                            <button
                                                className="news-discuss-ai-btn"
                                                onClick={() => handleDiscussArticleInChat(art)}
                                            >
                                                💬 Discuss with LifeLink AI
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="no-news-found">
                                No articles matched your search filter.
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* =========================================================================
                HEALTH DATA MODAL (PDFs, Images, Emergency QR, Clinical Records)
            ========================================================================= */}
            <HealthDataModal
                isOpen={isHealthDataOpen}
                onClose={() => setIsHealthDataOpen(false)}
                profile={profile}
                user={user}
                qrCodeValue={qrCodeValue}
            />

            {/* =========================================================================
                SETTINGS MODAL (Security, Passwords, Offline Storage)
            ========================================================================= */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                user={user}
                isOfflineCard={isOfflineCard}
                logout={logout}
            />
        </div>
    );
}
