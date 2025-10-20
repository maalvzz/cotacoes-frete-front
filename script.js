‎script.js‎
+39
-8
Linhas alteradas: 39 adições e 8 exclusões
Número da linha do arquivo original	Número da linha de comparação	Mudança de linha de comparação
@@ -1,12 +1,38 @@
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
    const token = sessionStorage.getItem('jwtToken');
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
@@ -16,7 +42,8 @@ async function verificarToken() {
        if (!response.ok) {
            // Token inválido ou sem permissão
            alert('Token inválido ou expirado! Faça login novamente.');
            sessionStorage.removeItem('jwtToken');
            sessionStorage.removeItem('authToken');
            localStorage.removeItem('authToken');
            window.location.href = 'https://sistema-central-front.onrender.com';
            return false;
        }
@@ -31,10 +58,15 @@ async function verificarToken() {
}

// ==========================================
// FUNÇÃO FETCH COM AUTENTICAÇÃO
// FUNÇÃO FETCH COM AUTENTICAÇÃO (CORRIGIDA)
// ==========================================
async function fetchComAutenticacao(url, options = {}) {
    const token = sessionStorage.getItem('jwtToken');
    // Pegar token do sessionStorage ou localStorage
    let token = sessionStorage.getItem('authToken');
    if (!token) {
        token = localStorage.getItem('authToken');
    }
    
    if (!token) throw new Error('Token ausente');

    const headers = {
@@ -309,7 +341,7 @@ async function handleSubmit(event) {
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span id="submitIcon">✔</span> <span id="submitText">Registrar Cotação</span>';
        submitBtn.innerHTML = '<span id="submitIcon">✓</span> <span id="submitText">Registrar Cotação</span>';
    }
}

@@ -425,7 +457,7 @@ function resetForm() {
    document.getElementById('cotacaoForm').reset();
    document.getElementById('editId').value = '';
    document.getElementById('formTitle').textContent = 'Nova Cotação';
    document.getElementById('submitIcon').textContent = '✔';
    document.getElementById('submitIcon').textContent = '✓';
    document.getElementById('submitText').textContent = 'Registrar Cotação';
    document.getElementById('cancelBtn').classList.add('hidden');
    setTodayDate();
@@ -497,7 +529,7 @@ function renderCotacoes(filtered) {
            <tbody>
                ${filtered.map(c => `
                    <tr class="${c.negocioFechado ? 'negocio-fechado' : ''}">
                        <td><button class="small ${c.negocioFechado ? 'success' : 'secondary'}" onclick="toggleNegocio('${c.id}')">✔</button></td>
                        <td><button class="small ${c.negocioFechado ? 'success' : 'secondary'}" onclick="toggleNegocio('${c.id}')">✓</button></td>
                        <td><span class="badge ${c.negocioFechado ? 'fechado' : ''}">${c.responsavelCotacao}</span></td>
                        <td>${c.transportadora}</td><td>${c.destino || 'Não Informado'}</td>
                        <td>${c.numeroCotacao}</td><td class="valor">R$ ${c.valorFrete.toFixed(2)}</td>
@@ -532,4 +564,3 @@ function showMessage(message, type) {
        setTimeout(() => div.remove(), 300);
    }, 3000);
}
