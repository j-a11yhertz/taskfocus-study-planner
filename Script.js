// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://wyxvinnmwuiuwznptool.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5eHZpbm5td3VpdXd6bnB0b29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NjQ4MzgsImV4cCI6MjEwOTA0MDgzOH0.tYNect2Z_SQmdUGnvrur6VbHmFu4idaru0CEj0D2OwA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- STATE MANAGEMENT ---
let tasks = [];
let currentUser = localStorage.getItem('taskfocus_user') || '';
let currentFilter = 'all'; // 'all', 'incomplete', 'completed'

// --- DOM ELEMENTS ---
const loginOverlay = document.getElementById('loginOverlay');
const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const appContainer = document.getElementById('appContainer');
const displayUsername = document.getElementById('displayUsername');
const logoutBtn = document.getElementById('logoutBtn');

const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskSubject = document.getElementById('taskSubject');
const taskList = document.getElementById('taskList');
const todayDate = document.getElementById('todayDate');
const filterButtons = document.querySelectorAll('.nav-link[data-filter]');
const listHeading = document.getElementById('listHeading');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (todayDate) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        todayDate.textContent = new Date().toLocaleDateString(undefined, options);
    }

    if (currentUser) {
        showAppScreen();
    } else {
        showLoginScreen();
    }

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin();
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

    // Filter button event listeners
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;

            if (listHeading) {
                if (currentFilter === 'incomplete') listHeading.textContent = 'Incomplete Tasks';
                else if (currentFilter === 'completed') listHeading.textContent = 'Completed Tasks';
                else listHeading.textContent = 'All Tasks';
            }
            render();
        });
    });
});

function handleLogin() {
    const name = authUsername.value.trim();
    if (!name) {
        alert('Please enter your name.');
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
    if (loginOverlay) loginOverlay.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    if (authUsername) authUsername.value = '';
}

function showAppScreen() {
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
    if (displayUsername) displayUsername.textContent = currentUser;
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
        .eq('username', currentUser)
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
    const title = taskTitle.value.trim();
    const subject = taskSubject.value.trim() || 'General';

    if (!title) return;

    const newTask = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        title: title,
        subject: subject,
        done: false,
        username: currentUser
    };

    const { error } = await supabaseClient
        .from('Tasks')
        .insert([newTask]);

    if (error) {
        console.error('Error adding task to Supabase:', error);
        alert('Failed to save task.');
        return;
    }

    taskTitle.value = '';
    taskSubject.value = '';
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
    if (!titleSpan) return;
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

    // Filter tasks based on current selection
    const filteredTasks = tasks.filter(task => {
        if (currentFilter === 'incomplete') return !task.done;
        if (currentFilter === 'completed') return task.done;
        return true; // 'all'
    });

    if (filteredTasks.length === 0) {
        taskList.innerHTML = `<li class="empty-message">No ${currentFilter !== 'all' ? currentFilter : ''} study tasks found.</li>`;
        return;
    }

    taskList.innerHTML = '';
    filteredTasks.forEach(task => {
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