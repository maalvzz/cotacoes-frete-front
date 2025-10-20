// ✅ CONFIGURAÇÕES GERAIS - RENDER (PRODUÇÃO)
const API_URL = 'https://cotacoes-frete-back.onrender.com/api/cotacoes';
const STORAGE_KEY = 'cotacoes_frete';
const POLLING_INTERVAL = 5000; // 5 segundos

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
// FUNÇÃO AUXILIAR PARA REQUISIÇÕES (SEM TOKEN)
// ==========================================
async function fetchAPI(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    return fetch(url, {
        ...options,
        headers,
        cache: 'no-store'
    });
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Aplicação iniciada - Modo Produção (Render)');
    setTodayDate();
    loadCotacoes();
    updateMonthDisplay();
    startRealtimeSync();
});

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
        if (isOnline && !isSubmitting) {
            await checkForUpdates();
        }
    }, POLLING_INTERVAL);
}

async function checkForUpdates() {
    try {
        const response = await fetchAPI(API_URL);
        if (!response.ok) return;

        const serverData = await response.json();
        if (hasDataChanged(serverData)) {
            console.log('📥 Dados atualizados do servidor');
            cotacoes = serverData;
            saveToLocalStorage(cotacoes);
            filterCotacoes();
            showRealtimeUpdate();
        }
    } catch (error) {
        console.error('⚠️ Erro ao verificar atualizações:', error);
    }
}

function hasDataChanged(newData) {
    if (cotacoes.length !== newData.length) return true;

    const currentIds = new Set(cotacoes.map(c => c.id));
    const newIds = new Set(newData.map(c => c.id));

    if (currentIds.size !== newIds.size) return true;

    for (let id of newIds) {
        if (!currentIds.has(id)) return true;
    }

    for (let newItem of newData) {
        const oldItem = cotacoes.find(c => c.id === newItem.id);
        if (oldItem && JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
            return true;
        }
    }

    return false;
}

function showRealtimeUpdate() {
    const notification = document.createElement('div');
    notification.className = 'realtime-notification';
    notification.innerHTML = '✅ Dados atualizados';
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==========================================
// VERIFICAÇÃO DE STATUS DO SERVIDOR
// ==========================================
async function checkServerStatus() {
    try {
        const healthURL = API_URL.replace('/api/cotacoes', '/health');
        const response = await fetch(healthURL, { 
            method: 'GET',
            cache: 'no-store'
        });
        
        isOnline = response.ok;
        updateConnectionStatus();
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Servidor:', data.status, '| DB:', data.database, '| Cache:', data.cache);
        }
        
        return isOnline;
    } catch (error) {
        console.error('❌ Servidor offline:', error.message);
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
        console.log(`💾 ${data.length} cotações salvas localmente`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        return false;
    }
}

function loadFromLocalStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const data = stored ? JSON.parse(stored) : [];
        console.log(`💾 ${data.length} cotações carregadas do localStorage`);
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
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
    console.log('📋 Carregando cotações do Render...');
    const serverOnline = await checkServerStatus();
    
    try {
        if (serverOnline) {
            console.log('🌐 Buscando do servidor Render...');
            const response = await fetchAPI(API_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            cotacoes = await response.json();
            console.log(`✅ ${cotacoes.length} cotações carregadas do Render`);
            saveToLocalStorage(cotacoes);
        } else {
            console.log('💾 Servidor offline - usando dados locais');
            cotacoes = loadFromLocalStorage();
        }
        
        filterCotacoes();
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
        cotacoes = loadFromLocalStorage();
        filterCotacoes();
        showMessage('⚠️ Modo offline - usando dados locais', 'info');
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
        console.log('⏳ Submissão já em andamento');
        return;
    }

    isSubmitting = true;
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span> <span>Salvando...</span>';

    const formData = getFormData();
    const editId = document.getElementById('editId').value;

    console.log('📝 Enviando para Render:', formData);

    try {
        const serverOnline = await checkServerStatus();
        
        if (!serverOnline) {
            throw new Error('Servidor offline');
        }

        let response;
        let url;
        let method;

        if (editId) {
            url = `${API_URL}/${editId}`;
            method = 'PUT';
            console.log(`✏️ Atualizando cotação ${editId}...`);
        } else {
            url = API_URL;
            method = 'POST';
            console.log('➕ Criando nova cotação...');
        }

        response = await fetchAPI(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erro do servidor:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const savedData = await response.json();
        console.log('✅ Salvo no Render:', savedData);

        // Atualiza array local
        if (editId) {
            const index = cotacoes.findIndex(c => c.id === editId);
            if (index !== -1) {
                cotacoes[index] = savedData;
            }
        } else {
            cotacoes.unshift(savedData);
        }

        saveToLocalStorage(cotacoes);
        filterCotacoes();
        showMessage(editId ? '✅ Cotação atualizada!' : '✅ Cotação registrada!', 'success');
        resetForm();

        // Recarrega do servidor para garantir sincronização
        setTimeout(() => loadCotacoes(), 1000);

    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        showMessage('❌ Erro ao salvar. Verifique sua conexão.', 'error');
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
}

// ==========================================
// CRUD: EDIÇÃO / EXCLUSÃO / STATUS
// ==========================================
function editCotacao(id) {
    const cotacao = cotacoes.find(c => c.id === id);
    if (!cotacao) {
        console.error('❌ Cotação não encontrada:', id);
        return;
    }

    console.log('✏️ Editando cotação:', id);

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
    
    console.log('🗑️ Deletando cotação:', id);

    try {
        const serverOnline = await checkServerStatus();
        
        if (!serverOnline) {
            throw new Error('Servidor offline');
        }

        const response = await fetchAPI(`${API_URL}/${id}`, { method: 'DELETE' });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        console.log('✅ Exclusão confirmada no Render');
        
        // Remove da UI
        cotacoes = cotacoes.filter(c => c.id !== id);
        saveToLocalStorage(cotacoes);
        filterCotacoes();
        showMessage('✅ Cotação excluída!', 'success');
        
        // Recarrega do servidor
        setTimeout(() => loadCotacoes(), 1000);
        
    } catch (error) {
        console.error('❌ Erro ao excluir:', error);
        showMessage('❌ Erro ao excluir. Verifique sua conexão.', 'error');
    }
}

async function toggleNegocio(id) {
    const cotacao = cotacoes.find(c => c.id === id);
    if (!cotacao) return;
    
    console.log('🔄 Alterando status:', id);

    const estadoAnterior = cotacao.negocioFechado;
    cotacao.negocioFechado = !cotacao.negocioFechado;
    
    try {
        const serverOnline = await checkServerStatus();
        
        if (!serverOnline) {
            throw new Error('Servidor offline');
        }

        const response = await fetchAPI(`${API_URL}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(cotacao)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        console.log('✅ Status sincronizado no Render');
        
        saveToLocalStorage(cotacoes);
        filterCotacoes();
        showMessage(cotacao.negocioFechado ? '✅ Negócio fechado!' : '✅ Marcação removida!', 'success');
        
        // Recarrega do servidor
        setTimeout(() => loadCotacoes(), 1000);
        
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        
        // Reverte se falhar
        cotacao.negocioFechado = estadoAnterior;
        saveToLocalStorage(cotacoes);
        filterCotacoes();
        showMessage('❌ Erro ao atualizar. Tente novamente.', 'error');
    }
}

// ==========================================
// INTERFACE E UTILITÁRIOS
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
                            <button class="small secondary" onclick="editCotacao('${c.id}')">✏️</button>
                            <button class="small danger" onclick="deleteCotacao('${c.id}')">🗑️</button>
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
    div.className = `status-message ${type}`;
    div.textContent = message;
    
    const statusContainer = document.getElementById('statusMessage');
    statusContainer.className = `status-message ${type}`;
    statusContainer.textContent = message;
    statusContainer.classList.remove('hidden');
    
    setTimeout(() => {
        statusContainer.classList.add('hidden');
    }, 4000);
}
