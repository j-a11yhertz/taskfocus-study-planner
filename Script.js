// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://wyxvinnmwuiwznptool.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5eHZpbm5td3VpdXd6bnB0b29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NjQ4MzgsImV4cCI6MjEwOTA0MDgzOH0.tYNect2Z_SQmdUGnvrur6VbHmFu4idaru0CEj0D2OwA'; // Replace with your actual anon key

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- STATE MANAGEMENT ---
let tasks = [];
let currentUser = localStorage.getItem('taskfocus_user') || '';

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const currentUserDisplay = document.getElementById('current-user-display');
const logoutBtn = document.getElementById('logout-btn');

const taskForm = document.getElementById('task-form');
const titleInput = document.getElementById('title-input');
const subjectInput = document.getElementById('subject-input');
const taskList = document.getElementById('task-list');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showAppScreen();
    } else {
        showLoginScreen();
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskSubmit);
    }
    if (taskList) {
        taskList.addEventListener('click', handleTaskListClick);
    }
});

function handleLogin() {
    const name = usernameInput.value.trim();
    if (!name) {
        alert('Please enter a username.');
        return;
    }
    currentUser = name;
    localStorage.setItem('taskfocus_user', currentUser);
    showAppScreen();
}

function handleLogout() {
    currentUser = '';
    localStorage.removeItem('taskfocus_user');
    showLoginScreen();
}

function showLoginScreen() {
    if (loginScreen) loginScreen.style.display = 'block';
    if (appScreen) appScreen.style.display = 'none';
    if (usernameInput) usernameInput.value = '';
}

function showAppScreen() {
    if (loginScreen) loginScreen.style.display = 'none';
    if (appScreen) appScreen.style.display = 'block';
    if (currentUserDisplay) currentUserDisplay.textContent = currentUser;
    fetchTasks();
}

// --- SUPABASE OPERATIONS ---

async function fetchTasks() {
    if (taskList) {
        taskList.innerHTML = '<li class="empty-message">Loading study tasks...</li>';
    }

    const { data, error } = await supabaseClient
        .from('Tasks')
        .select('*')
        .eq('username', currentUser) // Filters tasks by current logged-in user
        .order('id', { ascending: false });

    if (error) {
        console.error('Error fetching tasks from Supabase:', error);
        if (taskList) {
            taskList.innerHTML = '<li class="empty-message" style="color: #e71d36;">Failed to load tasks. Check connection.</li>';
        }
        return;
    }

    tasks = data || [];
    render();
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const title = titleInput.value.trim();
    const subject = subjectInput.value.trim() || 'General';

    if (!title) return;

    const newTask = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        title: title,
        subject: subject,
        done: false,
        username: currentUser // Saves task tied to the user
    };

    const { error } = await supabaseClient
        .from('Tasks')
        .insert([newTask]);

    if (error) {
        console.error('Error adding task to Supabase:', error);
        alert('Failed to save task.');
        return;
    }

    titleInput.value = '';
    subjectInput.value = '';
    fetchTasks();
}

async function deleteTask(taskId) {
    const { error } = await supabaseClient
        .from('Tasks')
        .delete()
        .eq('id', taskId)
        .eq('username', currentUser);

    if (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task.');
        return;
    }

    fetchTasks();
}

async function toggleTaskDone(taskId, currentDoneStatus) {
    const { error } = await supabaseClient
        .from('Tasks')
        .update({ done: !currentDoneStatus })
        .eq('id', taskId)
        .eq('username', currentUser);

    if (error) {
        console.error('Error updating task status:', error);
        return;
    }

    fetchTasks();
}

// --- EDIT TASK FUNCTIONS ---

function startEditing(taskItem, taskId) {
    const titleSpan = taskItem.querySelector('.task-title');
    const currentTitle = titleSpan.textContent;

    titleSpan.innerHTML = `
        <input type="text" class="edit-input" value="${escapeHtml(currentTitle)}" />
        <button class="btn-save">Save</button>
        <button class="btn-cancel">Cancel</button>
    `;

    const editInput = titleSpan.querySelector('.edit-input');
    editInput.focus();

    titleSpan.querySelector('.btn-save').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newTitle = editInput.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            await updateTaskTitle(taskId, newTitle);
        } else {
            render();
        }
    });

    titleSpan.querySelector('.btn-cancel').addEventListener('click', (e) => {
        e.stopPropagation();
        render();
    });
}

async function updateTaskTitle(taskId, newTitle) {
    const { error } = await supabaseClient
        .from('Tasks')
        .update({ title: newTitle })
        .eq('id', taskId)
        .eq('username', currentUser);

    if (error) {
        console.error('Error updating task title:', error);
        alert('Failed to update task.');
        return;
    }

    fetchTasks();
}

// --- EVENT ROUTING FOR TASK LIST ---

async function handleTaskListClick(e) {
    const taskItem = e.target.closest('.task-item');
    if (!taskItem) return;
    const taskId = taskItem.dataset.id;

    if (e.target.classList.contains('btn-edit')) {
        startEditing(taskItem, taskId);
    } else if (e.target.classList.contains('btn-delete')) {
        await deleteTask(taskId);
    } else if (e.target.classList.contains('task-checkbox') || e.target.classList.contains('task-content')) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            await toggleTaskDone(taskId, task.done);
        }
    }
}

// --- UTILITY ---
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function render() {
    if (!taskList) return;

    if (tasks.length === 0) {
        taskList.innerHTML = '<li class="empty-message">No study tasks found. Add one above!</li>';
        return;
    }

    taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.done ? 'completed' : ''}`;
        li.dataset.id = task.id;

        li.innerHTML = `
            <div class="task-content">
                <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''}>
                <span class="task-title">${escapeHtml(task.title)}</span>
                <span class="task-subject">${escapeHtml(task.subject || 'General')}</span>
            </div>
            <div class="task-actions">
                <button class="btn-edit" title="Edit Task">Edit</button>
                <button class="btn-delete" title="Delete Task">Delete</button>
            </div>
        `;
        taskList.appendChild(li);
    });
}