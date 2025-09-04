
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000; // Porta padrão 3000

// ----- CONFIGURAÇÃO -----
app.use(cors()); // Permite que seu frontend acesse o backend
app.use(express.json({ limit: '5mb' })); // Permite ao servidor receber JSON (e aumenta o limite para a imagem da assinatura)
app.use(express.static('public')); // Serve os arquivos estáticos da pasta 'public'

// ----- CONEXÃO COM O POSTGRESQL -----
// !! IMPORTANTE: Substitua pela sua string de conexão do PostgreSQL !!
// Exemplo: 'postgres://user:password@host:port/database'
const connectionString = process.env.DATABASE_URL;

console.log('>>>> MINHA CONNECTION STRING É:', connectionString); 

const pool = new Pool({
    connectionString: connectionString,
});

// ----- ROTAS DA API -----

// == CLIENTES ==
// Listar todos os clientes (com busca)
app.get('/api/clientes', async (req, res) => {

    // --- ADICIONE ESTAS LINHAS DE DEPURAÇÃO AQUI ---
    console.log("========================================");
    console.log(">>>> DADOS RECEBIDOS DO FRONTEND (CARRINHO):");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("========================================");
    // ---------------------------------------------------
    
    const { q } = req.query; // q = query de busca
    try {
        let query = 'SELECT * FROM clientes ORDER BY nome ASC';
        let params = [];
        if (q) {
            query = 'SELECT * FROM clientes WHERE nome ILIKE $1 OR cpf ILIKE $1 OR escola ILIKE $1 ORDER BY nome ASC';
            params.push(`%${q}%`);
        }
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar clientes.' });
    }
});

// Cadastrar novo cliente
app.post('/api/clientes', async (req, res) => {
    const { nome, cpf, endereco, escola, telefones } = req.body;
    try {
        const query = 'INSERT INTO clientes (nome, cpf, endereco, escola, telefones) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        const { rows } = await pool.query(query, [nome, cpf, endereco, escola, telefones]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
    }
});

// Atualizar cliente
app.put('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, cpf, endereco, escola, telefones } = req.body;
    try {
        const query = 'UPDATE clientes SET nome = $1, cpf = $2, endereco = $3, escola = $4, telefones = $5 WHERE id = $6 RETURNING *';
        const { rows } = await pool.query(query, [nome, cpf, endereco, escola, telefones, id]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar cliente.' });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Encontrar todas as vendas do cliente
        const vendasQuery = 'SELECT id FROM vendas WHERE cliente_id = $1';
        const { rows: vendasDoCliente } = await client.query(vendasQuery, [id]);

        // 2. Para cada venda, fazer o processo completo de exclusão
        for (const venda of vendasDoCliente) {
            // Devolver produtos ao estoque
            const produtosVendidosQuery = 'SELECT produto_id, quantidade FROM vendas_produtos WHERE venda_id = $1';
            const { rows: produtosVendidos } = await client.query(produtosVendidosQuery, [venda.id]);
            for (const produto of produtosVendidos) {
                await client.query('UPDATE produtos SET estoque = estoque + $1 WHERE id = $2', [produto.quantidade, produto.produto_id]);
            }
            // Apagar parcelas, registros de venda e a venda principal (usando o CASCADE do banco de dados)
            await client.query('DELETE FROM vendas WHERE id = $1', [venda.id]);
        }

        // 3. Apagar as observações do cliente
        await client.query('DELETE FROM observacoes WHERE cliente_id = $1', [id]);

        // 4. Finalmente, apagar o cliente, agora que seu histórico está limpo
        await client.query('DELETE FROM clientes WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.status(204).send(); // Sucesso
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao apagar cliente:', err);
        res.status(500).json({ error: 'Erro ao apagar cliente e seu histórico.' });
    } finally {
        client.release();
    }
});

// == PRODUTOS ==
// Listar todos os produtos
app.get('/api/produtos', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM produtos ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar produtos.' });
    }
});

// Cadastrar novo produto
app.post('/api/produtos', async (req, res) => {
    const { nome, preco, marca, estoque } = req.body;
    try {
        const query = 'INSERT INTO produtos (nome, preco, marca, estoque) VALUES ($1, $2, $3, $4) RETURNING *';
        const { rows } = await pool.query(query, [nome, preco, marca, estoque]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cadastrar produto.' });
    }
});

// Atualizar produto
app.put('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, preco, marca, estoque } = req.body;
    try {
        const query = 'UPDATE produtos SET nome = $1, preco = $2, marca = $3, estoque = $4 WHERE id = $5 RETURNING *';
        const { rows } = await pool.query(query, [nome, preco, marca, estoque, id]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar produto.' });
    }
});

// Apagar produto
app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM produtos WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao apagar produto.' });
    }
});

// == VENDAS ==
// ROTA DE VENDAS FINAL E CORRIGIDA
app.post('/api/vendas', async (req, res) => {
    // Agora pegamos apenas os dados essenciais. O 'total' será recalculado no backend.
    const { cliente, produtos, pagamento, parcelas, assinatura, dataVenda } = req.body;
    
    // Verificação de segurança básica
    if (!cliente || !produtos || !produtos.length) {
        return res.status(400).json({ error: "Dados da venda incompletos." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- LÓGICA DE AGRUPAMENTO E CÁLCULO DO TOTAL (CORRIGIDA) ---
        const produtosAgrupados = produtos.reduce((acc, produto) => {
            if (!acc[produto.id]) {
                acc[produto.id] = { ...produto, quantidade: 0 };
            }
            acc[produto.id].quantidade += 1;
            return acc;
        }, {});
        
        // Recalculamos o total no backend para garantir a integridade
        const totalCalculado = Object.values(produtosAgrupados).reduce((acc, produto) => {
            return acc + (parseFloat(produto.preco) * produto.quantidade);
        }, 0);
        // --- FIM DA LÓGICA DE AGRUPAMENTO ---

        let dataBaseParaCalculo;
const agora = new Date(); // Pega o momento exato atual (com hora, minuto, segundo)

if (dataVenda) {
    // Pega apenas a parte da HORA do momento atual. Ex: "17:06:53"
    const horaAtual = agora.toTimeString().split(' ')[0];

    // Junta a DATA selecionada no calendário com a HORA exata de agora
    // Ex: "2025-09-04" + "T" + "17:06:53" -> "2025-09-04T17:06:53"
    dataBaseParaCalculo = new Date(`${dataVenda}T${horaAtual}`);
} else {
    // Se nenhuma data foi escolhida, simplesmente usa o momento exato atual
    dataBaseParaCalculo = agora;
}

        const vendaQuery = 'INSERT INTO vendas (cliente_id, total, pagamento, parcelas, assinatura, data_hora) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        const vendaResult = await client.query(vendaQuery, [cliente.id, totalCalculado, pagamento, parcelas, assinatura, dataBaseParaCalculo]);
        const vendaId = vendaResult.rows[0].id;

        for (const produtoId in produtosAgrupados) {
            const produto = produtosAgrupados[produtoId];
            await client.query(
                'INSERT INTO vendas_produtos (venda_id, produto_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
                [vendaId, produto.id, produto.quantidade, produto.preco]
            );
            await client.query(
                'UPDATE produtos SET estoque = estoque - $1 WHERE id = $2',
                [produto.quantidade, produto.id]
            );
        }
        
        if (pagamento === 'crediario' && parcelas > 0) {
            const valorParcela = totalCalculado / parcelas;
            for (let i = 1; i <= parcelas; i++) {
                const dataVencimento = new Date(dataBaseParaCalculo);
                dataVencimento.setMonth(dataBaseParaCalculo.getMonth() + i);
                await client.query('INSERT INTO parcelas_crediario (venda_id, valor, data_vencimento) VALUES ($1, $2, $3)', [vendaId, valorParcela, dataVencimento]);
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ message: 'Venda finalizada com sucesso!', vendaId: vendaId });

    } catch (err) {
        await client.query('ROLLBACK');
        // Enviamos o erro original do banco de dados no console para depuração
        console.error('ERRO DETALHADO AO FINALIZAR VENDA:', err);
        res.status(500).json({ error: 'Erro interno ao finalizar a venda.' });
    } finally {
        client.release();
    }
});

// == HISTÓRICO E OBSERVAÇÕES ==

// Rota para buscar o histórico completo de um cliente
app.get('/api/clientes/:id/historico', async (req, res) => {
    const { id } = req.params;
    try {
        // Busca as vendas do cliente
        const vendasQuery = `
            SELECT v.*, json_agg(p.*) as produtos
            FROM vendas v
            JOIN vendas_produtos vp ON v.id = vp.venda_id
            JOIN produtos p ON vp.produto_id = p.id
            WHERE v.cliente_id = $1
            GROUP BY v.id
            ORDER BY v.data_hora DESC
        `;
        const vendasResult = await pool.query(vendasQuery, [id]);

        // Busca as parcelas de crediário de cada venda
        for (let venda of vendasResult.rows) {
            if (venda.pagamento === 'crediario') {
                const parcelasResult = await pool.query('SELECT * FROM parcelas_crediario WHERE venda_id = $1 ORDER BY data_vencimento ASC', [venda.id]);
                venda.detalheParcelas = parcelasResult.rows;
            }
        }

        // Busca as observações do cliente
        const observacoesResult = await pool.query('SELECT * FROM observacoes WHERE cliente_id = $1 ORDER BY data_hora DESC', [id]);
        
        res.json({
            vendas: vendasResult.rows,
            observacoes: observacoesResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
});

// Adicionar uma observação
app.post('/api/clientes/:id/observacoes', async (req, res) => {
    const { id } = req.params;
    const { texto } = req.body;
    try {
        const query = 'INSERT INTO observacoes (cliente_id, texto) VALUES ($1, $2) RETURNING *';
        const { rows } = await pool.query(query, [id, texto]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar observação.' });
    }
});

// Dar baixa em uma parcela
app.patch('/api/parcelas/:id/pagar', async (req, res) => {
    const { id } = req.params;
    try {
        const query = "UPDATE parcelas_crediario SET status = 'paga' WHERE id = $1 RETURNING *";
        const { rows } = await pool.query(query, [id]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao dar baixa na parcela.' });
    }
});

// ROTA #1: Retorna uma lista de meses que têm parcelas pendentes
app.get('/api/dashboard/meses-disponiveis', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT date_trunc('month', data_vencimento) AS mes
            FROM parcelas_crediario
            WHERE status = 'pendente'
            ORDER BY mes ASC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar meses disponíveis.' });
    }
});

// ROTA #2: Retorna o total a receber para um mês e ano específicos
app.get('/api/dashboard/previsao-mensal', async (req, res) => {
    const { mes, ano } = req.query; // Recebe mês e ano como parâmetros. Ex: /?mes=9&ano=2025

    if (!mes || !ano) {
        return res.status(400).json({ error: 'Mês e ano são obrigatórios.' });
    }

    try {
        const query = `
            SELECT SUM(valor) as total
            FROM parcelas_crediario
            WHERE status = 'pendente' 
            AND EXTRACT(MONTH FROM data_vencimento) = $1
            AND EXTRACT(YEAR FROM data_vencimento) = $2;
        `;
        const { rows } = await pool.query(query, [mes, ano]);
        const totalReceber = rows[0].total || 0;
        res.json({ total: totalReceber });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar previsão mensal.' });
    }
});

// ROTA PARA DADOS DO DASHBOARD: CLIENTES COM PARCELAS ATRASADAS
app.get('/api/dashboard/clientes-atrasados', async (req, res) => {
    try {
        const query = `
    SELECT DISTINCT c.id, c.nome, c.telefones
    FROM clientes c
    JOIN vendas v ON c.id = v.cliente_id
    JOIN parcelas_crediario p ON v.id = p.venda_id
    WHERE p.status = 'pendente'
    AND p.data_vencimento < date_trunc('day', NOW());
`;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar clientes com parcelas atrasadas.' });
    }
});

// ----- INICIALIZAÇÃO DO SERVIDOR -----
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});