// ==========================================
// CONFIGURAÇÃO
// ==========================================
const API_URL = 'https://cotacoes-frete-back.onrender.com/api';
const API_TOKEN = 'cotacoes_frete_token_secreto_2025';

let cotacoes = [];
let currentMonth = new Date();

// ==========================================
// FUNÇÕES UTILITÁRIAS
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
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            statusDiv.className = 'connection-status online';
            statusDiv.innerHTML = `<span class="status-dot"></span><span>Online ${data.cache === 'connected' ? '⚡' : ''}</span>`;
        } else {
            throw new Error('Erro de conexão');
        }
    } catch (error) {
        statusDiv.className = 'connection-status offline';
        statusDiv.innerHTML = '<span class="status-dot"></span><span>Offline</span>';
    }
}

// ==========================================
// CARREGAR COTAÇÕES (INICIAL)
// ==========================================
async function loadCotacoes() {
    try {
        document.getElementById('cotacoesContainer').innerHTML = '<p>Carregando...</p>';

        const response = await fetch(`${API_URL}/cotacoes`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar cotações');
        }

        cotacoes = await response.json();
        displayCotacoes();
        
    } catch (error) {
        console.error('Erro ao carregar cotações:', error);
        showMessage('Erro ao carregar cotações', 'error');
        document.getElementById('cotacoesContainer').innerHTML = 
            '<p style="color: red;">Erro ao carregar dados. Tente novamente.</p>';
    }
}

// ==========================================
// EXIBIR COTAÇÕES
// ==========================================
function displayCotacoes() {
    const filtered = filterCotacoesByMonth(cotacoes);
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
                    <tr class="${c.negocioFechado ? 'negocio-fechado' : ''}" id="row-${c.id}">
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
// CRIAR/ATUALIZAR COTAÇÃO (INSTANTÂNEO)
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

    if (editId) {
        // EDITAR - Atualização instantânea
        await updateCotacaoInstant(editId, formData);
    } else {
        // CRIAR - Criação instantânea
        await createCotacaoInstant(formData);
    }
    
    // Limpar e fechar formulário IMEDIATAMENTE
    document.getElementById('cotacaoForm').reset();
    document.getElementById('formCard').classList.add('hidden');
    document.getElementById('editId').value = '';
    document.getElementById('cancelBtn').classList.add('hidden');
    document.getElementById('formTitle').textContent = 'Nova Cotação';
    document.getElementById('submitText').textContent = 'Registrar Cotação';
}

// CRIAR com UI instantânea
async function createCotacaoInstant(formData) {
    // 1. Criar ID temporário
    const tempId = 'temp_' + Date.now();
    const novaCotacao = {
        ...formData,
        id: tempId,
        timestamp: new Date().toISOString()
    };
    
    // 2. Adicionar na lista LOCAL imediatamente
    cotacoes.unshift(novaCotacao);
    
    // 3. Atualizar interface IMEDIATAMENTE
    displayCotacoes();
    showMessage('✅ Cotação registrada!', 'success');
    
    // 4. Enviar ao servidor em BACKGROUND
    try {
        const response = await fetch(`${API_URL}/cotacoes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Erro ao salvar no servidor');

        const cotacaoReal = await response.json();
        
        // 5. Substituir objeto temporário pelo real
        const index = cotacoes.findIndex(c => c.id === tempId);
        if (index !== -1) {
            cotacoes[index] = cotacaoReal;
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        // Remover cotação temporária em caso de erro
        cotacoes = cotacoes.filter(c => c.id !== tempId);
        displayCotacoes();
        showMessage('❌ Erro ao salvar. Tente novamente.', 'error');
    }
}

// ATUALIZAR com UI instantânea
async function updateCotacaoInstant(id, formData) {
    const index = cotacoes.findIndex(c => c.id === id);
    if (index === -1) return;
    
    // 1. Guardar backup
    const backup = {...cotacoes[index]};
    
    // 2. Atualizar LOCAL imediatamente
    cotacoes[index] = {
        ...cotacoes[index],
        ...formData
    };
    
    // 3. Atualizar interface IMEDIATAMENTE
    displayCotacoes();
    showMessage('✅ Cotação atualizada!', 'success');
    
    // 4. Enviar ao servidor em BACKGROUND
    try {
        const response = await fetch(`${API_URL}/cotacoes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Erro ao atualizar no servidor');

        const cotacaoAtualizada = await response.json();
        cotacoes[index] = cotacaoAtualizada;
        
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        // Reverter em caso de erro
        cotacoes[index] = backup;
        displayCotacoes();
        showMessage('❌ Erro ao atualizar. Tente novamente.', 'error');
    }
}

// ==========================================
// MARCAR COMO FECHADO (INSTANTÂNEO)
// ==========================================
async function marcarFechado(id) {
    if (!confirm('Marcar este negócio como fechado?')) return;
    
    const index = cotacoes.findIndex(c => c.id === id);
    if (index === -1) return;
    
    // 1. Guardar backup
    const backup = {...cotacoes[index]};
    
    // 2. Marcar como fechado IMEDIATAMENTE
    cotacoes[index].negocioFechado = true;
    
    // 3. Atualizar interface IMEDIATAMENTE
    displayCotacoes();
    showMessage('✅ Negócio fechado!', 'success');
    
    // 4. Enviar ao servidor em BACKGROUND
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
        console.error('Erro:', error);
        // Reverter em caso de erro
        cotacoes[index] = backup;
        displayCotacoes();
        showMessage('❌ Erro ao marcar. Tente novamente.', 'error');
    }
}

// ==========================================
// EXCLUIR COTAÇÃO (INSTANTÂNEO)
// ==========================================
async function deleteCotacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;
    
    const index = cotacoes.findIndex(c => c.id === id);
    if (index === -1) return;
    
    // 1. Guardar backup
    const backup = cotacoes[index];
    
    // 2. Remover da lista IMEDIATAMENTE
    cotacoes.splice(index, 1);
    
    // 3. Atualizar interface IMEDIATAMENTE (com animação)
    const row = document.getElementById(`row-${id}`);
    if (row) {
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        row.style.transition = 'all 0.3s ease';
        setTimeout(() => displayCotacoes(), 300);
    } else {
        displayCotacoes();
    }
    
    showMessage('🗑️ Cotação excluída!', 'success');
    
    // 4. Enviar ao servidor em BACKGROUND
    try {
        const response = await fetch(`${API_URL}/cotacoes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            }
        });

        if (!response.ok) throw new Error('Erro ao excluir do servidor');
        
    } catch (error) {
        console.error('Erro:', error);
        // Reverter em caso de erro
        cotacoes.splice(index, 0, backup);
        displayCotacoes();
        showMessage('❌ Erro ao excluir. Tente novamente.', 'error');
    }
}

// ==========================================
// EDITAR COTAÇÃO
// ==========================================
function editCotacao(id) {
    const cotacao = cotacoes.find(c => c.id === id);
    if (!cotacao) return;

    document.getElementById('editId').value = id;
    document.getElementById('formTitle').textContent = 'Editar Cotação';
    document.getElementById('submitText').textContent = 'Salvar Alterações';
    document.getElementById('cancelBtn').classList.remove('hidden');

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

    let filtered = filterCotacoesByMonth(cotacoes);

    if (search) {
        filtered = filtered.filter(c =>
            c.transportadora.toLowerCase().includes(search) ||
            (c.numeroDocumento && c.numeroDocumento.toLowerCase().includes(search)) ||
            c.destino.toLowerCase().includes(search)
        );
    }

    if (filterResp) {
        filtered = filtered.filter(c => c.responsavelCotacao === filterResp);
    }

    if (filterTrans) {
        filtered = filtered.filter(c => c.transportadora === filterTrans);
    }

    if (filterStatus === 'fechado') {
        filtered = filtered.filter(c => c.negocioFechado);
    } else if (filterStatus === 'aberto') {
        filtered = filtered.filter(c => !c.negocioFechado);
    }

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
                    <tr class="${c.negocioFechado ? 'negocio-fechado' : ''}" id="row-${c.id}">
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
    
    setInterval(checkConnection, 30000);
});
