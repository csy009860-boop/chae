import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Monitor, ZoomIn, ZoomOut, MessageSquare, MapPin, Send, X, Check, MessageSquarePlus, SidebarClose, SidebarOpen
} from 'lucide-react';
import { 
  db, handleFirestoreError, OperationType 
} from '../firebase';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc
} from 'firebase/firestore';
import { format } from 'date-fns';

interface DraftComment {
  id: string;
  draftUrl: string;
  x: number;
  y: number;
  content: string;
  author: string;
  createdAt: string | any;
  status: 'open' | 'resolved';
}

function DraftWorkspace({ activePreviewUrl }: { activePreviewUrl: string | null }) {
  const [scale, setScale] = useState(1);
  const [scaleInput, setScaleInput] = useState('100');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Comment modes
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [comments, setComments] = useState<DraftComment[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<{x: number, y: number} | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state values for native event listeners without causing bind-loops
  const stateRef = useRef({ scale, pan, isAddingPin });
  useEffect(() => {
    stateRef.current = { scale, pan, isAddingPin };
  }, [scale, pan, isAddingPin]);

  // Real-time comments listener
  useEffect(() => {
    if (!activePreviewUrl) {
      setComments([]);
      return;
    }

    const q = query(collection(db, 'draft_comments'), where('draftUrl', '==', activePreviewUrl));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DraftComment[];
      setComments(data);
      if (data.length > 0) setIsSidebarOpen(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'draft_comments');
    });

    return () => unsubscribe();
  }, [activePreviewUrl]);

  // When switching images or opening the workspace, reset pan/zoom
  useEffect(() => {
    setScale(1);
    setScaleInput('100');
    setPan({ x: 0, y: 0 });
    setPendingPin(null);
    setIsAddingPin(false);
  }, [activePreviewUrl]);

  // Unified Zoom Engine
  const handleZoom = useCallback((newScale: number, cx: number = 0, cy: number = 0) => {
    newScale = Math.max(0.05, Math.min(newScale, 10)); // Allow 5% to 1000%
    const { scale: currentScale, pan: currentPan } = stateRef.current;
    
    setPan({
      x: cx - (cx - currentPan.x) * (newScale / currentScale),
      y: cy - (cy - currentPan.y) * (newScale / currentScale)
    });
    setScale(newScale);
    setScaleInput(Math.round(newScale * 100).toString());
  }, []);

  // Native Event Binding for Override (Ctrl+Wheel, Ctrl+0, etc.)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // Strongly prevent browser native zoom

        const { scale: currentScale } = stateRef.current;
        const zoomFactor = 0.08;
        const direction = e.deltaY > 0 ? -1 : 1;
        const newScale = currentScale + (zoomFactor * direction * currentScale);
        
        const rect = container.getBoundingClientRect();
        const cx = (e.clientX - rect.left) - rect.width / 2;
        const cy = (e.clientY - rect.top) - rect.height / 2;
        
        handleZoom(newScale, cx, cy);
      } else {
        // Regular pan via mouse wheel
        if (!stateRef.current.isAddingPin) {
          // Optional: e.preventDefault() to stop page bouncing
          e.preventDefault();
          setPan(prev => ({
            x: prev.x - e.deltaX,
            y: prev.y - e.deltaY
          }));
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts if typing in input fields (so user can copy/paste/select text)
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
         return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault();
          setScale(1);
          setScaleInput('100');
          setPan({ x: 0, y: 0 });
        } else if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault();
          const { scale: currentScale } = stateRef.current;
          handleZoom(currentScale + 0.2, 0, 0);
        } else if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          const { scale: currentScale } = stateRef.current;
          handleZoom(currentScale - 0.2, 0, 0);
        }
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, { passive: false });

    return () => {
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleZoom]);

  const handleManualZoom = (direction: 'in' | 'out') => {
    handleZoom(scale + (direction === 'in' ? 0.2 : -0.2), 0, 0);
  };

  const handleScaleInputBlur = () => {
    const parsed = parseInt(scaleInput, 10);
    if (!isNaN(parsed)) {
       handleZoom(parsed / 100, 0, 0);
    } else {
       setScaleInput(Math.round(scale * 100).toString());
    }
  };

  const handleScaleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScaleInputBlur();
    }
  };

  // Panning Handling
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click if not adding pin, or always with middle click
    if ((e.button === 0 && !isAddingPin) || e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Comment Creation
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingPin || !activePreviewUrl || isDragging) return;
    
    e.stopPropagation();

    const bounds = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width) * 100;
    const y = ((e.clientY - bounds.top) / bounds.height) * 100;
    
    setPendingPin({ x, y });
    setIsAddingPin(false); // Once pinned, exit add mode to type
    setIsSidebarOpen(true);
  };

  const submitComment = async () => {
    if (!pendingPin || !newCommentText.trim() || !activePreviewUrl) return;

    try {
      await addDoc(collection(db, 'draft_comments'), {
        draftUrl: activePreviewUrl,
        x: pendingPin.x,
        y: pendingPin.y,
        content: newCommentText,
        author: '팀원 (Guest)', // Can be replaced with actual user context
        createdAt: new Date().toISOString(),
        status: 'open'
      });
      setPendingPin(null);
      setNewCommentText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'draft_comments');
    }
  };

  const resolveComment = async (id: string) => {
    try {
      await updateDoc(doc(db, 'draft_comments', id), { status: 'resolved' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `draft_comments/${id}`);
    }
  };

  const deleteComment = async (id: string) => {
     try {
      await deleteDoc(doc(db, 'draft_comments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `draft_comments/${id}`);
    }
  };

  const isVideo = activePreviewUrl?.match(/\.(mp4|webm|ogg)$/i) || activePreviewUrl?.includes('youtube') || activePreviewUrl?.includes('vimeo');

  return (
    <div className="w-screen h-screen bg-slate-900 flex flex-col overflow-hidden text-slate-200">
      {/* Header Toolbar */}
      <div className="h-14 bg-slate-950 flex items-center justify-between px-6 border-b border-white/5 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h1 className="text-white font-bold tracking-tight">시안 모니터 (연동됨)</h1>
        </div>
        
        {activePreviewUrl && (
          <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 rounded-md p-1 border border-slate-700">
              <button 
                onClick={() => handleManualZoom('out')}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition rounded"
              >
                <ZoomOut size={16} />
              </button>
              <div className="px-1 shrink-0 flex items-center">
                <input 
                   type="text" 
                   value={scaleInput}
                   onChange={(e) => setScaleInput(e.target.value)}
                   onBlur={handleScaleInputBlur}
                   onKeyDown={handleScaleInputKeyDown}
                   className="w-[45px] text-center bg-transparent text-slate-200 text-sm font-bold focus:outline-none focus:bg-slate-700 rounded py-1"
                />
                <span className="text-slate-400 text-sm font-bold">%</span>
              </div>
              <button 
                onClick={() => handleManualZoom('in')}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition rounded"
              >
                <ZoomIn size={16} />
              </button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
              <button
                onClick={() => {
                  const newMode = !isAddingPin;
                  setIsAddingPin(newMode);
                  if (newMode) {
                    setIsSidebarOpen(true);
                    setPendingPin(null); // Reset pending pin to start fresh
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium text-sm border hover:shadow-lg
                  ${isAddingPin 
                    ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
              >
                <MessageSquarePlus size={16} />
                {isAddingPin ? '코멘트 모드 켜짐' : '코멘트 추가'}
              </button>

              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`w-10 h-10 flex items-center justify-center rounded-md transition border hover:bg-slate-700
                  ${isSidebarOpen
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                title="코멘트 패널 열기/닫기"
              >
                {isSidebarOpen ? <SidebarClose size={18} /> : <SidebarOpen size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Canvas Area */}
        <div 
          ref={containerRef}
          className={`flex-1 overflow-hidden relative flex items-center justify-center bg-slate-800
            ${isAddingPin ? 'cursor-crosshair' : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {activePreviewUrl ? (
            <div 
              className="relative shadow-2xl rounded-lg bg-white shrink-0 origin-center"
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transition: isDragging || isAddingPin ? 'none' : 'transform 0.05s ease-out',
                willChange: 'transform'
              }}
              onClick={handleImageClick}
            >
              {isVideo ? (
                 <video src={activePreviewUrl} controls className="max-w-full rounded-lg pointer-events-auto block" />
              ) : (
                <>
                  <img 
                    src={activePreviewUrl} 
                    alt="Preview Target" 
                    className="block user-select-none pointer-events-none"
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Render Pins */}
                  {comments.filter(c => c.status === 'open').map((comment, i) => (
                    <div 
                      key={comment.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePinId(comment.id);
                        setIsSidebarOpen(true);
                      }}
                      className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer shadow-lg transition-transform transform z-10 pointer-events-auto
                        ${activePinId === comment.id || pendingPin === null && !isAddingPin ? 'hover:scale-110' : ''} 
                        ${activePinId === comment.id ? 'bg-blue-600 text-white ring-4 ring-blue-500/30 scale-110' : 'bg-white text-slate-900 border-2 border-slate-900'}`}
                      style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                    >
                      {i + 1}
                    </div>
                  ))}

                  {/* Render Pending Pin */}
                  {pendingPin && (
                    <div 
                      className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-sm shadow-lg ring-4 ring-blue-500/30 animate-pulse z-20 pointer-events-none"
                      style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
                    >
                      +
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <Monitor size={48} strokeWidth={1.5} />
              <p className="font-medium">대시보드에서 시안을 선택해주세요</p>
            </div>
          )}
        </div>

        {/* Comment Sidebar */}
        {isSidebarOpen && activePreviewUrl && (
          <div className="w-80 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.15)] z-20 flex flex-col shrink-0 border-l border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-sleek-primary" />
                <h3 className="font-bold text-slate-900 tracking-tight">코멘트</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 flex items-center h-6 rounded-full">
                  {comments.filter(c => c.status === 'open').length}
                </span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {pendingPin && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-800 flex items-center gap-1"><MapPin size={12}/> 새 코멘트 등록</span>
                    <button onClick={() => setPendingPin(null)} className="text-blue-400 hover:text-blue-800"><X size={14} /></button>
                  </div>
                  <textarea 
                    autoFocus
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="w-full text-sm bg-white border border-blue-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none mb-2 text-slate-900"
                    placeholder="여기에 코멘트를 입력하세요..."
                  />
                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={submitComment}
                      disabled={!newCommentText.trim()}
                      className="bg-blue-600 text-white text-xs font-bold px-4 h-8 rounded hover:bg-blue-700 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={12} /> 추가
                    </button>
                  </div>
                </div>
              )}

              {comments.filter(c => c.status === 'open').map((comment, i) => (
                <div 
                  key={comment.id}
                  className={`bg-white border rounded-lg p-4 transition-all cursor-pointer shadow-sm ${activePinId === comment.id ? 'border-sleek-primary ring-2 ring-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                  onMouseEnter={() => setActivePinId(comment.id)}
                  onMouseLeave={() => setActivePinId(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                        {i + 1}
                      </div>
                      <span className="font-bold text-slate-800 text-sm">{comment.author}</span>
                    </div>
                    <button onClick={() => resolveComment(comment.id)} className="text-slate-400 hover:text-emerald-500 transition" title="해결 완료">
                      <Check size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 justify-between">
                     <span className="text-[10px] text-slate-400">
                        {comment.createdAt ? format(new Date(comment.createdAt), 'MM/dd HH:mm') : ''}
                     </span>
                     <button onClick={() => deleteComment(comment.id)} className="text-[10px] text-red-400 hover:text-red-600 font-medium">삭제</button>
                  </div>
                </div>
              ))}

              {isAddingPin && !pendingPin && (
                 <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg p-4 text-center text-slate-500 text-sm animate-pulse">
                    이미지의 원하는 위치를 클릭하여 핀을 고정하세요.
                 </div>
              )}

              {comments.filter(c => c.status === 'open').length === 0 && !pendingPin && !isAddingPin && (
                <div className="text-center py-10">
                  <p className="text-slate-400 text-sm font-medium">작성된 코멘트가 없습니다.</p>
                  <p className="text-slate-400 text-xs mt-1">'코멘트 추가'를 눌러 의견을 남겨보세요.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DraftWorkspace;
