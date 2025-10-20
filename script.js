// ==========================================
// FUNÇÃO PARA EXTRAIR TOKEN DA URL
// ==========================================
function getTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
}

// ==========================================
// VERIFICAÇÃO DE TOKEN CORRIGIDA
// ==========================================
async function verificarToken() {
    // 1. Tentar pegar token da URL primeiro
    let token = getTokenFromURL();
    
    // 2. Se não tiver na URL, tentar pegar do sessionStorage
    if (!token) {
        token = sessionStorage.getItem('authToken'); // CORRIGIDO: era 'jwtToken'
    }
    
    // 3. Se não tiver no sessionStorage, tentar localStorage
    if (!token) {
        token = localStorage.getItem('authToken'); // CORRIGIDO: era 'jwtToken'
    }

    if (!token) {
        alert('Acesso negado! Faça login no sistema central.');
        window.location.href = 'https://sistema-central-front.onrender.com';
        return false;
    }

    // Salvar token para uso posterior
    sessionStorage.setItem('authToken', token);
    localStorage.setItem('authToken', token); // Salvar também no localStorage

    try {
        // Tentativa de acessar /api/cotacoes para validar token
        const response = await fetch('https://cotacoes-frete-back.onrender.com/api/cotacoes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // Token inválido ou sem permissão
            alert('Token inválido ou expirado! Faça login novamente.');
            sessionStorage.removeItem('authToken');
            localStorage.removeItem('authToken');
            window.location.href = 'https://sistema-central-front.onrender.com';
            return false;
        }

        return true; // Token válido
    } catch (err) {
        console.error('Erro de autenticação:', err);
        alert('Erro de autenticação! Redirecionando...');
        window.location.href = 'https://sistema-central-front.onrender.com';
        return false;
    }
}

// ==========================================
// FUNÇÃO FETCH COM AUTENTICAÇÃO (CORRIGIDA)
// ==========================================
async function fetchComAutenticacao(url, options = {}) {
    // Pegar token do sessionStorage ou localStorage
    let token = sessionStorage.getItem('authToken');
    if (!token) {
        token = localStorage.getItem('authToken');
    }
    
    if (!token) throw new Error('Token ausente');

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    return fetch(url, {
        ...options,
        headers,
        cache: 'no-cache'
    });
}

// ==========================================
// CONFIGURAÇÕES GERAIS
// ==========================================
const API_URL = 'https://cotacoes-frete-back.onrender.com/api/cotacoes';
const STORAGE_KEY = 'cotacoes_frete';
const POLLING_INTERVAL = 3000;

let cotacoes = [];
let isOnline = false;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let isSubmitting = false;

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ==========================================
// INICIALIZAÇÃO
// ==========================================
async function iniciarModulo() {
    setTodayDate();
    await loadCotacoes();
    updateMonthDisplay();
    startRealtimeSync();
}

document.addEventListener('DOMContentLoaded', async () => {
    const valido = await verificarToken();
    if (!valido) return;
    iniciarModulo();
});

// ==========================================
// FUNÇÕES DE INTERFACE DE MÊS
// ==========================================
function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = `${meses[currentMonth]} ${currentYear}`;
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateMonthDisplay();
    filterCotacoes();
}

// ==========================================
// SINCRONIZAÇÃO EM TEMPO REAL
// ==========================================
function startRealtimeSync() {
    setInterval(async () => {
        if (isOnline && !isSubmitting) await checkForUpdates();
    }, POLLING_INTERVAL);
}

async function checkForUpdates() {
    try {
        const response = await fetchComAutenticacao(API_URL);
        if (!response.ok) return;

        const serverData = await response.json();
        if (hasDataChanged(serverData)) {
            cotacoes = serverData;
            saveToLocalStorage(cotacoes);
            filterCotacoes();
            showRealtimeUpdate();
        }
    } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
    }
}

function hasDataChanged(newData) {
    if (cotacoes.length !== newData.length) return true;

    const currentIds = new Set(cotacoes.map(c => c.id));
    const newIds = new Set(newData.map(c => c.id));

    if (currentIds.size !== newIds.size) return true;

    for (let id of newIds) if (!currentIds.has(id)) return true;

    for (let newItem of newData) {
        const oldItem = cotacoes.find(c => c.id === newItem.id);
        if (oldItem && JSON.stringify(oldItem) !== JSON.stringify(newItem)) return true;
    }

    return false;
}

function showRealtimeUpdate() {
    const notification = document.createElement('div');
    notification.className = 'realtime-notification';
    notification.innerHTML = 'Dados atualizados';
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==========================================
// STATUS DO SERVIDOR
// ==========================================
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL.replace('/api/cotacoes', '/health')}`, { 
            method: 'GET',
            cache: 'no-cache'
        });
        isOnline = response.ok;
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;

    if (isOnline) {
        statusDiv.className = 'connection-status online';
        statusDiv.querySelector('span:last-child').textContent = 'Online';
    } else {
        statusDiv.className = 'connection-status offline';
        statusDiv.querySelector('span:last-child').textContent = 'Offline';
    }
}

// ==========================================
// LOCAL STORAGE
// ==========================================
function saveToLocalStorage(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Erro ao salvar:', error);
        return false;
    }
}

function loadFromLocalStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Erro ao carregar:', error);
        return [];
    }
}

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dataCotacao').value = today;
}

async function loadCotacoes() {
    const serverOnline = await checkServerStatus();
    try {
        if (serverOnline) {
            const response = await fetchComAutenticacao(API_URL);
            if (!response.ok) throw new Error('Erro ao carregar cotações');
            cotacoes = await response.json();
            saveToLocalStorage(cotacoes);
        } else {
            cotacoes = loadFromLocalStorage();
        }
        filterCotacoes();
    } catch (error) {
        console.error('Erro:', error);
        cotacoes = loadFromLocalStorage();
        filterCotacoes();
        showMessage('Modo offline ativo', 'info');
    }
}

// ==========================================
// SUBMISSÃO DO FORMULÁRIO
// ==========================================
async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    isSubmitting = true;
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span id="submitIcon"></span> <span id="submitText">Salvando...</span>';

    const formData = getFormData();
    const editId = document.getElementById('editId').value;

    try {
        let tempId = null;
        let novaCotacao = null;

        if (editId) {
            const index = cotacoes.findIndex(c => c.id === editId);
            if (index !== -1) cotacoes[index] = { ...formData, id: editId, timestamp: cotacoes[index].timestamp };
        } else {
            tempId = 'temp_' + Date.now();
            novaCotacao = { ...formData, id: tempId, timestamp: new Date().toISOString() };
            cotacoes.unshift(novaCotacao);
        }

        saveToLocalStorage(cotacoes);
        filterCotacoes();
        showMessage(editId ? '✔ Cotação atualizada!' : '✔ Cotação registrada!', 'success');
        resetForm();

        const serverOnline = await checkServerStatus();
        if (serverOnline) {
            try {
                let response;
                if (editId) {
                    response = await fetchComAutenticacao(`${API_URL}/${editId}`, { method: 'PUT', body: JSON.stringify(formData) });
                } else {
                    response = await fetchComAutenticacao(API_URL, { method: 'POST', body: JSON.stringify(formData) });
                }

                if (response.ok) {
                    const savedData = await response.json();
                    if (tempId) {
                        const index = cotacoes.findIndex(c => c.id === tempId);
                        if (index !== -1) { cotacoes[index] = savedData; saveToLocalStorage(cotacoes); filterCotacoes(); }
                    } else if (editId) {
                        const index = cotacoes.findIndex(c => c.id === editId);
                        if (index !== -1) { cotacoes[index] = savedData; saveToLocalStorage(cotacoes); filterCotacoes(); }
                    }
                } else throw new Error('Erro ao salvar no servidor');
            } catch (error) {
                console.error('Erro ao sincronizar com servidor:', error);
                showMessage('⚠️ Salvo localmente', 'info');
            }
        }
    } catch (error) {
        console.error('Erro:', error);
        showMessage('❌ Erro ao processar cotação', 'error');
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span id="submitIcon">✓</span> <span id="submitText">Registrar Cotação</span>';
    }
}

// ==========================================
// CRUD / STATUS
// ==========================================
function editCotacao(id) {
    const cotacao = cotacoes.find(c => c.id === id);
    if (!cotacao) return;

    document.getElementById('editId').value = id;
    document.getElementById('responsavelCotacao').value = cotacao.responsavelCotacao;
    document.getElementById('transportadora').value = cotacao.transportadora;
    document.getElementById('destino').value = cotacao.destino || '';
    document.getElementById('numeroCotacao').value = cotacao.numeroCotacao || '';
    document.getElementById('valorFrete').value = cotacao.valorFrete;
    document.getElementById('vendedor').value = cotacao.vendedor || '';
    document.getElementById('numeroDocumento').value = cotacao.numeroDocumento || '';
    document.getElementById('previsaoEntrega').value = cotacao.previsaoEntrega || '';
    document.getElementById('canalComunicacao').value = cotacao.canalComunicacao || '';
    document.getElementById('codigoColeta').value = cotacao.codigoColeta || '';
    document.getElementById('responsavelTransportadora').value = cotacao.responsavelTransportadora || '';
    document.getElementById('dataCotacao').value = cotacao.dataCotacao;
    document.getElementById('observacoes').value = cotacao.observacoes || '';

    document.getElementById('formTitle').textContent = 'Editar Cotação';
    document.getElementById('submitIcon').textContent = '✏️';
    document.getElementById('submitText').textContent = 'Atualizar Cotação';
    document.getElementById('cancelBtn').classList.remove('hidden');
    document.getElementById('formCard').classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteCotacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;

    const cotacaoBackup = cotacoes.find(c => c.id === id);
    cotacoes = cotacoes.filter(c => c.id !== id);
    saveToLocalStorage(cotacoes);
    filterCotacoes();
    showMessage('✔ Cotação excluída!', 'success');

    const serverOnline = await checkServerStatus();
    if (serverOnline) {
        try {
            const response = await fetchComAutenticacao(`${API_URL}/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Erro ao excluir no servidor');
        } catch (error) {
            console.error('Erro ao sincronizar exclusão:', error);
            if (cotacaoBackup) {
                cotacoes.push(cotacaoBackup);
                cotacoes.sort((a, b) => new Date(b.timestamp || b.dataCotacao) - new Date(a.timestamp || a.dataCotacao));
                saveToLocalStorage(cotacoes);
                filterCotacoes();
                showMessage('❌ Erro ao excluir. Registro restaurado.', 'error');
            }
        }
    }
}

async function toggleNegocio(id) {
    const cotacao = cotacoes.find(c => c.id === id);
    if (!cotacao) return;

    const estadoAnterior = cotacao.negocioFechado;
    cotacao.negocioFechado = !cotacao.negocioFechado;
    saveToLocalStorage(cotacoes);
    filterCotacoes();
    showMessage(cotacao.negocioFechado ? '✔ Negócio fechado!' : '✔ Marcação removida!', 'success');

    const serverOnline = await checkServerStatus();
    if (serverOnline) {
        try {
            const response = await fetchComAutenticacao(`${API_URL}/${id}`, {
                method: 'PUT',
                body: JSON.stringify(cotacao)
            });
            if (!response.ok) throw new Error('Erro ao atualizar status');
        } catch (error) {
            console.error('Erro ao sincronizar status:', error);
            cotacao.negocioFechado = estadoAnterior;
            saveToLocalStorage(cotacoes);
            filterCotacoes();
            showMessage('❌ Erro ao atualizar. Status revertido.', 'error');
        }
    }
}

// ==========================================
// FORMULÁRIO / UTILITÁRIOS
// ==========================================
function getFormData() {
    return {
        responsavelCotacao: document.getElementById('responsavelCotacao').value,
        transportadora: document.getElementById('transportadora').value,
        destino: document.getElementById('destino').value,
        numeroCotacao: document.getElementById('numeroCotacao').value || 'Não Informado',
        valorFrete: parseFloat(document.getElementById('valorFrete').value),
        vendedor: document.getElementById('vendedor').value || 'Não Informado',
        numeroDocumento: document.getElementById('numeroDocumento').value || 'Não Informado',
        previsaoEntrega: document.getElementById('previsaoEntrega').value || 'Não Informado',
        canalComunicacao: document.getElementById('canalComunicacao').value || 'Não Informado',
        codigoColeta: document.getElementById('codigoColeta').value || 'Não Informado',
        responsavelTransportadora: document.getElementById('responsavelTransportadora').value || 'Não Informado',
        dataCotacao: document.getElementById('dataCotacao').value,
        observacoes: document.getElementById('observacoes').value || '',
        negocioFechado: false
    };
}

function resetForm() {
    document.getElementById('cotacaoForm').reset();
    document.getElementById('editId').value = '';
    document.getElementById('formTitle').textContent = 'Nova Cotação';
    document.getElementById('submitIcon').textContent = '✓';
    document.getElementById('submitText').textContent = 'Registrar Cotação';
    document.getElementById('cancelBtn').classList.add('hidden');
    setTodayDate();
}

function cancelEdit() { resetForm(); }

function toggleForm() {
    const formCard = document.getElementById('formCard');
    const button = event.currentTarget;
    formCard.classList.toggle('hidden');
    button.textContent = formCard.classList.contains('hidden') ? 'Nova Cotação' : 'Ocultar Formulário';
    if (!formCard.classList.contains('hidden')) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// FILTROS / RENDERIZAÇÃO
// ==========================================
function filterCotacoes() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filterResp = document.getElementById('filterResponsavel').value;
    const filterTrans = document.getElementById('filterTransportadora').value;
    const filterStatus = document.getElementById('filterStatus').value;

    let filtered = cotacoes.filter(c => {
        const cotacaoDate = new Date(c.dataCotacao);
        return cotacaoDate.getMonth() === currentMonth && cotacaoDate.getFullYear() === currentYear;
    });

    if (searchTerm)
        filtered = filtered.filter(c =>
            c.transportadora.toLowerCase().includes(searchTerm) ||
            c.numeroCotacao.toLowerCase().includes(searchTerm) ||
            (c.vendedor && c.vendedor.toLowerCase().includes(searchTerm)) ||
            c.numeroDocumento.toLowerCase().includes(searchTerm) ||
            c.codigoColeta.toLowerCase().includes(searchTerm) ||
            c.responsavelTransportadora.toLowerCase().includes(searchTerm) ||
            (c.destino && c.destino.toLowerCase().includes(searchTerm))
        );

    if (filterResp) filtered = filtered.filter(c => c.responsavelCotacao === filterResp);
    if (filterTrans) filtered = filtered.filter(c => c.transportadora === filterTrans);

    if (filterStatus) {
        if (filterStatus === 'fechado') filtered = filtered.filter(c => c.negocioFechado);
        else if (filterStatus === 'aberto') filtered = filtered.filter(c => !c.negocioFechado);
    }

    renderCotacoes(filtered);
}

function renderCotacoes(filtered) {
    const container = document.getElementById('cotacoesContainer');
    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Nenhuma cotação encontrada para ${meses[currentMonth]} de ${currentYear}.</p>`;
        return;
    }

    filtered.sort((a, b) => new Date(b.timestamp || b.dataCotacao) - new Date(a.timestamp || a.dataCotacao));
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Status</th><th>Resp.</th><th>Transportadora</th><th>Destino</th><th>Nº Cotação</th>
                    <th>Valor</th><th>Vendedor</th><th>Documento</th><th>Previsão</th>
                    <th>Código Coleta</th><th>Data</th><th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(c => `
                    <tr class="${c.negocioFechado ? 'negocio-fechado' : ''}">
                        <td><button class="small ${c.negocioFechado ? 'success' : 'secondary'}" onclick="toggleNegocio('${c.id}')">✓</button></td>
                        <td><span class="badge ${c.negocioFechado ? 'fechado' : ''}">${c.responsavelCotacao}</span></td>
                        <td>${c.transportadora}</td><td>${c.destino || 'Não Informado'}</td>
                        <td>${c.numeroCotacao}</td><td class="valor">R$ ${c.valorFrete.toFixed(2)}</td>
                        <td>${c.vendedor}</td><td>${c.numeroDocumento}</td>
                        <td>${c.previsaoEntrega}</td><td>${c.codigoColeta}</td>
                        <td>${formatDate(c.dataCotacao)}</td>
                        <td class="actions">
                            <button class="small secondary" onclick="editCotacao('${c.id}')">Editar</button>
                            <button class="small danger" onclick="deleteCotacao('${c.id}')">Excluir</button>
                        </td>
                    </tr>
                    ${c.observacoes ? `<tr class="observacoes-row ${c.negocioFechado ? 'negocio-fechado' : ''}"><td colspan="12"><strong>📝 Observações:</strong> ${c.observacoes}</td></tr>` : ''}
                `).join('')}
            </tbody>
        </table>`;
    container.innerHTML = tableHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function showMessage(message, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.classList.add('show'), 100);
    setTimeout(() => {
        div.classList.remove('show');
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

