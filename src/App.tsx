// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Clipboard, Bot, Loader2, Lock, Unlock, Target, Check, Lightbulb, Sparkles, ArrowRight, AlertTriangle, ShieldCheck, Settings2, ChevronDown, ChevronUp, Mic, BookOpen, Download, Upload, FileDown, Folder, Play, BookmarkPlus, X, FileText, Pencil, Trash2, FolderInput, FolderPlus, MoreHorizontal, CheckSquare, Square } from 'lucide-react';

let onUnauthorizedError = null;

const callGeminiAPI = async (prompt, isJson = false, customSchema = null) => {
  const url = `/api/generate`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (isJson) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: customSchema || {
        type: "OBJECT",
        properties: {
          instructionFollowing: { type: "INTEGER", description: "Score 0, 1, or 2" },
          completeness: { type: "INTEGER", description: "Score 0, 1, or 2" },
          accuracy: { type: "INTEGER", description: "Score 0, 1, or 2" },
          clarity: { type: "INTEGER", description: "Score 0, 1, or 2" },
          tone: { type: "INTEGER", description: "Score 0, 1, or 2" },
          usefulness: { type: "INTEGER", description: "Score 0, 1, or 2" },
          task: { type: "INTEGER", description: "Score 0 or 1" },
          context: { type: "INTEGER", description: "Score 0 or 1" },
          audience: { type: "INTEGER", description: "Score 0 or 1" },
          promptTone: { type: "INTEGER", description: "Score 0 or 1" },
          format: { type: "INTEGER", description: "Score 0 or 1" },
          constraints: { type: "INTEGER", description: "Score 0 or 1" },
          successCriteria: { type: "INTEGER", description: "Score 0 or 1" },
          instructionFollowingNote: { type: "STRING", description: "Brief justification" },
          completenessNote: { type: "STRING", description: "Brief justification" },
          accuracyNote: { type: "STRING", description: "Brief justification" },
          clarityNote: { type: "STRING", description: "Brief justification" },
          toneNote: { type: "STRING", description: "Brief justification" },
          usefulnessNote: { type: "STRING", description: "Brief justification" },
          suggestedFailureType: { type: "STRING" },
          suggestedIssues: { type: "STRING" },
          suggestedFix: { type: "STRING" }
        },
        required: [
          "instructionFollowing", "completeness", "accuracy", "clarity", "tone", "usefulness",
          "task", "context", "audience", "promptTone", "format", "constraints", "successCriteria",
          "instructionFollowingNote", "completenessNote", "accuracyNote", "clarityNote", "toneNote", "usefulnessNote",
          "suggestedFailureType", "suggestedIssues", "suggestedFix"
        ]
      }
    };
  }

  let retries = 5;
  let delays = [1000, 2000, 4000, 8000, 16000];
  
  for (let i = 0; i < retries; i++) {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          if (onUnauthorizedError) onUnauthorizedError();
          throw new Error('Unauthorized: 401');
        }
        const errorData = await response.json();
        const msg = errorData.error?.message || errorData.error || `HTTP error ${response.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      return isJson ? JSON.parse(text) : text;
    } catch (err) {
      if (err.message.includes('401')) throw err;
      if (i === retries - 1) throw new Error(err.message || "Failed to generate response after multiple attempts.");
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

const safeInt = (val, max, fallback) => {
  if (val === undefined || val === null) return fallback;
  const parsed = parseInt(val);
  return isNaN(parsed) ? fallback : Math.min(Math.max(parsed, 0), max);
};

const safeStr = (val) => {
  if (val === undefined || val === null) return '';
  let str = String(val);
  if (str.length > 250 && str.includes('{') && str.includes('}')) {
     return str.substring(0, 150) + '... [Truncated invalid format]';
  }
  return str;
};

const toneOptions = [
  "Auto-detect tone from prompt",
  "Professional",
  "Warm",
  "Conversational",
  "Direct",
  "Spartan",
  "Friendly",
  "Confident",
  "Creative",
  "Academic",
  "Dry / Witty",
  "Formal",
  "Casual"
];

const toneInstructions = {
  "Warm": "Use a warm, human, reassuring tone.",
  "Spartan": "Use concise, direct wording with no fluff.",
  "Dry / Witty": "Use dry, understated wit without sounding forced.",
  "Professional": "Use a polished, professional, and highly capable tone.",
  "Conversational": "Use a natural, conversational, and approachable tone.",
  "Direct": "Use a direct, straightforward, and no-nonsense tone.",
  "Friendly": "Use a friendly, welcoming, and helpful tone.",
  "Confident": "Use a confident, authoritative, and assuring tone.",
  "Creative": "Use a creative, engaging, and imaginative tone.",
  "Academic": "Use a rigorous, academic, and well-reasoned tone.",
  "Formal": "Use a formal, respectful, and proper tone.",
  "Casual": "Use a casual, relaxed, and easygoing tone."
};

const STARTER_PACKS = [
  {
    id: "starter-marketing-social-001",
    title: "Grounded Marketing & Social Post",
    folder: "Marketing / Social Media",
    tags: ["marketing", "social-media", "copywriting", "guardrails"],
    difficulty: "Intermediate",
    description: "Creates a short promotional or announcement post under 80 words using only verified details, avoiding placeholders and unsupported marketing hype.",
    promptText: `System:\nYou are a concise marketing and social media copywriter who writes clear, grounded promotional copy.\nContext:\nThe user needs a short social media post or announcement (for a business, event, or product launch). The final copy must use only verified details and avoid exaggerated claims or placeholders.\nUser Data Needed:\n- Subject or topic (business, product, event, or announcement)\n- Name of organization, business, or event\n- Location, service area, or link/CTA\n- Date/time or price details, if relevant\n- Confirmed facts or credibility details to support any claims\nInstruction:\nIf any critical details are missing, ask the user for them before writing the final copy.\nIf details are provided, write a ready-to-post update.\nFormat:\nOne paragraph under 80 words.\nRules:\n- Use only the details explicitly provided by the user.\n- Do not invent names, prices, dates, links, locations, reviews, awards, guarantees, or deadlines.\n- Do not use generic placeholders unless the user explicitly allows them.\n- Avoid unsupported hype words like "best," "trusted," "limited-time," "guaranteed," "proven," "top-rated," or "available now" unless proof is provided.\n- Include a clear CTA if a contact method or link is provided.\n- Tone should be professional, friendly, and human.`,
    type: 'Optimized',
    outputQaScore: 12,
    promptQualityScore: 7,
    dateSaved: new Date().toISOString()
  },
  {
    id: "starter-resume-001",
    title: "Entry-Level Resume Summary",
    folder: "Resume",
    tags: ["resume", "entry-level", "career"],
    difficulty: "Beginner",
    description: "Creates an honest entry-level resume summary without inflating experience or skills.",
    promptText: `System:\nYou are an honest technical resume writer specializing in entry-level career transitions.\nContext:\nThe candidate is entry-level and wants a professional resume summary without exaggerating experience.\nUser Data Needed:\n- Target role\n- Training or education completed\n- Tools, platforms, or concepts learned\n- Projects, labs, or hands-on practice\n- Certifications earned or currently studying\n- Customer service or teamwork background, if relevant\nInstruction:\nIf the candidate details are missing, ask for them first.\nIf details are provided, write one resume summary.\nFormat:\nOne paragraph under 75 words.\nRules:\n- Do not claim paid experience unless explicitly provided.\n- Do not claim senior-level skills.\n- Do not mention years of experience unless provided.\n- Do not upgrade "fundamentals" into "administration."\n- Do not upgrade "training labs" into professional experience.\n- Do not turn "studying" into "certified."\n- Use honest entry-level language.\n- Emphasize training, troubleshooting, documentation, customer support, and learning mindset.`,
    type: 'Optimized',
    outputQaScore: 12,
    promptQualityScore: 7,
    dateSaved: new Date().toISOString()
  },
  {
    id: "starter-email-001",
    title: "Customer Delay Email",
    folder: "Business Writing",
    tags: ["customer-service", "email", "delay"],
    difficulty: "Intermediate",
    description: "Writes a calm customer delay email while avoiding invented dates, policies, or compensation claims.",
    promptText: `System:\nYou are a customer relations specialist who writes concise, calm, and trustworthy customer emails.\nContext:\nA customer-facing update is needed for a delay. The message must stay factual and avoid unsupported details.\nUser Data Needed:\n- Type of delay\n- Confirmed reason, if available\n- Next update timeframe\n- Support contact\n- Refund or compensation policy, if confirmed\n- Any details that should be avoided\nInstruction:\nIf required details are missing, ask for them first.\nIf details are provided, write a short customer email about the delay.\nFormat:\nSubject line plus email body under 100 words.\nRules:\n- Use only confirmed facts.\n- Do not invent delay reasons, dates, tracking links, refund policies, or compensation.\n- If no customer name is provided, use a generic greeting.\n- Include a support contact only if provided.\n- Clearly state when the next update will be provided if that timeframe is given.\n- Keep the tone calm, professional, and reassuring.`,
    type: 'Optimized',
    outputQaScore: 12,
    promptQualityScore: 7,
    dateSaved: new Date().toISOString()
  },
  {
    id: "starter-ai-workflow-001",
    title: "AI Workflow Portfolio Post",
    folder: "Marketing / Social Media",
    tags: ["ai-workflow", "portfolio", "linkedin"],
    difficulty: "Beginner",
    description: "Creates a grounded LinkedIn post about an AI workflow project without overstating expertise.",
    promptText: `System:\nYou are a professional LinkedIn writing assistant for entry-level AI builders.\nContext:\nThe user finished an AI workflow project and wants to describe the process without sounding like an expert.\nUser Data Needed:\n- Project name or type\n- What the workflow does\n- Tools used\n- What was tested or improved\n- Before/after result, if available\n- Target role or portfolio goal\nInstruction:\nIf project details are missing, ask for them first.\nIf details are provided, write a short LinkedIn post.\nFormat:\nOne post under 100 words.\nRules:\n- Mention prompt testing, QA scoring, prompt optimization, and before/after improvement when supported by the user’s details.\n- Do not exaggerate expertise.\n- Do not use "thought leader," "expert," "visionary," or hype-heavy AI language.\n- Make the post useful for someone building an entry-level AI portfolio.\n- Keep the tone professional, natural, and not over-polished.`,
    type: 'Optimized',
    outputQaScore: 12,
    promptQualityScore: 7,
    dateSaved: new Date().toISOString()
  },
  {
    id: "starter-it-001",
    title: "IT Support Ticket Summary",
    folder: "IT / Cybersecurity",
    tags: ["it-support", "ticket", "troubleshooting"],
    difficulty: "Beginner",
    description: "Turns troubleshooting details into a professional help desk ticket note.",
    promptText: `System:\nYou are an IT support documentation assistant.\nContext:\nThe user needs a clear ticket summary based on troubleshooting steps and outcome.\nUser Data Needed:\n- Reported issue\n- Device, app, or system affected\n- Troubleshooting steps performed\n- Result or resolution\n- Next step if unresolved\nInstruction:\nIf ticket details are missing, ask for them first.\nIf details are provided, write a professional ticket note.\nFormat:\nUse:\nIssue:\nTroubleshooting Performed:\nResolution:\nNext Steps:\nRules:\n- Use only the facts provided.\n- Do not invent tools, logs, errors, user details, or root causes.\n- Keep wording clear and concise.\n- Write in a professional help desk style.\n- If unresolved, clearly state the next step.`,
    type: 'Optimized',
    outputQaScore: 12,
    promptQualityScore: 7,
    dateSaved: new Date().toISOString()
  },
  {
    id: "starter-cybersecurity-001",
    title: "Safe Cybersecurity Learning Summary",
    folder: "IT / Cybersecurity",
    tags: ["cybersecurity", "security-plus", "study-notes"],
    difficulty: "Intermediate",
    description: "Explains cybersecurity concepts in a defensive, exam-focused way.",
    promptText: `System:\nYou are a cybersecurity study coach focused on defensive understanding and Security+ exam readiness.\nContext:\nThe user is learning a cybersecurity concept and needs clear, exam-focused notes.\nUser Data Needed:\n- Cybersecurity concept or topic\n- Exam level or study goal\n- Any specific confusion or scenario\nInstruction:\nIf the topic is missing, ask for it first.\nIf the topic is provided, explain it for Security+ style understanding.\nFormat:\nUse:\nPlain-English Explanation\nWhy It Matters\nExam Trap\nExample Scenario\nQuick Review\nRules:\n- Keep the explanation accurate and beginner-friendly.\n- Do not provide offensive security instructions, exploit steps, recon scripts, payloads, or unauthorized hacking guidance.\n- Focus on defensive understanding, risk, controls, terminology, and recognition.\n- Use concise wording.`,
    type: 'Optimized',
    outputQaScore: 12,
    promptQualityScore: 7,
    dateSaved: new Date().toISOString()
  },
  {
    id: "starter-business-001",
    title: "Business Website Section Copy",
    folder: "Business Writing",
    tags: ["website", "small-business", "copywriting"],
    difficulty: "Intermediate",
    description: "Creates clean website section copy for a small business without sounding corporate or generic.",
    promptText: `System:\nYou are a small-business website copywriter who writes clear, human, benefit-focused copy.\nContext:\nThe user needs website copy for a specific business section. The copy should sound professional but not corporate.\nUser Data Needed:\n- Business name\n- Website section type\n- Services or products offered\n- Target customer\n- Main benefits\n- CTA\n- Proof, reviews, or guarantees if claims are requested\nInstruction:\nIf required details are missing, ask for them first.\nIf details are provided, write website section copy.\nFormat:\nReturn:\nSection Headline\nShort Subheadline\n3 Benefit Bullets\nCall to Action\nRules:\n- Use only business details provided by the user.\n- Do not invent awards, guarantees, reviews, locations, services, or pricing.\n- Keep language human, clear, and benefit-focused.\n- Avoid generic phrases like "take your business to the next level," "unlock your potential," or "game-changing solution."\n- Tone should be professional, warm, and direct.`,
    type: 'Optimized',
    outputQaScore: 12,
    promptQualityScore: 7,
    dateSaved: new Date().toISOString()
  }
];

function extractMissingDetails(promptText) {
  const text = promptText.toLowerCase();

  const patterns = [
    /(?:i don’t have|i don't have|we don’t have|we don't have|not finalized|not provided|missing|unknown|tbd)([^.\n]+)/i
  ];

  let details = [];

  for (const pattern of patterns) {
    const match = promptText.match(pattern);
    if (match && match[1]) {
      const raw = match[1]
        .replace(/yet/gi, '')
        .replace(/finalized/gi, '')
        .replace(/confirmed/gi, '')
        .replace(/or /gi, '')
        .trim();

      details = raw
        .split(/,| and /i)
        .map(item => item.trim())
        .filter(Boolean);
    }
  }

  return [...new Set(details)];
}

function extractRiskyClaims(promptText) {
  const riskyTerms = [
    'best', 'trusted', 'guaranteed', 'expert', 'bank-level',
    'instant savings', 'instant results', 'fast results',
    'available now', 'limited-time', 'limited spots',
    'lifetime access', 'bonus resources', 'proven',
    'affordable', 'certified', 'secure', 'premium'
  ];

  const lower = promptText.toLowerCase();

  return riskyTerms.filter(term => lower.includes(term.toLowerCase()));
}

function buildSpecificQuestions(missingDetails, riskyClaims) {
  const questions = [];

  const has = (terms) =>
    terms.some(term =>
      missingDetails.some(detail => detail.toLowerCase().includes(term))
    );

  if (has(['app name', 'business name', 'course name', 'workshop name', 'event name'])) {
    questions.push('What is the official name that should appear in the final copy?');
  }

  if (has(['launch date', 'start date', 'event date', 'date'])) {
    questions.push('What date or timeframe should be included?');
  }

  if (has(['download link', 'signup link', 'registration link', 'login link', 'website', 'url'])) {
    questions.push('What link or access method should users use?');
  }

  if (has(['pricing', 'price', 'cost', 'refund policy', 'policy'])) {
    questions.push('What pricing, offer, or policy details should be included?');
  }

  if (has(['platform availability', 'platform'])) {
    questions.push('Which platforms or availability details should be listed?');
  }

  if (has(['support email', 'contact', 'phone'])) {
    questions.push('What support or contact method should be included?');
  }

  if (has(['instructor name', 'instructor', 'credentials', 'security details', 'customer reviews'])) {
    questions.push('What verified credentials, security details, reviews, or proof should support these claims?');
  }

  if (riskyClaims.length > 0) {
    questions.push(`Which of these claims are verified, and which should be softened or removed: ${riskyClaims.join(', ')}?`);
  }

  return [...new Set(questions)].slice(0, 5);
}

const App = () => {
  // DEV MODE CONFIGURATION (Hidden from normal UI)
  const debugMode = false;

  // Global Navigation State
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'library' | 'admin'

  // Authentication State
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));
  const [loginError, setLoginError] = useState('');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  
  // Admin Generator State
  const [adminMasterKey, setAdminMasterKey] = useState('');
  const [adminDuration, setAdminDuration] = useState('24');
  const [generatedCode, setGeneratedCode] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');

  const handleLogout = (message = '') => {
    localStorage.removeItem('access_token');
    setAccessToken(null);
    setPasscodeInput('');
    if (message) {
      setLoginError(message);
    }
  };

  // Bind global unauthorized callback
  useEffect(() => {
    onUnauthorizedError = () => {
      handleLogout('Session expired or unauthorized. Please re-enter code.');
    };
    return () => {
      onUnauthorizedError = null;
    };
  }, []);

  // Track Token Expiry
  useEffect(() => {
    if (!accessToken) {
      setTimeRemaining('');
      return;
    }
    
    // Dev Mode bypass
    if (accessToken === 'dev-bypass') {
      setTimeRemaining('Dev Mode (No Limit)');
      return;
    }

    const checkExpiry = () => {
      try {
        const parts = accessToken.split('-');
        if (parts.length === 3) {
          const expiresAt = parseInt(parts[1]);
          if (isNaN(expiresAt)) return;
          
          const diff = expiresAt - Date.now();
          if (diff <= 0) {
            handleLogout('Your access passcode has expired.');
            return;
          }
          
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          
          const pad = (n) => String(n).padStart(2, '0');
          setTimeRemaining(`${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`);
        } else {
          setTimeRemaining('Valid Session');
        }
      } catch (e) {
        setTimeRemaining('Valid Session');
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);
    return () => clearInterval(interval);
  }, [accessToken]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!passcodeInput.trim()) {
      setLoginError('Passcode cannot be empty.');
      return;
    }

    const code = passcodeInput.trim();
    if (code === 'dev-bypass') {
      localStorage.setItem('access_token', code);
      setAccessToken(code);
      return;
    }

    try {
      const parts = code.split('-');
      if (parts.length === 3 && parts[0] === 'emp') {
        const expiresAt = parseInt(parts[1]);
        if (isNaN(expiresAt) || Date.now() > expiresAt) {
          setLoginError('This passcode has expired.');
          return;
        }
      }
    } catch (err) {}

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${code}`
        }
      });

      if (!response.ok) {
        throw new Error('Invalid or expired passcode. Please try again.');
      }

      localStorage.setItem('access_token', code);
      setAccessToken(code);
    } catch(err) {
      setLoginError(err.message || 'Passcode verification failed.');
    }
  };

  const handleGenerateCode = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    setGeneratedCode('');

    if (!adminMasterKey.trim()) {
      setAdminError('Master Key is required.');
      return;
    }

    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminMasterKey.trim(), durationHours: parseFloat(adminDuration) })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setGeneratedCode(data.code);
      setAdminSuccess('Access code generated successfully!');
    } catch(err) {
      setAdminError(err.message || 'Failed to generate code.');
    }
  };

  // Library State
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [customFolders, setCustomFolders] = useState([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState([]);
  const [isStarterSectionOpen, setIsStarterSectionOpen] = useState(false);
  const [isUserSectionOpen, setIsUserSectionOpen] = useState(false);
  const [openFolders, setOpenFolders] = useState({}); // Tracking accordion states
  
  // Custom Modal State
  const [modalConfig, setModalConfig] = useState({ 
    isOpen: false, type: '', title: '', message: '', inputValue: '', 
    confirmText: '', cancelText: '', onConfirm: null, folder: '' 
  });

  const [copiedId, setCopiedId] = useState(null);
  
  // Load Modal (Variable Filler) State
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [loadModalData, setLoadModalData] = useState({ text: '', variables: [], values: {} });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const localData = localStorage.getItem('ai_prompt_library');
      if (localData) {
        const parsed = JSON.parse(localData);
        setSavedPrompts(parsed);
      }
      
      const localFolders = localStorage.getItem('ai_prompt_library_folders');
      if (localFolders) {
        setCustomFolders(JSON.parse(localFolders));
      }
    } catch (e) {
      console.warn("Failed to load prompt library from local storage", e);
    }
  }, []);

  const saveLibraryToLocal = (newLibrary) => {
    setSavedPrompts(newLibrary);
    try {
      localStorage.setItem('ai_prompt_library', JSON.stringify(newLibrary));
    } catch (e) {
      console.warn("Failed to save to local storage", e);
    }
  };

  const saveFoldersToLocal = (nextFolders) => {
    setCustomFolders(nextFolders);
    try {
      localStorage.setItem('ai_prompt_library_folders', JSON.stringify(nextFolders));
    } catch (e) {
      console.warn("Failed to save folders to local storage", e);
    }
  };

  const handleCreateFolder = () => {
    setModalConfig({
      isOpen: true,
      type: 'input',
      title: 'Create New Folder',
      message: 'Enter a name for your new folder:',
      inputValue: '',
      confirmText: 'Create Folder',
      cancelText: 'Cancel',
      onConfirm: (name) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        const existingFolders = [
          ...new Set(savedPrompts.map(p => p.folder || 'Misc')),
          ...customFolders,
          'Misc'
        ].map(f => f.toLowerCase());
        
        if (existingFolders.includes(trimmedName.toLowerCase())) {
          alert("A folder with this name already exists.");
          return;
        }
        saveFoldersToLocal([...customFolders, trimmedName]);
      }
    });
  };

  const handleRenameFolder = (oldName) => {
    if (oldName === 'Misc') return;
    setModalConfig({
      isOpen: true,
      type: 'input',
      title: 'Rename Folder',
      message: `Enter a new name for "${oldName}":`,
      inputValue: oldName,
      confirmText: 'Rename',
      cancelText: 'Cancel',
      onConfirm: (newName) => {
        const trimmedName = newName.trim();
        if (!trimmedName || trimmedName === oldName) return;
        
        const existingFolders = [
          ...new Set(savedPrompts.map(p => p.folder || 'Misc')),
          ...customFolders,
          'Misc'
        ].map(f => f.toLowerCase());
        
        if (existingFolders.includes(trimmedName.toLowerCase())) {
          alert("A folder with this name already exists.");
          return;
        }
        
        const nextCustomFolders = customFolders.map(f => f === oldName ? trimmedName : f);
        saveFoldersToLocal(nextCustomFolders);
        const nextPrompts = savedPrompts.map(p => 
          (p.folder || 'Misc') === oldName ? { ...p, folder: trimmedName } : p
        );
        saveLibraryToLocal(nextPrompts);
      }
    });
  };

  const handleDeleteFolder = (folderName) => {
    if (folderName === 'Misc') return;
    const promptsInFolder = savedPrompts.filter(p => (p.folder || 'Misc') === folderName);
    
    if (promptsInFolder.length === 0) {
      setModalConfig({
        isOpen: true,
        type: 'confirm',
        title: 'Delete Folder',
        message: `Are you sure you want to delete the empty folder "${folderName}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: () => {
          saveFoldersToLocal(customFolders.filter(f => f !== folderName));
        }
      });
      return;
    }

    setModalConfig({
      isOpen: true,
      type: 'choice',
      title: 'Delete Folder',
      message: `Delete folder "${folderName}"? There are ${promptsInFolder.length} prompts inside. What should happen to them?`,
      options: [
        { label: 'Move to Misc', value: '1', class: 'bg-blue-600 hover:bg-blue-500' },
        { label: 'Delete Everything', value: '2', class: 'bg-red-600 hover:bg-red-500' }
      ],
      cancelText: 'Cancel',
      onConfirm: (choice) => {
        if (choice === '1') {
          const nextPrompts = savedPrompts.map(p => 
            (p.folder || 'Misc') === folderName ? { ...p, folder: 'Misc' } : p
          );
          saveLibraryToLocal(nextPrompts);
        } else if (choice === '2') {
          const nextPrompts = savedPrompts.filter(p => (p.folder || 'Misc') !== folderName);
          saveLibraryToLocal(nextPrompts);
        }
        saveFoldersToLocal(customFolders.filter(f => f !== folderName));
      }
    });
  };

  const handleMovePrompt = (promptId, currentFolder) => {
    const existingFolders = [
      ...new Set(savedPrompts.map(p => p.folder || 'Misc')),
      ...customFolders,
      'Misc'
    ].sort();
    
    setModalConfig({
      isOpen: true,
      type: 'input',
      title: 'Move Prompt',
      message: `Current Folder: ${currentFolder}. Type an existing folder name or a new one:`,
      inputValue: '',
      confirmText: 'Move',
      cancelText: 'Cancel',
      onConfirm: (newFolder) => {
        const trimmedFolder = newFolder.trim();
        if (!trimmedFolder || trimmedFolder === currentFolder) return;
        
        const isNew = !existingFolders.map(f => f.toLowerCase()).includes(trimmedFolder.toLowerCase());
        const finalFolderName = existingFolders.find(f => f.toLowerCase() === trimmedFolder.toLowerCase()) || trimmedFolder;

        if (isNew) {
          saveFoldersToLocal([...customFolders, trimmedFolder]);
        }

        const nextPrompts = savedPrompts.map(p => 
          p.id === promptId ? { ...p, folder: finalFolderName } : p
        );
        saveLibraryToLocal(nextPrompts);
      }
    });
  };

  const handleBulkMove = () => {
    if (selectedPromptIds.length === 0) return;
    
    const existingFolders = [
      ...new Set(savedPrompts.map(p => p.folder || 'Misc')),
      ...customFolders,
      'Misc'
    ].sort();
    
    setModalConfig({
      isOpen: true,
      type: 'input',
      title: 'Bulk Move',
      message: `Move ${selectedPromptIds.length} prompts to which folder?`,
      inputValue: '',
      confirmText: 'Move All',
      cancelText: 'Cancel',
      onConfirm: (newFolder) => {
        const trimmedFolder = newFolder.trim();
        if (!trimmedFolder) return;
        
        const isNew = !existingFolders.map(f => f.toLowerCase()).includes(trimmedFolder.toLowerCase());
        const finalFolderName = existingFolders.find(f => f.toLowerCase() === trimmedFolder.toLowerCase()) || trimmedFolder;

        if (isNew) {
          saveFoldersToLocal([...customFolders, trimmedFolder]);
        }

        const nextPrompts = savedPrompts.map(p => 
          selectedPromptIds.includes(p.id) ? { ...p, folder: finalFolderName } : p
        );
        saveLibraryToLocal(nextPrompts);
        setSelectedPromptIds([]);
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedPromptIds.length === 0) return;
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Delete Selected',
      message: `Are you sure you want to delete ${selectedPromptIds.length} selected prompts? This cannot be undone.`,
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      onConfirm: () => {
        const nextPrompts = savedPrompts.filter(p => !selectedPromptIds.includes(p.id));
        saveLibraryToLocal(nextPrompts);
        setSelectedPromptIds([]);
      }
    });
  };

  const toggleStarterSection = () => {
    setIsStarterSectionOpen(prev => {
      const next = !prev;
      if (next) setIsUserSectionOpen(false);
      return next;
    });
  };

  const toggleUserSection = () => {
    setIsUserSectionOpen(prev => {
      const next = !prev;
      if (next) setIsStarterSectionOpen(false);
      return next;
    });
  };

  // Phase 1: Original State
  const [inputs, setInputs] = useState({ prompt: '', output: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOriginalLocked, setIsOriginalLocked] = useState(true);
  
  const [scores, setScores] = useState({
    instructionFollowing: null, completeness: null, accuracy: null,
    clarity: null, tone: null, usefulness: null,
  });
  
  const [promptQualityScores, setPromptQualityScores] = useState({
    task: null, context: null, audience: null, promptTone: null, format: null, constraints: null, successCriteria: null
  });

  const [notes, setNotes] = useState({});
  const [diagnosis, setDiagnosis] = useState({ type: 'None', issues: '', fix: '' });
  
  // Phase 2: Optimization State
  const [clarifyingQAs, setClarifyingQAs] = useState([]);
  const [questionsStatus, setQuestionsStatus] = useState('idle');
  const [validationError, setValidationError] = useState('');
  const [placeholderStrategy, setPlaceholderStrategy] = useState('provide'); 
  const [selectedTone, setSelectedTone] = useState("Auto-detect tone from prompt");
  
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [optimizedOutput, setOptimizedOutput] = useState('');
  const [isGeneratingOptimized, setIsGeneratingOptimized] = useState(false);
  const [isOptimizedLocked, setIsOptimizedLocked] = useState(true);
  
  const [optimizedScores, setOptimizedScores] = useState({
    instructionFollowing: null, completeness: null, accuracy: null,
    clarity: null, tone: null, usefulness: null,
  });
  const [optimizedNotes, setOptimizedNotes] = useState({});
  const [optimizedDiagnosis, setOptimizedDiagnosis] = useState({ type: 'None', issues: '', fix: '', summary: '' });
  
  const [optimizedPromptQualityScores, setOptimizedPromptQualityScores] = useState({
    task: null, context: null, audience: null, promptTone: null, format: null, constraints: null, successCriteria: null
  });

  const [questionTimeoutMsg, setQuestionTimeoutMsg] = useState('');

  // Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ title: '', folder: '', tags: '', notes: '', source: 'optimized' });

  // Optimization Preferences State
  const prefLabels = {
    human: "Make output sound more human",
    noGeneric: "Avoid Generic AI Patterns",
    noCliches: "Avoid clichés / predictable wording",
    preserveVoice: "Preserve user's original voice",
    natural: "Prefer natural conversational wording",
    noJargon: "Avoid corporate jargon",
    spartan: "Use concise Spartan tone",
    under300: "Keep optimized prompt under 300 tokens",
    clearFormat: "Add clear output format",
    safetyGuardrails: "Add safety/accuracy guardrails"
  };

  const prefDescriptions = {
    noGeneric: "Reduce reliance on common AI clichés, overused examples, and first-association outputs."
  };

  const [presets, setPresets] = useState({
    humanNatural: true,
    clearConcise: false,
    preserveVoice: true
  });

  const [advPrefs, setAdvPrefs] = useState({
    human: true, noGeneric: true, noCliches: false, preserveVoice: true, natural: true,
    noJargon: false, spartan: false, under300: false, clearFormat: false, safetyGuardrails: false
  });

  const [isAdvOpen, setIsAdvOpen] = useState(false);

  // Constraint Builder State
  const [isConstraintBuilderOpen, setIsConstraintBuilderOpen] = useState(false);
  const [suggestedConstraints, setSuggestedConstraints] = useState([]);
  const [selectedConstraints, setSelectedConstraints] = useState([]);
  const [customConstraints, setCustomConstraints] = useState('');
  const [constraintsStatus, setConstraintsStatus] = useState('idle');

  const handlePresetToggle = (preset) => {
    const newState = !presets[preset];
    setPresets(prev => ({ ...prev, [preset]: newState }));
    
    if (preset === 'humanNatural') {
      setAdvPrefs(prev => ({ ...prev, human: newState, noGeneric: newState, noCliches: newState, natural: newState }));
    } else if (preset === 'clearConcise') {
      setAdvPrefs(prev => ({ ...prev, spartan: newState, under300: newState, clearFormat: newState }));
    } else if (preset === 'preserveVoice') {
      setAdvPrefs(prev => ({ ...prev, preserveVoice: newState, noJargon: newState }));
    }
  };

  const handleOpenConstraintBuilder = async () => {
    const nextState = !isConstraintBuilderOpen;
    setIsConstraintBuilderOpen(nextState);
    
    if (nextState && constraintsStatus === 'idle' && inputs.prompt) {
      setConstraintsStatus('generating');
      try {
        const prompt = `Review this QA evaluation to generate prompt-specific constraints.
          Original Prompt: ${inputs.prompt}
          Failure Type: ${diagnosis.type}
          Issues: ${diagnosis.issues}
          Score: ${totalScore}/12
          Generate 4 to 6 highly specific, actionable constraints (rules) to add to the optimized prompt to fix the flaws.
          Keep them short (under 8 words). Examples: "Avoid overused puns", "Keep tone entry-level", "Include a clear CTA", "Do not use placeholders".
          Return ONLY an array of strings.`;
          
        const constraintsArray = await callGeminiAPI(prompt, true, { type: "ARRAY", items: { type: "STRING" } });
        if (Array.isArray(constraintsArray) && constraintsArray.length > 0) {
          setSuggestedConstraints(constraintsArray);
        } else { throw new Error("Invalid format"); }
      } catch (error) { 
        setSuggestedConstraints([
          "Avoid unsupported claims",
          "Keep under specified word count",
          "Include a clear CTA",
          "Do not use placeholders unless allowed"
        ]);
      } finally { 
        setConstraintsStatus('generated');
      }
    }
  };

  const toggleConstraint = (constraint) => {
    setSelectedConstraints(prev => 
      prev.includes(constraint) 
        ? prev.filter(c => c !== constraint) 
        : [...prev, constraint]
    );
  };

  const [isInitialCopied, setIsInitialCopied] = useState(false);
  const [isFullCopied, setIsFullCopied] = useState(false);

  const totalScore = useMemo(() => Object.values(scores).reduce((acc, curr) => acc + (curr || 0), 0), [scores]);
  const totalOptimizedScore = useMemo(() => Object.values(optimizedScores).reduce((acc, curr) => acc + (curr || 0), 0), [optimizedScores]);
  const totalPromptQuality = useMemo(() => Object.values(promptQualityScores).reduce((acc, curr) => acc + (curr || 0), 0), [promptQualityScores]);
  const totalOptimizedPromptQuality = useMemo(() => Object.values(optimizedPromptQualityScores).reduce((acc, curr) => acc + (curr || 0), 0), [optimizedPromptQualityScores]);

  const getRatingLabel = (score, scoreObj) => {
    if (Object.values(scoreObj).some(s => s === null)) return 'Pending';
    if (score === 12) return 'Excellent';
    if (score >= 10) return 'Strong';
    if (score >= 7) return 'Good';
    if (score >= 4) return 'Needs Work';
    return 'Poor';
  };

  // Color Coding Helpers
  const getOutputBadgeClasses = (score, scoreObj) => {
    if (Object.values(scoreObj).some(s => s === null)) return 'bg-slate-800 text-slate-400 border-slate-700';
    if (score === 12) return 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50';
    if (score >= 10) return 'bg-teal-900/30 text-teal-400 border-teal-800/50'; // Strong
    if (score >= 7) return 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50';
    if (score >= 4) return 'bg-orange-900/30 text-orange-400 border-orange-800/50';
    return 'bg-red-900/30 text-red-400 border-red-800/50';
  };

  const getOutputTextClasses = (score, scoreObj) => {
    if (Object.values(scoreObj).some(s => s === null)) return 'text-slate-500';
    if (score === 12) return 'text-emerald-400';
    if (score >= 10) return 'text-teal-400';
    if (score >= 7) return 'text-yellow-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getPromptBadgeClasses = (score) => {
    if (score <= 2) return 'bg-red-900/30 text-red-400 border-red-800/50'; // Low
    if (score <= 5) return 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'; // Medium
    return 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'; // High
  };

  const getPromptTextClasses = (score) => {
    if (score <= 2) return 'text-red-400';
    if (score <= 5) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getImprovementTextClasses = (change) => {
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  const promptQualityLabel = totalPromptQuality <= 2 ? 'Low' : totalPromptQuality <= 5 ? 'Medium' : 'High';
  const hasCriticalFailure = Object.values(scores).some(s => s === 0) || scores.usefulness === 1 || (totalScore <= 6 && totalScore > 0);

  const recommendationData = useMemo(() => {
    if (Object.values(scores).some(s => s === null)) return null;
    
    const hasQuestions = clarifyingQAs.length > 0;
    const needsCompletion = scores.completeness <= 1 || scores.accuracy <= 1 || scores.usefulness <= 1;

    if (totalScore < 8 || (hasQuestions && needsCompletion)) {
      return { status: "Optimization Recommended", potential: "High", reason: "The output contains significant issues or missing details that must be corrected." };
    } else if (totalScore >= 8 && totalScore < 10) {
      return { status: "Optimization Suggested", potential: "Medium", reason: "The output is usable but can likely be improved through clarification and optimization." };
    } else if (hasQuestions) {
      return { status: "Optional Optimization Available", potential: "Medium", reason: "The output is strong, but adding missing operational details (like timeframes, policies, or specific facts) would make it more useful and deployment-ready." };
    } else if (totalScore >= 10 && totalPromptQuality <= 5) {
      return { status: "Optional Optimization Available", potential: "High", reason: "The output is strong, but the prompt lacks structure, context, or specific details. Optimization may improve consistency, targeting, and repeatability." };
    } else {
      return { status: "Optimization Not Necessary", potential: "Low", reason: "The prompt is already well-structured and the output is strong. Additional optimization is unlikely to provide meaningful improvement." };
    }
  }, [totalScore, totalPromptQuality, scores, clarifyingQAs.length]);

  const handleTestAndScorePrompt = async () => {
    if (!inputs.prompt.trim()) return;
    setIsGenerating(true);
    setIsOriginalLocked(true);
    
    try {
      const responseText = await callGeminiAPI(inputs.prompt, false);
      const currentOutput = responseText;
      setInputs(prev => ({ ...prev, output: currentOutput }));
      
      const autoScorePrompt = `
        You are a strict QA analyst evaluating an AI's output AND evaluating the structural quality of the prompt that generated it.
        
        PART 1: AI OUTPUT QA (Score 0-2)
        [CRITICAL SEPARATION RULE]: Evaluate the AI Response strictly on whether it satisfied the Original Prompt AS WRITTEN.
        If the Original Prompt is very simple (e.g., 'tell me a joke') and the AI output satisfies it, Output QA MUST be 12/12.
        DO NOT lower Output QA because the prompt lacks audience, tone, format, or constraints. Those omissions MUST ONLY lower the PROMPT QUALITY scores (Part 2). Output QA measures AI execution. Prompt Quality measures human instructions. KEEP THEM STRICTLY SEPARATE.

        Provide a 1-sentence justification note for EACH score.
        - Instruction Following: 2=Perfect, 1=Missed minor constraints, 0=Violated negative constraints or contradictions.
        - Completeness: 2=Fully self-contained, 1=Relies on placeholders, 0=Missing core info.
        - Accuracy: 2=Accurate/grounded, 1=Minor assumptions, 0=Hallucinates unverified skills, data, or facts not in prompt.
        - Clarity: 2=Crystal clear, 1=Readable but generic, 0=Confusing.
        - Tone: 2=Perfect fit, 1=Generic, 0=Contradicts requested persona.
        - Usefulness: 2=Ready to use, 1=Requires manual edits, 0=Unusable.

        CRITICAL RULES:
        1. GROUNDING & HALLUCINATION: If AI claims seniority, years of experience, complex threat management, enterprise environments, Python, SQL, leadership, or production systems WITHOUT concrete evidence provided in the prompt, Accuracy MUST be 0.
        2. KEY PRINCIPLE: A requested claim does NOT equal a verified claim. If prompt says "claim 5 years experience" but gives no background, it is a hallucination.
        3. POSITIONING CONTRADICTION: If a prompt asks for "entry-level" PLUS "senior expert", and the AI inflates the candidate, Accuracy=0, Tone=0, InstructionFollowing=0.
        4. MARKETING CLAIMS: Claims like "best", "limited time", "exclusive", "easy signup" WITHOUT factual evidence in prompt = Accuracy 0.
        5. CONTRADICTION PENALTY: Asking for claims + saying "don't make anything up" = Accuracy 0.
        6. MISSING CTA: If prompt asks for ready-to-use copy but details (links, dates) are missing, Completeness=0.
        7. PLACEHOLDERS: If output has brackets like [Date], Completeness=1 or 0 and Usefulness=1 or 0.
        8. CAREER/RESUME GROUNDING: For resume, LinkedIn, career, or job-search prompts, if the AI inflates entry-level skills into professional operations (e.g., "studying" to "certified", "fundamentals" to "administration", "labs" to "production"), reduce Accuracy / Grounding by 1 or more depending on severity.

        PART 2: PROMPT QUALITY (Score 0 or 1)
        Score 1 if present, 0 if absent:
        - task: Is the core task explicitly clear?
        - context: Is background context provided? (Score 0 if essential facts like dates, reasons, or policies are missing).
        - audience: Is the target audience defined?
        - promptTone: Is the tone/style defined?
        - format: Is the output format defined?
        - constraints: Are limits/rules defined? (Score 0 if missing constraints force the AI to guess or hallucinate).
        - successCriteria: Is it clear what makes this successful? (Score 0 if missing details prevent a ready-to-use output).

        CRITICAL RULE FOR PROMPT QUALITY: If the prompt asks for a "ready to send", "ready to post", or "final copy" output but lacks key operational details (e.g., delivery timeframe, delay reason, refund policy, support contact), you MUST score Context=0, Constraints=0, or SuccessCriteria=0 as appropriate. A prompt can be well-structured but still incomplete for deployment.

        AUTO-SUGGEST DIAGNOSIS:
        Return a 'suggestedFailureType' (None, Hallucination / Safety Risk, Wrong Tone, Weak Prompt Input, Incomplete Output, Overcomplication). Provide brief 'suggestedIssues' and 'suggestedFix'.

        Prompt: ${inputs.prompt}
        Response: ${currentOutput}
      `;
      
      const scoresObj = await callGeminiAPI(autoScorePrompt, true);
      
      setScores({
        instructionFollowing: safeInt(scoresObj?.instructionFollowing, 2, null), 
        completeness: safeInt(scoresObj?.completeness, 2, null),
        accuracy: safeInt(scoresObj?.accuracy, 2, null), 
        clarity: safeInt(scoresObj?.clarity, 2, null), 
        tone: safeInt(scoresObj?.tone, 2, null), 
        usefulness: safeInt(scoresObj?.usefulness, 2, null),
      });
      setPromptQualityScores({
        task: safeInt(scoresObj?.task, 1, 0), 
        context: safeInt(scoresObj?.context, 1, 0), 
        audience: safeInt(scoresObj?.audience, 1, 0), 
        promptTone: safeInt(scoresObj?.promptTone, 1, 0), 
        format: safeInt(scoresObj?.format, 1, 0), 
        constraints: safeInt(scoresObj?.constraints, 1, 0), 
        successCriteria: safeInt(scoresObj?.successCriteria, 1, 0)
      });
      setNotes({
        instructionFollowing: safeStr(scoresObj?.instructionFollowingNote), 
        completeness: safeStr(scoresObj?.completenessNote),
        accuracy: safeStr(scoresObj?.accuracyNote), 
        clarity: safeStr(scoresObj?.clarityNote), 
        tone: safeStr(scoresObj?.toneNote), 
        usefulness: safeStr(scoresObj?.usefulnessNote),
      });
      
      const tScore = safeInt(scoresObj?.instructionFollowing, 2, 0) + safeInt(scoresObj?.completeness, 2, 0) + safeInt(scoresObj?.accuracy, 2, 0) + safeInt(scoresObj?.clarity, 2, 0) + safeInt(scoresObj?.tone, 2, 0) + safeInt(scoresObj?.usefulness, 2, 0);
      const pScore = safeInt(scoresObj?.task, 1, 0) + safeInt(scoresObj?.context, 1, 0) + safeInt(scoresObj?.audience, 1, 0) + safeInt(scoresObj?.promptTone, 1, 0) + safeInt(scoresObj?.format, 1, 0) + safeInt(scoresObj?.constraints, 1, 0) + safeInt(scoresObj?.successCriteria, 1, 0);
      
      let autoFailType = scoresObj?.suggestedFailureType || 'None';
      if (tScore <= 6 && autoFailType === 'None') autoFailType = 'Weak Prompt Input';
      if ((safeInt(scoresObj?.accuracy, 2, 0) === 0 || safeInt(scoresObj?.completeness, 2, 0) === 0) && autoFailType === 'None') autoFailType = 'Hallucination / Safety Risk';
      
      setDiagnosis({ type: autoFailType, issues: safeStr(scoresObj?.suggestedIssues), fix: safeStr(scoresObj?.suggestedFix) });
    } catch (error) {
      console.error("Dashboard Error:", error);
      let displayError = "Unknown error occurred";
      if (error instanceof Error) displayError = error.message;
      else if (typeof error === 'string') displayError = error;
      else displayError = JSON.stringify(error);
      
      setInputs(prev => ({ ...prev, output: `[Error]: ${displayError}` }));
    } finally { 
      setIsGenerating(false); 
    }
  };

  useEffect(() => {
    const isScored = Object.values(scores).every(s => s !== null);
    if (isScored && questionsStatus === 'idle') {
      const needsQuestions = totalScore <= 7 || 
        ['Weak Prompt Input', 'Incomplete Output', 'Hallucination / Safety Risk'].includes(diagnosis.type) ||
        scores.completeness <= 1 || scores.accuracy <= 1 || scores.usefulness <= 1 ||
        (totalScore >= 10 && totalPromptQuality < 5);

      if (needsQuestions) {
        generateQuestionsForScore(scores, diagnosis);
      } else {
        setQuestionsStatus('not_needed');
      }
    }
  }, [scores, diagnosis, questionsStatus, totalScore, totalPromptQuality]);

  const generateQuestionsForScore = async (currentScores, currentDiagnosis) => {
    setQuestionsStatus('generating');
    setQuestionTimeoutMsg('');

    try {
      const missingDetails = extractMissingDetails(inputs.prompt);
      const riskyClaims = extractRiskyClaims(inputs.prompt);
      const deterministicQuestions = buildSpecificQuestions(missingDetails, riskyClaims);

      if (deterministicQuestions.length > 0) {
        setClarifyingQAs(deterministicQuestions.map(q => ({ question: q, answer: '' })));
        setQuestionsStatus('generated');
        return;
      }

      const questionPrompt = `You are a Prompt Coach. Extract missing details and risky claims from the original prompt and QA evaluation, then generate clarifying questions.
      
      Original Prompt:
      "${inputs.prompt}"
      
      QA Diagnosis: ${currentDiagnosis.type} - ${currentDiagnosis.issues}
      QA Notes: Completeness (${notes.completeness}), Accuracy (${notes.accuracy})
      
      RULES:
      1. EXTRACT MISSING DETAILS: Scan the prompt and QA notes for phrases like "we don't have", "I don't have", "missing", "not finalized", "unknown", "not provided", "TBD". Extract the exact missing items.
      2. EXTRACT RISKY CLAIMS: Scan the prompt and QA notes for words like "best", "trusted", "guaranteed", "expert", "bank-level", "instant results", "fast results", "available now", "limited-time", "limited spots", "proven", "affordable", "certified", "secure", "premium". Extract the exact claims.
      3. GENERATE QUESTIONS: Generate 4-6 specific clarifying questions based ONLY on the extracted details and claims.
      - Each question must ask for a concrete missing item or decision.
      - If a claim lacks evidence, ask whether to provide proof, soften it, or remove it (e.g., "What verified security details support 'bank-level security'?").
      - Group related items naturally.
      - NEVER use broad category questions if specific details exist.
      - If NO specific missing details or risky claims are found, return an empty array for questions.`;

      const schema = {
        type: "OBJECT",
        properties: {
          extractedMissingDetails: { type: "ARRAY", items: { type: "STRING" } },
          extractedRiskyClaims: { type: "ARRAY", items: { type: "STRING" } },
          questions: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["extractedMissingDetails", "extractedRiskyClaims", "questions"]
      };

      const fetchPromise = callGeminiAPI(questionPrompt, true, schema);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 5000));

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      const hasSpecificDetails = (response?.extractedMissingDetails?.length > 0) || (response?.extractedRiskyClaims?.length > 0);

      if (hasSpecificDetails && Array.isArray(response?.questions) && response.questions.length > 0) {
        setClarifyingQAs(response.questions.map(q => ({ question: q, answer: '' })));
      } else {
        // Fallback if empty array returned or no specific details extracted
        setClarifyingQAs([
          { question: "What exact names, dates, links, or locations need to be included in this output?", answer: '' },
          { question: "What specific evidence supports the claims made in your prompt?", answer: '' },
          { question: "Are there any strict limits (e.g., exact word count, mandatory formatting) to enforce?", answer: '' }
        ]);
      }
    } catch (error) { 
      console.error("Question Generation Error:", error);
      if (error.message === "TIMEOUT") {
        setQuestionTimeoutMsg("Question generation is taking longer than expected. Use generic questions or try again.");
      }
      setClarifyingQAs([
        { question: "What exact names, dates, links, or locations need to be included in this output?", answer: '' },
        { question: "What specific evidence supports the claims made in your prompt?", answer: '' },
        { question: "Are there any strict limits (e.g., exact word count, mandatory formatting) to enforce?", answer: '' }
      ]);
    } finally { 
      setQuestionsStatus('generated');
    }
  };

  const handleOptimizeTestAndScore = async () => {
    let isValid = true;
    for (const qa of clarifyingQAs) {
      if (qa.answer.trim().length === 0) { isValid = false; break; }
    }
    if (!isValid && placeholderStrategy === 'provide') {
      setValidationError("Missing detail: Please fully answer all clarification questions, or change your privacy strategy below.");
      return;
    }
    setValidationError('');
    setIsGeneratingOptimized(true);
    setIsOptimizedLocked(true);
    
    try {
      const qnaContext = clarifyingQAs.map(qa => `Q: ${qa.question}\nA: ${qa.answer || 'Not provided'}`).join('\n');
      const placeholderInstruction = placeholderStrategy === 'placeholders' 
        ? "PLACEHOLDER RULE: The user has opted to use safe placeholders for missing or private information. Use strict brackets like [CLIENT NAME] or [DATE] where needed."
        : placeholderStrategy === 'remove'
        ? "PLACEHOLDER RULE: The user has opted to remove missing/private details. Do not use placeholders; simply write the prompt so it does not require those details."
        : "PLACEHOLDER RULE: NO PLACEHOLDERS ALLOWED. Ensure the prompt uses the specific details provided in the clarifications.";

      let toneInstruction = "";
      if (selectedTone !== "Auto-detect tone from prompt") {
        toneInstruction = `\n\nUSER-SELECTED TONE:\nEnsure the optimized prompt incorporates this tone guidance:\n- ${toneInstructions[selectedTone] || `Use a ${selectedTone.toLowerCase()} tone.`}`;
      }

      const activePrefLabels = Object.keys(advPrefs).filter(k => advPrefs[k]).map(k => prefLabels[k]);
      let prefInstruction = activePrefLabels.length > 0 
        ? `\n\nUSER OPTIMIZATION PREFERENCES:\nEnsure the optimized prompt incorporates these guidelines:\n- ${activePrefLabels.join('\n- ')}`
        : "";

      if (advPrefs.noGeneric) {
        prefInstruction += "\n\nANTI-CLICHÉ RULE: When multiple valid responses exist, prefer less obvious or overused associations. Avoid the most common AI-generated examples (first-association outputs) unless explicitly requested.";
      }

      const allConstraints = [...selectedConstraints, ...(customConstraints.trim() ? [customConstraints.trim()] : [])];
      let constraintInstruction = "";
      if (allConstraints.length > 0) {
        constraintInstruction = `\n\nUSER-APPLIED CONSTRAINTS:\nEnforce the following rules strictly in the prompt structure:\n- ${allConstraints.join('\n- ')}`;
      }

      const promptRewriter = `You are an expert Prompt Engineer. Rewrite this prompt into a highly optimized, robust prompt using the provided structure.
      Original Prompt: ${inputs.prompt}
      User Clarifications: ${qnaContext}
      
      CRITICAL RULES:
      1. AGGRESSIVELY FIX ISSUES: Remove unsupported claims.
      2. TARGET SCORE 12/12.
      3. ${placeholderInstruction}${toneInstruction}${prefInstruction}${constraintInstruction}
      4. CAREER/RESUME SAFEGUARD: If this is a resume, LinkedIn, career, or job-search prompt, DO NOT inflate or upgrade user-provided skills. Retain terms like "fundamentals", "foundational knowledge", "hands-on labs", "training experience", "currently studying", "entry-level", "developing skills", "exposure to", "familiar with". AVOID terms like "administration", "managed", "led", "owned", "deployed", "enterprise", "production", "years of experience", "expert", "senior", "certified" unless explicitly provided.

      Output strictly in this text format:
      System:\n[Define the AI role]\n\nContext:\n[Background]\n\nInstruction:\n[Exact task]\n\nFormat:\n[Output structure]\n\nRules:\n[Restrictions, tone]\n\nExamples:\n[Optional]`;
      
      const newOptPrompt = await callGeminiAPI(promptRewriter, false);
      setOptimizedPrompt(newOptPrompt);
      
      if (newOptPrompt && !newOptPrompt.includes("[Error]")) {
          const newOptOutput = await callGeminiAPI(newOptPrompt, false);
          setOptimizedOutput(newOptOutput);
          
          const optScorePrompt = `
            You are a strict QA analyst evaluating an AI's output AND evaluating the structural quality of the prompt that generated it.
            
            NOTE: If placeholderStrategy is "placeholders", do NOT penalize Completeness or Usefulness for using bracketed placeholders.
            Current Strategy: ${placeholderStrategy}.

            PART 1: AI OUTPUT QA (Score 0-2)
            [CRITICAL SEPARATION RULE]: Evaluate the AI Response strictly on whether it satisfied the Original Prompt AS WRITTEN.
            If the Original Prompt is very simple (e.g., 'tell me a joke') and the AI output satisfies it, Output QA MUST be 12/12.
            DO NOT lower Output QA because the prompt lacks audience, tone, format, or constraints. Those omissions MUST ONLY lower the PROMPT QUALITY scores (Part 2). Output QA measures AI execution. Prompt Quality measures human instructions. KEEP THEM STRICTLY SEPARATE.

            Provide a 1-sentence justification note for EACH score.
            - Instruction Following: 2=Perfect, 1=Missed minor constraints, 0=Violated negative constraints or contradictions.
            - Completeness: 2=Fully self-contained, 1=Relies on placeholders, 0=Missing core info.
            - Accuracy: 2=Accurate/grounded, 1=Minor assumptions, 0=Hallucinates unverified skills, data, or facts not in prompt.
            - Clarity: 2=Crystal clear, 1=Readable but generic, 0=Confusing.
            - Tone: 2=Perfect fit, 1=Generic, 0=Contradicts requested persona.
            - Usefulness: 2=Ready to use, 1=Requires manual edits, 0=Unusable.

            CRITICAL RULES:
            1. GROUNDING & HALLUCINATION: If AI claims seniority, years of experience, complex threat management, enterprise environments, Python, SQL, leadership, or production systems WITHOUT concrete evidence provided in the prompt, Accuracy MUST be 0.
            2. KEY PRINCIPLE: A requested claim does NOT equal a verified claim. If prompt says "claim 5 years experience" but gives no background, it is a hallucination.
            3. POSITIONING CONTRADICTION: If a prompt asks for "entry-level" PLUS "senior expert", and the AI inflates the candidate, Accuracy=0, Tone=0, InstructionFollowing=0.
            4. MARKETING CLAIMS: Claims like "best", "limited time", "exclusive", "easy signup" WITHOUT factual evidence in prompt = Accuracy 0.
            5. CONTRADICTION PENALTY: Asking for claims + saying "don't make anything up" = Accuracy 0.
            6. MISSING CTA: If prompt asks for ready-to-use copy but details (links, dates) are missing, Completeness=0.
            7. PLACEHOLDERS: If output has brackets like [Date], Completeness=1 or 0 and Usefulness=1 or 0.
            8. CAREER/RESUME GROUNDING: For resume, LinkedIn, career, or job-search prompts, if the AI inflates entry-level skills into professional operations (e.g., "studying" to "certified", "fundamentals" to "administration", "labs" to "production"), reduce Accuracy / Grounding by 1 or more depending on severity.

            PART 2: PROMPT QUALITY (Score 0 or 1)
            Score 1 if present, 0 if absent:
            - task: Is the core task explicitly clear?
            - context: Is background context provided? (Score 0 if essential facts like dates, reasons, or policies are missing).
            - audience: Is the target audience defined?
            - promptTone: Is the tone/style defined?
            - format: Is the output format defined?
            - constraints: Are limits/rules defined? (Score 0 if missing constraints force the AI to guess or hallucinate).
            - successCriteria: Is it clear what makes this successful? (Score 0 if missing details prevent a ready-to-use output).

            CRITICAL RULE FOR PROMPT QUALITY: If the prompt asks for a "ready to send", "ready to post", or "final copy" output but lacks key operational details (e.g., delivery timeframe, delay reason, refund policy, support contact), you MUST score Context=0, Constraints=0, or SuccessCriteria=0 as appropriate. A prompt can be well-structured but still incomplete for deployment.

            AUTO-SUGGEST DIAGNOSIS:
            Return a 'suggestedFailureType' (None, Hallucination / Safety Risk, Wrong Tone, Weak Prompt Input, Incomplete Output, Overcomplication). Provide brief 'suggestedIssues' and 'suggestedFix'.

            Prompt: ${newOptPrompt}
            Response: ${newOptOutput}
          `;
          const scoresObj = await callGeminiAPI(optScorePrompt, true);
          
          setOptimizedScores({
            instructionFollowing: safeInt(scoresObj?.instructionFollowing, 2, null), 
            completeness: safeInt(scoresObj?.completeness, 2, null),
            accuracy: safeInt(scoresObj?.accuracy, 2, null), 
            clarity: safeInt(scoresObj?.clarity, 2, null), 
            tone: safeInt(scoresObj?.tone, 2, null), 
            usefulness: safeInt(scoresObj?.usefulness, 2, null),
          });
          
          const tScore = safeInt(scoresObj?.instructionFollowing, 2, 0) + safeInt(scoresObj?.completeness, 2, 0) + safeInt(scoresObj?.accuracy, 2, 0) + safeInt(scoresObj?.clarity, 2, 0) + safeInt(scoresObj?.tone, 2, 0) + safeInt(scoresObj?.usefulness, 2, 0);
          const pScore = safeInt(scoresObj?.task, 1, 0) + safeInt(scoresObj?.context, 1, 0) + safeInt(scoresObj?.audience, 1, 0) + safeInt(scoresObj?.promptTone, 1, 0) + safeInt(scoresObj?.format, 1, 0) + safeInt(scoresObj?.constraints, 1, 0) + safeInt(scoresObj?.successCriteria, 1, 0);
          
          let autoFailType = scoresObj?.suggestedFailureType || 'None';
          if (tScore <= 6 && autoFailType === 'None') autoFailType = 'Weak Prompt Input';
          if ((safeInt(scoresObj?.accuracy, 2, 0) === 0 || safeInt(scoresObj?.completeness, 2, 0) === 0) && autoFailType === 'None') autoFailType = 'Hallucination / Safety Risk';
          
          setOptimizedDiagnosis({ 
            type: autoFailType, 
            issues: safeStr(scoresObj?.suggestedIssues), 
            fix: safeStr(scoresObj?.suggestedFix), 
            summary: 'Optimization complete.' 
          });
          
          setOptimizedPromptQualityScores({
            task: safeInt(scoresObj?.task, 1, 0), 
            context: safeInt(scoresObj?.context, 1, 0), 
            audience: safeInt(scoresObj?.audience, 1, 0), 
            promptTone: safeInt(scoresObj?.promptTone, 1, 0), 
            format: safeInt(scoresObj?.format, 1, 0), 
            constraints: safeInt(scoresObj?.constraints, 1, 0), 
            successCriteria: safeInt(scoresObj?.successCriteria, 1, 0)
          });

          setOptimizedNotes({
            instructionFollowing: safeStr(scoresObj?.instructionFollowingNote), 
            completeness: safeStr(scoresObj?.completenessNote),
            accuracy: safeStr(scoresObj?.accuracyNote), 
            clarity: safeStr(scoresObj?.clarityNote), 
            tone: safeStr(scoresObj?.toneNote), 
            usefulness: safeStr(scoresObj?.usefulnessNote),
          });
      }
    } catch (error) { 
      setOptimizedPrompt("[Error]: Failed to complete optimization lifecycle.");
    } finally { 
      setIsGeneratingOptimized(false); 
      setIsOptimizedLocked(true);
    }
  };

  const handleCopyInitialReport = () => {
    const diagnosisTitle = (diagnosis.type === 'None' && totalPromptQuality <= 5) ? '[3] PROMPT QUALITY DIAGNOSIS' : '[3] FAILURE PATTERN DIAGNOSIS';
    const issuesLabel = (diagnosis.type === 'None' && totalPromptQuality <= 5) ? 'Prompt Quality Issue' : 'Issues Found';

    const reportText = `=== AI INITIAL QA REPORT ===\n\n[1] ORIGINAL BASELINE\nPrompt: ${inputs.prompt}\nAI Output: ${inputs.output}\n\n[2] QA SCORECARD\n- Instruction Following: ${scores.instructionFollowing ?? 'N/A'} | Note: ${notes.instructionFollowing || 'None'}\n- Completeness: ${scores.completeness ?? 'N/A'} | Note: ${notes.completeness || 'None'}\n- Accuracy / Risk: ${scores.accuracy ?? 'N/A'} | Note: ${notes.accuracy || 'None'}\n- Clarity / Structure: ${scores.clarity ?? 'N/A'} | Note: ${notes.clarity || 'None'}\n- Tone / Audience Fit: ${scores.tone ?? 'N/A'} | Note: ${notes.tone || 'None'}\n- Usefulness / Task Value: ${scores.usefulness ?? 'N/A'} | Note: ${notes.usefulness || 'None'}\n\n${diagnosisTitle}\nOutput Failure Type: ${diagnosis.type}\n${issuesLabel}: ${diagnosis.issues || 'None'}\nSuggested Fix: ${diagnosis.fix || 'None'}\n\n[4] FINAL EVALUATION\nOutput QA Score: ${totalScore}/12 (${getRatingLabel(totalScore, scores)})\nPrompt Quality Score: ${totalPromptQuality}/7 (${promptQualityLabel})\nRecommendation: ${recommendationData?.status}\nReason: ${recommendationData?.reason}\n============================`.trim();
    copyToClipboard(reportText, setIsInitialCopied);
  };

  const handleCopyFullReport = () => {
    const qnaText = clarifyingQAs.length > 0 ? clarifyingQAs.map((qa, i) => `Q${i+1}: ${qa.question}\nA: ${qa.answer || 'Not provided'}`).join('\n\n') : 'None generated.';
    const activePrefLabels = Object.keys(advPrefs).filter(k => advPrefs[k]).map(k => prefLabels[k]);
    const prefsList = [`Tone: ${selectedTone}`, ...activePrefLabels].join('\n- ');
    const appliedConstraintsText = [...selectedConstraints, ...(customConstraints.trim() ? [customConstraints.trim()] : [])].map(c => `- ${c}`).join('\n') || 'None applied';
    
    const origDiagnosisTitle = (diagnosis.type === 'None' && totalPromptQuality <= 5) ? '[3] PROMPT QUALITY DIAGNOSIS' : '[3] FAILURE PATTERN DIAGNOSIS';
    const origIssuesLabel = (diagnosis.type === 'None' && totalPromptQuality <= 5) ? 'Prompt Quality Issue' : 'Issues Found';

    const reportText = `=== AI FULL OPTIMIZATION LIFECYCLE REPORT ===

[1] ORIGINAL BASELINE
Prompt: ${inputs.prompt}
AI Output: ${inputs.output}

[2] ORIGINAL QA SCORECARD
Total Output Score: ${totalScore}/12 (${getRatingLabel(totalScore, scores)})
Prompt Quality: ${totalPromptQuality}/7 (${promptQualityLabel})
Output Failure Type: ${diagnosis.type}
${origIssuesLabel}: ${diagnosis.issues || 'None'}

[3] PROMPT OPTIMIZATION BUILDER
Clarifications:
${qnaText}

Privacy Strategy: ${placeholderStrategy}

Optimization Preferences Used:
- ${prefsList}

Additional Constraints Applied:
${appliedConstraintsText}

Optimized Prompt:
${optimizedPrompt}

[4] OPTIMIZED TEST RESULTS
Optimized Output: ${optimizedOutput}

[5] OPTIMIZED QA SCORECARD
Total Optimized Score: ${totalOptimizedScore}/12 (${getRatingLabel(totalOptimizedScore, optimizedScores)})
Optimized Prompt Quality: ${totalOptimizedPromptQuality}/7
Failure Type: ${optimizedDiagnosis.type}

[6] BEFORE/AFTER COMPARISON
Output Quality:
Original Output: ${totalScore}/12 — ${getRatingLabel(totalScore, scores)}
Optimized Output: ${hasOptimizedTest ? totalOptimizedScore : '--'}/12 — ${hasOptimizedTest ? getRatingLabel(totalOptimizedScore, optimizedScores) : 'Pending'}
Improvement: ${scoreImprovement > 0 ? '+' : ''}${hasOptimizedTest ? scoreImprovement : '--'}

Prompt Quality:
Original Prompt: ${totalPromptQuality}/7 — ${promptQualityLabel}
Optimized Prompt: ${hasOptimizedTest ? totalOptimizedPromptQuality : '--'}/7 — ${hasOptimizedTest ? (totalOptimizedPromptQuality <= 2 ? 'Low' : totalOptimizedPromptQuality <= 5 ? 'Medium' : 'High') : 'Pending'}
Improvement: ${promptQualityImprovement > 0 ? '+' : ''}${hasOptimizedTest ? promptQualityImprovement : '--'}

Final Evaluation:
Original Rating: ${getRatingLabel(totalScore, scores)}
Optimized Rating: ${hasOptimizedTest ? getRatingLabel(totalOptimizedScore, optimizedScores) : 'Pending'}
Final Result: ${optimizationResult}
Optimization Summary: ${optimizationSummary}
====================================`.trim();
    copyToClipboard(reportText, setIsFullCopied);
  };

  const copyToClipboard = (text, setCopiedState) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (e) {
      console.warn("Clipboard access denied.");
    }
    document.body.removeChild(textArea);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const criteria = [
    { id: 'instructionFollowing', label: 'Instruction Following' }, { id: 'completeness', label: 'Completeness' },
    { id: 'accuracy', label: 'Accuracy / Grounding / Risk' }, { id: 'clarity', label: 'Clarity / Structure' },
    { id: 'tone', label: 'Tone / Audience Fit' }, { id: 'usefulness', label: 'Usefulness / Task Value' },
  ];

  const scoreImprovement = totalOptimizedScore - totalScore;
  const promptQualityImprovement = totalOptimizedPromptQuality - totalPromptQuality;
  const isOriginalScored = Object.values(scores).every(s => s !== null);
  const hasOptimizedTest = optimizedOutput.trim().length > 0 && Object.values(optimizedScores).every(s => s !== null);
  
  let optimizationResult = 'Pending';
  let optimizationSummary = 'Awaiting optimization.';

  if (hasOptimizedTest) {
    if (scoreImprovement > 0 && promptQualityImprovement > 0) {
      optimizationResult = 'Improved';
    } else if (scoreImprovement < 0) {
      optimizationResult = 'Worse';
    } else {
      optimizationResult = 'No Change';
    }

    if (scoreImprovement > 0 && promptQualityImprovement > 0) {
      optimizationSummary = 'Output quality improved. Prompt quality also improved.';
    } else if (scoreImprovement === 0 && promptQualityImprovement > 0) {
      optimizationSummary = 'Prompt improved significantly. Output quality maintained.';
    } else if (scoreImprovement < 0 && promptQualityImprovement > 0) {
      optimizationSummary = 'Prompt improved, but output quality decreased. Review optimization settings.';
    } else if (scoreImprovement > 0) {
      optimizationSummary = 'Output improved significantly. Prompt quality unchanged.';
    } else if (scoreImprovement < 0) {
      optimizationSummary = 'Output quality decreased.';
    } else {
      optimizationSummary = 'No significant changes in output or prompt quality.';
    }
  }

  // --- LIBRARY & BACKUP FUNCTIONS ---
  const handleSaveToLibrary = () => {
    if (!saveForm.title || !saveForm.folder) return;
    
    const isOpt = saveForm.source === 'optimized' && hasOptimizedTest;
    const pType = isOpt ? (inputs.prompt && optimizedPrompt ? 'Full Set' : 'Optimized') : 'Original';
    
    const newPrompt = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      title: saveForm.title,
      folder: saveForm.folder,
      tags: saveForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      type: pType,
      outputQaScore: isOpt ? totalOptimizedScore : totalScore,
      promptQualityScore: isOpt ? totalOptimizedPromptQuality : totalPromptQuality,
      dateSaved: new Date().toISOString(),
      promptText: isOpt ? optimizedPrompt : inputs.prompt,
      notes: saveForm.notes
    };
    
    saveLibraryToLocal([...savedPrompts, newPrompt]);
    setIsSaveModalOpen(false);
    setSaveForm({ title: '', folder: '', tags: '', notes: '', source: 'optimized' });
    alert("Saved to Library!");
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedPrompts));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "prompt_library_backup.json");
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          saveLibraryToLocal(parsed);
          alert("Backup successfully restored!");
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        alert("Error parsing backup file.");
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadIntoDashboard = (promptText) => {
    // Detect variables like {{name}}
    const varRegex = /\{\{([^}]+)\}\}/g;
    const matches = [...promptText.matchAll(varRegex)];

    if (matches.length > 0) {
      const uniqueVars = [...new Set(matches.map(m => m[1]))];
      setLoadModalData({
        text: promptText,
        variables: uniqueVars,
        values: uniqueVars.reduce((acc, v) => ({ ...acc, [v]: '' }), {})
      });
      setIsLoadModalOpen(true);
    } else {
      executeLoad(promptText);
    }
  };

  const executeLoad = (text) => {
    setInputs({ prompt: text, output: '' });
    setOptimizedPrompt('');
    setOptimizedOutput('');
    setIsOriginalLocked(true);
    setIsOptimizedLocked(true);
    setScores({ instructionFollowing: null, completeness: null, accuracy: null, clarity: null, tone: null, usefulness: null });
    setOptimizedScores({ instructionFollowing: null, completeness: null, accuracy: null, clarity: null, tone: null, usefulness: null });
    setCurrentView('dashboard');
    setIsLoadModalOpen(false);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const handleExportPDF = (targetFolder = null, sourcePrompts = null) => {
    const isStringFolder = targetFolder && typeof targetFolder === 'string';
    const promptsToUse = sourcePrompts || savedPrompts;
    let folders = [...new Set(promptsToUse.map(p => p.folder || 'Misc'))].sort();
    
    if (isStringFolder) {
      folders = folders.filter(f => f === targetFolder);
    }
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isStringFolder ? `${targetFolder} - ` : ''}Prompt Library Export</title>
        <style>
          @page {
            margin: 20mm 15mm;
          }
          body { 
            font-family: 'Helvetica Neue', Arial, sans-serif; 
            color: #1e293b; 
            line-height: 1.5; 
            padding: 0; 
            margin: 0; 
            background: white; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .page-break { 
            page-break-before: always; 
            break-before: always; 
          }
          .cover { 
            height: 90vh; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            text-align: center; 
            page-break-after: always; 
            break-after: always; 
          }
          .title { font-size: 3rem; margin-bottom: 10px; color: #0f172a; }
          .subtitle { font-size: 1.5rem; color: #64748b; }
          .toc { padding: 20px 0; }
          .toc h2 { border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; }
          .toc-item { font-size: 1.2rem; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; }
          .folder-cover { 
            height: 90vh; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            padding: 40px; 
            background: #f8fafc; 
            page-break-after: always; 
            break-after: always; 
            page-break-inside: avoid; 
            break-inside: avoid; 
          }
          .folder-title { font-size: 2.5rem; color: #0f172a; margin-bottom: 20px; text-align: center; }
          .stats-grid { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 30px; justify-content: center; }
          .stat-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; min-width: 150px; text-align: center; }
          .stat-val { font-size: 2rem; font-weight: bold; color: #0f172a; }
          .stat-label { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .prompts-container { padding: 20px 0; }
          .prompt-card { 
            border: 1px solid #cbd5e1; 
            border-radius: 12px; 
            padding: 20px; 
            margin-bottom: 30px; 
            page-break-inside: avoid; 
            break-inside: avoid; 
          }
          .prompt-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
          .prompt-title { font-size: 1.5rem; font-weight: bold; margin: 0; }
          .badges { display: flex; gap: 10px; margin-top: 10px; }
          .badge { background: #e2e8f0; color: #334155; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
          .badge.type { background: #dbeafe; color: #1d4ed8; }
          .score-row { display: flex; gap: 20px; margin-bottom: 15px; }
          .score { font-weight: bold; }
          .code-block { 
            background: #f1f5f9; 
            padding: 15px; 
            border-radius: 6px; 
            font-family: monospace; 
            white-space: pre-wrap; 
            word-wrap: break-word;
            word-break: break-word;
            font-size: 0.9rem; 
            border: 1px solid #e2e8f0; 
          }
        </style>
      </head>
      <body>
        <div class="cover">
          <h1 class="title">${isStringFolder ? targetFolder : 'Prompt Library Export'}</h1>
          <div class="subtitle">${isStringFolder ? (sourcePrompts ? 'Starter Collection' : 'Prompt Collection') : 'Full Library Export'}</div>
          <div class="subtitle" style="font-size: 1rem; margin-top: 10px;">Generated on ${new Date().toLocaleDateString()}</div>
        </div>
        
        ${!isStringFolder ? `
        <div class="page-break toc">
          <h2>Table of Contents</h2>
          ${folders.length === 0 ? '<p>No saved prompts.</p>' : folders.map(f => `<div class="toc-item">${f} (${promptsToUse.filter(p=>(p.folder || 'Misc')===f).length} prompts)</div>`).join('')}
        </div>
        ` : ''}
    `;

    folders.forEach(folder => {
      const folderPrompts = promptsToUse.filter(p => (p.folder || 'Misc') === folder);
      const count = folderPrompts.length;
      
      let lastUpdate = "N/A";
      try {
        const dates = folderPrompts.map(p => p.dateSaved).filter(d => d);
        if (dates.length > 0) {
          lastUpdate = new Date(Math.max(...dates.map(d => new Date(d)))).toLocaleDateString();
        }
      } catch (e) {}

      html += `
        <div class="page-break folder-cover">
          <h1 class="folder-title">${folder}</h1>
          <div class="stats-grid">
            <div class="stat-box"><div class="stat-val">${count}</div><div class="stat-label">Number of Prompts</div></div>
            ${lastUpdate !== "N/A" ? `<div class="stat-box"><div class="stat-val">${lastUpdate}</div><div class="stat-label">Last Updated</div></div>` : ''}
          </div>
        </div>
        <div class="page-break prompts-container">
          ${folderPrompts.map(p => `
            <div class="prompt-card">
              <div class="prompt-header">
                <div>
                  <h3 class="prompt-title">${p.title}</h3>
                  <div class="badges">
                    ${p.type ? `<span class="badge type">${p.type}</span>` : ''}
                    ${p.difficulty ? `<span class="badge" style="background:#fef3c7;color:#92400e;">${p.difficulty}</span>` : ''}
                    ${(p.tags || []).map(t => `<span class="badge">${t}</span>`).join('')}
                  </div>
                </div>
                ${p.dateSaved ? `<div style="font-size: 0.8rem; color: #64748b;">Saved: ${new Date(p.dateSaved).toLocaleDateString()}</div>` : ''}
              </div>
              ${p.outputQaScore !== undefined ? `
              <div class="score-row">
                <div>Output QA: <span class="score">${p.outputQaScore}/12</span></div>
                <div>Prompt Quality: <span class="score">${p.promptQualityScore}/7</span></div>
              </div>
              ` : ''}
              <div class="code-block">${p.promptText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              ${p.notes ? `<div style="margin-top:15px;"><strong>Notes:</strong><br/>${p.notes}</div>` : ''}
              ${p.description ? `<div style="margin-top:15px;"><strong>Description:</strong><br/>${p.description}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    });

    html += `</body></html>`;

    const printWindow = window.open('', '_blank');
    if(printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    } else {
      alert("Please allow popups to export the PDF.");
    }
  };

  const renderScorecardFields = (prefix, scoreState, setScoreState, noteState, setNoteState, isLocked) => (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {criteria.map((c) => (
        <div key={`${prefix}-${c.id}`} className={`border p-4 rounded-lg transition-colors ${isLocked ? 'bg-slate-900 border-slate-800' : 'bg-slate-900 border-slate-600 shadow-sm'}`}>
          <div className="flex justify-between items-center mb-3">
            <span className={`font-bold text-sm ${isLocked ? 'text-slate-400' : 'text-slate-200'}`}>{c.label}</span>
            <div className="flex gap-3 text-sm text-slate-400">
              {[0, 1, 2].map((num) => (
                <label key={num} className={`flex items-center gap-1 ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-white'}`}>
                  <input type="radio" name={`${prefix}-${c.id}`} value={num} checked={scoreState[c.id] === num} 
                    onChange={(e) => setScoreState(prev => ({...prev, [c.id]: parseInt(e.target.value)}))} disabled={isLocked}
                    className="w-3.5 h-3.5 text-blue-500 bg-slate-950 border-slate-600 focus:ring-blue-500 focus:ring-offset-slate-900 disabled:bg-slate-800" /> {num}
                </label>
              ))}
            </div>
          </div>
          <textarea className={`w-full text-xs p-2.5 border rounded outline-none h-12 resize-none transition-colors ${isLocked ? 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border-slate-600 text-slate-200 focus:ring-1 focus:ring-blue-500 placeholder-slate-500'}`}
            placeholder="Reviewer note..." value={noteState[c.id] || ''} onChange={(e) => setNoteState({...noteState, [c.id]: e.target.value})} disabled={isLocked} />
        </div>
      ))}
    </div>
  );

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-[#0b1120] font-sans flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative Floating Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-600/10 text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-4 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <Bot size={36} />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Prompt Optimizer</h1>
            <p className="text-slate-400 text-sm mt-1">Portfolio Evaluation Dashboard</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">Access Passcode</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="Enter your limited-time code..."
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl p-4 text-white text-sm outline-none transition-all pr-12 placeholder-slate-600"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
                  <Lock size={18} />
                </div>
              </div>
              {loginError && (
                <div className="text-red-400 text-xs font-bold mt-2 flex items-center gap-1.5 bg-red-950/20 border border-red-500/10 p-2.5 rounded-xl">
                  <AlertTriangle size={14} /> {loginError}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 flex items-center justify-center gap-2 text-sm"
            >
              Enter Dashboard <ArrowRight size={16} />
            </button>
          </form>

          {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
              <button 
                onClick={() => {
                  localStorage.setItem('access_token', 'dev-bypass');
                  setAccessToken('dev-bypass');
                  setLoginError('');
                }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-bold"
              >
                ⚙️ Local Dev Bypass (Only works if Server Auth is disabled)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] font-sans text-slate-200 pb-20">
      
      {/* Top Navigation */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-center">
          <div className="flex flex-wrap gap-2 sm:gap-4 justify-center w-full sm:w-auto">
            <button onClick={() => setCurrentView('dashboard')} className={`flex items-center gap-1.5 sm:gap-2 font-bold px-3 py-2 sm:px-4 rounded-md transition-colors text-xs sm:text-sm ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              <Target size={16} /> Dashboard
            </button>
            <button onClick={() => setCurrentView('library')} className={`flex items-center gap-1.5 sm:gap-2 font-bold px-3 py-2 sm:px-4 rounded-md transition-colors text-xs sm:text-sm ${currentView === 'library' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              <BookOpen size={16} /> Library
            </button>
            {(!accessToken || !accessToken.startsWith('emp-')) && (
              <button onClick={() => setCurrentView('admin')} className={`flex items-center gap-1.5 sm:gap-2 font-bold px-3 py-2 sm:px-4 rounded-md transition-colors text-xs sm:text-sm ${currentView === 'admin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <Lock size={16} /> Console
              </button>
            )}
          </div>

          <div className="flex justify-between sm:justify-end items-center gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-none">
            {timeRemaining && (
              <span className="text-[10px] sm:text-xs bg-slate-950 border border-slate-800 text-slate-300 font-black px-3 py-1.5 sm:py-2 rounded-full tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {timeRemaining}
              </span>
            )}
            <button onClick={() => handleLogout()} className="text-[10px] sm:text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 font-bold px-3 py-1.5 sm:py-2 rounded-md border border-slate-800 hover:border-red-500/20 transition-all">
              Log Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8">
        
        {/* --- DASHBOARD VIEW --- */}
        {currentView === 'dashboard' && (
          <>
            <h1 className="text-white text-3xl font-black mb-8 tracking-tight">AI Prompt QA & Optimization Dashboard</h1>

            <div className="border border-slate-800 bg-slate-900 rounded-2xl p-4 md:p-8 space-y-6 mb-12 shadow-sm">
              <h2 className="text-2xl font-black text-slate-200 ml-2 mb-2 tracking-tight">Phase 1: Original Prompt Evaluation</h2>

              <section className="bg-slate-800/50 p-6 rounded-xl shadow-sm border border-slate-700">
                <h2 className="text-md font-bold mb-4 text-slate-200">1. Original Input & AI Response</h2>
                <textarea className="w-full h-24 p-3 border border-slate-700 rounded-lg mb-4 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm bg-slate-950 text-slate-200 placeholder-slate-500" placeholder="Paste original prompt..." value={inputs.prompt} onChange={(e) => setInputs({ ...inputs, prompt: e.target.value })} />
                <label className="block text-sm font-bold mb-2 text-slate-200">Original AI Output</label>
                <textarea className="w-full h-40 p-3 border border-slate-700 rounded-lg mb-6 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm bg-slate-950 text-slate-200 placeholder-slate-500" value={inputs.output} onChange={(e) => setInputs({ ...inputs, output: e.target.value })} />
                <button onClick={handleTestAndScorePrompt} disabled={isGenerating} className="w-full md:w-auto bg-[#2563eb] text-white px-6 py-3 rounded-md font-bold flex items-center justify-center gap-2 hover:bg-blue-600 disabled:opacity-70 text-sm shadow-md transition-all">
                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Bot size={18} />} {isGenerating ? 'Processing...' : 'Test + Score Prompt'}
                </button>
              </section>

              <section className="bg-slate-800/50 p-6 rounded-xl shadow-sm border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-md font-bold text-slate-200">2. Original QA Scorecard</h2>
                  <div className="flex items-center gap-3">
                    {!isOriginalLocked && <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2 py-1 rounded border border-slate-600">Manual review enabled</span>}
                    <button onClick={() => setIsOriginalLocked(!isOriginalLocked)} className={`text-xs px-3 py-1.5 rounded font-bold flex items-center gap-2 border transition-colors ${isOriginalLocked ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-slate-600 text-white border-slate-500 hover:bg-slate-500'}`}>
                      {isOriginalLocked ? <Lock size={12} /> : <Unlock size={12} />} {isOriginalLocked ? 'Manual Entry' : 'Lock Scores'}
                    </button>
                  </div>
                </div>
                
                {renderScorecardFields('orig', scores, setScores, notes, setNotes, isOriginalLocked)}

                <div className="space-y-4 border-t border-slate-700 pt-6">
                  <h3 className={`font-bold text-sm ${isOriginalLocked ? 'text-slate-500' : 'text-slate-200'}`}>
                    {diagnosis.type === 'None' && totalPromptQuality <= 5 ? '3. Prompt Quality Diagnosis' : '3. Failure Pattern Diagnosis'}
                  </h3>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Output Failure Type</label>
                    <select value={diagnosis.type} onChange={(e) => setDiagnosis({ ...diagnosis, type: e.target.value })} disabled={isOriginalLocked}
                      className={`w-full p-2.5 border rounded-md text-sm outline-none transition-colors font-medium ${diagnosis.type === 'None' && hasCriticalFailure ? 'border-red-500/50 text-red-400 bg-red-900/20' : isOriginalLocked ? 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed' : 'border-slate-700 text-slate-200 bg-slate-950 focus:ring-1 focus:ring-blue-500'}`}>
                      <option>None</option><option>Hallucination / Safety Risk</option><option>Wrong Tone</option><option>Incomplete Output</option><option>Weak Prompt Input</option><option>Overcomplication</option>
                    </select>
                    {diagnosis.type === 'None' && hasCriticalFailure && <p className="text-red-400 text-xs font-bold flex items-center gap-1 mt-2"><AlertTriangle size={12} /> Failure type required due to critical scores.</p>}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                      {diagnosis.type === 'None' && totalPromptQuality <= 5 ? 'Prompt Quality Issue' : 'Issues Found'}
                    </label>
                    <textarea value={diagnosis.issues} onChange={(e) => setDiagnosis({ ...diagnosis, issues: e.target.value })} disabled={isOriginalLocked}
                      className={`w-full p-3 border rounded-md text-sm h-16 transition-colors resize-none placeholder-slate-500 ${isOriginalLocked ? 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border-slate-700 text-slate-200 focus:ring-1 focus:ring-blue-500'}`} placeholder={diagnosis.type === 'None' && totalPromptQuality <= 5 ? 'E.g., Missing audience/tone specificity' : 'Issues Found'} />
                  </div>
                </div>
              </section>

              <section className="bg-slate-950 text-slate-200 p-8 rounded-xl shadow-lg border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Target size={120} /></div>
                <h2 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-800 pb-4 relative z-10">4. Original Final Evaluation</h2>
                
                <div className="grid md:grid-cols-2 gap-8 mb-6 relative z-10">
                  <div>
                    <div className="text-xs font-bold text-slate-400 tracking-wider mb-2">AI OUTPUT QA SCORE</div>
                    <div className="flex items-baseline gap-2 mb-2"><span className={`text-5xl font-black ${getOutputTextClasses(totalScore, scores)}`}>{totalScore}</span><span className="text-xl text-slate-500 font-bold">/12</span></div>
                    <div className={`px-3 py-1 rounded inline-block border font-bold text-sm ${getOutputBadgeClasses(totalScore, scores)}`}>{getRatingLabel(totalScore, scores)}</div>
                  </div>
                  <div className="border-l border-slate-800 pl-8">
                    <div className="text-xs font-bold text-slate-400 tracking-wider mb-2">PROMPT QUALITY SCORE</div>
                    <div className="flex items-baseline gap-2 mb-2"><span className={`text-5xl font-black ${getPromptTextClasses(totalPromptQuality)}`}>{totalPromptQuality}</span><span className="text-xl text-slate-500 font-bold">/7</span></div>
                    <div className={`px-3 py-1 rounded inline-block border font-bold text-sm ${getPromptBadgeClasses(totalPromptQuality)}`}>{promptQualityLabel} Potential</div>
                  </div>
                </div>

                {recommendationData && (
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg relative z-10 mb-6">
                    <div className="text-xs font-bold text-slate-400 tracking-wider mb-1">RECOMMENDATION</div>
                    <div className={`font-bold text-lg mb-2 ${recommendationData.potential === 'High' ? 'text-emerald-400' : 'text-blue-400'}`}>{recommendationData.status}</div>
                    <div className="text-sm text-slate-300 leading-relaxed">{recommendationData.reason}</div>
                  </div>
                )}

                <div className="flex gap-4 relative z-10">
                  <button onClick={handleCopyInitialReport} disabled={!isOriginalScored} className={`flex-1 py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm ${!isOriginalScored ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                    {isInitialCopied ? <Check size={18} /> : <Clipboard size={18} />} Export Report
                  </button>
                  <button onClick={() => setIsSaveModalOpen(true)} disabled={!isOriginalScored} className={`px-6 py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm ${!isOriginalScored ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white'}`}>
                    <BookmarkPlus size={18} /> Save to Library
                  </button>
                </div>
              </section>
            </div>


            <div className="border border-slate-800 bg-slate-900 rounded-2xl p-4 md:p-8 space-y-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-200 ml-2 mb-2 tracking-tight">Phase 2: Prompt Optimization & Retest</h2>

              <section className="bg-slate-800/50 p-6 rounded-xl shadow-sm border border-slate-700">
                <h2 className="text-md font-bold text-slate-200 mb-6 flex items-center gap-2"><Lightbulb size={20} className="text-blue-400" /> 5. Prompt Optimization Builder</h2>
                
                <div className="bg-slate-900 p-5 rounded-lg mb-6 border border-slate-700">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-200">Clarifying Questions</h3>
                    </div>
                    {questionsStatus === 'generating' && <span className="text-xs text-slate-300 flex items-center gap-1 font-bold bg-slate-800 border border-slate-700 px-2 py-1 rounded"><Loader2 size={12} className="animate-spin" /> Auto-generating...</span>}
                    {questionsStatus === 'not_needed' && <span className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-800/50 px-2 py-1 rounded font-bold">No clarifying questions needed.</span>}
                  </div>

                  {questionTimeoutMsg && (
                    <div className="mb-4 text-orange-400 text-xs font-bold flex items-center gap-2 bg-orange-900/20 border border-orange-800/50 p-2.5 rounded">
                      <AlertTriangle size={14} className="shrink-0" /> 
                      <span>{questionTimeoutMsg}</span>
                      <button 
                        onClick={() => generateQuestionsForScore(scores, diagnosis)} 
                        className="ml-auto bg-orange-800/40 hover:bg-orange-700/50 text-orange-200 px-2.5 py-1 rounded transition-colors whitespace-nowrap"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                  
                  {questionsStatus === 'generated' && clarifyingQAs.map((qa, i) => {
                    const isInvalid = validationError && qa.answer.trim().length === 0 && placeholderStrategy === 'provide';
                    return (
                      <div key={`qa-${i}`} className="mb-4">
                        <label className={`block text-sm font-bold p-2.5 rounded mb-2 leading-relaxed ${isInvalid ? 'text-red-300 bg-red-950 border border-red-800' : 'text-slate-200 bg-slate-900 border border-blue-500/30'}`}>
                          <span className={`${isInvalid ? 'text-red-400' : 'text-blue-400'} mr-2`}>Q{i+1}:</span>
                          {qa.question}
                          {isInvalid && <span className="text-red-400 ml-1 text-base">*</span>}
                        </label>
                        <textarea 
                          className={`w-full p-3 border rounded-md text-sm h-16 resize-none outline-none bg-slate-950 text-slate-200 placeholder-slate-500 ${isInvalid ? 'border-red-500/50 focus:ring-1 focus:ring-red-500' : 'border-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'}`} 
                          placeholder="Type your answer here..." 
                          value={qa.answer} 
                          onChange={(e) => { 
                            const newQAs = [...clarifyingQAs]; 
                            newQAs[i].answer = e.target.value; 
                            setClarifyingQAs(newQAs); 
                            setValidationError(''); 
                          }} 
                        />
                        {isInvalid && <div className="text-red-400 text-xs font-bold mt-1.5">Error: Missing detail. Please provide an answer or change your privacy strategy below.</div>}
                      </div>
                    );
                  })}
                  {validationError && <div className="text-red-400 text-xs font-bold mt-2 flex items-center gap-1 bg-red-900/20 border border-red-800/50 p-2 rounded"><AlertTriangle size={14} /> Please resolve the missing details above.</div>}
                </div>

                <div className="bg-slate-900 p-5 rounded-lg mb-6 border border-slate-700">
                  <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-blue-400"/> Privacy & Placeholder Strategy</h3>
                  <p className="text-xs text-slate-400 mb-4">If missing details are sensitive (client names, private links, financials), how should the optimizer handle them?</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="radio" name="privacy" value="provide" checked={placeholderStrategy === 'provide'} onChange={(e) => setPlaceholderStrategy(e.target.value)} className="w-4 h-4 text-blue-500 bg-slate-950 border-slate-600 focus:ring-blue-500 focus:ring-offset-slate-900" /> Require all details</label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="radio" name="privacy" value="placeholders" checked={placeholderStrategy === 'placeholders'} onChange={(e) => setPlaceholderStrategy(e.target.value)} className="w-4 h-4 text-blue-500 bg-slate-950 border-slate-600 focus:ring-blue-500 focus:ring-offset-slate-900" /> Use safe placeholders</label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="radio" name="privacy" value="remove" checked={placeholderStrategy === 'remove'} onChange={(e) => setPlaceholderStrategy(e.target.value)} className="w-4 h-4 text-blue-500 bg-slate-950 border-slate-600 focus:ring-blue-500 focus:ring-offset-slate-900" /> Remove from prompt</label>
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-lg mb-6 border border-slate-700">
                  <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2"><Mic size={16} className="text-blue-400"/> Tone Guidance</h3>
                  <p className="text-xs text-slate-400 mb-4">Select a specific tone to influence the generated prompt and output, or let the AI auto-detect it.</p>
                  <select 
                    value={selectedTone} 
                    onChange={(e) => setSelectedTone(e.target.value)}
                    className="w-full p-2.5 border rounded-md text-sm outline-none transition-colors font-medium border-slate-700 text-slate-200 bg-slate-950 focus:ring-1 focus:ring-blue-500"
                  >
                    {toneOptions.map(tone => <option key={tone} value={tone}>{tone}</option>)}
                  </select>
                </div>

                <div className="bg-slate-900 p-5 rounded-lg mb-6 border border-slate-700">
                  <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2"><Settings2 size={16} className="text-blue-400"/> Optimization Preferences</h3>
                  <p className="text-xs text-slate-400 mb-4">Select guidelines to influence the generated prompt and output style.</p>
                  
                  <div className="grid md:grid-cols-3 gap-3 mb-4">
                    <button 
                      onClick={() => handlePresetToggle('humanNatural')}
                      className={`p-3 rounded-lg border text-left transition-all ${presets.humanNatural ? 'bg-blue-600/20 border-blue-500/60 text-blue-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                      <div className="font-bold flex items-center gap-2 mb-1">🧑 Human + Natural</div>
                      <div className="text-[10px] opacity-80 leading-tight">Less robotic, conversational wording.</div>
                    </button>
                    <button 
                      onClick={() => handlePresetToggle('clearConcise')}
                      className={`p-3 rounded-lg border text-left transition-all ${presets.clearConcise ? 'bg-blue-600/20 border-blue-500/60 text-blue-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                      <div className="font-bold flex items-center gap-2 mb-1">✂️ Clear + Concise</div>
                      <div className="text-[10px] opacity-80 leading-tight">Reduce fluff, Spartan tone, under 300 tokens.</div>
                    </button>
                    <button 
                      onClick={() => handlePresetToggle('preserveVoice')}
                      className={`p-3 rounded-lg border text-left transition-all ${presets.preserveVoice ? 'bg-blue-600/20 border-blue-500/60 text-blue-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                      <div className="font-bold flex items-center gap-2 mb-1">🎯 Keep Original Style</div>
                      <div className="text-[10px] opacity-80 leading-tight">Keep original tone and avoid jargon.</div>
                    </button>
                  </div>

                  <div className="border border-slate-700 rounded-lg overflow-hidden">
                    <button 
                      onClick={() => setIsAdvOpen(!isAdvOpen)}
                      className={`w-full p-3 bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-200 flex justify-between items-center transition-colors ${isAdvOpen ? 'border-b border-slate-700' : ''}`}
                    >
                      Advanced Fine-Tuning
                      {isAdvOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                    {isAdvOpen && (
                      <div className="p-4 bg-slate-900 grid sm:grid-cols-2 gap-y-4 gap-x-4">
                        {Object.entries(prefLabels).map(([key, label]) => (
                          <div key={key} className="flex flex-col">
                            <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer hover:text-white transition-colors">
                              <input 
                                type="checkbox" 
                                checked={advPrefs[key]} 
                                onChange={() => setAdvPrefs(prev => ({ ...prev, [key]: !prev[key] }))}
                                className="mt-0.5 rounded border-slate-600 text-blue-500 bg-slate-950 focus:ring-0 focus:ring-offset-slate-900"
                              />
                              <span className="leading-tight">{label}</span>
                            </label>
                            {prefDescriptions[key] && <div className="text-[10px] text-slate-500 ml-6 mt-1 leading-tight">{prefDescriptions[key]}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Guided Constraint Builder */}
                  <div className="mt-4 border border-slate-700 rounded-lg overflow-hidden">
                    <button 
                      onClick={handleOpenConstraintBuilder}
                      className={`w-full p-3 bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-200 flex justify-between items-center transition-colors ${isConstraintBuilderOpen ? 'border-b border-slate-700' : ''}`}
                    >
                      <div className="flex items-center gap-2"><Target size={16} /> Add Stronger Constraints</div>
                      {isConstraintBuilderOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {isConstraintBuilderOpen && (
                      <div className="p-5 bg-slate-900">
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-slate-200 mb-2">Prompt-Specific Constraint Suggestions</h4>
                          {constraintsStatus === 'generating' ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Auto-generating context-aware rules...</div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {suggestedConstraints.map((c, i) => {
                                const isSelected = selectedConstraints.includes(c);
                                return (
                                  <button 
                                    key={i} 
                                    onClick={() => toggleConstraint(c)} 
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors text-left ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-100' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                                  >
                                    {isSelected ? '✓ ' : '+ '}{c}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 mb-2">Additional Constraints to Add</h4>
                          <textarea 
                            className="w-full p-3 border border-slate-700 bg-slate-950 rounded-md text-sm text-slate-200 placeholder-slate-500 h-20 resize-none focus:ring-1 focus:ring-blue-500 outline-none" 
                            placeholder="Add any extra rules you want the optimized prompt to follow..." 
                            value={customConstraints} 
                            onChange={(e) => setCustomConstraints(e.target.value)} 
                          />
                        </div>
                        <button 
                          onClick={() => setIsConstraintBuilderOpen(false)} 
                          className="mt-4 w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-bold py-2.5 rounded transition-colors"
                        >
                          Apply Constraints to Optimized Prompt
                        </button>
                      </div>
                    )}
                  </div>

                </div>

                <button onClick={handleOptimizeTestAndScore} disabled={isGeneratingOptimized || questionsStatus === 'generating'} className="w-full bg-[#2563eb] text-white px-6 py-3.5 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 hover:bg-blue-600 disabled:opacity-70 disabled:bg-blue-400 transition-all text-sm mb-6">
                  {isGeneratingOptimized ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} {isGeneratingOptimized ? 'Building & Testing...' : 'Optimize + Test + Score Prompt'}
                </button>
                
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <label className="font-bold text-sm text-slate-200 mb-2 block">Generated Optimized Prompt</label>
                  <textarea className="w-full p-4 border border-slate-700 rounded-md text-sm h-64 bg-slate-950 font-mono text-slate-300 resize-none focus:ring-1 focus:ring-blue-500 outline-none placeholder-slate-600" placeholder="Optimized prompt will appear here..." value={optimizedPrompt} onChange={(e) => setOptimizedPrompt(e.target.value)} />
                </div>
              </section>

              <section className="bg-slate-800/50 p-6 rounded-xl shadow-sm border border-slate-700">
                <h2 className="text-md font-bold text-slate-200 mb-4">6. Optimized Prompt Test</h2>
                <label className="block text-sm font-bold mb-2 text-slate-200">Optimized AI Output</label>
                <textarea className="w-full h-40 p-4 border border-slate-700 rounded-lg outline-none text-sm resize-none bg-slate-950 text-slate-200 placeholder-slate-500" placeholder="Output will appear here after optimization..." value={optimizedOutput} readOnly />
              </section>

              <section className="bg-slate-800/50 p-6 rounded-xl shadow-sm border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-md font-bold text-slate-200">7. Optimized QA Scorecard</h2>
                  <div className="flex items-center gap-3">
                    {!isOptimizedLocked && <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2 py-1 rounded border border-slate-600">Manual review enabled</span>}
                    <button onClick={() => setIsOptimizedLocked(!isOptimizedLocked)} className={`text-xs px-3 py-1.5 rounded font-bold flex items-center gap-2 border transition-colors ${isOptimizedLocked ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-slate-600 text-white border-slate-500 hover:bg-slate-500'}`}>
                      {isOptimizedLocked ? <Lock size={12} /> : <Unlock size={12} />} {isOptimizedLocked ? 'Manual Entry' : 'Lock Scores'}
                    </button>
                  </div>
                </div>
                
                {renderScorecardFields('opt', optimizedScores, setOptimizedScores, optimizedNotes, setOptimizedNotes, isOptimizedLocked)}
              </section>

              {isOriginalScored && (
                <section className="bg-slate-950 text-slate-200 p-8 rounded-xl shadow-lg border border-slate-800">
                  <h2 className="font-bold text-lg mb-8 flex items-center gap-2 border-b border-slate-800 pb-4"><Target size={20} className="text-blue-400" /> 8. Before / After Comparison</h2>
                    
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Output QA comparison */}
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-inner">
                      <div className="text-xs text-slate-400 font-bold tracking-wider mb-4 flex justify-between border-b border-slate-800 pb-3">
                        <span>OUTPUT QUALITY</span>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-400">Original Output:</span>
                          <span className={`text-lg font-black ${getOutputTextClasses(totalScore, scores)}`}>{totalScore}/12 <span className={`text-sm ml-1 font-normal ${getOutputTextClasses(totalScore, scores)}`}>— {getRatingLabel(totalScore, scores)}</span></span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-blue-400">Optimized Output:</span>
                          <span className={`text-lg font-black ${hasOptimizedTest ? getOutputTextClasses(totalOptimizedScore, optimizedScores) : 'text-slate-600'}`}>{hasOptimizedTest ? totalOptimizedScore : '--'}/12 <span className={`text-sm ml-1 font-normal ${hasOptimizedTest ? getOutputTextClasses(totalOptimizedScore, optimizedScores) : 'text-slate-600'}`}>— {hasOptimizedTest ? getRatingLabel(totalOptimizedScore, optimizedScores) : 'Pending'}</span></span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                          <span className="text-sm font-medium text-slate-400">Improvement:</span>
                          <span className={`font-bold ${hasOptimizedTest ? getImprovementTextClasses(scoreImprovement) : 'text-slate-600'}`}>
                            {hasOptimizedTest ? `${scoreImprovement > 0 ? '+' : ''}${scoreImprovement}` : '--'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Prompt Quality comparison */}
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-inner">
                      <div className="text-xs text-slate-400 font-bold tracking-wider mb-4 flex justify-between border-b border-slate-800 pb-3">
                        <span>PROMPT QUALITY</span>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-400">Original Prompt:</span>
                          <span className={`text-lg font-black ${getPromptTextClasses(totalPromptQuality)}`}>{totalPromptQuality}/7 <span className={`text-sm ml-1 font-normal ${getPromptTextClasses(totalPromptQuality)}`}>— {promptQualityLabel}</span></span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-blue-400">Optimized Prompt:</span>
                          <span className={`text-lg font-black ${hasOptimizedTest ? getPromptTextClasses(totalOptimizedPromptQuality) : 'text-slate-600'}`}>{hasOptimizedTest ? totalOptimizedPromptQuality : '--'}/7 <span className={`text-sm ml-1 font-normal ${hasOptimizedTest ? getPromptTextClasses(totalOptimizedPromptQuality) : 'text-slate-600'}`}>— {hasOptimizedTest ? (totalOptimizedPromptQuality <= 2 ? 'Low' : totalOptimizedPromptQuality <= 5 ? 'Medium' : 'High') : 'Pending'}</span></span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                          <span className="text-sm font-medium text-slate-400">Improvement:</span>
                          <span className={`font-bold ${hasOptimizedTest ? getImprovementTextClasses(promptQualityImprovement) : 'text-slate-600'}`}>
                            {hasOptimizedTest ? `${promptQualityImprovement > 0 ? '+' : ''}${promptQualityImprovement}` : '--'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Final Conclusion Box */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center mb-8 shadow-md">
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Final Evaluation</div>
                    <div className={`text-2xl font-black mb-2 ${hasOptimizedTest ? (optimizationResult === 'Improved' ? 'text-emerald-400' : optimizationResult === 'Worse' ? 'text-red-400' : 'text-slate-300') : 'text-slate-600'}`}>
                      Final Result: {optimizationResult}
                    </div>
                    <div className="text-sm text-slate-300 mb-4">{hasOptimizedTest ? `Optimization Summary: ${optimizationSummary}` : ''}</div>
                    <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm">
                      <div className="text-slate-400">Original Rating: <span className={`font-bold ${getOutputTextClasses(totalScore, scores)}`}>{getRatingLabel(totalScore, scores)}</span></div>
                      <div className="text-slate-600">•</div>
                      <div className="text-slate-400">Optimized Rating: <span className={`font-bold ${hasOptimizedTest ? getOutputTextClasses(totalOptimizedScore, optimizedScores) : 'text-slate-600'}`}>{hasOptimizedTest ? getRatingLabel(totalOptimizedScore, optimizedScores) : 'Pending'}</span></div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button onClick={handleCopyFullReport} disabled={!hasOptimizedTest} className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl text-sm ${!hasOptimizedTest ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-[#2563eb] hover:bg-blue-600 text-white'}`}>
                      {isFullCopied ? <Check size={20} /> : <Clipboard size={20} />} Export Full Report
                    </button>
                    <button onClick={() => setIsSaveModalOpen(true)} disabled={!hasOptimizedTest} className={`px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl text-sm ${!hasOptimizedTest ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white'}`}>
                      <BookmarkPlus size={20} /> Save to Library
                    </button>
                  </div>
                </section>
              )}
            </div>
          </>
        )}

        {/* --- LIBRARY VIEW --- */}
        {currentView === 'library' && (
          <div className="space-y-8 animate-in fade-in duration-300">

            <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-4 flex gap-3 items-start">
              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-orange-200">
                <strong className="text-orange-400">Important:</strong> Saved prompts are stored locally in this browser. Clearing cache, deleting site data, switching browsers/devices, or using private browsing may remove saved prompts. Export your library regularly.
              </p>
            </div>

            {/* Bulk Action Bar */}
            {selectedPromptIds.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 border border-blue-500/50 shadow-2xl shadow-blue-500/20 rounded-2xl px-6 py-4 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 text-white text-xs font-black h-6 w-6 rounded-full flex items-center justify-center">
                    {selectedPromptIds.length}
                  </div>
                  <span className="text-sm font-bold text-white uppercase tracking-wider">Prompts Selected</span>
                </div>
                <div className="h-8 w-px bg-slate-800"></div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleBulkMove}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-slate-700"
                  >
                    <FolderInput size={14} /> Move to Folder
                  </button>
                  <button 
                    onClick={handleBulkDelete}
                    className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-red-900/30"
                  >
                    <Trash2 size={14} /> Delete Selected
                  </button>
                  <button 
                    onClick={() => setSelectedPromptIds([])}
                    className="bg-slate-950 hover:bg-slate-900 text-slate-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-slate-800"
                  >
                    <X size={14} /> Clear
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 items-center justify-between">
              <h1 className="text-3xl font-black text-white">Local Prompt Library</h1>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleCreateFolder} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20">
                  <FolderPlus size={16} /> Create Folder
                </button>
                <button onClick={handleExportJSON} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-colors">
                  <Download size={16} /> Export Backup JSON
                </button>
                <div className="relative">
                  <button onClick={() => fileInputRef.current?.click()} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-colors">
                    <Upload size={16} /> Import Backup JSON
                  </button>
                  <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportJSON} className="hidden" />
                </div>
                <button onClick={() => handleExportPDF()} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-colors">
                  <FileDown size={16} /> Export PDF Copy
                </button>
              </div>
            </div>

            {/* --- TOP-LEVEL SECTION: STARTER PACKS --- */}
            <div className="border border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-slate-900/40 mb-8">
              <div 
                onClick={toggleStarterSection}
                className={`px-8 py-7 flex justify-between items-center cursor-pointer transition-all ${isStarterSectionOpen ? 'bg-slate-800/80' : 'bg-slate-900/60 hover:bg-slate-800/50'}`}
              >
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl border transition-all duration-500 ${isStarterSectionOpen ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-blue-600/10 text-blue-400 border-blue-500/20'}`}>
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Starter Prompt Packs</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-70">Curated examples and templates</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <span className="text-xs font-black text-slate-500 bg-slate-950/50 px-5 py-2 rounded-full border border-slate-800 tracking-widest">{STARTER_PACKS.length} Prompts</span>
                  <div className={`transition-transform duration-300 ${isStarterSectionOpen ? 'rotate-180' : 'rotate-0'}`}>
                    <ChevronDown size={32} className={isStarterSectionOpen ? "text-blue-400" : "text-slate-600"} />
                  </div>
                </div>
              </div>

              {isStarterSectionOpen && (
                <div className="p-8 space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                  {(() => {
                    const starterCategories = [...new Set(STARTER_PACKS.map(p => p.folder))].sort();
                 return starterCategories.map(category => {
                   const categoryPrompts = STARTER_PACKS.filter(p => p.folder === category);
                   const isOpen = openFolders[`starter-${category}`];

                   return (
                     <div key={`starter-${category}`} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                       <div 
                         onClick={() => setOpenFolders(prev => ({ ...prev, [`starter-${category}`]: !isOpen }))}
                         className="bg-slate-800/40 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-800/60 transition-colors"
                       >
                         <div className="flex items-center gap-3">
                           <Folder size={18} className="text-blue-500/70" />
                           <h3 className="text-lg font-bold text-slate-300">{category}</h3>
                           <span className="text-[10px] font-black bg-slate-800 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">Starter</span>
                         </div>
                         <div className="flex items-center gap-4">
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleExportPDF(category, STARTER_PACKS); }}
                             className="flex items-center gap-1.5 text-slate-500 hover:text-blue-400 transition-colors px-2 py-1 rounded-md bg-slate-950/50 border border-slate-800 hover:border-blue-500/30 group"
                             title="Export this starter collection to PDF"
                           >
                             <FileDown size={12} className="group-hover:scale-110 transition-transform" />
                             <span className="text-[10px] font-black uppercase tracking-widest">Export PDF</span>
                           </button>
                           <span className="text-xs font-bold text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full">{categoryPrompts.length} Prompts</span>
                           {isOpen ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                         </div>
                       </div>

                       {isOpen && (
                         <div className="p-6 bg-slate-900/20 border-t border-slate-800/50 animate-in slide-in-from-top-2 duration-200">
                           <div className="grid grid-cols-1 gap-6">
                             {categoryPrompts.map(pack => {
                               const isAdded = savedPrompts.some(p => p.id === pack.id);
                               return (
                                 <div key={pack.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-8 transition-all hover:border-slate-700 shadow-lg">
                                   <div className="flex justify-between items-start mb-8 border-b border-slate-800/50 pb-6">
                                     <div>
                                       <h4 className="font-bold text-2xl text-blue-300 mb-3 tracking-tight">{pack.title}</h4>
                                       <div className="flex flex-wrap gap-2">
                                         <span className="text-[10px] font-black bg-blue-900/30 text-blue-400 px-3 py-1 rounded-lg border border-blue-800/50 uppercase tracking-[0.15em]">Starter Template</span>
                                         {pack.tags.map(t => <span key={t} className="text-[10px] font-bold bg-slate-800 text-slate-500 px-3 py-1 rounded-lg uppercase tracking-wider">{t}</span>)}
                                       </div>
                                     </div>
                                     {pack.difficulty && (
                                       <div className="text-right">
                                          <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Level</div>
                                          <span className={`text-[11px] font-black px-4 py-1.5 rounded-full border shadow-sm ${
                                            pack.difficulty === 'Beginner' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/30 shadow-emerald-900/10' : 
                                            pack.difficulty === 'Intermediate' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800/30 shadow-yellow-900/10' : 
                                            'bg-red-900/20 text-red-400 border-red-800/30 shadow-red-900/10'
                                          }`}>
                                            {pack.difficulty.toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                   </div>
                                      <p className="text-sm text-slate-400 mb-4">{pack.description}</p>
                                      <div className="flex flex-wrap gap-2 mb-4">
                                        {pack.tags.map(t => <span key={t} className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{t}</span>)}
                                      </div>
                                      <div className="relative group">
                                        <div className="text-xs text-slate-500 font-mono bg-slate-950 p-4 pr-10 rounded-lg border border-slate-800/50 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 transition-all">
                                          {pack.promptText}
                                        </div>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleCopy(pack.id, pack.promptText); }}
                                          className="absolute top-2 right-2 p-2 rounded bg-slate-800/90 border border-slate-800 text-slate-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-md"
                                        >
                                          {copiedId === pack.id ? <Check size={14} className="text-emerald-400" /> : <Clipboard size={14} />}
                                        </button>
                                      </div>
                                   <div className="flex gap-3 pt-4 border-t border-slate-800/50">
                                      <button onClick={() => loadIntoDashboard(pack.promptText)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                                        <Play size={16} /> Load Dashboard
                                      </button>
                                      <button 
                                        disabled={isAdded}
                                        onClick={() => saveLibraryToLocal([...savedPrompts, pack])} 
                                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${isAdded ? 'bg-emerald-900/30 text-emerald-500 border border-emerald-800/30 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white'}`}
                                      >
                                        {isAdded ? <Check size={16} /> : <BookmarkPlus size={16} />} {isAdded ? 'Added to Library' : 'Add to My Library'}
                                      </button>
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 });
               })()}
                </div>
              )}
            </div>

            <div className="h-px bg-slate-800/50 my-6"></div>

            {/* --- TOP-LEVEL SECTION: MY PROMPT LIBRARY --- */}
            <div className="border border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-slate-900/40">
              <div 
                onClick={toggleUserSection}
                className={`px-8 py-7 flex justify-between items-center cursor-pointer transition-all ${isUserSectionOpen ? 'bg-slate-800/80' : 'bg-slate-900/60 hover:bg-slate-800/50'}`}
              >
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl border transition-all duration-500 ${isUserSectionOpen ? 'bg-emerald-600 text-white border-blue-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20'}`}>
                    <Folder size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">My Prompt Library</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5 opacity-70">Your saved and custom prompts</p>
                  </div>
                </div>
                <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
                  <button onClick={handleCreateFolder} className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all border border-emerald-500/30 shadow-lg active:scale-95">
                    <FolderPlus size={16} /> New Folder
                  </button>
                  <span className="text-xs font-black text-slate-500 bg-slate-950/50 px-5 py-2 rounded-full border border-slate-800 tracking-widest">{savedPrompts.length} Prompts</span>
                  <div onClick={toggleUserSection} className={`cursor-pointer transition-transform duration-300 ${isUserSectionOpen ? 'rotate-180' : 'rotate-0'}`}>
                    <ChevronDown size={32} className={isUserSectionOpen ? "text-emerald-400" : "text-slate-600"} />
                  </div>
                </div>
              </div>

              {isUserSectionOpen && (
                <div className="p-8 space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                  {savedPrompts.length === 0 && customFolders.length === 0 ? (
                    <div className="bg-slate-950/50 border border-slate-800 border-dashed rounded-3xl p-20 text-center">
                      <Folder size={72} className="mx-auto text-slate-800 mb-6 opacity-30" />
                      <h3 className="text-2xl font-black text-slate-400 mb-3">Library is empty</h3>
                      <button onClick={handleCreateFolder} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20">Create your first folder</button>
                    </div>
                  ) : (
                    (() => {
                      const promptFolders = savedPrompts.map(p => p.folder || 'Misc');
                      const allFolders = [...new Set([...promptFolders, ...customFolders, 'Misc'])].sort((a, b) => {
                        if (a === 'Misc') return 1;
                        if (b === 'Misc') return -1;
                        return a.localeCompare(b);
                      });

                      return allFolders.map(folder => {
                        const isOpen = openFolders[folder];
                        const folderPrompts = savedPrompts.filter(p => (p.folder || 'Misc') === folder);
                        const selectedInFolder = folderPrompts.filter(p => selectedPromptIds.includes(p.id)).length;

                        return (
                          <div key={folder} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div 
                              onClick={() => setOpenFolders(prev => ({ ...prev, [folder]: !isOpen }))}
                              className={`bg-slate-800/30 px-6 py-5 flex justify-between items-center cursor-pointer hover:bg-slate-800/50 transition-colors ${isOpen ? 'border-b border-slate-800/50' : ''}`}
                            >
                              <div className="flex items-center gap-5">
                                <div className="flex items-center gap-3">
                                   <Folder size={20} className="text-emerald-500/40"/> 
                                   <h3 className="text-lg font-bold text-slate-300">{folder}</h3>
                                </div>
                                
                                {selectedInFolder > 0 && (
                                  <div className="flex items-center gap-2 bg-blue-600/10 px-3 py-1 rounded-full border border-blue-500/20">
                                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">{selectedInFolder} Selected</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-3 ml-2" onClick={e => e.stopPropagation()}>
                                  {folder !== 'Misc' && (
                                    <>
                                      <button onClick={() => handleRenameFolder(folder)} className="flex items-center gap-1.5 text-slate-600 hover:text-blue-400 transition-colors px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-blue-500/30 group">
                                        <Pencil size={12} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Rename</span>
                                      </button>
                                      <button onClick={() => handleDeleteFolder(folder)} className="flex items-center gap-1.5 text-slate-600 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-red-500/30 group">
                                        <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Delete</span>
                                      </button>
                                    </>
                                  )}
                                  
                                  {folderPrompts.length > 0 && (
                                    <button 
                                      onClick={() => handleExportPDF(folder)}
                                      className="flex items-center gap-1.5 text-slate-500 hover:text-orange-400 transition-colors px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-orange-500/30 group"
                                      title="Export this folder to PDF"
                                    >
                                      <FileDown size={12} className="group-hover:scale-110 transition-transform" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Export PDF</span>
                                    </button>
                                  )}
                                  
                                  {folderPrompts.length > 0 && (
                                    <button 
                                      onClick={() => {
                                        const folderIds = folderPrompts.map(p => p.id);
                                        const allSelected = folderIds.every(id => selectedPromptIds.includes(id));
                                        if (allSelected) {
                                          setSelectedPromptIds(selectedPromptIds.filter(id => !folderIds.includes(id)));
                                        } else {
                                          setSelectedPromptIds([...new Set([...selectedPromptIds, ...folderIds])]);
                                        }
                                      }}
                                      className="flex items-center gap-1.5 text-slate-600 hover:text-emerald-400 transition-colors px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-emerald-500/30 group"
                                    >
                                      {folderPrompts.every(p => selectedPromptIds.includes(p.id)) ? <CheckSquare size={12} className="text-emerald-500" /> : <Square size={12} />}
                                      <span className="text-[10px] font-black uppercase tracking-widest">Select All</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleExportPDF(folder); }}
                                  className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded-md bg-slate-950/40 border border-slate-800 hover:border-emerald-500/30 group"
                                  title="Export this folder to PDF"
                                >
                                  <FileDown size={12} className="group-hover:scale-110 transition-transform" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Export PDF</span>
                                </button>
                                <span className="text-xs font-bold text-slate-500 tracking-wider">{folderPrompts.length} Prompts</span>
                                {isOpen ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                              </div>
                            </div>

                            {isOpen && (
                              <div className="p-8 bg-slate-950/20 space-y-8 animate-in slide-in-from-top-2 duration-300">
                                {folderPrompts.length === 0 ? (
                                  <p className="text-slate-600 text-sm italic py-10 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800/50">This folder is empty.</p>
                                ) : (
                                  folderPrompts.map(prompt => (
                                    <div key={prompt.id} className={`bg-slate-950 border rounded-2xl p-8 transition-all duration-300 ${selectedPromptIds.includes(prompt.id) ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]' : 'border-slate-800 hover:border-slate-700'}`}>
                                      <div className="flex justify-between items-start mb-8 border-b border-slate-800/50 pb-6">
                                        <div className="flex gap-6">
                                          <div className="pt-1.5">
                                            <input 
                                              type="checkbox" 
                                              checked={selectedPromptIds.includes(prompt.id)}
                                              onChange={(e) => {
                                                if (e.target.checked) setSelectedPromptIds([...selectedPromptIds, prompt.id]);
                                                else setSelectedPromptIds(selectedPromptIds.filter(id => id !== prompt.id));
                                              }}
                                              className="w-6 h-6 rounded-lg border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-950 cursor-pointer transition-all shadow-inner"
                                            />
                                          </div>
                                          <div>
                                            <h3 className="font-bold text-2xl text-blue-300 mb-3 tracking-tight">{prompt.title}</h3>
                                            <div className="flex flex-wrap gap-2">
                                              <span className="text-[10px] font-black bg-blue-900/30 text-blue-400 px-3 py-1 rounded-lg border border-blue-800/50 uppercase tracking-[0.15em]">{prompt.type}</span>
                                              {prompt.tags.map(t => <span key={t} className="text-[10px] font-bold bg-slate-800 text-slate-500 px-3 py-1 rounded-lg uppercase tracking-wider">{t}</span>)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right flex flex-col gap-2">
                                          <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Evaluation</div>
                                          <div className="text-sm font-bold text-slate-300 flex justify-between gap-4">
                                            <span className="opacity-50">Output:</span>
                                            <span className={getOutputTextClasses(prompt.outputQaScore, {t:prompt.outputQaScore})}>{prompt.outputQaScore}/12</span>
                                          </div>
                                          <div className="text-sm font-bold text-slate-300 flex justify-between gap-4">
                                            <span className="opacity-50">Quality:</span>
                                            <span className={getPromptTextClasses(prompt.promptQualityScore)}>{prompt.promptQualityScore}/7</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="relative group mb-8">
                                        <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/80 p-6 pr-14 rounded-2xl border border-slate-800/50 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 transition-all group-hover:border-slate-700 shadow-inner leading-relaxed">
                                          {prompt.promptText}
                                        </div>
                                        <button 
                                          onClick={() => handleCopy(prompt.id, prompt.promptText)}
                                          className="absolute top-4 right-4 p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-400 hover:text-white hover:scale-110 transition-all opacity-0 group-hover:opacity-100 shadow-2xl z-10"
                                        >
                                          {copiedId === prompt.id ? <Check size={20} className="text-emerald-400" /> : <Clipboard size={20} />}
                                        </button>
                                        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-900/40 to-transparent pointer-events-none rounded-r-2xl"></div>
                                      </div>
                                      
                                      {prompt.notes && (
                                        <div className="text-sm text-slate-400 mb-8 bg-blue-950/10 p-6 rounded-2xl border-l-4 border-blue-500/30 italic opacity-90 font-medium shadow-sm">
                                          <div className="text-[11px] font-black text-blue-500/50 uppercase tracking-[0.2em] mb-2 not-italic">Usage Notes</div>
                                          {prompt.notes}
                                        </div>
                                      )}

                                      <div className="flex justify-end gap-4 pt-6 border-t border-slate-800/30">
                                        <button onClick={() => handleMovePrompt(prompt.id, folder)} className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 px-6 py-3 rounded-xl text-sm font-black flex items-center gap-3 transition-all shadow-md active:scale-95">
                                          <FolderInput size={18} /> Move
                                        </button>
                                        <button onClick={() => {
                                            setModalConfig({
                                              isOpen: true,
                                              type: 'confirm',
                                              title: 'Delete Prompt',
                                              message: `Are you sure you want to permanently delete "${prompt.title}"?`,
                                              confirmText: 'Delete Prompt',
                                              cancelText: 'Cancel',
                                              onConfirm: () => {
                                                const newLib = savedPrompts.filter(p => p.id !== prompt.id);
                                                saveLibraryToLocal(newLib);
                                              }
                                            });
                                        }} className="text-sm font-black text-slate-600 hover:text-red-400 px-6 py-3 transition-all active:scale-95">Delete</button>
                                        <button onClick={() => loadIntoDashboard(prompt.promptText)} className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30 px-8 py-3 rounded-xl text-sm font-black flex items-center gap-3 transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95">
                                          <Play size={18} className="fill-current" /> Load Into Dashboard
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- OWNER CONSOLE VIEW --- */}
        {currentView === 'admin' && (
          <div className="max-w-xl mx-auto border border-slate-800 bg-slate-900 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Glowing effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none"></div>

            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Lock size={22} className="text-blue-500" /> Owner Console
              </h2>
              <p className="text-xs text-slate-400 mt-1">Generate time-limited passcode tokens for recruiters and employers.</p>
            </div>

            <form onSubmit={handleGenerateCode} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Master Key</label>
                <input 
                  type="password" 
                  value={adminMasterKey}
                  onChange={(e) => setAdminMasterKey(e.target.value)}
                  placeholder="Enter your server MASTER_KEY..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl p-3.5 text-white text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Access Expiry Duration</label>
                <select 
                  value={adminDuration}
                  onChange={(e) => setAdminDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl p-3.5 text-white text-sm outline-none transition-all"
                >
                  <option value="2">2 Hours</option>
                  <option value="12">12 Hours</option>
                  <option value="24">24 Hours (1 Day)</option>
                  <option value="72">72 Hours (3 Days)</option>
                  <option value="168">168 Hours (7 Days)</option>
                </select>
              </div>

              {adminError && (
                <div className="text-red-400 text-xs font-bold bg-red-950/20 border border-red-500/15 p-3.5 rounded-2xl flex items-center gap-2">
                  <AlertTriangle size={16} /> {adminError}
                </div>
              )}

              {adminSuccess && (
                <div className="text-emerald-400 text-xs font-bold bg-emerald-950/20 border border-emerald-500/15 p-3.5 rounded-2xl flex items-center gap-2">
                  <ShieldCheck size={16} /> {adminSuccess}
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-all duration-300 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 text-sm"
              >
                Generate Access Passcode
              </button>
            </form>

            {generatedCode && (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3 relative">
                <label className="block text-xs font-black text-blue-400 uppercase tracking-widest">Shareable Passcode</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedCode}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 select-all outline-none font-mono"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                      alert('Copied to clipboard!');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">Copy this code and send it to your recruiter. It will auto-expire exactly {adminDuration} hours after generation.</p>
              </div>
            )}
          </div>
        )}

            {/* Custom Themed Modal Implementation */}
            {modalConfig.isOpen && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-slate-800/50 px-8 py-6 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                      {modalConfig.type === 'input' && <Pencil size={20} className="text-blue-400" />}
                      {modalConfig.type === 'confirm' && <AlertTriangle size={20} className="text-yellow-500" />}
                      {modalConfig.type === 'choice' && <Trash2 size={20} className="text-red-400" />}
                      {modalConfig.title}
                    </h3>
                    <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="text-slate-500 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-8">
                    <p className="text-slate-300 mb-6 leading-relaxed">{modalConfig.message}</p>

                    {modalConfig.type === 'input' && (
                      <input 
                        autoFocus
                        type="text" 
                        value={modalConfig.inputValue} 
                        onChange={(e) => setModalConfig({ ...modalConfig, inputValue: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Type name here..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            modalConfig.onConfirm(modalConfig.inputValue);
                            setModalConfig({ ...modalConfig, isOpen: false });
                          }
                        }}
                      />
                    )}

                    <div className="flex flex-col gap-3 mt-8">
                      {modalConfig.type === 'choice' ? (
                        modalConfig.options.map(opt => (
                          <button 
                            key={opt.value}
                            onClick={() => {
                              modalConfig.onConfirm(opt.value);
                              setModalConfig({ ...modalConfig, isOpen: false });
                            }}
                            className={`w-full ${opt.class} text-white py-4 rounded-2xl font-bold shadow-lg transition-all`}
                          >
                            {opt.label}
                          </button>
                        ))
                      ) : (
                        <button 
                          onClick={() => {
                            modalConfig.onConfirm(modalConfig.inputValue || true);
                            setModalConfig({ ...modalConfig, isOpen: false });
                          }}
                          className={`w-full ${modalConfig.title.includes('Delete') ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} text-white py-4 rounded-2xl font-bold shadow-lg transition-all`}
                        >
                          {modalConfig.confirmText}
                        </button>
                      )}

                      <button 
                        onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 rounded-2xl font-bold text-sm transition-all"
                      >
                        {modalConfig.cancelText}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-slate-700">
              <h2 className="font-bold text-lg text-white flex items-center gap-2"><BookmarkPlus size={20} className="text-blue-400" /> Save to Library</h2>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {hasOptimizedTest && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Prompt Version to Save</label>
                  <select value={saveForm.source} onChange={(e) => setSaveForm({...saveForm, source: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="optimized">Optimized Prompt (Score: {totalOptimizedScore}/12)</option>
                    <option value="original">Original Prompt (Score: {totalScore}/12)</option>
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Title</label>
                <input type="text" value={saveForm.title} onChange={(e) => setSaveForm({...saveForm, title: e.target.value})} placeholder="e.g., Q3 Executive Summary" className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Folder</label>
                <input type="text" list="folder-options" value={saveForm.folder} onChange={(e) => setSaveForm({...saveForm, folder: e.target.value})} placeholder="e.g., Business Writing" className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none" />
                <datalist id="folder-options">
                  <option value="Marketing" />
                  <option value="Resume / LinkedIn" />
                  <option value="Email" />
                  <option value="AI Workflow" />
                  <option value="IT / Cybersecurity" />
                  <option value="Business Writing" />
                  <option value="Social Media" />
                  {[...new Set(savedPrompts.map(p=>p.folder))].map(f => <option key={`dl-${f}`} value={f} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tags (Comma separated)</label>
                <input type="text" value={saveForm.tags} onChange={(e) => setSaveForm({...saveForm, tags: e.target.value})} placeholder="e.g., Reporting, B2B, Internal" className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Notes (Optional)</label>
                <textarea value={saveForm.notes} onChange={(e) => setSaveForm({...saveForm, notes: e.target.value})} placeholder="Add any context on how to use this..." className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none h-20 resize-none" />
              </div>

            </div>
            <div className="bg-slate-800/50 p-4 border-t border-slate-700 flex justify-end gap-3">
              <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white">Cancel</button>
              <button onClick={handleSaveToLibrary} disabled={!saveForm.title || !saveForm.folder} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded font-bold text-sm shadow-md transition-colors">Save Prompt</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Loader Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings2 size={20} className="text-blue-400" /> Fill Template Variables
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Found {loadModalData.variables.length} placeholders in this prompt.</p>
              </div>
              <button onClick={() => setIsLoadModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {loadModalData.variables.map(variable => (
                <div key={variable}>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">
                    Value for: <span className="text-blue-400">{variable}</span>
                  </label>
                  <input 
                    type="text" 
                    value={loadModalData.values[variable] || ''} 
                    onChange={(e) => setLoadModalData({
                      ...loadModalData, 
                      values: { ...loadModalData.values, [variable]: e.target.value }
                    })}
                    placeholder={`Enter ${variable}...`}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              ))}
            </div>

            <div className="bg-slate-800/50 p-6 border-t border-slate-700 flex flex-col gap-3">
              <button 
                onClick={() => {
                  let filledText = loadModalData.text;
                  loadModalData.variables.forEach(v => {
                    const val = loadModalData.values[v] || `{{${v}}}`;
                    filledText = filledText.replaceAll(`{{${v}}}`, val);
                  });
                  executeLoad(filledText);
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Play size={16} /> Load with Filled Values
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => executeLoad(loadModalData.text)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-700"
                >
                  Load As Is
                </button>
                <button 
                  onClick={() => setIsLoadModalOpen(false)}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 text-slate-500 py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;