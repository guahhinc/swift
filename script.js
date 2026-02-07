// State
let employees = ['Taj', 'Alex', 'Gwish', 'Charlie', 'Indi'];
let currentUser = null;

// DOM Elements
const employeeDropdown = document.getElementById('employeeDropdown');
const currentEmployeeName = document.getElementById('current-employee-name');
const employeeList = document.getElementById('employee-list');
const mainContent = document.getElementById('main-content');
const taskListContainer = document.getElementById('task-list-container');
const notesArea = document.getElementById('notes-area');
const saveStatus = document.getElementById('save-status');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const taskDateInput = document.getElementById('task-date');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    renderEmployeeList();
    loadLastUser();
    setupEventListeners();
});

function setupEventListeners() {
    // Dropdown toggle
    window.toggleDropdown = function () {
        employeeDropdown.classList.toggle('active');
    };

    // Close dropdown on outside click
    window.onclick = function (e) {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
        }
        if (e.target === taskModal) {
            closeAddTaskModal();
        }
    };

    // Task Form
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask();
    });

    // Notes Auto-save
    notesArea.addEventListener('input', debounce(() => {
        saveNotes();
    }, 1000));
}

function initializeData() {
    // Ensure localStorage has structure
    let allTasks = JSON.parse(localStorage.getItem('guahh_tasks'));
    if (!allTasks) {
        allTasks = { 'Taj': [], 'Alex': [], 'Gwish': [], 'Charlie': [], 'Indi': [] };
    }

    // TASKS_DB is defined in tasks.js. Sync it into localStorage.
    if (typeof TASKS_DB !== 'undefined') {
        const syncedAllTasks = {};

        for (const [user, dbTasks] of Object.entries(TASKS_DB)) {
            // 1. Preserve ONLY explicitly manual tasks from storage
            // (Note: If this is the first run with this logic, all old tasks lack 'type', so they will be treated as stale file tasks and removed. This allows 'reset' to the file state, which matches user request).
            const existingTasks = allTasks[user] || [];
            const manualTasks = existingTasks.filter(t => t.type === 'manual');

            const fileTasks = dbTasks.map((dbTask, index) => {
                // Try to find ANY existing task (manual or file) with same desc to preserve 'completed' status
                const match = existingTasks.find(t => t.desc === dbTask.desc);

                // Parse date
                const parsedDate = parseCustomDate(dbTask.due);

                return {
                    id: match ? match.id : (Date.now() + index + Math.random()), // Keep ID if matched, else new
                    desc: dbTask.desc,
                    dueDate: parsedDate,
                    completed: match ? match.completed : false,
                    type: 'file', // Mark as file-sourced
                    workingWith: dbTask.workingWith || [] // Sync workingWith
                };
            });

            // Combine: File Tasks + Manual Tasks
            syncedAllTasks[user] = [...fileTasks, ...manualTasks];
        }

        // Update storage with the cleaner list
        allTasks = syncedAllTasks;
    }

    // Save synced data back to storage
    localStorage.setItem('guahh_tasks', JSON.stringify(allTasks));

    // Initialize Notes if missing
    if (!localStorage.getItem('guahh_notes')) {
        const initialNotes = {
            'Taj': '',
            'Alex': '',
            'Gwish': '',
            'Charlie': '',
            'Indi': ''
        };
        localStorage.setItem('guahh_notes', JSON.stringify(initialNotes));
    }
}

// Helper to parse "D-M-YYYY h:mmA" -> ISO String
function parseCustomDate(dateStr) {
    if (!dateStr) return ''; // Handle empty strings
    // Check if likely already ISO or standard format (contains T or just YYYY-MM-DD)
    if (dateStr.includes('T')) return dateStr;

    try {
        // Expected format: "12-2-2026 4:30PM"
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return ''; // Invalid or empty

        const [day, month, year] = datePart.split('-');

        // Remove AM/PM for parsing, get last 2 chars
        let time = timePart.slice(0, -2);
        let modifier = timePart.slice(-2).toUpperCase(); // PM/AM
        let [hours, minutes] = time.split(':');

        if (hours === '12') {
            hours = '00';
        }
        if (modifier === 'PM') {
            hours = parseInt(hours, 10) + 12;
        }

        // Pad single digits
        const pad = (n) => n.toString().padStart(2, '0');

        return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
    } catch (e) {
        console.error("Date parse error for:", dateStr);
        return '';
    }
}

function renderEmployeeList() {
    employeeList.innerHTML = '';
    employees.forEach(emp => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.textContent = emp;
        div.onclick = () => login(emp);
        employeeList.appendChild(div);
    });
}

function login(user) {
    currentUser = user;
    currentEmployeeName.textContent = user;
    localStorage.setItem('guahh_current_user', user); // Persistence

    // Highlight selected
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.textContent === user);
    });

    employeeDropdown.classList.remove('active');
    mainContent.classList.remove('hidden');

    loadUserContent();
}

function loadLastUser() {
    const lastUser = localStorage.getItem('guahh_current_user');
    if (lastUser && employees.includes(lastUser)) {
        login(lastUser);
    }
}

function loadUserContent() {
    renderTasks();
    loadNotes();
}

function getTasks() {
    const allTasks = JSON.parse(localStorage.getItem('guahh_tasks')) || {};
    return allTasks[currentUser] || [];
}

function saveTasks(tasks) {
    const allTasks = JSON.parse(localStorage.getItem('guahh_tasks')) || {};
    allTasks[currentUser] = tasks;
    localStorage.setItem('guahh_tasks', JSON.stringify(allTasks));
}

function renderTasks() {
    taskListContainer.innerHTML = '';
    let tasks = getTasks(); // Get current tasks
    const now = new Date();

    // Auto-delete expired tasks
    const activeTasks = tasks.filter(task => {
        if (!task.dueDate) return true; // Keep if no due date
        const dueDate = new Date(task.dueDate);
        return dueDate > now; // Keep only if due date is in the future
    });

    // If tasks were filtered out, save the new list
    if (activeTasks.length !== tasks.length) {
        tasks = activeTasks;
        saveTasks(tasks);
    }

    // Sort: Manual tasks often added recently, but let's just sort by date/completion for all
    const sortFn = (a, b) => {
        if (a.completed === b.completed) {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        return a.completed ? 1 : -1;
    };

    // Split into Assigned (file) and Custom (manual)
    const assignedTasks = tasks.filter(t => t.type === 'file').sort(sortFn);
    const customTasks = tasks.filter(t => t.type === 'manual').sort(sortFn);

    const renderTaskItem = (task) => {
        const isUrgent = task.dueDate && checkUrgency(task.dueDate) && !task.completed;

        // Filter out empty strings from workingWith
        const validCollaborators = (task.workingWith || []).filter(name => name && name.trim() !== '');

        const workingWith = validCollaborators.length > 0
            ? `<div class="working-with-badge" title="Collaborators"><span class="material-symbols-rounded" style="font-size: 14px;">group</span> ${validCollaborators.join(', ')}</div>`
            : '';

        const deleteButton = task.type === 'manual'
            ? `<button class="btn-icon delete-btn" onclick="deleteTask(${task.id})" title="Delete Task"><span class="material-symbols-rounded">delete</span></button>`
            : '';

        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="label-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${task.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${escapeHtml(task.desc)}</span>
                </div>
                 <div class="task-meta">
                     ${isUrgent ? '<span class="urgent-icon material-symbols-rounded" title="Due < 24h" style="font-size: 16px;">warning</span>' : ''}
                     <span>${formatDate(task.dueDate)}</span>
                     ${workingWith}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                 ${deleteButton}
                 <label class="toggle-wrapper">
                    <input type="checkbox" class="toggle-input" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id})">
                    <div class="toggle-track"></div>
                </label>
            </div>
        `;
        return div;
    };

    // Render Assigned Section
    if (assignedTasks.length > 0) {
        const header = document.createElement('h3');
        header.textContent = 'Assigned Tasks';
        header.style.cssText = 'font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; opacity: 0.7;';
        taskListContainer.appendChild(header);

        assignedTasks.forEach(task => {
            taskListContainer.appendChild(renderTaskItem(task));
        });
    }

    // Render Custom Section
    if (customTasks.length > 0) {
        // Add spacer if both exist
        if (assignedTasks.length > 0) {
            const spacer = document.createElement('div');
            spacer.style.height = '20px';
            taskListContainer.appendChild(spacer);
        }

        const header = document.createElement('h3');
        header.textContent = 'Custom Tasks';
        header.style.cssText = 'font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; opacity: 0.7;';
        taskListContainer.appendChild(header);

        customTasks.forEach(task => {
            taskListContainer.appendChild(renderTaskItem(task));
        });
    }

    if (tasks.length === 0) {
        taskListContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 10px; font-size: 14px;">No active tasks.</div>';
    }
}

function addTask() {
    const desc = document.getElementById('task-desc').value;
    const date = document.getElementById('task-date').value;

    if (!desc || !date) return;

    const tasks = getTasks();
    tasks.push({
        id: Date.now(),
        desc: desc,
        dueDate: date,
        completed: false,
        type: 'manual' // Explicitly mark as manual
    });

    saveTasks(tasks);
    renderTasks();
    closeAddTaskModal();
    taskForm.reset();
}

window.toggleTask = function (id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks(tasks);
        renderTasks();
    }
}

window.deleteTask = function (id) {
    if (confirm('Delete this task?')) {
        let tasks = getTasks();
        tasks = tasks.filter(t => t.id !== id);
        saveTasks(tasks);
        renderTasks();
    }
}

function loadNotes() {
    const allNotes = JSON.parse(localStorage.getItem('guahh_notes')) || {};
    notesArea.value = allNotes[currentUser] || '';
}

function saveNotes() {
    if (!currentUser) return;
    const allNotes = JSON.parse(localStorage.getItem('guahh_notes')) || {};
    allNotes[currentUser] = notesArea.value;
    localStorage.setItem('guahh_notes', JSON.stringify(allNotes));

    saveStatus.style.opacity = '1';
    setTimeout(() => {
        saveStatus.style.opacity = '0';
    }, 2000);
}

// Modal
window.openAddTaskModal = function () {
    // Default to tomorrow same time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    taskDateInput.value = tomorrow.toISOString().slice(0, 16);

    taskModal.classList.add('active');
}

window.closeAddTaskModal = function () {
    taskModal.classList.remove('active');
}

// Helpers
function checkUrgency(dateString) {
    const now = new Date();
    const due = new Date(dateString);
    const diffMs = due - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 0 && diffHours < 24;
}

function formatDate(dateString) {
    if (!dateString) return 'No Due Date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
