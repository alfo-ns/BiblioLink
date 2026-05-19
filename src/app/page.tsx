"use client";
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Search, Plus, Library, Settings, Trash2, 
  BookOpen, Video, MessageSquare, Image as ImageIcon,
  ExternalLink, X, Edit2, Download, Upload, Loader2, LogIn, LogOut
} from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { fetchUrlMetadata } from './actions';
import './App.css';

// Types
type ContentType = 'article' | 'video' | 'post' | 'photo';
type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';
type TagLogic = 'AND' | 'OR';

interface LinkItem {
  id: string;
  url: string;
  title: string;
  description: string;
  type: ContentType;
  tags: string[];
  notes: string;
  imageUrl: string;
  dateAdded: string;
}

function App() {
  const { data: session } = useSession();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/links');
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
      }
    } catch (e) {
      console.error('Failed to load links:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagLogic, setTagLogic] = useState<TagLogic>('OR');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  // Modal State (for both Add and Edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<ContentType>('article');
  const [newNotes, setNewNotes] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    links.forEach(l => l.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [links]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const openModal = (link?: LinkItem) => {
    if (link) {
      setEditingId(link.id);
      setNewUrl(link.url);
      setNewType(link.type);
      setNewNotes(link.notes);
      setNewTags(link.tags.join(', '));
    } else {
      setEditingId(null);
      setNewUrl('');
      setNewType('article');
      setNewNotes('');
      setNewTags('');
    }
    setIsModalOpen(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsSaving(true);
    
    const parsedTags = newTags.split(',').map(t => t.trim()).filter(Boolean);

    // Prevent javascript: URLs (XSS protection)
    let safeUrl = newUrl;
    if (!safeUrl.toLowerCase().startsWith('http://') && !safeUrl.toLowerCase().startsWith('https://')) {
      safeUrl = 'https://' + safeUrl;
    }

    try {
      if (editingId) {
        // UPDATE via API
        const res = await fetch(`/api/links/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: safeUrl, type: newType, tags: parsedTags, notes: newNotes }),
        });
        if (res.ok) {
          const updated = await res.json();
          setLinks(links.map(l => l.id === editingId ? updated : l));
        }
      } else {
        // Fetch metadata for new link
        const meta = await fetchUrlMetadata(safeUrl);
        
        // CREATE via API
        const res = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: safeUrl,
            title: meta.success && meta.title ? meta.title : ('Saved Link - ' + safeUrl.substring(0, 30) + '...'),
            description: meta.success && meta.description ? meta.description : '',
            type: newType,
            tags: parsedTags,
            notes: newNotes,
            imageUrl: meta.success && meta.image ? meta.image : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setLinks([created, ...links]);
        }
      }
    } catch (err) {
      console.error('Save failed:', err);
    }

    setIsModalOpen(false);
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if(confirm('Are you sure you want to delete this link?')) {
      try {
        const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setLinks(links.filter(l => l.id !== id));
        }
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(links, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'bibliolink-export.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          const res = await fetch('/api/links/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importedData),
          });
          if (res.ok) {
            const result = await res.json();
            alert(`Import successful! ${result.imported} links imported.`);
            loadLinks(); // Reload from DB
          } else {
            alert('Import failed.');
          }
        } else {
          alert('Invalid JSON format.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Processing data
  const processedLinks = useMemo(() => {
    let result = links;
    
    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(link => 
        link.title.toLowerCase().includes(query) || 
        link.notes.toLowerCase().includes(query) ||
        link.description.toLowerCase().includes(query)
      );
    }

    // 2. Tag Filter
    if (selectedTags.length > 0) {
      result = result.filter(link => {
        if (tagLogic === 'AND') {
          return selectedTags.every(tag => link.tags.includes(tag));
        } else {
          return selectedTags.some(tag => link.tags.includes(tag));
        }
      });
    }

    // 3. Sort
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        case 'date-asc':
          return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return result;
  }, [links, searchQuery, selectedTags, tagLogic, sortOption]);

  const TypeIcon = ({ type }: { type: ContentType }) => {
    switch(type) {
      case 'article': return <BookOpen size={14} />;
      case 'video': return <Video size={14} />;
      case 'post': return <MessageSquare size={14} />;
      case 'photo': return <ImageIcon size={14} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Library size={20} />
          </div>
          <h1>BiblioLink</h1>
        </div>

        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            className="input" 
            placeholder="Search titles, notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="nav-section" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3>Tags Filter</h3>
            <select 
              className="select-input" 
              style={{ fontSize: '0.75rem', padding: '2px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}
              value={tagLogic} 
              onChange={e => setTagLogic(e.target.value as TagLogic)}
            >
              <option value="OR">OR</option>
              <option value="AND">AND</option>
            </select>
          </div>
          
          <div className="sidebar-tags">
            {allTags.map(tag => (
              <button 
                key={tag} 
                className={`tag-toggle ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                # {tag}
              </button>
            ))}
            {allTags.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No tags yet</p>}
          </div>
        </div>

        <div className="sidebar-bottom">
          {session && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }} onClick={handleExport}>
                <Download size={14} /> Export
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }} onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> Import
              </button>
              <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleImport} 
              />
            </div>
          )}

          {session ? (
            <button className="nav-item btn-secondary" style={{ width: '100%', border: 'none', background: 'rgba(255,255,255,0.05)' }} onClick={() => signOut()}>
              <LogOut size={18} /> Logout
            </button>
          ) : (
            <button className="nav-item btn-primary" style={{ width: '100%', border: 'none', color: 'white' }} onClick={() => signIn()}>
              <LogIn size={18} /> Login for Admin
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header glass">
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>All Links</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {processedLinks.length} items {selectedTags.length > 0 ? `(filtered by ${selectedTags.length} tags)` : ''}
            </p>
          </div>
          
          <div className="header-actions">
            <div className="filter-group">
              <label>Sort:</label>
              <select className="select-input" value={sortOption} onChange={e => setSortOption(e.target.value as SortOption)}>
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
              </select>
            </div>

            {session && (
              <button className="btn btn-primary" onClick={() => openModal()}>
                <Plus size={18} /> Add Link
              </button>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          <div className="cards-grid">
            {/* Quick Add Slot */}
            {session && (
              <div className="link-card glass quick-add-card" onClick={() => openModal()}>
                <div className="quick-add-icon">
                  <Plus size={24} />
                </div>
                <p style={{ fontWeight: 500 }}>Save new link</p>
              </div>
            )}

            {/* Link Cards */}
            {processedLinks.map(link => (
              <div key={link.id} className="link-card glass animate-fade-in">
                <div className={`card-badge badge ${link.type}`}>
                  <TypeIcon type={link.type} /> {link.type}
                </div>
                <div className="card-image">
                  <img src={link.imageUrl} alt={link.title} />
                </div>
                <div className="card-content">
                  <h3 className="card-title">{link.title}</h3>
                  <p className="card-desc">{link.description}</p>
                  
                  {link.notes && (
                    <div className="card-notes">
                      <span className="notes-label">Personal Note</span>
                      {link.notes}
                    </div>
                  )}

                  <div className="card-footer">
                    <div className="tag-list">
                      {link.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    <div className="card-actions">
                      {session && (
                        <>
                          <button className="btn-icon" title="Edit" onClick={() => openModal(link)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon delete" title="Delete" onClick={() => handleDelete(link.id)}>
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <a href={link.url} target="_blank" rel="noreferrer" className="btn-icon" title="Open Link">
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>{editingId ? 'Edit Link' : 'Save to BiblioLink'}</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveLink}>
              <div className="modal-body">
                <div className="input-group">
                  <label>URL</label>
                  <input 
                    type="url" 
                    className="input" 
                    placeholder="https://..." 
                    required 
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                  />
                </div>

                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, display: 'block', margin: '16px 0 8px' }}>
                  Content Type
                </label>
                <div className="type-selector">
                  <button type="button" className={`type-btn ${newType === 'article' ? 'active' : ''}`} onClick={() => setNewType('article')}>
                    <BookOpen size={20} /> Article
                  </button>
                  <button type="button" className={`type-btn ${newType === 'video' ? 'active' : ''}`} onClick={() => setNewType('video')}>
                    <Video size={20} /> Video
                  </button>
                  <button type="button" className={`type-btn ${newType === 'post' ? 'active' : ''}`} onClick={() => setNewType('post')}>
                    <MessageSquare size={20} /> Post
                  </button>
                  <button type="button" className={`type-btn ${newType === 'photo' ? 'active' : ''}`} onClick={() => setNewType('photo')}>
                    <ImageIcon size={20} /> Photo
                  </button>
                </div>

                <div className="input-group">
                  <label>Tags (comma separated)</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. Design, React, Inspiration" 
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>Personal Notes</label>
                  <textarea 
                    className="input" 
                    rows={3} 
                    placeholder="Why are you saving this? What's the key takeaway?"
                    style={{ resize: 'none' }}
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Fetching Preview...</> : (editingId ? 'Save Changes' : 'Save Link')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
