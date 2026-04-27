const API_BASE_URL = '';

const userForm = document.getElementById('userForm');
const userList = document.getElementById('userList');
const loading = document.getElementById('loading');

// Edit Modal Elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editId = document.getElementById('editId');
const editName = document.getElementById('editName');
const editEmail = document.getElementById('editEmail');

// Initial Load
document.addEventListener('DOMContentLoaded', fetchUsers);

// Fetch all users
async function fetchUsers() {
    loading.style.display = 'block';
    userList.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/read`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch users');
        }
        
        if (data.length === 0) {
            userList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No users found.</p>';
        } else {
            data.forEach(user => renderUser(user));
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        userList.innerHTML = `<p style="text-align: center; color: var(--danger);">Error: ${error.message}. <br><small>Make sure your .env file is configured correctly.</small></p>`;
    } finally {
        loading.style.display = 'none';
    }
}

// Render a single user item
function renderUser(user) {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.id = `user-${user.id}`;
    li.innerHTML = `
        <div class="user-info">
            <h3>${user.name}</h3>
            <p>${user.email}</p>
        </div>
        <div class="actions">
            <button class="btn-edit" onclick="openEditModal(${user.id}, '${user.name}', '${user.email}')">Edit</button>
            <button class="btn-delete" onclick="deleteUser(${user.id})">Delete</button>
        </div>
    `;
    userList.appendChild(li);
}

// Create new user
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;

    try {
        const response = await fetch(`${API_BASE_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        if (response.ok) {
            renderUser(data);
            userForm.reset();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Failed to connect to backend.');
    }
});

// Delete user
async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/delete/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            document.getElementById(`user-${id}`).remove();
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to connect to backend.');
    }
}

// Modal Handlers
function openEditModal(id, name, email) {
    editId.value = id;
    editName.value = name;
    editEmail.value = email;
    editModal.style.display = 'flex';
}

function closeModal() {
    editModal.style.display = 'none';
}

// Update user
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editId.value;
    const name = editName.value;
    const email = editEmail.value;

    try {
        const response = await fetch(`${API_BASE_URL}/update/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        if (response.ok) {
            const userEl = document.getElementById(`user-${id}`);
            userEl.querySelector('h3').innerText = data.name;
            userEl.querySelector('p').innerText = data.email;
            closeModal();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error updating user:', error);
        alert('Failed to connect to backend.');
    }
});

// --- AI Assistant Integration ---
const aiInput = document.getElementById('aiInput');
const aiSendBtn = document.getElementById('aiSendBtn');
const aiChat = document.getElementById('aiChat');

aiSendBtn.addEventListener('click', sendAIQuery);
aiInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAIQuery(); });

async function sendAIQuery() {
    const prompt = aiInput.value.trim();
    if (!prompt) return;

    addMessage(prompt, 'user-msg');
    aiInput.value = '';

    const typingId = showTypingIndicator();

    try {
        const response = await fetch(`${API_BASE_URL}/ai-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        const data = await response.json();
        removeTypingIndicator(typingId);

        if (response.ok) {
            handleAIResponse(data.response);
        } else {
            addMessage(`Error: ${data.error}`, 'ai-msg');
        }
    } catch (error) {
        removeTypingIndicator(typingId);
        addMessage('Failed to connect to AI backend. Make sure Ollama is running.', 'ai-msg');
    }
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message ai-msg typing-indicator';
    typingDiv.id = id;
    typingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    aiChat.appendChild(typingDiv);
    aiChat.scrollTop = aiChat.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function addMessage(text, className) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${className}`;
    msgDiv.innerText = text;
    aiChat.appendChild(msgDiv);
    aiChat.scrollTop = aiChat.scrollHeight;
}

function handleAIResponse(response) {
    // Try to extract and parse JSON if present
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
        try {
            const actionObj = JSON.parse(jsonMatch[0]);
            executeAIAction(actionObj);
            addMessage("Action executed successfully based on your request.", 'ai-msg');
        } catch (e) {
            addMessage(response, 'ai-msg');
        }
    } else {
        addMessage(response, 'ai-msg');
    }
}

async function executeAIAction(obj) {
    console.log("Executing AI Action:", obj);
    
    if (obj.action === 'CREATE') {
        const res = await fetch(`${API_BASE_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obj.data)
        });
        if (res.ok) fetchUsers();
    } 
    else if (obj.action === 'UPDATE') {
        const id = obj.condition.match(/\d+/)[0];
        const res = await fetch(`${API_BASE_URL}/update/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obj.data)
        });
        if (res.ok) fetchUsers();
    }
    else if (obj.action === 'DELETE') {
        const id = obj.condition.match(/\d+/)[0];
        const res = await fetch(`${API_BASE_URL}/delete/${id}`, { method: 'DELETE' });
        if (res.ok) fetchUsers();
    }
    else if (obj.action === 'READ') {
        // AI generated a query, we just refresh for now or show a message
        fetchUsers();
    }
}
