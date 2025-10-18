// ==========================================
// CONFIGURAÇÃO
// ==========================================
const API_URL = 'https://cotacoes-frete-back.onrender.com/api';
const API_TOKEN = 'cotacoes_frete_token_secreto_2025';

// Cache local para dados
let cotacoesCache = [];
let currentMonth = new Date();

// ==========================================
// UTILITÁRIOS
// ==========================================
function formatarData(data) {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function showMessage(message, type = 'success') {
    const messageDiv = document.getElementById('statusMessage');
    messageDiv.textContent = message;
    messageDiv.className = `status-message ${type}`;
    messageDiv.classList.remove('hidden');
    
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 3000);
}

// ==========================================
// VERIFICAÇÃO DE CONEXÃO
// ==========================================
async function checkConnection() {
    const statusDiv = document.getElementById('connectionStatus');
    try {
        const response = await fetch(`${API_URL.replace('/api', '')}/health`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            statusDiv.className = 'connection-status online';
            statusDiv.innerHTML = `
                <span class="status-dot"></span>
                <span>Online ${data.cache === 'connected' ? '⚡ (Cache)' : ''}</span>
            `;
        } else {
            throw new Error('Erro de conexão');
        }
    } catch (error) {
        statusDiv.className = 'connection-status offline';
        statusDiv.innerHTML = '<span class="status-dot"></span><span>Offline</span>';
    }
}

// ==========================================
// CARREGAR COTAÇÕES (COM CACHE LOCAL)
// ==========================================
async function loadCotacoes(showLoading = true) {
    try {
        if (showLoading) {
            document.getElementById('cotacoesContainer').innerHTML = '<p>Carregando...</p>';
        }

        const response = await fetch(`${API_URL}/cotacoes`, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });

        if (!response.ok) throw new Error('Erro ao carregar cotações');

        cotacoesCache = await response.json();
        displayCotacoes();
        
    } catch (error) {
        console.error('Erro:', error);
        showMessage('Erro ao carregar cotações', 'error');
        document.getElementById('cotacoesContainer').innerHTML = 
            '<p style="color: red;">Erro ao carregar dados. Tente novamente.</p>';
    }
}

// ==========================================
// EXIBIR COTAÇÕES
// ==========================================
function displayCotacoes() {
    const filtered = filterCotacoesByMonth(cotacoesCache);
    const container = document.getElementById('cotacoesContainer');
    
    updateMonthDisplay();

    if (filtered.length === 0) {
        container.innerHTML = '<p>Nenhuma cotação encontrada neste período.</p>';
        return;
    }

    const table = `
        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Responsável</th>
                    <th>Transportadora</th>
                    <th>Destino</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(c => `
                    <tr class="${c.negocioFechado ? 'negocio-fechado' : ''}" data-id="${c.id}">
                        <td>${formatarData(c.dataCotacao)}</td>
                        <td>${c.responsavelCotacao}</td>
                        <td>${c.transportadora}</td>
                        <td>${c.destino}</td>
                        <td>${formatarMoeda(c.valorFrete)}</td>
                        <td>
                            ${c.negocioFechado 
                                ? '<span class="badge fechado">✓ Fechado</span>' 
                                : '<span class="badge">Em aberto</span>'}
                        </td>
                        <td class="actions">
                            <button class="small edit" onclick="editCotacao('${c.id}')">✏️ Editar</button>
                            ${!c.negocioFechado 
                                ? `<button class="small success" onclick="marcarFechado('${c.id}')">✓ Fechar</button>`
                                : ''}
                            <button class="small danger" onclick="deleteCotacao('${c.id}')">🗑️ Excluir</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// ==========================================
// CRIAR COTAÇÃO (OTIMISTA)
// ==========================================
async function handleSubmit(event) {
    event.preventDefault();
    
    const editId = document.getElementById('editId').value;
    const formData = {
        responsavelCotacao: document.getElementById('responsavelCotacao').value,
        transportadora: document.getElementById('transportadora').value,
        destino: document.getElementById('destino').value,
        numeroCotacao: document.getElementById('numeroCotacao').value,
        valorFrete: parseFloat(document.getElementById('valorFrete').value),
        vendedor: document.getElementById('vendedor').value,
        numeroDocumento: document.getElementById('numeroDocumento').value,
        previsaoEntrega: document.getElementById('previsaoEntrega').value,
        canalComunicacao: document.getElementById('canalComunicacao').value,
        codigoColeta: document.getElementById('codigoColeta').value,
        responsavelTransportadora: document.getElementById('responsavelTransportadora').value,
        dataCotacao: document.getElementById('dataCotacao').value,
        observacoes: document.getElementById('observacoes').value,
        negocioFechado: false
    };

    try {
        if (editId) {
            // ATUALIZAR
            await updateCotacaoOptimistic(editId, formData);
        } else {
            // CRIAR NOVO
            await createCotacaoOptimistic(formData);
        }
        
        // Limpar formulário e ocultar
        document.getElementById('cotacaoForm').reset();
        document.getElementById('formCard').classList.add('hidden');
        document.getElementById('editId').value = '';
        document.getElementById('cancelBtn').classList.add('hidden');
        
    } catch (error) {
        console.error('Erro:', error);
        showMessage('Erro ao salvar cotação', 'error');
        // Recarregar do servidor em caso de erro
        await loadCotacoes(false);
    }
}

// Criar com atualização otimista
async function createCotacaoOptimistic(formData) {
    // 1. Criar objeto temporário com ID único
    const tempCotacao = {
        ...formData,
        id: 'temp_' + Date.now(),
        timestamp: new Date().toISOString()
    };
    
    // 2. Adicionar ao cache local IMEDIATAMENTE
    cotacoesCache.unshift(tempCotacao);
    displayCotacoes();
    showMessage('✅ Cotação criada!', 'success');
    
    // 3. Enviar ao servidor em background
    const response = await fetch(`${API_URL}/cotacoes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify(formData)
    });
    
    if (!response.ok) throw new Error('Erro ao criar cotação');
    
    // 4. Substituir objeto temporário pelo real
    const novaCotacao = await response.json();
    const index = cotacoesCache.findIndex(c => c.id === tempCotacao.id);
    if (index !== -1) {
        cotacoesCache[index] = novaCotacao;
    }
}

// Atualizar com atualização otimista
async function updateCotacaoOptimistic(id, formData) {
    // 1. Encontrar e atualizar localmente IMEDIATAMENTE
    const index = cotacoesCache.findIndex(c => c.id === id);
    if (index !== -1) {
        const backup = {...cotacoesCache[index]};
        cotacoesCache[index] = { ...cotacoesCache[index], ...formData };
        displayCotacoes();
        showMessage('✅ Cotação atualizada!', 'success');
        
        // 2. Enviar ao servidor em background
        try {
            const response = await fetch(`${API_URL}/cotacoes/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) throw new Error('Erro ao atualizar');
            
            // 3. Atualizar com resposta real do servidor
            const updated = await response.json();
            cotacoesCache[index] = updated;
            
        } catch (error) {
            // Reverter em caso de erro
            cotacoesCache[index] = backup;
            displayCotacoes();
            throw error;
        }
    }
}

// ==========================================
// MARCAR COMO FECHADO (OTIMISTA)
// ==========================================
async function marcarFechado(id) {
    if (!confirm('Marcar este negócio como fechado?')) return;
    
    // 1. Atualizar localmente IMEDIATAMENTE
    const index = cotacoesCache.findIndex(c => c.id === id);
    if (index !== -1) {
        const backup = {...cotacoesCache[index]};
        cotacoesCache[index].negocioFechado = true;
        displayCotacoes();
        showMessage('✅ Negócio marcado como fechado!', 'success');
        
        // 2. Enviar ao servidor em background
        try {
            const response = await fetch(`${API_URL}/cotacoes/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify({ negocioFechado: true })
            });
            
            if (!response.ok) throw new Error('Erro ao marcar como fechado');
            
        } catch (error) {
            // Reverter em caso de erro
            cotacoesCache[index] = backup;
            displayCotacoes();
            showMessage('Erro ao marcar como fechado', 'error');
        }
    }
}

// ==========================================
// EXCLUIR (OTIMISTA)
// ==========================================
async function deleteCotacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;
    
    // 1. Remover localmente IMEDIATAMENTE
    const index = cotacoesCache.findIndex(c => c.id === id);
    if (index !== -1) {
        const backup = cotacoesCache[index];
        cotacoesCache.splice(index, 1);
        displayCotacoes();
        showMessage('🗑️ Cotação excluída!', 'success');
        
        // 2. Enviar ao servidor em background
        try {
            const response = await fetch(`${API_URL}/cotacoes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${API_TOKEN}` }
            });
            
            if (!response.ok) throw new Error('Erro ao excluir');
            
        } catch (error) {
            // Reverter em caso de erro
            cotacoesCache.splice(index, 0, backup);
            displayCotacoes();
            showMessage('Erro ao excluir cotação', 'error');
        }
    }
}

// ==========================================
// EDITAR COTAÇÃO
// ==========================================
function editCotacao(id) {
    const cotacao = cotacoesCache.find(c => c.id === id);
    if (!cotacao) return;

    document.getElementById('editId').value = id;
    document.getElementById('formTitle').textContent = 'Editar Cotação';
    document.getElementById('submitText').textContent = 'Salvar Alterações';
    document.getElementById('cancelBtn').classList.remove('hidden');

    // Preencher formulário
    document.getElementById('responsavelCotacao').value = cotacao.responsavelCotacao || '';
    document.getElementById('transportadora').value = cotacao.transportadora || '';
    document.getElementById('destino').value = cotacao.destino || '';
    document.getElementById('numeroCotacao').value = cotacao.numeroCotacao || '';
    document.getElementById('valorFrete').value = cotacao.valorFrete || '';
    document.getElementById('vendedor').value = cotacao.vendedor || '';
    document.getElementById('numeroDocumento').value = cotacao.numeroDocumento || '';
    document.getElementById('previsaoEntrega').value = cotacao.previsaoEntrega || '';
    document.getElementById('canalComunicacao').value = cotacao.canalComunicacao || '';
    document.getElementById('codigoColeta').value = cotacao.codigoColeta || '';
    document.getElementById('responsavelTransportadora').value = cotacao.responsavelTransportadora || '';
    document.getElementById('dataCotacao').value = cotacao.dataCotacao || '';
    document.getElementById('observacoes').value = cotacao.observacoes || '';

    document.getElementById('formCard').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('cotacaoForm').reset();
    document.getElementById('editId').value = '';
    document.getElementById('formTitle').textContent = 'Nova Cotação';
    document.getElementById('submitText').textContent = 'Registrar Cotação';
    document.getElementById('cancelBtn').classList.add('hidden');
    document.getElementById('formCard').classList.add('hidden');
}

// ==========================================
// CONTROLE DE MÊS
// ==========================================
function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    displayCotacoes();
}

function updateMonthDisplay() {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const display = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    document.getElementById('currentMonth').textContent = display;
}

function filterCotacoesByMonth(cotacoes) {
    return cotacoes.filter(c => {
        const cotacaoDate = new Date(c.dataCotacao);
        return cotacaoDate.getMonth() === currentMonth.getMonth() &&
               cotacaoDate.getFullYear() === currentMonth.getFullYear();
    });
}

// ==========================================
// FILTROS
// ==========================================
function filterCotacoes() {
    const search = document.getElementById('search').value.toLowerCase();
    const filterResp = document.getElementById('filterResponsavel').value;
    const filterTrans = document.getElementById('filterTransportadora').value;
    const filterStatus = document.getElementById('filterStatus').value;

    let filtered = filterCotacoesByMonth(cotacoesCache);

    if (search) {
        filtered = filtered.filter(c =>
            c.transportadora.toLowerCase().includes(search) ||
            (c.numeroDocumento && c.numeroDocumento.toLowerCase().includes(search)) ||
            c.destino.toLowerCase().includes(search)
        );
    }

    if (filterResp) filtered = filtered.filter(c => c.responsavelCotacao === filterResp);
    if (filterTrans) filtered = filtered.filter(c => c.transportadora === filterTrans);
    if (filterStatus === 'fechado') filtered = filtered.filter(c => c.negocioFechado);
    if (filterStatus === 'aberto') filtered = filtered.filter(c => !c.negocioFechado);

    const container = document.getElementById('cotacoesContainer');
    
    if (filtered.length === 0) {
        container.innerHTML = '<p>Nenhuma cotação encontrada com os filtros aplicados.</p>';
        return;
    }

    const table = `
        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Responsável</th>
                    <th>Transportadora</th>
                    <th>Destino</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(c => `
                    <tr class="${c.negocioFechado ? 'negocio-fechado' : ''}">
                        <td>${formatarData(c.dataCotacao)}</td>
                        <td>${c.responsavelCotacao}</td>
                        <td>${c.transportadora}</td>
                        <td>${c.destino}</td>
                        <td>${formatarMoeda(c.valorFrete)}</td>
                        <td>
                            ${c.negocioFechado 
                                ? '<span class="badge fechado">✓ Fechado</span>' 
                                : '<span class="badge">Em aberto</span>'}
                        </td>
                        <td class="actions">
                            <button class="small edit" onclick="editCotacao('${c.id}')">✏️ Editar</button>
                            ${!c.negocioFechado 
                                ? `<button class="small success" onclick="marcarFechado('${c.id}')">✓ Fechar</button>`
                                : ''}
                            <button class="small danger" onclick="deleteCotacao('${c.id}')">🗑️ Excluir</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// ==========================================
// TOGGLE FORMULÁRIO
// ==========================================
function toggleForm() {
    const formCard = document.getElementById('formCard');
    formCard.classList.toggle('hidden');
    
    if (!formCard.classList.contains('hidden')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
    loadCotacoes();
    
    // Verificar conexão a cada 30 segundos
    setInterval(checkConnection, 30000);
});
