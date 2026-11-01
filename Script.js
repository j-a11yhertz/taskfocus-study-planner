// ====================================
// TASKFOCUS (STUDY PLANNER) - SUPABASE INTEGRATED
// ====================================

const USER_KEY = "taskFocusUser";

// 1. Supabase Credentials
const SUPABASE_URL = 'https://wyxvinnmwuiuwznptool.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5eHZpbm5td3VpdXd6bnB0b29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NjQ4MzgsImV4cCI6MjEwOTA0MDgzOH0.tYNect2Z_SQmdUGnvrur6VbHmFu4idaru0CEj0D2OwA'; // Your Actual Supabase public key!

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements - Auth
const loginOverlay = document.getElementById("loginOverlay");
const appContainer = document.getElementById("appContainer");
const authForm = document.getElementById("authForm");
const authUsername = document.getElementById("authUsername");
const logoutBtn = document.getElementById("logoutBtn");
const displayUsername = document.getElementById("displayUsername");

// DOM Elements - Task App
const taskForm = document.getElementById("taskForm");
const titleInput = document.getElementById("taskTitle");
const subjectInput = document.getElementById("taskSubject");
const formMessage = document.getElementById("formMessage");
const taskList = document.getElementById("taskList");
const emptyMessage = document.getElementById("emptyMessage");
const listHeading = document.getElementById("listHeading");
const filterButtons = document.querySelectorAll(".nav-link");
const todayDateEl = document.getElementById("todayDate");

let currentUser = null;
let tasks = [];
let currentFilter = "all";

// ---------- Initialization & Name Greeting ----------

function initAuth() {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
        currentUser = savedUser;
        showApp(currentUser);
    } else {
        if (loginOverlay) loginOverlay.style.display = "flex";
        if (appContainer) appContainer.style.display = "none";
        if (authUsername) authUsername.focus();
    }
}

function showApp(username) {
    if (displayUsername) {
        displayUsername.textContent = username;
    }
    if (loginOverlay) loginOverlay.style.display = "none";
    if (appContainer) appContainer.style.display = "flex";

    if (todayDateEl) {
        todayDateEl.textContent = new Date().toLocaleDateString(
            undefined,
            { weekday: "long", year: "numeric", month: "long", day: "numeric" }
        );
    }

    // Fetch tasks directly from Supabase
    fetchTasks();
}

if (authForm) {
    authForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const username = authUsername.value.trim();

        if (!username) {
            alert("Please enter your name to continue.");
            authUsername.focus();
            return;
        }

        localStorage.setItem(USER_KEY, username);
        currentUser = username;
        showApp(username);
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        localStorage.removeItem(USER_KEY);
        currentUser = null;
        tasks = [];
        if (appContainer) appContainer.style.display = "none";
        if (loginOverlay) loginOverlay.style.display = "flex";
        if (authUsername) {
            authUsername.value = "";
            authUsername.focus();
        }
    });
}

// ---------- Status Messages ----------

function showMessage(text, type) {
    if (!formMessage) return;
    formMessage.textContent = text;
    formMessage.className = "status-message" + (type ? " " + type : "");
}

// ---------- Supabase Fetch Operations ----------

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
            taskList.innerHTML = '<li class="empty-message" style="color: var(--absent);">Failed to load tasks. Check your Supabase key/connection.</li>';
        }
        return;
    }

    tasks = data || [];
    render();
}

// ---------- Adding a task to Supabase ----------

if (taskForm) {
    taskForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const title = titleInput.value.trim();
        const subject = subjectInput.value.trim() || "General";

        if (!title) {
            titleInput.classList.add("invalid");
            showMessage("Please enter a task title.", "error");
            titleInput.focus();
            return;
        }

        titleInput.classList.remove("invalid");

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
            console.error('Error adding task:', error);
            showMessage("Failed to save task to Supabase: " + error.message, "error");
        } else {
            showMessage("Task added successfully.", "success");
            setTimeout(() => { showMessage("", ""); }, 3000);
            taskForm.reset();
            if (titleInput) titleInput.focus();
            fetchTasks();
        }
    });
}

if (titleInput) {
    titleInput.addEventListener("input", function () {
        titleInput.classList.remove("invalid");
        if (formMessage && formMessage.classList.contains("error")) {
            showMessage("", "");
        }
    });
}

// ---------- Updating & Deleting on Supabase ----------

async function toggleTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    const newDoneStatus = !task.done;

    const { error } = await supabaseClient
        .from('Tasks')
        .update({ done: newDoneStatus })
        .eq('id', id);

    if (error) {
        console.error('Error updating task:', error);
        alert('Failed to update task.');
    } else {
        fetchTasks();
    }
}

async function deleteTask(id) {
    const { error } = await supabaseClient
        .from('Tasks')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task.');
    } else {
        fetchTasks();
    }
}

// ---------- Filtering ----------

filterButtons.forEach(button => {
    button.addEventListener("click", function () {
        currentFilter = button.dataset.filter;

        filterButtons.forEach(item => {
            item.classList.toggle("active", item === button);
        });

        render();
    });
});

// ---------- Rendering the list ----------

const HEADINGS = {
    all: "All Tasks",
    incomplete: "Incomplete Tasks",
    completed: "Completed Tasks"
};

function emptyText() {
    if (tasks.length === 0) {
        return "No tasks yet. Add your first task above to get started.";
    }
    if (currentFilter === "incomplete") {
        return "Nothing left to do. Every task is complete.";
    }
    return "No completed tasks yet. Tick a task when you finish it.";
}

function render() {
    if (listHeading) {
        listHeading.textContent = HEADINGS[currentFilter];
    }
    if (!taskList) return;

    taskList.innerHTML = "";

    const visible = tasks.filter(task => {
        if (currentFilter === "incomplete") return !task.done;
        if (currentFilter === "completed") return task.done;
        return true;
    });

    if (emptyMessage) {
        emptyMessage.hidden = visible.length > 0;
    }

    if (visible.length === 0) {
        if (emptyMessage) {
            emptyMessage.textContent = emptyText();
        }
        return;
    }

    visible.forEach(task => {
        const item = document.createElement("li");
        item.className = "task" + (task.done ? " done" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "task-" + task.id;
        checkbox.checked = task.done;
        checkbox.addEventListener("change", () => toggleTask(task.id));

        const body = document.createElement("div");
        body.className = "task-body";

        const title = document.createElement("label");
        title.className = "task-title";
        title.htmlFor = checkbox.id;
        title.textContent = task.title;

        const subject = document.createElement("span");
        subject.className = "badge";
        subject.textContent = task.subject || "General";

        body.appendChild(title);
        body.appendChild(subject);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", "Delete task: " + task.title);
        deleteButton.addEventListener("click", () => deleteTask(task.id));

        item.appendChild(checkbox);
        item.appendChild(body);
        item.appendChild(deleteButton);
        taskList.appendChild(item);
    });
}

// ---------- Start Application ----------
initAuth();