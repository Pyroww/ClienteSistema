document.addEventListener('DOMContentLoaded', async () => {
    // URL base da sua nova API. Mude se o endereço do seu backend for diferente.
    //const API_URL = '/api';
    const API_URL = 'http://localhost:3000/api';

    // Pega o nome do arquivo atual, ex: "clientes.html"
    const paginaAtual = window.location.pathname.split('/').pop() || 'index.html';

    // ===============================================
    // LÓGICA GERAL (MENU, ETC)
    // ===============================================
    const menuToggleButton = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const menuOverlay = document.getElementById('menu-overlay');
    const logoutButton = document.getElementById('logout-btn');

    if (menuToggleButton) {
        menuToggleButton.addEventListener('click', () => {
            sidebar.classList.toggle('visible');
            menuOverlay.classList.toggle('visible');
        });
        menuOverlay.addEventListener('click', () => {
            sidebar.classList.remove('visible');
            menuOverlay.classList.remove('visible');
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('loggedIn');
            window.location.href = 'login.html';
        });
    }
    
    // A página de login continua igual por enquanto
    if (paginaAtual === 'login.html') {
        const loginForm = document.getElementById('form-login');
        const errorMessage = document.getElementById('error-message');

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Lógica de login temporária. No futuro, isso fará uma chamada para a API.
            if (username === 'admin' && password === '1234') {
                sessionStorage.setItem('loggedIn', 'true');
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = 'Usuário ou senha inválidos.';
            }
        });
    }

    
    // ===============================================
    // PÁGINA DE CLIENTES (clientes.html)
    // ===============================================
    if (paginaAtual === 'clientes.html') {
        const formCliente = document.getElementById('form-cliente');
        const listaClientes = document.getElementById('lista-clientes');
        const pesquisaClienteInput = document.getElementById('pesquisa-cliente');
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const closeModalBtn = document.getElementById('close-modal');

        const carregarClientes = async (filtro = '') => {
            try {
                const url = filtro ? `${API_URL}/clientes?q=${filtro}` : `${API_URL}/clientes`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Falha ao carregar clientes.');
                
                const clientes = await response.json();
                
                listaClientes.innerHTML = '';
                clientes.forEach(cliente => {
                    const card = document.createElement('div');
                    card.className = 'item-card';
                    card.innerHTML = `
                        <div>
                            <p><strong>Nome:</strong> ${cliente.nome}</p>
                            <p><strong>CPF:</strong> ${cliente.cpf}</p>
                            <p><strong>Escola:</strong> ${cliente.escola}</p>
                            <p><strong>Telefones:</strong> ${cliente.telefones.join(', ')}</p>
                        </div>
                        <div class="item-card-actions">
                            <button class="btn btn-secondary btn-sm" data-action="historico" data-id="${cliente.id}">Histórico</button>
                            <button class="btn btn-warning btn-sm" data-action="editar" data-id='${JSON.stringify(cliente)}'>Editar</button>
                            <button class="btn btn-danger btn-sm" data-action="apagar" data-id="${cliente.id}">Apagar</button>
                        </div>
                    `;
                    listaClientes.appendChild(card);
                });
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        const cadastrarCliente = async (e) => {
            e.preventDefault();
            const telefones = [
                document.getElementById('cliente-telefone1').value,
                document.getElementById('cliente-telefone2').value
            ].filter(tel => tel.trim() !== '');

            const novoCliente = {
                nome: document.getElementById('cliente-nome').value,
                cpf: document.getElementById('cliente-cpf').value,
                endereco: document.getElementById('cliente-endereco').value,
                escola: document.getElementById('cliente-escola').value,
                telefones: telefones
            };

            try {
                const response = await fetch(`${API_URL}/clientes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novoCliente)
                });
                if (!response.ok) throw new Error('Falha ao cadastrar cliente.');
                
                formCliente.reset();
                carregarClientes();
                alert('Cliente cadastrado com sucesso!');
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        const apagarCliente = async (id) => {
            if (confirm('Tem certeza que deseja apagar este cliente? Esta ação não pode ser desfeita.')) {
                try {
                    const response = await fetch(`${API_URL}/clientes/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Falha ao apagar cliente.');
                    
                    carregarClientes();
                    alert('Cliente apagado com sucesso.');
                } catch (error) {
                    console.error('Erro:', error);
                    alert(error.message);
                }
            }
        };

        const salvarEdicao = async (id) => {
            const clienteAtualizado = {
                nome: document.getElementById('edit-nome').value,
                cpf: document.getElementById('edit-cpf').value,
                escola: document.getElementById('edit-escola').value,
                endereco: document.getElementById('edit-endereco').value,
                telefones: [
                    document.getElementById('edit-tel1').value,
                    document.getElementById('edit-tel2').value
                ].filter(tel => tel.trim() !== '')
            };

            try {
                const response = await fetch(`${API_URL}/clientes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clienteAtualizado)
                });
                if (!response.ok) throw new Error('Falha ao atualizar cliente.');
                
                fecharModal();
                carregarClientes();
                alert('Cliente atualizado com sucesso!');
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        const mostrarHistorico = async (clienteId, clienteNome) => {
            try {
                const response = await fetch(`${API_URL}/clientes/${clienteId}/historico`);
                if (!response.ok) throw new Error('Falha ao carregar histórico.');
                const historico = await response.json();

                modalTitle.textContent = `Histórico de ${clienteNome}`;
                
                const comprasHtml = historico.vendas.length === 0 ? '<p>Nenhuma compra registrada.</p>' : historico.vendas.map(venda => `
                    <div class="compra-historico">
                        <div class="compra-historico-header">
                            ${new Date(venda.data_hora).toLocaleDateString('pt-BR')} - ${new Date(venda.data_hora).toLocaleTimeString('pt-BR')}
                            <span>${venda.pagamento.charAt(0).toUpperCase() + venda.pagamento.slice(1)}</span>
                        </div>
                        <p><strong>Total:</strong> R$ ${Number(venda.total).toFixed(2)}</p>
                        <p><strong>Produtos:</strong> ${venda.produtos.map(p => p.nome).join(', ')}</p>
                        ${detalhesPagamento(venda)}
                        ${venda.assinatura ? `<div><p><strong>Assinatura:</strong></p><img src="${venda.assinatura}" alt="Assinatura do cliente" class="assinatura-historico"></div>` : ''}
                    </div>
                `).join('');

                const observacoesHtml = historico.observacoes.map(obs => `
                    <div class="observacao-item">
                        <div class="data">${new Date(obs.data_hora).toLocaleString('pt-BR')}</div>
                        <div class="texto">${obs.texto}</div>
                    </div>
                `).join('');

                modalBody.innerHTML = `
                    <h4>Histórico de Compras</h4>
                    ${comprasHtml}
                    <div class="observacoes-container">
                        <h4>Histórico de Observações</h4>
                        <div id="lista-observacoes">${observacoesHtml || '<p>Nenhuma observação registrada.</p>'}</div>
                        <form id="form-add-observacao" style="margin-top: 20px;">
                            <div class="form-group">
                                <label for="nova-observacao">Adicionar Nova Observação</label>
                                <textarea id="nova-observacao" required></textarea>
                            </div>
                            <button type="submit" class="btn btn-secondary">Salvar Observação</button>
                        </form>
                    </div>
                `;
                
                abrirModal();

                document.getElementById('form-add-observacao').onsubmit = (e) => {
                    e.preventDefault();
                    salvarObservacao(clienteId, clienteNome);
                };

                modalBody.querySelectorAll('[data-action="pagar-parcela"]').forEach(btn => {
                    btn.onclick = () => darBaixaParcela(btn.dataset.parcelaId, clienteId, clienteNome);
                });

            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        const salvarObservacao = async (clienteId, clienteNome) => {
            const texto = document.getElementById('nova-observacao').value.trim();
            if (!texto) return;

            try {
                const response = await fetch(`${API_URL}/clientes/${clienteId}/observacoes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texto: texto })
                });
                if (!response.ok) throw new Error('Falha ao salvar observação.');
                
                mostrarHistorico(clienteId, clienteNome); // Recarrega o modal
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };
        
        const darBaixaParcela = async (parcelaId, clienteId, clienteNome) => {
            try {
                const response = await fetch(`${API_URL}/parcelas/${parcelaId}/pagar`, { method: 'PATCH' });
                if (!response.ok) throw new Error('Falha ao dar baixa na parcela.');
                
                mostrarHistorico(clienteId, clienteNome); // Recarrega o modal
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        function abrirModalEdicao(cliente) {
            modalTitle.textContent = 'Editar Cliente';
            modalBody.innerHTML = `
                <form id="form-edit-cliente">
                    <div class="form-grid">
                        <div class="form-group"><label>Nome</label><input id="edit-nome" value="${cliente.nome}" required></div>
                        <div class="form-group"><label>CPF</label><input id="edit-cpf" value="${cliente.cpf}" required></div>
                        <div class="form-group"><label>Celular 1</label><input id="edit-tel1" value="${cliente.telefones[0] || ''}" required></div>
                        <div class="form-group"><label>Celular 2</label><input id="edit-tel2" value="${cliente.telefones[1] || ''}"></div>
                        <div class="form-group"><label>Escola</label><input id="edit-escola" value="${cliente.escola}" required></div>
                        <div class="form-group" style="grid-column: 1 / -1;"><label>Endereço</label><input id="edit-endereco" value="${cliente.endereco}" required></div>
                    </div>
                    <br>
                    <button type="submit" class="btn">Salvar Alterações</button>
                </form>
            `;
            abrirModal();

            document.getElementById('form-edit-cliente').onsubmit = (e) => {
                e.preventDefault();
                salvarEdicao(cliente.id);
            };
        }

        // ----- Funções Auxiliares e Event Listeners -----
        function handleClienteAction(e) {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;
            if (!action || !id) return;
            
            if (action === 'historico') {
                const nomeCliente = e.target.closest('.item-card').querySelector('p:first-child').textContent.replace('Nome: ', '');
                mostrarHistorico(id, nomeCliente);
            } else if (action === 'editar') {
                abrirModalEdicao(JSON.parse(id));
            } else if (action === 'apagar') {
                apagarCliente(id);
            }
        }

        function detalhesPagamento(venda) {
            if (venda.pagamento === 'credito') {
                return `<p><strong>Parcelamento:</strong> ${venda.parcelas}x de R$ ${(venda.total / venda.parcelas).toFixed(2)}</p>`;
            }
            if (venda.pagamento === 'crediario') {
                const parcelasPagas = venda.detalheParcelas.filter(p => p.status === 'paga').length;
                let htmlParcelas = `<p><strong>Crediário:</strong> ${parcelasPagas} de ${venda.parcelas} parcelas pagas.</p>`;
                
                htmlParcelas += `<div>${venda.detalheParcelas.map(p => {
                    const dataVencimento = new Date(p.data_vencimento);
                    const estaVencida = p.status === 'pendente' && new Date() > dataVencimento;
                    
                    let statusHtml;
                    if (p.status === 'paga') {
                        statusHtml = '<span class="parcela-paga">PAGA</span>';
                    } else {
                        const statusVencidoHtml = estaVencida ? '<span class="status-vencido">VENCIDA</span>' : '';
                        statusHtml = `${statusVencidoHtml} <button class="btn btn-success btn-sm" data-action="pagar-parcela" data-parcela-id="${p.id}">Dar Baixa</button>`;
                    }

                    return `<div class="parcela ${estaVencida ? 'vencida' : ''}">
                        <span>Parcela (Vence: ${dataVencimento.toLocaleDateString('pt-BR')}): <strong>R$ ${Number(p.valor).toFixed(2)}</strong></span>
                        <div>${statusHtml}</div>
                    </div>`;
                }).join('')}</div>`;
                return htmlParcelas;
            }
            return '<p><strong>Pagamento:</strong> À vista</p>';
        }
        
        function abrirModal() { modal.style.display = 'flex'; }
        function fecharModal() { modal.style.display = 'none'; modalBody.innerHTML = ''; }

        formCliente.addEventListener('submit', cadastrarCliente);
        closeModalBtn.addEventListener('click', fecharModal);
        listaClientes.addEventListener('click', handleClienteAction);
        pesquisaClienteInput.addEventListener('keyup', () => carregarClientes(pesquisaClienteInput.value));
        
        carregarClientes(); // Carga inicial
    }

    // ===============================================
    // PÁGINA DE PRODUTOS (produtos.html)
    // ===============================================
    if (paginaAtual === 'produtos.html') {
        const formProduto = document.getElementById('form-produto');
        const listaProdutos = document.getElementById('lista-produtos');
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const closeModalBtn = document.getElementById('close-modal');

        const carregarProdutos = async () => {
            try {
                const response = await fetch(`${API_URL}/produtos`);
                if (!response.ok) throw new Error('Falha ao carregar produtos.');
                const produtos = await response.json();
                
                listaProdutos.innerHTML = '';
                produtos.forEach(produto => {
                    const card = document.createElement('div');
                    card.className = 'item-card';
                    card.innerHTML = `
                        <div>
                            <p><strong>Produto:</strong> ${produto.nome}</p>
                            <p><strong>Marca:</strong> ${produto.marca}</p>
                            <p><strong>Preço:</strong> R$ ${Number(produto.preco).toFixed(2)}</p>
                            <p><strong>Estoque:</strong> ${produto.estoque} unidades</p>
                        </div>
                        <div class="item-card-actions">
                            <button class="btn btn-warning btn-sm" data-action="editar" data-id='${JSON.stringify(produto)}'>Editar</button>
                            <button class="btn btn-danger btn-sm" data-action="apagar" data-id="${produto.id}">Apagar</button>
                        </div>
                    `;
                    listaProdutos.appendChild(card);
                });
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        const cadastrarProduto = async (e) => {
            e.preventDefault();
            const novoProduto = {
                nome: document.getElementById('produto-nome').value,
                preco: parseFloat(document.getElementById('produto-preco').value),
                marca: document.getElementById('produto-marca').value,
                estoque: parseInt(document.getElementById('produto-estoque').value)
            };
            
            try {
                const response = await fetch(`${API_URL}/produtos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novoProduto)
                });
                if (!response.ok) throw new Error('Falha ao cadastrar produto.');
                
                formProduto.reset();
                carregarProdutos();
                alert('Produto cadastrado com sucesso!');
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };
        
        const apagarProduto = async (id) => {
             if (confirm('Tem certeza que deseja apagar este produto?')) {
                try {
                    const response = await fetch(`${API_URL}/produtos/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Falha ao apagar produto.');
                    
                    carregarProdutos();
                    alert('Produto apagado com sucesso.');
                } catch (error) {
                    console.error('Erro:', error);
                    alert(error.message);
                }
            }
        };
        
        const salvarEdicaoProduto = async (id) => {
            const produtoAtualizado = {
                nome: document.getElementById('edit-nome-prod').value,
                marca: document.getElementById('edit-marca-prod').value,
                preco: parseFloat(document.getElementById('edit-preco-prod').value),
                estoque: parseInt(document.getElementById('edit-estoque-prod').value)
            };

            try {
                const response = await fetch(`${API_URL}/produtos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(produtoAtualizado)
                });
                if (!response.ok) throw new Error('Falha ao atualizar produto.');
                
                fecharModal();
                carregarProdutos();
                alert('Produto atualizado com sucesso!');
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        function abrirModalEdicaoProduto(produto) {
            modalTitle.textContent = 'Editar Produto';
            modalBody.innerHTML = `
                <form id="form-edit-produto">
                    <div class="form-grid">
                        <div class="form-group"><label>Nome</label><input id="edit-nome-prod" value="${produto.nome}" required></div>
                        <div class="form-group"><label>Marca</label><input id="edit-marca-prod" value="${produto.marca}" required></div>
                        <div class="form-group"><label>Preço</label><input type="number" step="0.01" id="edit-preco-prod" value="${produto.preco}" required></div>
                        <div class="form-group"><label>Estoque</label><input type="number" id="edit-estoque-prod" value="${produto.estoque}" required></div>
                    </div>
                    <br>
                    <button type="submit" class="btn">Salvar Alterações</button>
                </form>
            `;
            abrirModal();

            document.getElementById('form-edit-produto').onsubmit = (e) => {
                e.preventDefault();
                salvarEdicaoProduto(produto.id);
            };
        }
        
        // ----- Funções Auxiliares e Event Listeners -----
        function handleProdutoAction(e) {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;
            if (!action || !id) return;

            if (action === 'editar') {
                abrirModalEdicaoProduto(JSON.parse(id));
            } else if (action === 'apagar') {
                apagarProduto(id);
            }
        }
        
        function abrirModal() { modal.style.display = 'flex'; }
        function fecharModal() { modal.style.display = 'none'; modalBody.innerHTML = ''; }
        
        formProduto.addEventListener('submit', cadastrarProduto);
        closeModalBtn.addEventListener('click', fecharModal);
        listaProdutos.addEventListener('click', handleProdutoAction);

        carregarProdutos(); // Carga inicial
    }

    // ===============================================
    // PÁGINA DE VENDAS (vendas.html)
    // ===============================================
    if (paginaAtual === 'vendas.html') {
        document.getElementById('data-venda').valueAsDate = new Date();
        let clienteSelecionadoVenda = null;
        let carrinho = [];
        let produtosDisponiveis = []; // Cache dos produtos para não buscar toda hora

        const canvas = document.getElementById('signature-pad-canvas');
        const signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });

        const buscaClienteInput = document.getElementById('busca-cliente');
        const selectProduto = document.getElementById('select-produto');
        const btnAddProduto = document.getElementById('btn-add-produto');
        const formaPagamentoSelect = document.getElementById('forma-pagamento');
        const numeroParcelasInput = document.getElementById('numero-parcelas');
        const btnFinalizarVenda = document.getElementById('btn-finalizar-venda');

        const carregarProdutosVenda = async () => {
            try {
                const response = await fetch(`${API_URL}/produtos`);
                if (!response.ok) throw new Error('Falha ao carregar produtos.');
                produtosDisponiveis = await response.json();
                
                selectProduto.innerHTML = '<option value="">Selecione...</option>';
                produtosDisponiveis.forEach(produto => {
                    if (produto.estoque > 0) {
                        const option = document.createElement('option');
                        option.value = produto.id;
                        option.textContent = `${produto.nome} - R$ ${Number(produto.preco).toFixed(2)} (${produto.estoque} em estoque)`;
                        selectProduto.appendChild(option);
                    }
                });
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        const buscarClientesVenda = async (termo) => {
            const resultadoBusca = document.getElementById('resultado-busca-cliente');
            resultadoBusca.innerHTML = '';
            if (termo.length < 2) return;

            try {
                const response = await fetch(`${API_URL}/clientes?q=${termo}`);
                if (!response.ok) throw new Error('Falha ao buscar clientes.');
                const clientesFiltrados = await response.json();
                
                clientesFiltrados.forEach(cliente => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.textContent = `${cliente.nome} (${cliente.cpf})`;
                    div.onclick = () => selecionarCliente(cliente);
                    resultadoBusca.appendChild(div);
                });
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };
        
        const finalizarVenda = async () => {
            if (!clienteSelecionadoVenda) return alert('Selecione um cliente.');
            if (carrinho.length === 0) return alert('O carrinho está vazio.');
            if (signaturePad.isEmpty()) return alert("Por favor, peça ao cliente para assinar no campo indicado.");

            const vendaData = {
                cliente: clienteSelecionadoVenda,
                produtos: carrinho,
                total: carrinho.reduce((acc, p) => acc + parseFloat(p.preco), 0),
                pagamento: formaPagamentoSelect.value,
                parcelas: parseInt(numeroParcelasInput.value) || 1,
                assinatura: signaturePad.toDataURL("image/png"),
                dataVenda: document.getElementById('data-venda').value // <-- NOVA LINHA
            };

            try {
                const response = await fetch(`${API_URL}/vendas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(vendaData)
                });
                if (!response.ok) throw new Error('Falha ao finalizar a venda.');

                alert('Venda finalizada com sucesso!');
                window.location.reload();
            } catch (error) {
                console.error('Erro:', error);
                alert(error.message);
            }
        };

        // ----- Funções Auxiliares e Event Listeners -----
        function selecionarCliente(cliente) {
            clienteSelecionadoVenda = cliente;
            document.getElementById('cliente-selecionado-info').innerHTML = `<strong>Cliente Selecionado:</strong> ${cliente.nome}`;
            document.getElementById('resultado-busca-cliente').innerHTML = '';
            buscaClienteInput.value = '';
        }

        function adicionarProdutoAoCarrinho() {
            const produtoId = selectProduto.value;
            if (!produtoId) return alert('Selecione um produto.');
            
            const produto = produtosDisponiveis.find(p => p.id == produtoId);
            
            const qtdNoCarrinho = carrinho.filter(p => p.id === produto.id).length;
            if (qtdNoCarrinho >= produto.estoque) {
                return alert('Não há mais estoque disponível para este produto.');
            }
            carrinho.push(produto);
            atualizarCarrinho();
        }

        function atualizarCarrinho() {
            const corpoTabela = document.querySelector('#carrinho-venda tbody');
            corpoTabela.innerHTML = '';
            let total = 0;

            carrinho.forEach((produto, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${produto.nome}</td>
                    <td>R$ ${Number(produto.preco).toFixed(2)}</td>
                    <td><button class="btn btn-danger btn-sm" data-index="${index}">X</button></td>
                `;
                corpoTabela.appendChild(tr);
                total += parseFloat(produto.preco);
            });
            document.querySelector('#total-venda').textContent = `Total: R$ ${total.toFixed(2)}`;
            atualizarParcelas();
        }

        function atualizarParcelas() {
            const opcoesParcelamento = document.getElementById('opcoes-parcelamento');
            const total = carrinho.reduce((acc, p) => acc + p.preco, 0);
            const parcelas = parseInt(numeroParcelasInput.value) || 1;
            
            if (formaPagamentoSelect.value === 'credito' || formaPagamentoSelect.value === 'crediario') {
                opcoesParcelamento.style.display = 'block';
                const valorParcela = total > 0 ? (total / parcelas).toFixed(2) : '0.00';
                document.getElementById('valor-parcela').textContent = `${parcelas}x de R$ ${valorParcela}`;
            } else {
                opcoesParcelamento.style.display = 'none';
            }
        }
        
        function resizeCanvas() {
            const ratio =  Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            signaturePad.clear();
        }

        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();

        document.getElementById('clear-signature').addEventListener('click', () => signaturePad.clear());
        buscaClienteInput.addEventListener('keyup', () => buscarClientesVenda(buscaClienteInput.value));
        btnAddProduto.addEventListener('click', adicionarProdutoAoCarrinho);
        btnFinalizarVenda.addEventListener('click', finalizarVenda);
        formaPagamentoSelect.addEventListener('change', atualizarParcelas);
        numeroParcelasInput.addEventListener('input', atualizarParcelas);

        document.querySelector('#carrinho-venda tbody').addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                carrinho.splice(e.target.dataset.index, 1);
                atualizarCarrinho();
            }
        });
        
        carregarProdutosVenda(); // Carga inicial
    }

    // ===============================================
// CÓDIGO PARA A PÁGINA DE DASHBOARD (index.html) - VERSÃO DINÂMICA
// ===============================================
if (paginaAtual === 'index.html' || paginaAtual === '') {
    
    const seletorMes = document.getElementById('seletorMes');
    const chartCanvas = document.getElementById('previsaoMensalChart');
    let myChart = null; // Variável para guardar a instância do gráfico

    // Função para buscar e desenhar o gráfico para um mês/ano específico
    const renderizarGraficoPrevisao = async (mes, ano) => {
        try {
            const response = await fetch(`${API_URL}/dashboard/previsao-mensal?mes=${mes}&ano=${ano}`);
            if (!response.ok) throw new Error('Falha ao buscar dados da previsão.');
            
            const data = await response.json();
            const totalReceber = parseFloat(data.total);

            // ADICIONE ESTA LINHA PARA O TESTE:
            console.log('O tipo da variável totalReceber é:', typeof totalReceber);

            const ctx = chartCanvas.getContext('2d');
            
            // Se já existe um gráfico, destrua-o antes de desenhar o novo
            if (myChart) {
                myChart.destroy();
            }
            
            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Valor a Receber'],
                    datasets: [{
                        label: `Total: R$ ${totalReceber.toFixed(2)}`,
                        data: [totalReceber],
                        backgroundColor: ['rgba(75, 192, 192, 0.6)'],
                        borderColor: ['rgba(75, 192, 192, 1)'],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: { y: { beginAtZero: true } },
                    plugins: { legend: { display: true, position: 'top' } },
                    responsive: true,
                    maintainAspectRatio: false
                }
            });

        } catch (error) {
            console.error("Erro no gráfico de previsão:", error);
            chartCanvas.parentElement.innerHTML = '<p>Não foi possível carregar o gráfico.</p>';
        }
    };

    // Função para buscar os meses disponíveis e popular o seletor
    const popularSeletorDeMeses = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/meses-disponiveis`);
            if (!response.ok) throw new Error('Falha ao buscar meses.');

            const meses = await response.json();

            if (meses.length === 0) {
                seletorMes.innerHTML = '<option>Nenhuma parcela futura</option>';
                return;
            }

            const formatador = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

            meses.forEach(item => {
                const data = new Date(item.mes);
                const mes = data.getUTCMonth() + 1;
                const ano = data.getUTCFullYear();
                
                const option = document.createElement('option');
                option.value = `${mes}-${ano}`;
                option.textContent = formatador.format(data).replace(/^\w/, c => c.toUpperCase());
                seletorMes.appendChild(option);
            });

            // Dispara o render do gráfico para o primeiro mês da lista
            const [primeiroMes, primeiroAno] = seletorMes.value.split('-');
            renderizarGraficoPrevisao(primeiroMes, primeiroAno);

        } catch (error) {
            console.error("Erro ao popular meses:", error);
            seletorMes.innerHTML = '<option>Erro ao carregar</option>';
        }
    };

    // Adiciona o evento que atualiza o gráfico quando o usuário muda o mês
    seletorMes.addEventListener('change', (e) => {
        const [mes, ano] = e.target.value.split('-');
        renderizarGraficoPrevisao(mes, ano);
    });

    // Função para renderizar a lista de clientes (continua igual)
    const renderizarClientesAtrasados = async () => {
        const container = document.getElementById('listaClientesAtrasados');
        try {
            const response = await fetch(`${API_URL}/dashboard/clientes-atrasados`);
            if (!response.ok) throw new Error('Falha ao buscar clientes em atraso.');
            const clientes = await response.json();
            if (clientes.length === 0) {
                container.innerHTML = '<p>Nenhum cliente com parcelas em atraso. Bom trabalho!</p>';
                return;
            }
            let html = '<ul>';
            clientes.forEach(cliente => {
                html += `<li><strong>${cliente.nome}</strong> - Contato: ${cliente.telefones.join(' / ')}</li>`;
            });
            html += '</ul>';
            container.innerHTML = html;
        } catch (error) {
            console.error("Erro na lista de clientes:", error);
            container.innerHTML = '<p>Não foi possível carregar a lista de clientes.</p>';
        }
    };
    
    // Inicia o carregamento do dashboard
    popularSeletorDeMeses();
    renderizarClientesAtrasados();
}

});

