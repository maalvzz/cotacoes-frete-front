const API_URL = 'https://cotacoes-frete-back.onrender.com/';
const STORAGE_KEY = 'cotacoes_frete';
const POLLING_INTERVAL = 2000;

let cotacoes = [];
let isOnline = false;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

document.addEventListener('DOMContentLoaded', () => {
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

function startRealtimeSync() {
    setInterval(async () => {
        if (isOnline) {
            await checkForUpdates();
        }
    }, POLLING_INTERVAL);
}

async function checkForUpdates() {
    try {
        const response = await fetch(`${API_URL}/cotacoes`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
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
    notification.innerHTML = 'Dados atualizados';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/cotacoes`, { 
            method: 'HEAD',
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
    if (isOnline) {
        statusDiv.className = 'connection-status online';
        statusDiv.querySelector('span:last-child').textContent = 'Online';
    } else {
        statusDiv.className = 'connection-status offline';
        statusDiv.querySelector('span:last-child').textContent = 'Offline';
    }
}

function saveToLocalStorage(data) {
    try {
        const cotacoesData = JSON.stringify(data);
        return true;
    } catch (error) {
        console.error('Erro ao salvar:', error);
        return false;
    }
}

function loadFromLocalStorage() {
    try {
        return [];
    } catch (error) {
        console.error('Erro ao carregar:', error);
        return [];
    }
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dataCotacao').value = today;
}

async function loadCotacoes() {
    const serverOnline = await checkServerStatus();
    
    try {
        if (serverOnline) {
            const response = await fetch(`${API_URL}/cotacoes`);
            if (!response.ok) throw new Error('Erro ao carregar cotações');
            cotacoes = await response.json();
        } else {
            cotacoes = loadFromLocalStorage();
        }
        filterCotacoes();
    } catch (error) {
        console.error('Erro:', error);
        cotacoes = loadFromLocalStorage();
        filterCotacoes();
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    
    const formData = getFormData();
    const editId = document.getElementById('editId').value;
    const serverOnline = await checkServerStatus();
    
    try {
        if (serverOnline) {
            let response;
            if (editId) {
                response = await fetch(`${API_URL}/cotacoes/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                showMessage('✓ Cotação atualizada no servidor!', 'success');
            } else {
                response = await fetch(`${API_URL}/cotacoes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                showMessage('✓ Cotação registrada no servidor!', 'success');
            }
            
            if (!response.ok) throw new Error('Erro ao salvar');
            await loadCotacoes();
        } else {
            if (editId) {
                const index = cotacoes.findIndex(c => c.id === editId);
                if (index !== -1) {
                    cotacoes[index] = { ...formData, id: editId, timestamp: cotacoes[index].timestamp };
                }
                showMessage('✓ Cotação atualizada (Offline)', 'success');
            } else {
                const novaCotacao = {
                    ...formData,
                    id: Date.now().toString(),
                    timestamp: new Date().toISOString()
                };
                cotacoes.unshift(novaCotacao);
                showMessage('✓ Cotação salva (Offline)', 'success');
            }
            filterCotacoes();
        }
        
        resetForm();
    } catch (error) {
        console.error('Erro:', error);
        showMessage('Erro ao processar cotação', 'error');
    }
}

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

function editCotacao(id) {
    const cotacao = cotacoes.find(c => c.id === id);
    if (!cotacao) return;

    document.getElementById('formCard').classList.remove('hidden');
    document.getElementById('editId').value = cotacao.id;
    document.getElementById('responsavelCotacao').value = cotacao.responsavelCotacao;
    document.getElementById('transportadora').value = cotacao.transportadora;
    document.getElementById('destino').value = cotacao.destino || '';
    document.getElementById('numeroCotacao').value = cotacao.numeroCotacao === 'Não Informado' ? '' : cotacao.numeroCotacao;
    document.getElementById('valorFrete').value = cotacao.valorFrete;
    document.getElementById('vendedor').value = cotacao.vendedor === 'Não Informado' ? '' : cotacao.vendedor;
    document.getElementById('numeroDocumento').value = cotacao.numeroDocumento === 'Não Informado' ? '' : cotacao.numeroDocumento;
    document.getElementById('previsaoEntrega').value = cotacao.previsaoEntrega === 'Não Informado' ? '' : cotacao.previsaoEntrega;
    document.getElementById('canalComunicacao').value = cotacao.canalComunicacao === 'Não Informado' ? '' : cotacao.canalComunicacao;
    document.getElementById('codigoColeta').value = cotacao.codigoColeta === 'Não Informado' ? '' : cotacao.codigoColeta;
    document.getElementById('responsavelTransportadora').value = cotacao.responsavelTransportadora === 'Não Informado' ? '' : cotacao.responsavelTransportadora;
    document.getElementById('dataCotacao').value = cotacao.dataCotacao;
    document.getElementById('observacoes').value = cotacao.observacoes;
    document.getElementById('formTitle').textContent = 'Editar Cotação';
    document.getElementById('submitIcon').textContent = '💾';
    document.getElementById('submitText').textContent = 'Salvar Alterações';
    document.getElementById('cancelBtn').classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteCotacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;

    const serverOnline = await checkServerStatus();
    
    try {
        if (serverOnline) {
            const response = await fetch(`${API_URL}/cotacoes/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Erro ao excluir');
            showMessage('✓ Cotação excluída do servidor!', 'success');
            await loadCotacoes();
        } else {
            cotacoes = cotacoes.filter(c => c.id !== id);
            showMessage('✓ Cotação excluída (Offline)', 'success');
            filterCotacoes();
        }
    } catch (error) {
        console.error('Erro:', error);
        cotacoes = cotacoes.filter(c => c.id !== id);
        showMessage('⚠️ Erro no servidor. Cotação excluída localmente.', 'error');
        filterCotacoes();
    }
}

async function toggleNegocio(id) {
    const cotacao = cotacoes.find(c => c.id === id);
    if (!cotacao) return;

    cotacao.negocioFechado = !cotacao.negocioFechado;
    
    const serverOnline = await checkServerStatus();
    
    try {
        if (serverOnline) {
            const response = await fetch(`${API_URL}/cotacoes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cotacao)
            });
            
            if (!response.ok) throw new Error('Erro ao atualizar');
            showMessage(cotacao.negocioFechado ? '✓ Negócio marcado como fechado!' : '✓ Marcação removida!', 'success');
            await loadCotacoes();
        } else {
            showMessage(cotacao.negocioFechado ? '✓ Negócio marcado (Offline)' : '✓ Marcação removida (Offline)', 'success');
            filterCotacoes();
        }
    } catch (error) {
        console.error('Erro:', error);
        filterCotacoes();
    }
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

function cancelEdit() {
    resetForm();
}

function toggleForm() {
    const formCard = document.getElementById('formCard');
    const button = event.currentTarget;
    
    formCard.classList.toggle('hidden');
    
    if (!formCard.classList.contains('hidden')) {
        button.textContent = 'Ocultar Formulário';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        button.textContent = 'Nova Cotação';
    }
}

function filterCotacoes() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filterResp = document.getElementById('filterResponsavel').value;
    const filterTrans = document.getElementById('filterTransportadora').value;
    const filterStatus = document.getElementById('filterStatus').value;

    let filtered = [...cotacoes];

    filtered = filtered.filter(c => {
        const cotacaoDate = new Date(c.dataCotacao);
        return cotacaoDate.getMonth() === currentMonth && cotacaoDate.getFullYear() === currentYear;
    });

    if (searchTerm) {
        filtered = filtered.filter(c =>
            c.transportadora.toLowerCase().includes(searchTerm) ||
            c.numeroCotacao.toLowerCase().includes(searchTerm) ||
            (c.vendedor && c.vendedor.toLowerCase().includes(searchTerm)) ||
            c.numeroDocumento.toLowerCase().includes(searchTerm) ||
            c.codigoColeta.toLowerCase().includes(searchTerm) ||
            c.responsavelTransportadora.toLowerCase().includes(searchTerm) ||
            (c.destino && c.destino.toLowerCase().includes(searchTerm))
        );
    }

    if (filterResp) {
        filtered = filtered.filter(c => c.responsavelCotacao === filterResp);
    }

    if (filterTrans) {
        filtered = filtered.filter(c => c.transportadora === filterTrans);
    }

    if (filterStatus) {
        if (filterStatus === 'fechado') {
            filtered = filtered.filter(c => c.negocioFechado === true);
        } else if (filterStatus === 'aberto') {
            filtered = filtered.filter(c => !c.negocioFechado);
        }
    }

    renderCotacoes(filtered);
}

function renderCotacoes(filtered) {
    const container = document.getElementById('cotacoesContainer');
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                Nenhuma cotação encontrada para ${meses[currentMonth]} de ${currentYear}.
            </p>
        `;
        return;
    }

    filtered.sort((a, b) => new Date(b.timestamp || b.dataCotacao) - new Date(a.timestamp || a.dataCotacao));

    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Resp.</th>
                    <th>Transportadora</th>
                    <th>Destino</th>
                    <th>Nº Cotação</th>
                    <th>Valor</th>
                    <th>Vendedor</th>
                    <th>Documento</th>
                    <th>Previsão</th>
                    <th>Código Coleta</th>
                    <th>Data</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(c => `
                    <tr class="${c.negocioFechado ? 'negocio-fechado' : ''}">
                        <td>
                            <button 
                                class="small ${c.negocioFechado ? 'success' : 'secondary'}" 
                                onclick="toggleNegocio('${c.id}')"
                                title="${c.negocioFechado ? 'Negócio Fechado' : 'Marcar como Fechado'}"
                            >
                                ${c.negocioFechado ? '✓' : '✓'}
                            </button>
                        </td>
                        <td><span class="badge ${c.negocioFechado ? 'fechado' : ''}">${c.responsavelCotacao}</span></td>
                        <td><strong>${c.transportadora}</strong></td>
                        <td>${c.destino || 'Não Informado'}</td>
                        <td>${c.numeroCotacao}</td>
                        <td>R$ ${c.valorFrete.toFixed(2)}</td>
                        <td>${c.vendedor || 'Não Informado'}</td>
                        <td>${c.numeroDocumento}</td>
                        <td>${formatDate(c.previsaoEntrega)}</td>
                        <td>${c.codigoColeta}</td>
                        <td>${formatDate(c.dataCotacao)}</td>
                        <td>
                            <div class="actions">
                                <button class="edit small" onclick="editCotacao('${c.id}')">Editar</button>
                                <button class="danger small" onclick="deleteCotacao('${c.id}')">Excluir</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
}

function formatDate(dateString) {
    if (!dateString || dateString === 'Não Informado') return 'Não Informado';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function showMessage(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.classList.remove('hidden');

    setTimeout(() => {
        statusDiv.classList.add('hidden');
    }, 5000);
}

setInterval(async () => {
    const wasOnline = isOnline;
    await checkServerStatus();
    
    if (!wasOnline && isOnline) {
        showMessage('Conexão restaurada! Sincronizando...', 'success');
        await loadCotacoes();
    }

}, 5000);
